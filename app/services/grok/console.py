"""console.x.ai/v1/responses 适配器

通过 grok.com 的 SSO cookie 调用 console.x.ai，basic 账号即可访问 grok-4.3 /
grok-4.20 系列。本模块负责：

  1. 把 OpenAI Chat Completions 消息转换为 Responses API 的 input 结构
  2. 注入默认的 web_search 工具（与上游 PR 一致）
  3. 调用 /v1/responses 并把 SSE / JSON 响应翻译回 chat.completion 格式
"""

from __future__ import annotations

import time
import uuid
from typing import Any, AsyncGenerator

import orjson
from curl_cffi.requests import AsyncSession

from app.core.config import get_config
from app.core.exceptions import UpstreamException, ValidationException
from app.core.logger import logger


CONSOLE_RESPONSES_URL = "https://console.x.ai/v1/responses"
DEFAULT_TIMEOUT = 120
BROWSER = "chrome136"


# ---------------------------------------------------------------------------
# OpenAI Chat Completions → Console (Responses) 输入转换
# ---------------------------------------------------------------------------

def _flatten_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if isinstance(block, dict) and block.get("type") == "text":
            text = block.get("text") or ""
            if text:
                parts.append(text)
    return "\n".join(parts)


def _convert_content_blocks(content: Any, role: str) -> list[dict[str, Any]]:
    text_type = "output_text" if role == "assistant" else "input_text"

    if isinstance(content, str):
        text = content.strip()
        return [{"type": text_type, "text": text}] if text else []

    if not isinstance(content, list):
        return []

    blocks: list[dict[str, Any]] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        btype = block.get("type")
        if btype == "text":
            text = block.get("text") or ""
            if text.strip():
                blocks.append({"type": text_type, "text": text})
        elif btype == "image_url":
            inner = block.get("image_url") or {}
            if isinstance(inner, str):
                url, detail = inner, "auto"
            else:
                url = inner.get("url") or ""
                detail = inner.get("detail") or "auto"
            if url:
                blocks.append({"type": "input_image", "image_url": url, "detail": detail})
        elif btype in ("input_text", "output_text", "input_image"):
            blocks.append(dict(block))
    return blocks


def build_console_input(messages: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], str]:
    """OpenAI 消息 → (input 数组, instructions 字符串)。"""
    instructions_parts: list[str] = []
    output: list[dict[str, Any]] = []

    for msg in messages:
        role = msg.get("role") or "user"
        content = msg.get("content")
        tool_calls = msg.get("tool_calls")

        if role == "system":
            text = _flatten_text(content) if isinstance(content, list) else (content or "")
            if isinstance(text, str) and text.strip():
                instructions_parts.append(text.strip())
            continue

        if role == "tool":
            call_id = msg.get("tool_call_id") or ""
            text = content if isinstance(content, str) else _flatten_text(content)
            output.append({
                "type": "function_call_output",
                "call_id": call_id,
                "output": text or "",
            })
            continue

        if role == "assistant" and tool_calls:
            for tc in tool_calls:
                if not isinstance(tc, dict):
                    continue
                fn = tc.get("function") or {}
                output.append({
                    "type": "function_call",
                    "call_id": tc.get("id") or fn.get("name") or "",
                    "name": fn.get("name") or "",
                    "arguments": fn.get("arguments") or "{}",
                })
            text = content if isinstance(content, str) else _flatten_text(content)
            if isinstance(text, str) and text.strip():
                output.append({
                    "role": "assistant",
                    "content": [{"type": "output_text", "text": text.strip()}],
                })
            continue

        blocks = _convert_content_blocks(content, role)
        if blocks:
            output.append({"role": role, "content": blocks})

    return output, "\n\n".join(instructions_parts).strip()


# ---------------------------------------------------------------------------
# Tool 转换
# ---------------------------------------------------------------------------

def convert_openai_tools(tools: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    if not tools:
        return []
    out: list[dict[str, Any]] = []
    for t in tools:
        if not isinstance(t, dict):
            continue
        if t.get("type") != "function":
            out.append(dict(t))
            continue
        fn = t.get("function") if isinstance(t.get("function"), dict) else None
        if fn is not None:
            out.append({
                "type": "function",
                "name": fn.get("name") or "",
                "description": fn.get("description") or "",
                "parameters": fn.get("parameters") or {},
            })
        else:
            out.append(dict(t))
    return out


def convert_openai_tool_choice(tool_choice: Any) -> Any:
    if isinstance(tool_choice, str):
        return tool_choice
    if isinstance(tool_choice, dict) and tool_choice.get("type") == "function":
        fn = tool_choice.get("function") if isinstance(tool_choice.get("function"), dict) else None
        if fn:
            return {"type": "function", "name": fn.get("name") or ""}
        return dict(tool_choice)
    return tool_choice


def inject_web_search_tool(tools: list[dict[str, Any]] | None) -> list[dict[str, Any]]:
    existing = list(tools or [])
    for t in existing:
        if isinstance(t, dict) and t.get("type") == "web_search":
            return existing
    existing.append({"type": "web_search"})
    return existing


# ---------------------------------------------------------------------------
# HTTP 调用
# ---------------------------------------------------------------------------

def _build_headers(token: str) -> dict[str, str]:
    token = token[4:] if token.startswith("sso=") else token
    cf = get_config("grok.cf_clearance", "")
    cookie = f"sso={token};cf_clearance={cf}" if cf else f"sso={token}"
    return {
        "Accept": "text/event-stream, application/json",
        "Accept-Language": "zh-CN,zh;q=0.9",
        "Content-Type": "application/json",
        "Origin": "https://console.x.ai",
        "Referer": "https://console.x.ai/",
        "Cookie": cookie,
        "User-Agent": (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
        ),
        "X-Xai-Request-Id": str(uuid.uuid4()),
    }


def _build_payload(
    *,
    console_model: str,
    messages: list[dict[str, Any]],
    stream: bool,
    tools: list[dict[str, Any]] | None,
    tool_choice: Any,
) -> dict[str, Any]:
    input_array, instructions = build_console_input(messages)
    if not input_array and not instructions:
        raise ValidationException(
            message="Message content cannot be empty",
            param="messages",
            code="empty_content",
        )

    console_tools = convert_openai_tools(tools) if tools else None
    console_tool_choice = (
        convert_openai_tool_choice(tool_choice)
        if console_tools and tool_choice is not None else None
    )
    console_tools = inject_web_search_tool(console_tools)

    payload: dict[str, Any] = {
        "model": console_model,
        "input": input_array,
        "tools": console_tools,
    }
    if stream:
        payload["stream"] = True
    if instructions:
        payload["instructions"] = instructions
    if console_tool_choice is not None:
        payload["tool_choice"] = console_tool_choice
    return payload


# ---------------------------------------------------------------------------
# 非流式响应解析
# ---------------------------------------------------------------------------

def _extract_text(response_json: dict[str, Any]) -> str:
    for item in response_json.get("output") or []:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for c in item.get("content") or []:
            if isinstance(c, dict) and c.get("type") == "output_text":
                return c.get("text") or ""
    return ""


def _extract_reasoning(response_json: dict[str, Any]) -> str:
    for item in response_json.get("output") or []:
        if not isinstance(item, dict) or item.get("type") != "reasoning":
            continue
        parts: list[str] = []
        for s in item.get("summary") or []:
            if isinstance(s, dict):
                text = s.get("text") or s.get("content") or ""
                if text:
                    parts.append(text)
            elif isinstance(s, str):
                parts.append(s)
        return "\n".join(parts)
    return ""


def _extract_tool_calls(response_json: dict[str, Any]) -> list[dict[str, Any]]:
    calls: list[dict[str, Any]] = []
    for item in response_json.get("output") or []:
        if not isinstance(item, dict) or item.get("type") != "function_call":
            continue
        calls.append({
            "id": item.get("call_id") or item.get("id") or "",
            "type": "function",
            "function": {
                "name": item.get("name") or "",
                "arguments": item.get("arguments") or "{}",
            },
        })
    return calls


def _extract_usage(response_json: dict[str, Any]) -> dict[str, int]:
    usage = response_json.get("usage") or {}
    prompt = int(usage.get("input_tokens") or 0)
    completion = int(usage.get("output_tokens") or 0)
    reasoning = int(
        (usage.get("output_tokens_details") or {}).get("reasoning_tokens")
        or usage.get("reasoning_tokens") or 0
    )
    return {
        "prompt_tokens": prompt,
        "completion_tokens": completion,
        "total_tokens": int(usage.get("total_tokens") or prompt + completion),
        "completion_tokens_details": {"reasoning_tokens": reasoning},
    }


# ---------------------------------------------------------------------------
# SSE 流式解析
# ---------------------------------------------------------------------------

def _classify_sse_line(line: str) -> tuple[str, str]:
    line = line.strip()
    if not line:
        return "skip", ""
    if line.startswith("event:"):
        return "event", line[6:].strip()
    if line.startswith("data:"):
        return "data", line[5:].strip()
    if line.startswith("{"):
        return "data", line
    return "skip", ""


class _ConsoleStreamAdapter:
    """把 console SSE 翻译为 chat.completion delta 事件序列。"""

    def __init__(self) -> None:
        self._current_event = ""
        self._active_tool_index: dict[str, int] = {}
        self._tool_args_buf: dict[str, list[str]] = {}
        self.tool_calls: list[dict[str, Any]] = []

    def feed_event(self, event_name: str) -> None:
        self._current_event = event_name

    def feed_data(self, data: str) -> dict[str, Any]:
        if not data or data == "[DONE]":
            return {"kind": "done"}
        try:
            obj = orjson.loads(data)
        except (orjson.JSONDecodeError, ValueError, TypeError):
            return {"kind": "skip"}
        if not isinstance(obj, dict):
            return {"kind": "skip"}

        ev = self._current_event or obj.get("type") or ""

        if ev == "response.output_text.delta":
            delta = obj.get("delta") or ""
            return {"kind": "text", "content": delta} if delta else {"kind": "skip"}

        if ev in ("response.reasoning_summary_text.delta", "response.reasoning_summary.delta"):
            delta = obj.get("delta") or ""
            return {"kind": "thinking", "content": delta} if delta else {"kind": "skip"}

        if ev == "response.output_item.added":
            item = obj.get("item") or {}
            if isinstance(item, dict) and item.get("type") == "function_call":
                item_id = item.get("id") or item.get("call_id") or ""
                call_id = item.get("call_id") or item_id
                name = item.get("name") or ""
                idx = len(self.tool_calls)
                self._active_tool_index[item_id] = idx
                self._tool_args_buf[item_id] = []
                self.tool_calls.append({
                    "id": call_id,
                    "type": "function",
                    "function": {"name": name, "arguments": ""},
                })
                return {"kind": "tool_call_start", "index": idx, "call_id": call_id, "name": name}
            return {"kind": "skip"}

        if ev == "response.function_call_arguments.delta":
            item_id = obj.get("item_id") or ""
            delta = obj.get("delta") or ""
            idx = self._active_tool_index.get(item_id)
            if idx is None or not delta:
                return {"kind": "skip"}
            self._tool_args_buf.setdefault(item_id, []).append(delta)
            return {"kind": "tool_call_args", "index": idx, "delta": delta}

        if ev == "response.function_call_arguments.done":
            item_id = obj.get("item_id") or ""
            idx = self._active_tool_index.get(item_id)
            if idx is None:
                return {"kind": "skip"}
            final_args = obj.get("arguments")
            if not isinstance(final_args, str) or not final_args:
                final_args = "".join(self._tool_args_buf.get(item_id, []))
            self.tool_calls[idx]["function"]["arguments"] = final_args
            return {"kind": "tool_call_done", "index": idx}

        if ev in ("response.completed", "response.failed", "response.error", "error"):
            if ev != "response.completed":
                err = obj.get("error") or {}
                msg = err.get("message") if isinstance(err, dict) else str(err)
                return {"kind": "error", "message": str(msg or "Console stream error")}
            return {"kind": "done"}

        return {"kind": "skip"}


# ---------------------------------------------------------------------------
# 主入口
# ---------------------------------------------------------------------------

async def console_chat_completions(
    *,
    token: str,
    console_model: str,
    response_model: str,
    messages: list[dict[str, Any]],
    stream: bool,
    tools: list[dict[str, Any]] | None = None,
    tool_choice: Any = None,
) -> dict | AsyncGenerator[str, None]:
    """通过 console.x.ai 完成一次 chat。

    Returns:
        - stream=False 时返回 OpenAI Chat Completion 字典
        - stream=True 时返回 OpenAI SSE chunk 异步生成器
    """
    payload = _build_payload(
        console_model=console_model,
        messages=messages,
        stream=stream,
        tools=tools,
        tool_choice=tool_choice,
    )
    headers = _build_headers(token)
    timeout = get_config("grok.timeout", DEFAULT_TIMEOUT)
    proxy = get_config("grok.base_proxy_url", "")
    proxies = {"http": proxy, "https": proxy} if proxy else None

    session = AsyncSession(impersonate=BROWSER)
    try:
        response = await session.post(
            CONSOLE_RESPONSES_URL,
            headers=headers,
            data=orjson.dumps(payload),
            timeout=timeout,
            stream=stream,
            proxies=proxies,
        )
    except Exception as exc:
        try:
            await session.close()
        except Exception:
            pass
        raise UpstreamException(
            message=f"Console request failed: {exc}",
            details={"error": str(exc)},
        ) from exc

    if response.status_code != 200:
        try:
            body = (await response.text())[:1000]
        except Exception:
            body = ""
        try:
            await session.close()
        except Exception:
            pass
        logger.error(
            "Console upstream {} for model={}: {}",
            response.status_code, console_model, body,
        )
        raise UpstreamException(
            message=f"Console upstream returned {response.status_code}",
            details={"status": response.status_code, "body": body},
        )

    if stream:
        return _stream_chunks(session, response, response_model)

    try:
        content = await response.text()
        await session.close()
    except Exception:
        try:
            await session.close()
        except Exception:
            pass
        raise

    try:
        data = orjson.loads(content)
    except Exception as exc:
        raise UpstreamException(
            message="Console response is not valid JSON",
            details={"body": content[:400], "error": str(exc)},
        ) from exc

    return _build_chat_completion(response_model, data)


def _make_chat_id() -> str:
    return f"chatcmpl-{uuid.uuid4().hex[:24]}"


def _build_chat_completion(model: str, data: dict[str, Any]) -> dict[str, Any]:
    text = _extract_text(data)
    reasoning = _extract_reasoning(data)
    tool_calls = _extract_tool_calls(data)
    usage = _extract_usage(data)

    message: dict[str, Any] = {"role": "assistant"}
    if tool_calls:
        message["content"] = None
        message["tool_calls"] = tool_calls
        finish_reason = "tool_calls"
    else:
        message["content"] = text
        if reasoning:
            message["reasoning_content"] = reasoning
        finish_reason = "stop"

    return {
        "id": _make_chat_id(),
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "message": message, "finish_reason": finish_reason}],
        "usage": usage,
    }


def _chunk(response_id: str, model: str, delta: dict[str, Any], finish_reason: str | None = None) -> str:
    payload = {
        "id": response_id,
        "object": "chat.completion.chunk",
        "created": int(time.time()),
        "model": model,
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }
    return f"data: {orjson.dumps(payload).decode()}\n\n"


async def _stream_chunks(session: AsyncSession, response, model: str) -> AsyncGenerator[str, None]:
    response_id = _make_chat_id()
    adapter = _ConsoleStreamAdapter()
    role_sent = False
    saw_tool_calls = False
    try:
        async for raw_line in response.aiter_lines():
            line = raw_line.decode("utf-8", "replace") if isinstance(raw_line, bytes) else raw_line
            kind, payload = _classify_sse_line(line)
            if kind == "event":
                adapter.feed_event(payload)
                continue
            if kind != "data":
                continue

            event = adapter.feed_data(payload)
            ek = event["kind"]
            if ek == "skip":
                continue
            if ek == "done":
                break
            if ek == "error":
                logger.warning("Console stream error: {}", event.get("message"))
                break

            if not role_sent:
                role_sent = True
                yield _chunk(response_id, model, {"role": "assistant", "content": ""})

            if ek == "text":
                yield _chunk(response_id, model, {"content": event["content"]})
            elif ek == "thinking":
                yield _chunk(response_id, model, {"reasoning_content": event["content"]})
            elif ek == "tool_call_start":
                saw_tool_calls = True
                yield _chunk(response_id, model, {
                    "tool_calls": [{
                        "index": event["index"],
                        "id": event["call_id"],
                        "type": "function",
                        "function": {"name": event["name"], "arguments": ""},
                    }]
                })
            elif ek == "tool_call_args":
                yield _chunk(response_id, model, {
                    "tool_calls": [{
                        "index": event["index"],
                        "function": {"arguments": event["delta"]},
                    }]
                })

        finish = "tool_calls" if saw_tool_calls else "stop"
        yield _chunk(response_id, model, {}, finish)
        yield "data: [DONE]\n\n"
    finally:
        try:
            await session.close()
        except Exception:
            pass


__all__ = ["console_chat_completions"]

/**
 * console.x.ai/v1/responses 适配器（Workers 版）
 *
 * 通过 grok.com 的 SSO cookie 调用 console.x.ai，basic 池即可访问 grok-4.3 /
 * grok-4.20 系列。负责：
 *   1. OpenAI Chat Completions → Responses API input 转换
 *   2. 注入默认 web_search 工具
 *   3. 调用 /v1/responses 并把 SSE/JSON 翻译回 chat.completion
 */

import type { GrokSettings } from "../settings";

const CONSOLE_RESPONSES_URL = "https://console.x.ai/v1/responses";
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Json = Record<string, any>;

interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

// ---------------------------------------------------------------------------
// 消息转换
// ---------------------------------------------------------------------------

function flattenText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const block of content) {
    if (block && typeof block === "object" && (block as Json).type === "text") {
      const t = (block as Json).text;
      if (typeof t === "string" && t) parts.push(t);
    }
  }
  return parts.join("\n");
}

function convertContentBlocks(content: unknown, role: string): Json[] {
  const textType = role === "assistant" ? "output_text" : "input_text";

  if (typeof content === "string") {
    const t = content.trim();
    return t ? [{ type: textType, text: t }] : [];
  }
  if (!Array.isArray(content)) return [];

  const blocks: Json[] = [];
  for (const raw of content) {
    if (!raw || typeof raw !== "object") continue;
    const block = raw as Json;
    const btype = block.type;
    if (btype === "text") {
      const t = typeof block.text === "string" ? block.text : "";
      if (t.trim()) blocks.push({ type: textType, text: t });
    } else if (btype === "image_url") {
      const inner = block.image_url;
      let url = "";
      let detail = "auto";
      if (typeof inner === "string") {
        url = inner;
      } else if (inner && typeof inner === "object") {
        url = String((inner as Json).url ?? "");
        detail = String((inner as Json).detail ?? "auto");
      }
      if (url) blocks.push({ type: "input_image", image_url: url, detail });
    } else if (btype === "input_text" || btype === "output_text" || btype === "input_image") {
      blocks.push({ ...block });
    }
  }
  return blocks;
}

export function buildConsoleInput(messages: Json[]): { input: Json[]; instructions: string } {
  const instructionsParts: string[] = [];
  const output: Json[] = [];

  for (const msg of messages) {
    const role = (msg.role as string) || "user";
    const content = msg.content;
    const toolCalls = msg.tool_calls as Json[] | undefined;

    if (role === "system") {
      const text = Array.isArray(content) ? flattenText(content) : (content as string) ?? "";
      if (typeof text === "string" && text.trim()) instructionsParts.push(text.trim());
      continue;
    }

    if (role === "tool") {
      const callId = String(msg.tool_call_id ?? "");
      const text = typeof content === "string" ? content : flattenText(content);
      output.push({ type: "function_call_output", call_id: callId, output: text || "" });
      continue;
    }

    if (role === "assistant" && Array.isArray(toolCalls) && toolCalls.length) {
      for (const tc of toolCalls) {
        if (!tc || typeof tc !== "object") continue;
        const fn = (tc.function as Json) ?? {};
        output.push({
          type: "function_call",
          call_id: String(tc.id ?? fn.name ?? ""),
          name: String(fn.name ?? ""),
          arguments: String(fn.arguments ?? "{}"),
        });
      }
      const text = typeof content === "string" ? content : flattenText(content);
      if (typeof text === "string" && text.trim()) {
        output.push({
          role: "assistant",
          content: [{ type: "output_text", text: text.trim() }],
        });
      }
      continue;
    }

    const blocks = convertContentBlocks(content, role);
    if (blocks.length) output.push({ role, content: blocks });
  }

  return { input: output, instructions: instructionsParts.join("\n\n").trim() };
}

// ---------------------------------------------------------------------------
// Tool 转换
// ---------------------------------------------------------------------------

export function convertOpenAiTools(tools: Json[] | undefined): Json[] {
  if (!Array.isArray(tools) || !tools.length) return [];
  const out: Json[] = [];
  for (const t of tools) {
    if (!t || typeof t !== "object") continue;
    if (t.type !== "function") {
      out.push({ ...t });
      continue;
    }
    const fn = (t.function && typeof t.function === "object") ? (t.function as Json) : null;
    if (fn) {
      out.push({
        type: "function",
        name: String(fn.name ?? ""),
        description: String(fn.description ?? ""),
        parameters: fn.parameters ?? {},
      });
    } else {
      out.push({ ...t });
    }
  }
  return out;
}

export function convertOpenAiToolChoice(toolChoice: unknown): unknown {
  if (typeof toolChoice === "string") return toolChoice;
  if (toolChoice && typeof toolChoice === "object" && (toolChoice as Json).type === "function") {
    const fn = (toolChoice as Json).function;
    if (fn && typeof fn === "object") {
      return { type: "function", name: String((fn as Json).name ?? "") };
    }
    return { ...(toolChoice as Json) };
  }
  return toolChoice;
}

export function injectWebSearchTool(tools: Json[] | undefined): Json[] {
  const existing = Array.isArray(tools) ? [...tools] : [];
  for (const t of existing) {
    if (t && typeof t === "object" && t.type === "web_search") return existing;
  }
  existing.push({ type: "web_search" });
  return existing;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function buildHeaders(token: string, cfClearanceValue: string): Record<string, string> {
  const sso = token.startsWith("sso=") ? token.slice(4) : token;
  const cfValue = cfClearanceValue.trim();
  const cookie = cfValue ? `sso=${sso};cf_clearance=${cfValue}` : `sso=${sso}`;
  return {
    Accept: "text/event-stream, application/json",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Content-Type": "application/json",
    Origin: "https://console.x.ai",
    Referer: "https://console.x.ai/",
    Cookie: cookie,
    "User-Agent": USER_AGENT,
    "X-Xai-Request-Id": crypto.randomUUID(),
  };
}

function buildPayload(args: {
  consoleModel: string;
  messages: Json[];
  stream: boolean;
  tools?: Json[];
  toolChoice?: unknown;
}): Json {
  const { input, instructions } = buildConsoleInput(args.messages);
  if (!input.length && !instructions) {
    throw new ConsoleError("Message content cannot be empty", 400, "empty_content");
  }

  let consoleTools = args.tools && args.tools.length ? convertOpenAiTools(args.tools) : [];
  const consoleToolChoice =
    consoleTools.length && args.toolChoice !== undefined && args.toolChoice !== null
      ? convertOpenAiToolChoice(args.toolChoice)
      : null;
  consoleTools = injectWebSearchTool(consoleTools);

  const payload: Json = {
    model: args.consoleModel,
    input,
    tools: consoleTools,
  };
  if (args.stream) payload.stream = true;
  if (instructions) payload.instructions = instructions;
  if (consoleToolChoice !== null) payload.tool_choice = consoleToolChoice;
  return payload;
}

// ---------------------------------------------------------------------------
// 错误
// ---------------------------------------------------------------------------

export class ConsoleError extends Error {
  status: number;
  code: string;
  body: string;
  constructor(message: string, status: number, code: string, body: string = "") {
    super(message);
    this.status = status;
    this.code = code;
    this.body = body;
  }
}

// ---------------------------------------------------------------------------
// 非流式响应解析
// ---------------------------------------------------------------------------

function extractText(data: Json): string {
  for (const item of (data.output as Json[]) ?? []) {
    if (!item || typeof item !== "object" || item.type !== "message") continue;
    for (const c of (item.content as Json[]) ?? []) {
      if (c && typeof c === "object" && c.type === "output_text") return String(c.text ?? "");
    }
  }
  return "";
}

function extractReasoning(data: Json): string {
  for (const item of (data.output as Json[]) ?? []) {
    if (!item || typeof item !== "object" || item.type !== "reasoning") continue;
    const parts: string[] = [];
    for (const s of (item.summary as Json[]) ?? []) {
      if (s && typeof s === "object") {
        const text = String((s as Json).text ?? (s as Json).content ?? "");
        if (text) parts.push(text);
      } else if (typeof s === "string") {
        parts.push(s);
      }
    }
    return parts.join("\n");
  }
  return "";
}

function extractToolCalls(data: Json): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const item of (data.output as Json[]) ?? []) {
    if (!item || typeof item !== "object" || item.type !== "function_call") continue;
    calls.push({
      id: String(item.call_id ?? item.id ?? ""),
      type: "function",
      function: {
        name: String(item.name ?? ""),
        arguments: String(item.arguments ?? "{}"),
      },
    });
  }
  return calls;
}

function extractUsage(data: Json): Json {
  const usage = (data.usage as Json) ?? {};
  const prompt = Number(usage.input_tokens ?? 0) | 0;
  const completion = Number(usage.output_tokens ?? 0) | 0;
  const detailReasoning =
    Number((usage.output_tokens_details as Json)?.reasoning_tokens ?? usage.reasoning_tokens ?? 0) | 0;
  return {
    prompt_tokens: prompt,
    completion_tokens: completion,
    total_tokens: Number(usage.total_tokens ?? prompt + completion) | 0,
    completion_tokens_details: { reasoning_tokens: detailReasoning },
  };
}

function makeChatId(): string {
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `chatcmpl-${uuid.slice(0, 24)}`;
}

function buildChatCompletion(model: string, data: Json): Json {
  const text = extractText(data);
  const reasoning = extractReasoning(data);
  const toolCalls = extractToolCalls(data);
  const usage = extractUsage(data);

  const message: Json = { role: "assistant" };
  let finishReason: string;
  if (toolCalls.length) {
    message.content = null;
    message.tool_calls = toolCalls;
    finishReason = "tool_calls";
  } else {
    message.content = text;
    if (reasoning) message.reasoning_content = reasoning;
    finishReason = "stop";
  }

  return {
    id: makeChatId(),
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message, finish_reason: finishReason }],
    usage,
  };
}

// ---------------------------------------------------------------------------
// SSE 流式解析
// ---------------------------------------------------------------------------

function classifySseLine(line: string): { kind: "skip" | "event" | "data"; payload: string } {
  const trimmed = line.trim();
  if (!trimmed) return { kind: "skip", payload: "" };
  if (trimmed.startsWith("event:")) return { kind: "event", payload: trimmed.slice(6).trim() };
  if (trimmed.startsWith("data:")) return { kind: "data", payload: trimmed.slice(5).trim() };
  if (trimmed.startsWith("{")) return { kind: "data", payload: trimmed };
  return { kind: "skip", payload: "" };
}

type StreamEvent =
  | { kind: "skip" }
  | { kind: "done" }
  | { kind: "error"; message: string }
  | { kind: "text"; content: string }
  | { kind: "thinking"; content: string }
  | { kind: "tool_call_start"; index: number; call_id: string; name: string }
  | { kind: "tool_call_args"; index: number; delta: string }
  | { kind: "tool_call_done"; index: number };

class ConsoleStreamAdapter {
  private currentEvent = "";
  private activeToolIndex = new Map<string, number>();
  private toolArgsBuf = new Map<string, string[]>();
  tool_calls: ToolCall[] = [];

  feedEvent(name: string): void {
    this.currentEvent = name;
  }

  feedData(data: string): StreamEvent {
    if (!data || data === "[DONE]") return { kind: "done" };
    let obj: Json;
    try {
      obj = JSON.parse(data);
    } catch {
      return { kind: "skip" };
    }
    if (!obj || typeof obj !== "object") return { kind: "skip" };

    const ev = this.currentEvent || String((obj as Json).type ?? "");

    if (ev === "response.output_text.delta") {
      const delta = String(obj.delta ?? "");
      return delta ? { kind: "text", content: delta } : { kind: "skip" };
    }
    if (ev === "response.reasoning_summary_text.delta" || ev === "response.reasoning_summary.delta") {
      const delta = String(obj.delta ?? "");
      return delta ? { kind: "thinking", content: delta } : { kind: "skip" };
    }

    if (ev === "response.output_item.added") {
      const item = (obj.item as Json) ?? {};
      if (item && item.type === "function_call") {
        const itemId = String(item.id ?? item.call_id ?? "");
        const callId = String(item.call_id ?? itemId);
        const name = String(item.name ?? "");
        const idx = this.tool_calls.length;
        this.activeToolIndex.set(itemId, idx);
        this.toolArgsBuf.set(itemId, []);
        this.tool_calls.push({
          id: callId,
          type: "function",
          function: { name, arguments: "" },
        });
        return { kind: "tool_call_start", index: idx, call_id: callId, name };
      }
      return { kind: "skip" };
    }

    if (ev === "response.function_call_arguments.delta") {
      const itemId = String(obj.item_id ?? "");
      const delta = String(obj.delta ?? "");
      const idx = this.activeToolIndex.get(itemId);
      if (idx === undefined || !delta) return { kind: "skip" };
      this.toolArgsBuf.get(itemId)!.push(delta);
      return { kind: "tool_call_args", index: idx, delta };
    }

    if (ev === "response.function_call_arguments.done") {
      const itemId = String(obj.item_id ?? "");
      const idx = this.activeToolIndex.get(itemId);
      if (idx === undefined) return { kind: "skip" };
      let finalArgs = obj.arguments;
      if (typeof finalArgs !== "string" || !finalArgs) {
        finalArgs = (this.toolArgsBuf.get(itemId) ?? []).join("");
      }
      this.tool_calls[idx]!.function.arguments = finalArgs as string;
      return { kind: "tool_call_done", index: idx };
    }

    if (ev === "response.completed" || ev === "response.failed" || ev === "response.error" || ev === "error") {
      if (ev !== "response.completed") {
        const err = (obj.error as Json) ?? {};
        const msg =
          typeof err === "object" && err ? String((err as Json).message ?? "") : String(err);
        return { kind: "error", message: msg || "Console stream error" };
      }
      return { kind: "done" };
    }

    return { kind: "skip" };
  }
}

function chunkLine(responseId: string, model: string, delta: Json, finishReason: string | null = null): string {
  const payload = {
    id: responseId,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, delta, finish_reason: finishReason }],
  };
  return `data: ${JSON.stringify(payload)}\n\n`;
}

// ---------------------------------------------------------------------------
// 主入口
// ---------------------------------------------------------------------------

export interface ConsoleChatArgs {
  token: string;
  consoleModel: string;
  responseModel: string;
  messages: Json[];
  stream: boolean;
  tools?: Json[];
  toolChoice?: unknown;
  cfClearance?: string;
}

/**
 * 非流式：返回 OpenAI chat.completion 对象
 * 流式：返回 ReadableStream<Uint8Array>，已是 OpenAI SSE 字节流
 */
export async function consoleChatCompletions(
  args: ConsoleChatArgs,
): Promise<Json | ReadableStream<Uint8Array>> {
  const payload = buildPayload({
    consoleModel: args.consoleModel,
    messages: args.messages,
    stream: args.stream,
    ...(args.tools ? { tools: args.tools } : {}),
    ...(args.toolChoice !== undefined ? { toolChoice: args.toolChoice } : {}),
  });
  const headers = buildHeaders(args.token, args.cfClearance ?? "");

  let response: Response;
  try {
    response = await fetch(CONSOLE_RESPONSES_URL, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });
  } catch (exc) {
    const msg = exc instanceof Error ? exc.message : String(exc);
    throw new ConsoleError(`Console request failed: ${msg}`, 502, "upstream_error", msg);
  }

  if (response.status !== 200) {
    let body = "";
    try {
      body = (await response.text()).slice(0, 1000);
    } catch {
      // ignore
    }
    throw new ConsoleError(
      `Console upstream returned ${response.status}`,
      response.status,
      "upstream_error",
      body,
    );
  }

  if (!args.stream) {
    const text = await response.text();
    let data: Json;
    try {
      data = JSON.parse(text);
    } catch (exc) {
      throw new ConsoleError(
        "Console response is not valid JSON",
        502,
        "invalid_json",
        text.slice(0, 400),
      );
    }
    return buildChatCompletion(args.responseModel, data);
  }

  if (!response.body) {
    throw new ConsoleError("Console response has no stream body", 502, "no_stream_body");
  }

  return translateSseToChatStream(response.body, args.responseModel);
}

function translateSseToChatStream(upstream: ReadableStream<Uint8Array>, model: string): ReadableStream<Uint8Array> {
  const responseId = makeChatId();
  const adapter = new ConsoleStreamAdapter();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let roleSent = false;
  let sawToolCalls = false;
  let buffer = "";
  let finished = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const ensureRole = () => {
        if (!roleSent) {
          roleSent = true;
          controller.enqueue(encoder.encode(chunkLine(responseId, model, { role: "assistant", content: "" })));
        }
      };

      const handleEvent = (event: StreamEvent): boolean => {
        if (event.kind === "skip") return false;
        if (event.kind === "done") return true;
        if (event.kind === "error") return true;

        ensureRole();
        if (event.kind === "text") {
          controller.enqueue(encoder.encode(chunkLine(responseId, model, { content: event.content })));
        } else if (event.kind === "thinking") {
          controller.enqueue(encoder.encode(chunkLine(responseId, model, { reasoning_content: event.content })));
        } else if (event.kind === "tool_call_start") {
          sawToolCalls = true;
          controller.enqueue(
            encoder.encode(
              chunkLine(responseId, model, {
                tool_calls: [
                  {
                    index: event.index,
                    id: event.call_id,
                    type: "function",
                    function: { name: event.name, arguments: "" },
                  },
                ],
              }),
            ),
          );
        } else if (event.kind === "tool_call_args") {
          controller.enqueue(
            encoder.encode(
              chunkLine(responseId, model, {
                tool_calls: [
                  {
                    index: event.index,
                    function: { arguments: event.delta },
                  },
                ],
              }),
            ),
          );
        }
        return false;
      };

      const flushBuffer = (final: boolean): boolean => {
        let done = false;
        while (true) {
          const idx = buffer.indexOf("\n");
          if (idx < 0) break;
          const line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          const classified = classifySseLine(line);
          if (classified.kind === "event") {
            adapter.feedEvent(classified.payload);
            continue;
          }
          if (classified.kind !== "data") continue;
          const event = adapter.feedData(classified.payload);
          if (handleEvent(event)) {
            done = true;
            break;
          }
        }
        if (final && buffer.trim()) {
          const classified = classifySseLine(buffer);
          buffer = "";
          if (classified.kind === "data") {
            const event = adapter.feedData(classified.payload);
            if (handleEvent(event)) done = true;
          }
        }
        return done;
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (flushBuffer(false)) {
            finished = true;
            break;
          }
        }
        if (!finished) {
          buffer += decoder.decode();
          flushBuffer(true);
        }
        ensureRole();
        const finish = sawToolCalls ? "tool_calls" : "stop";
        controller.enqueue(encoder.encode(chunkLine(responseId, model, {}, finish)));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        controller.error(err);
      } finally {
        try {
          reader.releaseLock();
        } catch {
          // ignore
        }
      }
    },
  });
}

// Convenience wrapper used by routes
export function buildConsoleArgs(opts: {
  token: string;
  consoleModel: string;
  responseModel: string;
  messages: Json[];
  stream: boolean;
  tools?: Json[];
  toolChoice?: unknown;
  settings: GrokSettings;
}): ConsoleChatArgs {
  return {
    token: opts.token,
    consoleModel: opts.consoleModel,
    responseModel: opts.responseModel,
    messages: opts.messages,
    stream: opts.stream,
    ...(opts.tools ? { tools: opts.tools } : {}),
    ...(opts.toolChoice !== undefined ? { toolChoice: opts.toolChoice } : {}),
    cfClearance: opts.settings.cf_clearance ?? "",
  };
}

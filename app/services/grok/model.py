"""
Grok 模型管理服务
"""

from __future__ import annotations

from enum import Enum
from typing import Optional, Tuple
from pydantic import BaseModel, Field

from app.core.exceptions import ValidationException


class Tier(str, Enum):
    """模型档位"""
    BASIC = "basic"
    SUPER = "super"


class Cost(str, Enum):
    """计费类型"""
    LOW = "low"
    HIGH = "high"


class ModelInfo(BaseModel):
    """模型信息"""
    model_id: str
    grok_model: str
    rate_limit_model: str
    model_mode: str
    tier: Tier = Field(default=Tier.BASIC)
    cost: Cost = Field(default=Cost.LOW)
    display_name: str
    description: str = ""
    is_video: bool = False
    is_image: bool = False
    # 非空时通过 console.x.ai/v1/responses 调用，值为发送给 console 的 model id
    console_model: str = ""

    def is_console(self) -> bool:
        return bool(self.console_model)


class ModelService:
    """模型管理服务"""
    
    MODELS = [
        ModelInfo(
            model_id="grok-3",
            grok_model="grok-3",
            rate_limit_model="grok-3",
            model_mode="MODEL_MODE_GROK_3",
            cost=Cost.LOW,
            display_name="Grok 3"
        ),
        ModelInfo(
            model_id="grok-3-mini",
            grok_model="grok-3",
            rate_limit_model="grok-3",
            model_mode="MODEL_MODE_GROK_3_MINI_THINKING",
            cost=Cost.LOW,
            display_name="Grok 3 Mini"
        ),
        ModelInfo(
            model_id="grok-3-thinking",
            grok_model="grok-3",
            rate_limit_model="grok-3",
            model_mode="MODEL_MODE_GROK_3_THINKING",
            cost=Cost.LOW,
            display_name="Grok 3 Thinking"
        ),
        ModelInfo(
            model_id="grok-4",
            grok_model="grok-4",
            rate_limit_model="grok-4",
            model_mode="MODEL_MODE_GROK_4",
            cost=Cost.LOW,
            display_name="Grok 4"
        ),
        ModelInfo(
            model_id="grok-4-mini",
            grok_model="grok-4-mini",
            rate_limit_model="grok-4-mini",
            model_mode="MODEL_MODE_GROK_4_MINI_THINKING",
            cost=Cost.LOW,
            display_name="Grok 4 Mini"
        ),
        ModelInfo(
            model_id="grok-4-thinking",
            grok_model="grok-4",
            rate_limit_model="grok-4",
            model_mode="MODEL_MODE_GROK_4_THINKING",
            cost=Cost.LOW,
            display_name="Grok 4 Thinking"
        ),
        ModelInfo(
            model_id="grok-4-heavy",
            grok_model="grok-4",
            rate_limit_model="grok-4-heavy",
            model_mode="MODEL_MODE_HEAVY",
            cost=Cost.HIGH,
            tier=Tier.SUPER,
            display_name="Grok 4 Heavy"
        ),
        ModelInfo(
            model_id="grok-4.1-mini",
            grok_model="grok-4-1-thinking-1129",
            rate_limit_model="grok-4-1-thinking-1129",
            model_mode="MODEL_MODE_GROK_4_1_MINI_THINKING",
            cost=Cost.LOW,
            display_name="Grok 4.1 Mini"
        ),
        ModelInfo(
            model_id="grok-4.1-fast",
            grok_model="grok-4-1-thinking-1129",
            rate_limit_model="grok-4-1-thinking-1129",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.LOW,
            display_name="Grok 4.1 Fast"
        ),
        ModelInfo(
            model_id="grok-4.1-expert",
            grok_model="grok-4-1-thinking-1129",
            rate_limit_model="grok-4-1-thinking-1129",
            model_mode="MODEL_MODE_EXPERT",
            cost=Cost.HIGH,
            display_name="Grok 4.1 Expert"
        ),
        ModelInfo(
            model_id="grok-4.1-thinking",
            grok_model="grok-4-1-thinking-1129",
            rate_limit_model="grok-4-1-thinking-1129",
            model_mode="MODEL_MODE_GROK_4_1_THINKING",
            cost=Cost.HIGH, 
            display_name="Grok 4.1 Thinking"
        ),
        ModelInfo(
            model_id="grok-4.20-beta",
            grok_model="grok-420",
            rate_limit_model="grok-420",
            model_mode="MODEL_MODE_GROK_420",
            cost=Cost.LOW,
            display_name="Grok 4.20 Beta"
        ),
        # === Console API (console.x.ai/v1/responses) ===
        # 通过 grok.com 的 SSO cookie 直接调用 console.x.ai，basic 池即可使用
        # 速率限制由 console.x.ai 控制（免费 tier: 1 rps / 60 RPM）
        ModelInfo(
            model_id="grok-4.3",
            grok_model="grok-4.3",
            rate_limit_model="grok-4",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.LOW,
            display_name="Grok 4.3 (Console)",
            console_model="grok-4.3",
        ),
        ModelInfo(
            model_id="grok-4-console",
            grok_model="grok-4",
            rate_limit_model="grok-4",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.LOW,
            display_name="Grok 4 (Console)",
            console_model="grok-4",
        ),
        ModelInfo(
            model_id="grok-4.20",
            grok_model="grok-4.20",
            rate_limit_model="grok-4",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.LOW,
            display_name="Grok 4.20 (Console)",
            console_model="grok-4.20",
        ),
        ModelInfo(
            model_id="grok-4.20-reasoning",
            grok_model="grok-4.20-0309-reasoning",
            rate_limit_model="grok-4",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.LOW,
            display_name="Grok 4.20 Reasoning (Console)",
            console_model="grok-4.20-0309-reasoning",
        ),
        ModelInfo(
            model_id="grok-4.20-non-reasoning",
            grok_model="grok-4.20-0309-non-reasoning",
            rate_limit_model="grok-4",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.LOW,
            display_name="Grok 4.20 Non-Reasoning (Console)",
            console_model="grok-4.20-0309-non-reasoning",
        ),
        ModelInfo(
            model_id="grok-4.20-multi-agent",
            grok_model="grok-4.20-multi-agent-0309",
            rate_limit_model="grok-4",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.LOW,
            display_name="Grok 4.20 Multi-Agent (Console)",
            console_model="grok-4.20-multi-agent-0309",
        ),
        ModelInfo(
            model_id="grok-imagine-1.0",
            grok_model="grok-3",
            rate_limit_model="grok-3",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.HIGH,
            display_name="Grok Image",
            description="Image generation model",
            is_image=True
        ),
        ModelInfo(
            model_id="grok-imagine-1.0-edit",
            grok_model="imagine-image-edit",
            rate_limit_model="grok-3",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.HIGH,
            display_name="Grok Image Edit",
            description="Image edit model",
            is_image=True
        ),
        ModelInfo(
            model_id="grok-imagine-1.0-video",
            grok_model="grok-3",
            rate_limit_model="grok-3",
            model_mode="MODEL_MODE_FAST",
            cost=Cost.HIGH,
            display_name="Grok Video",
            description="Video generation model",
            is_video=True
        ),
    ]
    
    _map = {m.model_id: m for m in MODELS}
    
    @classmethod
    def get(cls, model_id: str) -> Optional[ModelInfo]:
        """获取模型信息"""
        return cls._map.get(model_id)
    
    @classmethod
    def list(cls) -> list[ModelInfo]:
        """获取所有模型"""
        return list(cls._map.values())
    
    @classmethod
    def valid(cls, model_id: str) -> bool:
        """模型是否有效"""
        return model_id in cls._map

    @classmethod
    def to_grok(cls, model_id: str) -> Tuple[str, str]:
        """转换为 Grok 参数"""
        model = cls.get(model_id)
        if not model:
            raise ValidationException(f"Invalid model ID: {model_id}")
        return model.grok_model, model.model_mode

    @classmethod
    def rate_limit_model_for(cls, model_id: str) -> str:
        """用于 /rest/rate-limits 的 modelName 映射。"""
        model = cls.get(model_id)
        return model.rate_limit_model if model else model_id

    @classmethod
    def is_heavy_bucket_model(cls, model_id: str) -> bool:
        """是否使用 heavy 配额桶（目前仅 grok-4-heavy）。"""
        return model_id == "grok-4-heavy"

    @classmethod
    def pool_for_model(cls, model_id: str) -> str:
        """根据模型选择 Token 池"""
        model = cls.get(model_id)
        if model and model.tier == Tier.SUPER:
            return "ssoSuper"
        return "ssoBasic"

    @classmethod
    def pool_candidates_for_model(cls, model_id: str) -> list[str]:
        """按优先级返回可用 Token 池列表。"""
        model = cls.get(model_id)
        if model and model.tier == Tier.SUPER:
            return ["ssoSuper"]
        return ["ssoBasic", "ssoSuper"]


__all__ = ["ModelService"]

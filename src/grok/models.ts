export interface ModelInfo {
  grok_model: [string, string];
  rate_limit_model: string;
  display_name: string;
  description: string;
  raw_model_path: string;
  default_temperature: number;
  default_max_output_tokens: number;
  supported_max_output_tokens: number;
  default_top_p: number;
  is_image_model?: boolean;
  is_video_model?: boolean;
  // 非空时通过 console.x.ai/v1/responses 调用，值为发送给 console 的 model id
  console_model?: string;
}

export const MODEL_CONFIG: Record<string, ModelInfo> = {
  "grok-3": {
    grok_model: ["grok-3", "MODEL_MODE_GROK_3"],
    rate_limit_model: "grok-3",
    display_name: "Grok 3",
    description: "Grok 3 chat model",
    raw_model_path: "xai/grok-3",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-3-mini": {
    grok_model: ["grok-3", "MODEL_MODE_GROK_3_MINI_THINKING"],
    rate_limit_model: "grok-3",
    display_name: "Grok 3 Mini",
    description: "Grok 3 mini model",
    raw_model_path: "xai/grok-3",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-3-thinking": {
    grok_model: ["grok-3", "MODEL_MODE_GROK_3_THINKING"],
    rate_limit_model: "grok-3",
    display_name: "Grok 3 Thinking",
    description: "Grok 3 thinking model",
    raw_model_path: "xai/grok-3",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4": {
    grok_model: ["grok-4", "MODEL_MODE_GROK_4"],
    rate_limit_model: "grok-4",
    display_name: "Grok 4",
    description: "Grok 4 chat model",
    raw_model_path: "xai/grok-4",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4-mini": {
    grok_model: ["grok-4-mini", "MODEL_MODE_GROK_4_MINI_THINKING"],
    rate_limit_model: "grok-4-mini",
    display_name: "Grok 4 Mini",
    description: "Grok 4 mini thinking model",
    raw_model_path: "xai/grok-4-mini",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4-thinking": {
    grok_model: ["grok-4", "MODEL_MODE_GROK_4_THINKING"],
    rate_limit_model: "grok-4",
    display_name: "Grok 4 Thinking",
    description: "Grok 4 thinking model",
    raw_model_path: "xai/grok-4",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4-heavy": {
    grok_model: ["grok-4", "MODEL_MODE_HEAVY"],
    rate_limit_model: "grok-4-heavy",
    display_name: "Grok 4 Heavy",
    description: "Most powerful Grok model (Super tokens required)",
    raw_model_path: "xai/grok-4",
    default_temperature: 1.0,
    default_max_output_tokens: 65536,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4.1-mini": {
    grok_model: ["grok-4-1-thinking-1129", "MODEL_MODE_GROK_4_1_MINI_THINKING"],
    rate_limit_model: "grok-4-1-thinking-1129",
    display_name: "Grok 4.1 Mini",
    description: "Grok 4.1 mini model",
    raw_model_path: "xai/grok-4-1-thinking-1129",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4.1-fast": {
    grok_model: ["grok-4-1-thinking-1129", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-4-1-thinking-1129",
    display_name: "Grok 4.1 Fast",
    description: "Fast Grok 4.1 chat model",
    raw_model_path: "xai/grok-4-1-thinking-1129",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4.1-expert": {
    grok_model: ["grok-4-1-thinking-1129", "MODEL_MODE_EXPERT"],
    rate_limit_model: "grok-4-1-thinking-1129",
    display_name: "Grok 4.1 Expert",
    description: "Expert Grok 4.1 chat model",
    raw_model_path: "xai/grok-4-1-thinking-1129",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4.1-thinking": {
    grok_model: ["grok-4-1-thinking-1129", "MODEL_MODE_GROK_4_1_THINKING"],
    rate_limit_model: "grok-4-1-thinking-1129",
    display_name: "Grok 4.1 Thinking",
    description: "Grok 4.1 with thinking mode",
    raw_model_path: "xai/grok-4-1-thinking-1129",
    default_temperature: 1.0,
    default_max_output_tokens: 32768,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  "grok-4.20-beta": {
    grok_model: ["grok-420", "MODEL_MODE_GROK_420"],
    rate_limit_model: "grok-420",
    display_name: "Grok 4.20 Beta",
    description: "Grok 4.20 beta chat model",
    raw_model_path: "xai/grok-420",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
  },
  // === Console API (console.x.ai/v1/responses) ===
  // 通过 grok.com 的 SSO cookie 直接调用 console.x.ai，basic 池即可使用
  "grok-4.3": {
    grok_model: ["grok-4.3", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-4",
    display_name: "Grok 4.3 (Console)",
    description: "Grok 4.3 via console.x.ai",
    raw_model_path: "xai/grok-4.3",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    console_model: "grok-4.3",
  },
  "grok-4-console": {
    grok_model: ["grok-4", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-4",
    display_name: "Grok 4 (Console)",
    description: "Grok 4 via console.x.ai",
    raw_model_path: "xai/grok-4",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    console_model: "grok-4",
  },
  "grok-4.20": {
    grok_model: ["grok-4.20", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-4",
    display_name: "Grok 4.20 (Console)",
    description: "Grok 4.20 via console.x.ai",
    raw_model_path: "xai/grok-4.20",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    console_model: "grok-4.20",
  },
  "grok-4.20-reasoning": {
    grok_model: ["grok-4.20-0309-reasoning", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-4",
    display_name: "Grok 4.20 Reasoning (Console)",
    description: "Grok 4.20 reasoning via console.x.ai",
    raw_model_path: "xai/grok-4.20-0309-reasoning",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    console_model: "grok-4.20-0309-reasoning",
  },
  "grok-4.20-non-reasoning": {
    grok_model: ["grok-4.20-0309-non-reasoning", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-4",
    display_name: "Grok 4.20 Non-Reasoning (Console)",
    description: "Grok 4.20 non-reasoning via console.x.ai",
    raw_model_path: "xai/grok-4.20-0309-non-reasoning",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    console_model: "grok-4.20-0309-non-reasoning",
  },
  "grok-4.20-multi-agent": {
    grok_model: ["grok-4.20-multi-agent-0309", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-4",
    display_name: "Grok 4.20 Multi-Agent (Console)",
    description: "Grok 4.20 multi-agent via console.x.ai",
    raw_model_path: "xai/grok-4.20-multi-agent-0309",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    console_model: "grok-4.20-multi-agent-0309",
  },
  "grok-imagine-1.0": {
    grok_model: ["grok-3", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-3",
    display_name: "Grok Imagine 1.0",
    description: "Image generation model",
    raw_model_path: "xai/grok-imagine-1.0",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    is_image_model: true,
  },
  "grok-imagine-1.0-edit": {
    grok_model: ["imagine-image-edit", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-3",
    display_name: "Grok Imagine 1.0 Edit",
    description: "Image edit model",
    raw_model_path: "xai/grok-imagine-1.0-edit",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    is_image_model: true,
  },
  "grok-imagine-1.0-video": {
    grok_model: ["grok-3", "MODEL_MODE_FAST"],
    rate_limit_model: "grok-3",
    display_name: "Grok Imagine 1.0 Video",
    description: "Video generation model",
    raw_model_path: "xai/grok-imagine-1.0-video",
    default_temperature: 1.0,
    default_max_output_tokens: 8192,
    supported_max_output_tokens: 131072,
    default_top_p: 0.95,
    is_video_model: true,
  },
};

export function isValidModel(model: string): boolean {
  return Boolean(MODEL_CONFIG[model]);
}

export function getModelInfo(model: string): ModelInfo | null {
  return MODEL_CONFIG[model] ?? null;
}

export function toGrokModel(model: string): { grokModel: string; mode: string; isVideoModel: boolean } {
  const cfg = MODEL_CONFIG[model];
  if (!cfg) return { grokModel: model, mode: "MODEL_MODE_FAST", isVideoModel: false };
  return { grokModel: cfg.grok_model[0], mode: cfg.grok_model[1], isVideoModel: Boolean(cfg.is_video_model) };
}

export function toRateLimitModel(model: string): string {
  return MODEL_CONFIG[model]?.rate_limit_model ?? model;
}

export function isConsoleModel(model: string): boolean {
  return Boolean(MODEL_CONFIG[model]?.console_model);
}

export function getConsoleModel(model: string): string {
  return MODEL_CONFIG[model]?.console_model ?? "";
}


export const PORT = Number(process.env.PORT ?? 8787);
export const MODEL = process.env.XAI_MEAL_MODEL ?? "grok-4-1-fast-non-reasoning";
export const XAI_TIMEOUT_MS = Number(process.env.XAI_TIMEOUT_MS ?? 18000);
export const XAI_MAX_OUTPUT_TOKENS = Number(process.env.XAI_MAX_OUTPUT_TOKENS ?? 800);

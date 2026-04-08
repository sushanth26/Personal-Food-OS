import OpenAI from "openai";
import { MODEL, XAI_TIMEOUT_MS } from "./config.mjs";

export const client = process.env.XAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.XAI_API_KEY,
      baseURL: "https://api.x.ai/v1",
      timeout: XAI_TIMEOUT_MS
    })
  : null;

export function requireClient() {
  if (!client) {
    throw new Error("XAI_API_KEY is not set on the server, so Grok meal plans cannot be generated yet.");
  }

  return client;
}

export { MODEL };

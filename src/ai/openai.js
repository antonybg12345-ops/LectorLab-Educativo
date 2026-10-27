import OpenAI from "openai";
import { redactPersonalData } from "../platform/privacy.js";

/** Server-only adapter, constructed only when a key/client is supplied. */
export function createOpenAITutor({ apiKey, model, client } = {}) {
  if (!apiKey && !client) return null;
  // Stage A has no persistent idempotency/reconciliation: do not silently retry paid calls.
  const provider = client || new OpenAI({ apiKey, timeout: 25_000, maxRetries: 0 });
  return async ({ instructions, history, message }) => {
    const response = await provider.responses.create({
      model,
      instructions: redactPersonalData(instructions),
      input: [...history.map(item => ({ role: item.role, content: redactPersonalData(item.content) })), { role: "user", content: redactPersonalData(message) }],
      reasoning: { effort: "none" },
      max_output_tokens: 300,
      store: false,
    });
    return response.output_text;
  };
}

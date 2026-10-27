import OpenAI from "openai";

/** Server-only adapter, constructed only when a key/client is supplied. */
export function createOpenAITutor({ apiKey, model, client } = {}) {
  if (!apiKey && !client) return null;
  // Stage A has no persistent idempotency/reconciliation: do not silently retry paid calls.
  const provider = client || new OpenAI({ apiKey, timeout: 25_000, maxRetries: 0 });
  return async ({ instructions, history, message }) => {
    const response = await provider.responses.create({
      model,
      instructions,
      input: [...history, { role: "user", content: message }],
      reasoning: { effort: "none" },
      max_output_tokens: 300,
      store: false,
    });
    return response.output_text;
  };
}

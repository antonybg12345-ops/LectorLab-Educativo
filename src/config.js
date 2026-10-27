/** No environment reads at import time: validate an explicit configuration. */
export function readConfig(env = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error("PORT debe ser un entero entre 0 y 65535.");
  }
  return {
    port,
    host: env.HOST || "127.0.0.1",
    model: env.OPENAI_MODEL || "gpt-5.6-luna",
    maxTurns: 5,
    jsonLimit: "32kb",
    rateWindowMs: 10 * 60 * 1000,
    rateMaxRequests: 300,
  };
}

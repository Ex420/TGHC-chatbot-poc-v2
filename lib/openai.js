import OpenAI from "openai";

export const EMBEDDING_MODEL = "text-embedding-3-small";

let client;

// Created lazily (on first use inside a request) rather than at module load,
// so a missing env var fails an actual request instead of `next build`,
// which imports route modules to collect metadata without running them.
export function getOpenAIClient() {
  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return client;
}

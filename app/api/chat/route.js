import { streamText, convertToModelMessages } from "ai";
import { openai } from "@ai-sdk/openai";
import { getOpenAIClient, EMBEDDING_MODEL } from "@/lib/openai";
import { getSupabaseAdmin } from "@/lib/supabase-admin";

const MATCH_COUNT = 5;

export async function POST(req) {
  try {
    const { messages } = await req.json();

    const lastMessage = messages[messages.length - 1];
    const query = (lastMessage?.parts ?? [])
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n")
      .trim();

    let context = "";

    if (query) {
      const embeddingResponse = await getOpenAIClient().embeddings.create({
        model: EMBEDDING_MODEL,
        input: query,
      });
      const queryEmbedding = embeddingResponse.data[0].embedding;

      const { data: chunks, error } = await getSupabaseAdmin().rpc(
        "match_chunks",
        { query_embedding: queryEmbedding, match_count: MATCH_COUNT }
      );

      if (error) {
        console.error("match_chunks error:", error.message);
      } else {
        const resolvedChunks = Array.isArray(chunks) ? chunks : [];
        if (resolvedChunks.length) {
          context = resolvedChunks
            .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
            .join("\n\n");
        }
      }
    }

    const systemPrompt = context
      ? `You are a helpful assistant that answers questions using only the context excerpts below, which were retrieved from the user's uploaded PDFs. If the answer cannot be found in the context, say you don't know rather than guessing. Cite the excerpt number(s) you used, like [1].\n\nContext:\n${context}`
      : "You are a helpful assistant for a PDF chatbot. No relevant excerpts were found in the user's documents for this question. Let them know you couldn't find anything relevant in their uploaded documents.";

    const result = streamText({
      model: openai("gpt-4o"),
      system: systemPrompt,
      messages: await convertToModelMessages(messages),
    });

    return result.toUIMessageStreamResponse();
  } catch (err) {
    console.error("chat route error:", err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

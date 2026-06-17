import { randomUUID } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOpenAIClient, EMBEDDING_MODEL } from "@/lib/openai";
import { chunkText } from "@/lib/chunk";
import { extractMarkdown } from "@/lib/pdf";

const EMBEDDING_BATCH_SIZE = 100;

// Always hit the database; never statically cache the document list.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin
      .from("documents")
      .select("id, name, status, chunk_count, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ documents: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || typeof file === "string") {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return Response.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    );
  }

  const documentId = randomUUID();
  const storagePath = `${documentId}/${file.name}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: insertError } = await supabaseAdmin.from("documents").insert({
    id: documentId,
    name: file.name,
    storage_path: storagePath,
    status: "processing",
  });
  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  try {
    const { error: uploadError } = await supabaseAdmin.storage
      .from("pdfs")
      .upload(storagePath, buffer, { contentType: "application/pdf" });
    if (uploadError) throw new Error(uploadError.message);

    const markdown = await extractMarkdown(buffer);
    const chunks = chunkText(markdown);
    if (chunks.length === 0) {
      throw new Error("No extractable text found in this PDF");
    }

    const openaiClient = getOpenAIClient();
    const embeddings = [];
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const response = await openaiClient.embeddings.create({
        model: EMBEDDING_MODEL,
        input: batch,
      });
      embeddings.push(...response.data.map((d) => d.embedding));
    }

    const rows = chunks.map((content, index) => ({
      document_id: documentId,
      chunk_index: index,
      content,
      embedding: embeddings[index],
    }));

    const { error: chunksError } = await supabaseAdmin
      .from("chunks")
      .insert(rows);
    if (chunksError) throw new Error(chunksError.message);

    await supabaseAdmin
      .from("documents")
      .update({ status: "ready", chunk_count: rows.length })
      .eq("id", documentId);

    return Response.json({ id: documentId, chunkCount: rows.length });
  } catch (err) {
    await supabaseAdmin
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

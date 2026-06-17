import { waitUntil } from "@vercel/functions";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import { getOpenAIClient, EMBEDDING_MODEL } from "@/lib/openai";
import { chunkText } from "@/lib/chunk";
import { extractMarkdown, getPageCount, MAX_PDF_PAGES } from "@/lib/pdf";

const EMBEDDING_BATCH_SIZE = 100;
const PDFS_BUCKET = "pdfs";

// Always hit the database; never statically cache the document list.
export const dynamic = "force-dynamic";
// Ingestion keeps running in the background after the response is sent (see
// waitUntil in POST below); extend the function's lifetime well past the
// default so extraction + embedding has time to finish for larger PDFs.
export const maxDuration = 60;

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

// The browser uploads the PDF directly to Supabase Storage (see
// lib/supabase-browser.js) and only sends us the resulting path -- this
// route never receives the raw file bytes, so there's no request body size
// limit to hit no matter how large the PDF is.
export async function POST(req) {
  let supabaseAdmin;
  try {
    supabaseAdmin = getSupabaseAdmin();
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }

  const body = await req.json().catch(() => null);
  const { id, name, storagePath } = body ?? {};

  if (!id || !name || !storagePath) {
    return Response.json(
      { error: "Missing id, name, or storagePath" },
      { status: 400 }
    );
  }
  if (!name.toLowerCase().endsWith(".pdf")) {
    return Response.json(
      { error: "Only PDF files are supported" },
      { status: 400 }
    );
  }

  const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
    .from(PDFS_BUCKET)
    .download(storagePath);
  if (downloadError) {
    return Response.json({ error: downloadError.message }, { status: 400 });
  }
  const buffer = Buffer.from(await fileBlob.arrayBuffer());

  let pageCount;
  try {
    pageCount = await getPageCount(buffer);
  } catch {
    await supabaseAdmin.storage.from(PDFS_BUCKET).remove([storagePath]);
    return Response.json(
      { error: "Could not read this file. Make sure it's a valid PDF." },
      { status: 400 }
    );
  }

  if (pageCount > MAX_PDF_PAGES) {
    await supabaseAdmin.storage.from(PDFS_BUCKET).remove([storagePath]);
    return Response.json(
      {
        error: `This PDF has ${pageCount} pages, which exceeds the ${MAX_PDF_PAGES}-page limit. Please split it into smaller documents and upload each part separately.`,
      },
      { status: 400 }
    );
  }

  const { error: insertError } = await supabaseAdmin.from("documents").insert({
    id,
    name,
    storage_path: storagePath,
    status: "processing",
  });
  if (insertError) {
    return Response.json({ error: insertError.message }, { status: 500 });
  }

  waitUntil(ingestDocument(supabaseAdmin, id, buffer));

  return Response.json({ id, status: "processing" });
}

// Runs in the background after POST has already responded (via waitUntil
// above), so its errors can no longer reach that request -- they only ever
// surface through the document's `status` column.
async function ingestDocument(supabaseAdmin, documentId, buffer) {
  try {
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
  } catch (err) {
    await supabaseAdmin
      .from("documents")
      .update({ status: "failed" })
      .eq("id", documentId);
  }
}

import { getSupabaseAdmin } from "@/lib/supabase-admin";

export async function DELETE(req, { params }) {
  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { id } = await params;

    const { data: doc, error: fetchError } = await supabaseAdmin
      .from("documents")
      .select("storage_path")
      .eq("id", id)
      .single();

    if (fetchError || !doc) {
      return Response.json({ error: "Document not found" }, { status: 404 });
    }

    const { error: storageError } = await supabaseAdmin.storage
      .from("pdfs")
      .remove([doc.storage_path]);
    if (storageError) {
      return Response.json({ error: storageError.message }, { status: 500 });
    }

    // chunks are removed automatically via ON DELETE CASCADE
    const { error: deleteError } = await supabaseAdmin
      .from("documents")
      .delete()
      .eq("id", id);
    if (deleteError) {
      return Response.json({ error: deleteError.message }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

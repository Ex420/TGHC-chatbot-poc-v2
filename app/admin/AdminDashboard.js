"use client";

import { useCallback, useEffect, useState } from "react";
import AppHeader from "@/components/AppHeader";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

const PDFS_BUCKET = "pdfs";

const STATUS_STYLES = {
  ready: "bg-green-100 text-green-700",
  processing: "bg-amber-100 text-amber-700",
  failed: "bg-tghc-red/10 text-tghc-red",
};

function StatusBadge({ status }) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        STATUS_STYLES[status] ?? "bg-slate-100 text-slate-600"
      }`}
    >
      {status}
    </span>
  );
}

export default function AdminDashboard() {
  const [documents, setDocuments] = useState([]);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [listError, setListError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadDocuments = useCallback(async () => {
    setIsLoadingList(true);
    setListError(null);
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load documents");
      setDocuments(data.documents ?? []);
    } catch (err) {
      setListError(err.message);
    } finally {
      setIsLoadingList(false);
    }
  }, []);

  // Silent refresh (no loading flicker) used while polling for ingestion
  // status, which finishes in the background after the upload responds.
  const refreshDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      const data = await res.json();
      if (res.ok) setDocuments(data.documents ?? []);
    } catch {
      // Transient failure -- the next poll will retry.
    }
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    if (!documents.some((doc) => doc.status === "processing")) return;
    const interval = setInterval(refreshDocuments, 3000);
    return () => clearInterval(interval);
  }, [documents, refreshDocuments]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are supported");
      return;
    }
    setIsUploading(true);
    setUploadError(null);
    try {
      // Upload straight to Storage with the anon key so the file bytes
      // never pass through our API route -- only the resulting path does.
      const supabase = getSupabaseBrowser();
      const documentId = crypto.randomUUID();
      const storagePath = `${documentId}/${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from(PDFS_BUCKET)
        .upload(storagePath, file, { contentType: "application/pdf" });
      if (uploadError) throw new Error(uploadError.message);

      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: documentId, name: file.name, storagePath }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      setFile(null);
      await loadDocuments();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setIsUploading(false);
    }
  }

  async function handleDelete(id) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      setDocuments((docs) => docs.filter((d) => d.id !== id));
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-tghc-grey">
      <AppHeader
        title="Document admin"
        subtitle="Upload and manage PDFs used by the chatbot"
        links={[
          { href: "/admin/analytics", label: "Analytics" },
          { href: "/", label: "Back to chat" },
        ]}
      />

      <main className="mx-auto max-w-3xl px-4 py-8">
        <form
          onSubmit={handleUpload}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <label className="mb-2 block text-sm font-medium text-tghc-charcoal">
            Upload a PDF
          </label>
          <div className="flex gap-2">
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
            />
            <button
              type="submit"
              disabled={!file || isUploading}
              className="rounded-md bg-tghc-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-tghc-red/90 disabled:opacity-40"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
          {isUploading && (
            <p className="mt-2 text-xs text-slate-500">
              Uploading file...
            </p>
          )}
          {uploadError && (
            <p className="mt-2 text-sm text-tghc-red">{uploadError}</p>
          )}
        </form>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-tghc-navy">Documents</h2>
          </div>

          {listError ? (
            <p className="px-5 py-6 text-sm text-tghc-red">{listError}</p>
          ) : isLoadingList ? (
            <p className="px-5 py-6 text-sm text-slate-400">Loading...</p>
          ) : documents.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">
              No documents uploaded yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((doc) => (
                <li
                  key={doc.id}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-tghc-charcoal">
                      {doc.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"}{" "}
                      · {new Date(doc.created_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={doc.status} />
                    <button
                      onClick={() => handleDelete(doc.id)}
                      disabled={deletingId === doc.id}
                      className="text-sm font-medium text-tghc-red hover:text-tghc-red/80 disabled:opacity-40"
                    >
                      {deletingId === doc.id ? "Deleting..." : "Delete"}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

const STATUS_STYLES = {
  ready: "bg-green-100 text-green-700",
  processing: "bg-amber-100 text-amber-700",
  failed: "bg-red-100 text-red-700",
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

export default function AdminPage() {
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

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setIsUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/documents", {
        method: "POST",
        body: formData,
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
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Document admin</h1>
          <p className="text-sm text-slate-500">
            Upload and manage PDFs used by the chatbot
          </p>
        </div>
        <Link
          href="/"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Back to chat
        </Link>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">
        <form
          onSubmit={handleUpload}
          className="mb-8 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <label className="mb-2 block text-sm font-medium text-slate-700">
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
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
            >
              {isUploading ? "Uploading..." : "Upload"}
            </button>
          </div>
          {isUploading && (
            <p className="mt-2 text-xs text-slate-500">
              Extracting text, chunking, and embedding — this can take a
              moment for larger PDFs.
            </p>
          )}
          {uploadError && (
            <p className="mt-2 text-sm text-red-600">{uploadError}</p>
          )}
        </form>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-slate-900">Documents</h2>
          </div>

          {listError ? (
            <p className="px-5 py-6 text-sm text-red-600">{listError}</p>
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
                    <p className="truncate text-sm font-medium text-slate-900">
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
                      className="text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-40"
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

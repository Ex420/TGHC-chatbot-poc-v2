"use client";

import { useEffect, useState } from "react";

// Documents finish ingesting in the background, so poll while this is open
// to pick up newly-ready documents without a manual refresh.
const POLL_INTERVAL_MS = 15000;

function DocumentList({ documents, isLoading, error }) {
  if (error) {
    return <p className="text-sm text-tghc-red">{error}</p>;
  }
  if (isLoading) {
    return <p className="text-sm text-slate-400">Loading...</p>;
  }
  if (documents.length === 0) {
    return <p className="text-sm text-slate-400">No documents available yet.</p>;
  }
  return (
    <ul className="space-y-3">
      {documents.map((doc) => (
        <li key={doc.id} className="rounded-lg border border-slate-200 bg-tghc-grey p-3">
          <p className="truncate text-sm font-medium text-tghc-charcoal">{doc.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"} ·{" "}
            {new Date(doc.created_at).toLocaleDateString()}
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function KnowledgeBasePanel({ isOpen, onClose }) {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/documents");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load documents");
        if (!cancelled) {
          setDocuments(data.documents ?? []);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const readyDocuments = documents.filter((doc) => doc.status === "ready");

  const panelBody = (
    <div className="flex h-full flex-col bg-white">
      <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-tghc-navy">Knowledge Base</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close knowledge base"
          className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 lg:hidden"
        >
          ✕
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-5 py-4">
        <DocumentList documents={readyDocuments} isLoading={isLoading} error={error} />
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden w-[30%] shrink-0 border-l border-slate-200 lg:block">
        {panelBody}
      </aside>

      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={onClose} />
          <div className="absolute right-0 top-0 h-full w-full max-w-sm shadow-xl">
            {panelBody}
          </div>
        </div>
      )}
    </>
  );
}

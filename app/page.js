"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import ReactMarkdown from "react-markdown";
import { getUserIdentity } from "@/lib/identity";
import AppHeader from "@/components/AppHeader";
import KnowledgeBasePanel from "@/components/KnowledgeBasePanel";

const MARKDOWN_COMPONENTS = {
  p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
  ul: ({ node, ...props }) => <ul className="list-disc pl-5" {...props} />,
  ol: ({ node, ...props }) => <ol className="list-decimal pl-5" {...props} />,
  a: ({ node, ...props }) => (
    <a
      className="text-tghc-blue underline hover:text-tghc-navy"
      target="_blank"
      rel="noreferrer"
      {...props}
    />
  ),
};

function getMessageText(parts) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export default function ChatPage() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    const { userIdentifier, userName, sessionId } = getUserIdentity();
    sendMessage({ text }, { body: { userIdentifier, userName, sessionId } });
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col bg-tghc-grey">
      <AppHeader
        title="PDF Chatbot"
        subtitle="Ask questions about your uploaded documents"
        links={[{ href: "/admin", label: "Admin" }]}
      />

      <div className="flex flex-1 overflow-hidden">
        <div className="flex w-full flex-col lg:w-[70%]">
          <main className="flex-1 overflow-y-auto px-4 py-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-4">
              {messages.length === 0 && (
                <div className="mt-20 text-center text-sm text-slate-400">
                  No messages yet. Ask a question about one of your uploaded PDFs.
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${
                    message.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm leading-relaxed shadow-sm ${
                      message.role === "user"
                        ? "bg-tghc-navy text-white"
                        : "border border-slate-200 bg-white text-tghc-charcoal"
                    }`}
                  >
                    {message.role === "user" ? (
                      getMessageText(message.parts)
                    ) : (
                      <ReactMarkdown components={MARKDOWN_COMPONENTS}>
                        {getMessageText(message.parts)}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              ))}

              {status === "submitted" && (
                <div className="flex justify-start">
                  <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-tghc-navy/40 [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-tghc-navy/40 [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-tghc-navy/40" />
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-md border border-tghc-red/30 bg-tghc-red/10 px-4 py-2 text-sm text-tghc-red">
                  Something went wrong: {error.message}
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          </main>

          <form
            onSubmit={handleSubmit}
            className="border-t border-slate-200 bg-white px-4 py-4"
          >
            <div className="mx-auto flex max-w-2xl gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask a question about your documents..."
                className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-tghc-red focus:outline-none focus:ring-1 focus:ring-tghc-red"
                disabled={isBusy}
              />
              <button
                type="submit"
                disabled={isBusy || !input.trim()}
                className="rounded-full bg-tghc-red px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-tghc-red/90 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </form>
        </div>

        <KnowledgeBasePanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
      </div>

      {!isPanelOpen && (
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          className="fixed bottom-24 right-4 z-30 flex items-center gap-2 rounded-full bg-tghc-navy px-4 py-2.5 text-sm font-medium text-white shadow-lg lg:hidden"
        >
          <span aria-hidden>📚</span> Knowledge Base
        </button>
      )}
    </div>
  );
}

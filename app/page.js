"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import Link from "next/link";

function MessageText({ parts }) {
  return parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export default function ChatPage() {
  const { messages, sendMessage, status, error } = useChat();
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const isBusy = status === "submitted" || status === "streaming";

  function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text || isBusy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex h-screen flex-col bg-slate-50">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">PDF Chatbot</h1>
          <p className="text-sm text-slate-500">
            Ask questions about your uploaded documents
          </p>
        </div>
        <Link
          href="/admin"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          Admin
        </Link>
      </header>

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
                    ? "bg-slate-900 text-white"
                    : "border border-slate-200 bg-white text-slate-800"
                }`}
              >
                <MessageText parts={message.parts} />
              </div>
            </div>
          ))}

          {status === "submitted" && (
            <div className="flex justify-start">
              <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
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
            className="flex-1 rounded-full border border-slate-300 px-4 py-2 text-sm focus:border-slate-500 focus:outline-none"
            disabled={isBusy}
          />
          <button
            type="submit"
            disabled={isBusy || !input.trim()}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}

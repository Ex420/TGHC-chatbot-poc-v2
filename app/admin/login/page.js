"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppHeader from "@/components/AppHeader";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-tghc-grey">
      <AppHeader title="Admin Login" subtitle="Toronto Grace Health Centre" />

      <div className="flex flex-1 items-center justify-center px-4">
        <form
          onSubmit={handleSubmit}
          className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <h1 className="mb-1 text-lg font-semibold text-tghc-navy">
            Admin login
          </h1>
          <p className="mb-4 text-sm text-slate-500">
            Enter the admin password to manage documents.
          </p>
          <input
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-tghc-red focus:outline-none focus:ring-1 focus:ring-tghc-red"
          />
          <button
            type="submit"
            disabled={!password || isSubmitting}
            className="w-full rounded-md bg-tghc-red px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-tghc-red/90 disabled:opacity-40"
          >
            {isSubmitting ? "Checking..." : "Continue"}
          </button>
          {error && <p className="mt-3 text-sm text-tghc-red">{error}</p>}
        </form>
      </div>
    </div>
  );
}

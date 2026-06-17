import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, isValidAdminSessionToken } from "@/lib/admin-auth";
import { getSupabaseAdmin } from "@/lib/supabase-admin";
import AppHeader from "@/components/AppHeader";
import UsageChart from "./UsageChart";

// Always reflect the latest conversations; never statically cache this page.
export const dynamic = "force-dynamic";

const TOKEN_COST_PER_TOKEN = 0.000002; // rough gpt-4o blended estimate
const USAGE_WINDOW_DAYS = 30;
const RECENT_QUESTIONS_LIMIT = 20;
const QUESTION_TRUNCATE_LENGTH = 80;
const DOCUMENT_ENGAGEMENT_LIMIT = 10;

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function truncate(text, length) {
  if (!text) return "";
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function buildUsageByDay(conversations) {
  const counts = new Map();
  const days = [];
  const now = new Date();

  for (let i = USAGE_WINDOW_DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    days.push(key);
    counts.set(key, 0);
  }

  for (const convo of conversations) {
    const key = new Date(convo.created_at).toISOString().slice(0, 10);
    if (counts.has(key)) counts.set(key, counts.get(key) + 1);
  }

  return days.map((date) => ({ date, count: counts.get(date) }));
}

function buildUserBreakdown(conversations) {
  const byUser = new Map();

  for (const convo of conversations) {
    const key = convo.user_identifier ?? "unknown";
    if (!byUser.has(key)) {
      byUser.set(key, {
        userIdentifier: key,
        userName: convo.user_name || "Unknown user",
        questionCount: 0,
        totalTokens: 0,
        responseTimes: [],
        lastActive: convo.created_at,
      });
    }
    const entry = byUser.get(key);
    entry.questionCount += 1;
    entry.totalTokens += convo.total_tokens ?? 0;
    if (convo.response_time_ms != null) entry.responseTimes.push(convo.response_time_ms);
    if (new Date(convo.created_at) > new Date(entry.lastActive)) {
      entry.lastActive = convo.created_at;
    }
  }

  return Array.from(byUser.values())
    .map((entry) => ({ ...entry, avgResponseTime: average(entry.responseTimes) }))
    .sort((a, b) => b.questionCount - a.questionCount);
}

function buildDocumentEngagement(conversations, documents) {
  const counts = new Map();
  for (const convo of conversations) {
    for (const docId of convo.document_ids ?? []) {
      counts.set(docId, (counts.get(docId) ?? 0) + 1);
    }
  }

  const documentNames = new Map(documents.map((doc) => [doc.id, doc.name]));

  return Array.from(counts.entries())
    .map(([documentId, count]) => ({
      documentId,
      name: documentNames.get(documentId) ?? "Deleted document",
      count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, DOCUMENT_ENGAGEMENT_LIMIT);
}

export default async function AnalyticsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!isValidAdminSessionToken(token)) {
    redirect("/admin/login");
  }

  const supabaseAdmin = getSupabaseAdmin();

  const [{ data: conversations, error: conversationsError }, { data: documents, error: documentsError }] =
    await Promise.all([
      supabaseAdmin
        .from("conversations")
        .select(
          "id, user_identifier, user_name, question, prompt_tokens, completion_tokens, total_tokens, response_time_ms, document_ids, created_at"
        )
        .order("created_at", { ascending: false }),
      supabaseAdmin.from("documents").select("id, name"),
    ]);

  if (conversationsError) throw new Error(conversationsError.message);
  if (documentsError) throw new Error(documentsError.message);

  const rows = conversations ?? [];
  const docs = documents ?? [];

  const totalQuestions = rows.length;
  const totalUsers = new Set(rows.map((r) => r.user_identifier).filter(Boolean)).size;
  const totalTokens = rows.reduce((sum, r) => sum + (r.total_tokens ?? 0), 0);
  const estimatedCost = totalTokens * TOKEN_COST_PER_TOKEN;
  const avgResponseTime = average(rows.map((r) => r.response_time_ms ?? 0));

  const totalPromptTokens = rows.reduce((sum, r) => sum + (r.prompt_tokens ?? 0), 0);
  const totalCompletionTokens = rows.reduce((sum, r) => sum + (r.completion_tokens ?? 0), 0);
  const avgPromptPerQuestion = totalQuestions ? totalPromptTokens / totalQuestions : 0;
  const avgCompletionPerQuestion = totalQuestions ? totalCompletionTokens / totalQuestions : 0;

  const usageByDay = buildUsageByDay(rows);
  const userBreakdown = buildUserBreakdown(rows);
  const documentEngagement = buildDocumentEngagement(rows, docs);
  const recentQuestions = rows.slice(0, RECENT_QUESTIONS_LIMIT);

  return (
    <div className="min-h-screen bg-tghc-grey">
      <AppHeader
        title="Analytics"
        subtitle="Chatbot usage and engagement"
        links={[
          { href: "/admin", label: "Documents" },
          { href: "/", label: "Back to chat" },
        ]}
      />

      <main className="mx-auto max-w-5xl space-y-8 px-4 py-8">
        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard label="Total questions" value={totalQuestions.toLocaleString()} />
          <StatCard label="Total users" value={totalUsers.toLocaleString()} />
          <StatCard label="Total tokens" value={totalTokens.toLocaleString()} />
          <StatCard label="Estimated cost" value={`$${estimatedCost.toFixed(4)}`} />
          <StatCard label="Avg response time" value={`${Math.round(avgResponseTime)} ms`} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-tghc-navy">
            Usage over time (last {USAGE_WINDOW_DAYS} days)
          </h2>
          <UsageChart data={usageByDay} />
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-tghc-navy">User breakdown</h2>
          </div>
          {userBreakdown.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No data yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                    <th className="px-5 py-2 font-medium">User</th>
                    <th className="px-5 py-2 font-medium">Questions</th>
                    <th className="px-5 py-2 font-medium">Total tokens</th>
                    <th className="px-5 py-2 font-medium">Avg response time</th>
                    <th className="px-5 py-2 font-medium">Last active</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {userBreakdown.map((user) => (
                    <tr key={user.userIdentifier}>
                      <td className="px-5 py-3 font-medium text-tghc-charcoal">{user.userName}</td>
                      <td className="px-5 py-3 text-slate-600">{user.questionCount}</td>
                      <td className="px-5 py-3 text-slate-600">
                        {user.totalTokens.toLocaleString()}
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {Math.round(user.avgResponseTime)} ms
                      </td>
                      <td className="px-5 py-3 text-slate-600">
                        {new Date(user.lastActive).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-tghc-navy">Token usage</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Total prompt tokens" value={totalPromptTokens.toLocaleString()} />
            <StatCard
              label="Total completion tokens"
              value={totalCompletionTokens.toLocaleString()}
            />
            <StatCard label="Avg prompt / question" value={avgPromptPerQuestion.toFixed(1)} />
            <StatCard
              label="Avg completion / question"
              value={avgCompletionPerQuestion.toFixed(1)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-tghc-navy">Document engagement</h2>
          </div>
          {documentEngagement.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No data yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {documentEngagement.map((doc) => (
                <li key={doc.documentId} className="flex items-center justify-between px-5 py-3">
                  <span className="truncate text-sm font-medium text-tghc-charcoal">{doc.name}</span>
                  <span className="whitespace-nowrap text-sm text-slate-500">
                    {doc.count} reference{doc.count === 1 ? "" : "s"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-3">
            <h2 className="text-sm font-semibold text-tghc-navy">Recent questions</h2>
          </div>
          {recentQuestions.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-400">No data yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentQuestions.map((q) => (
                <li key={q.id} className="px-5 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-sm text-tghc-charcoal">
                      {truncate(q.question, QUESTION_TRUNCATE_LENGTH)}
                    </p>
                    <span className="whitespace-nowrap text-xs text-slate-500">
                      {q.total_tokens ?? 0} tok · {q.response_time_ms ?? 0} ms
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    {q.user_name || "Unknown user"} · {new Date(q.created_at).toLocaleString()}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-tghc-navy">{value}</p>
    </div>
  );
}

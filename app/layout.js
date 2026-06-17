import "./globals.css";

export const metadata = {
  title: "PDF RAG Chatbot",
  description: "Ask questions about your uploaded PDFs",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}

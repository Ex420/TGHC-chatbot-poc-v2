import "./globals.css";

export const metadata = {
  title: "TGHC Chatbot",
  description: "Ask questions about Toronto Grace Health Centre documents",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="bg-tghc-grey font-sans text-tghc-charcoal antialiased">
        {children}
      </body>
    </html>
  );
}

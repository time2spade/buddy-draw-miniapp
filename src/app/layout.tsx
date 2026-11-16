import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Buddy Draw - จับฉลากของขวัญบัดดี้",
  description: "แอปจับฉลากแลกของขวัญบัดดี้ พร้อมระบบ Exclusions, Wish List และคำถามลับ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body className="min-h-screen bg-emerald-950 text-stone-100 antialiased">
        {children}
      </body>
    </html>
  );
}

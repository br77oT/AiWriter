import type { Metadata } from "next";
import "./globals.css";
import { AppFooter } from "@/components/AppFooter";

export const metadata: Metadata = {
  title: "AiWriter",
  description: "Structured AI drafting & review workspace",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      {/* Column layout so the footer sits at the bottom and the page
          content claims the rest. AppFooter manages its own visibility. */}
      <body className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden">{children}</div>
        <AppFooter />
      </body>
    </html>
  );
}

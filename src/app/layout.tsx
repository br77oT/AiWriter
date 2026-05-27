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
          content claims the rest. AppFooter manages its own visibility.
          The page sits on the slate "app" surface; child screens render
          their own white cards on top of it (see docs/design-system.md). */}
      <body className="flex h-full flex-col">
        <div className="flex-1 overflow-hidden p-3">
          <div
            className="flex h-full flex-col overflow-hidden border bg-white"
            style={{
              borderColor: "var(--border-subtle)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            {children}
          </div>
        </div>
        <AppFooter />
      </body>
    </html>
  );
}

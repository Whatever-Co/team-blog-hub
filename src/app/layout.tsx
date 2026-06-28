import "./globals.css";
import type { Metadata } from "next";
import { config } from "@site.config";

export const metadata: Metadata = {
  title: config.siteMeta.title,
  description: config.siteMeta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}

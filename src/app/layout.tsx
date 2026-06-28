import "./globals.css";
import type { Metadata } from "next";
import { Source_Serif_4, JetBrains_Mono } from "next/font/google";
import { config } from "@site.config";
import { Header } from "@/components/Header";

const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif-loaded" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono-loaded" });

export const metadata: Metadata = {
  metadataBase: new URL(config.siteRoot),
  title: { default: config.siteMeta.title, template: `%s — ${config.siteMeta.title}` },
  description: config.siteMeta.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja" className={`${serif.variable} ${mono.variable}`}>
      <body>
        <Header />
        <main className="mx-auto max-w-[920px] px-8">{children}</main>
      </body>
    </html>
  );
}

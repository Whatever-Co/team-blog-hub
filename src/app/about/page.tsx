import type { Metadata } from "next";
import Link from "next/link";
import { config } from "@site.config";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <section className="pt-16 max-w-[640px]">
      <h1 className="font-serif italic text-4xl mb-8">About</h1>
      <p className="leading-relaxed">
        <a href="https://whatever.co" target="_blank" rel="noopener noreferrer" className="underline">
          {config.siteMeta.teamName}
        </a>{" "}
        開発チームメンバーの各ブログを集約したサイトです。元実装は{" "}
        <a href="https://github.com/catnose99/team-blog-hub" target="_blank" rel="noopener noreferrer" className="underline">
          team-blog-hub
        </a>
        {" "}を基にしています。
      </p>
      <p className="mt-8">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.08em] underline">
          ← Back home
        </Link>
      </p>
    </section>
  );
}

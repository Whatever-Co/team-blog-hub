import Link from "next/link";

export default function NotFound() {
  return (
    <section className="pt-32 text-center">
      <h1 className="font-serif italic text-6xl">404</h1>
      <p className="font-mono text-[color:var(--color-text-muted)] mt-4">Page not found.</p>
      <p className="mt-8">
        <Link href="/" className="font-mono text-[11px] uppercase tracking-[0.08em] underline">
          ← Back home
        </Link>
      </p>
    </section>
  );
}

import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-[color:var(--color-rule-soft)]">
      <div className="mx-auto max-w-[920px] px-8 py-4 flex items-center justify-between">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)] hover:text-[color:var(--color-text)]"
        >
          WHATEVER/DEV-BLOG
        </Link>
        <nav className="flex gap-5 font-mono text-[11px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
          <Link href="/about/" className="hover:text-[color:var(--color-text)]">About</Link>
          <Link href="/members/" className="hover:text-[color:var(--color-text)]">Members</Link>
          <a
            href="/feed.xml"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[color:var(--color-text)]"
          >
            RSS
          </a>
        </nav>
      </div>
    </header>
  );
}

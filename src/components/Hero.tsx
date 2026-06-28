export function Hero({ memberCount, postCount }: { memberCount: number; postCount: number }) {
  return (
    <section className="pt-16 pb-2">
      <h1 className="font-serif italic text-5xl font-normal tracking-[-0.01em]">
        Engineering log.
      </h1>
      <p className="font-mono text-xs text-[color:var(--color-text-muted)] mt-2">
        By the engineers at Whatever Co. — {memberCount} members, {postCount} posts.
      </p>
    </section>
  );
}

"use client";

import { useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { PostItem, Member } from "@/types";
import { PostRow } from "./PostRow";

export function PostList({ posts, members }: { posts: PostItem[]; members: Member[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const authorFilter = searchParams.get("author");

  const filtered = useMemo(
    () => (authorFilter ? posts.filter((p) => p.authorId === authorFilter) : posts),
    [posts, authorFilter]
  );

  const memberMap = useMemo(() => new Map(members.map((m) => [m.id, m])), [members]);

  function toggle(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (authorFilter === id) next.delete("author");
    else next.set("author", id);
    const q = next.toString();
    router.replace(q ? `${pathname}?${q}` : pathname);
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center py-5 border-b border-[color:var(--color-rule-solid)]">
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)] mr-3">
          Members
        </span>
        {members.map((m) => {
          const selected = authorFilter === m.id;
          const dim = authorFilter && !selected;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => toggle(m.id)}
              title={m.name}
              className="rounded-full"
            >
              <img
                src={m.avatarSrc}
                alt={m.name}
                className={[
                  "w-11 h-11 rounded-full object-cover transition-all",
                  selected ? "ring-2 ring-[color:var(--color-rule-solid)]" : "",
                  dim ? "opacity-30" : "grayscale hover:grayscale-0 hover:scale-105",
                ].join(" ")}
              />
            </button>
          );
        })}
      </div>

      <div className="hidden sm:grid sm:grid-cols-[92px_52px_1fr_110px] gap-[18px] pt-6 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        <span>Date</span><span></span><span>Title</span><span className="text-right">Author</span>
      </div>

      {filtered.map((p) => (
        <PostRow key={p.link} post={p} member={memberMap.get(p.authorId)} />
      ))}

      {filtered.length === 0 && (
        <p className="py-12 text-center font-mono text-[color:var(--color-text-muted)]">
          No posts.
        </p>
      )}
    </>
  );
}

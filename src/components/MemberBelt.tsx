import Link from "next/link";
import type { Member } from "@/types";

export function MemberBelt({ members }: { members: Member[] }) {
  return (
    <div className="flex flex-wrap gap-3 items-center py-5 border-b border-[color:var(--color-rule-solid)]">
      <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-[color:var(--color-text-muted)] mr-3">
        Members
      </span>
      {members.map((m) => (
        <Link key={m.id} href={`/members/${m.id}/`} title={m.name}>
          <img
            src={m.avatarSrc}
            alt={m.name}
            className="w-11 h-11 rounded-full object-cover grayscale hover:grayscale-0 hover:scale-105 transition-all"
          />
        </Link>
      ))}
    </div>
  );
}

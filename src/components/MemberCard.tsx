import Link from "next/link";
import type { Member } from "@/types";

export function MemberCard({ member }: { member: Member }) {
  return (
    <Link
      href={`/members/${member.id}/`}
      className="flex items-center gap-4 py-5 border-b border-dashed border-[color:var(--color-rule-dashed)] hover:bg-[color:var(--color-hover)] px-2"
    >
      <img
        src={member.avatarSrc}
        alt={member.name}
        className="w-14 h-14 rounded-full object-cover"
      />
      <div>
        <div className="font-serif text-lg">{member.name}</div>
        {member.role && (
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-text-muted)]">
            {member.role}
          </div>
        )}
      </div>
    </Link>
  );
}

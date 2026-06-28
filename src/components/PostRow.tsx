import type { PostItem } from "@/types";
import type { Member } from "@/types";

export function PostRow({ post, member }: { post: PostItem; member?: Member }) {
  const date = post.isoDate?.slice(0, 10) ?? "";
  return (
    <a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      className="grid grid-cols-[92px_52px_1fr_110px] gap-[18px] items-center py-[18px] border-b border-dashed border-[color:var(--color-rule-dashed)] hover:bg-[color:var(--color-hover)]"
    >
      <span className="font-mono text-[13px] text-[color:var(--color-text-dim)]">{date}</span>
      <span>
        {member && (
          <img src={member.avatarSrc} alt="" className="w-10 h-10 rounded-full object-cover" />
        )}
      </span>
      <span className="leading-[1.45]">
        <span className="font-serif text-[17px] block mb-[3px] text-[color:var(--color-text)]">
          {post.title}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--color-text-dim)]">
          {post.sourceHost}
        </span>
      </span>
      <span className="font-mono text-[13px] text-[color:var(--color-text-muted)] text-right">
        {post.authorId}
      </span>
    </a>
  );
}

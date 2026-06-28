import type { PostItem } from "@/types";
import type { Member } from "@/types";

export function PostRow({
  post,
  member,
  showAuthor = true,
}: {
  post: PostItem;
  member?: Member;
  showAuthor?: boolean;
}) {
  const date = post.isoDate?.slice(0, 10) ?? "";
  const gridClass = showAuthor
    ? "sm:grid-cols-[92px_52px_1fr_110px]"
    : "sm:grid-cols-[92px_52px_1fr]";
  const rowClass =
    "block py-[18px] border-b border-dashed border-[color:var(--color-rule-dashed)] hover:bg-[color:var(--color-hover)]";

  return (
    <a
      href={post.link}
      target="_blank"
      rel="noopener noreferrer"
      className={rowClass}
    >
      <div className="flex sm:hidden gap-3 items-start">
        {member && (
          <img
            src={member.avatarSrc}
            alt=""
            className="w-10 h-10 rounded-full object-cover shrink-0"
          />
        )}
        <div className="min-w-0 flex-1">
          <span className="font-serif text-base block text-[color:var(--color-text)] leading-[1.45]">
            {post.title}
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-text-dim)] mt-1 flex flex-wrap gap-x-2">
            <span>{date}</span>
            <span>·</span>
            <span>{post.sourceHost}</span>
            {showAuthor && (
              <>
                <span>·</span>
                <span>{post.authorId}</span>
              </>
            )}
          </span>
        </div>
      </div>

      <div className={`hidden sm:grid ${gridClass} gap-[18px] items-center`}>
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
        {showAuthor && (
          <span className="font-mono text-[13px] text-[color:var(--color-text-muted)] text-right">
            {post.authorId}
          </span>
        )}
      </div>
    </a>
  );
}

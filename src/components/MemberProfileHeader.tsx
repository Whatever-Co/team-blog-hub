import type { Member } from "@/types";
import { FaGithub, FaTwitter, FaGlobe } from "react-icons/fa";

export function MemberProfileHeader({ member, postCount }: { member: Member; postCount: number }) {
  return (
    <section className="pt-16 pb-8 border-b border-[color:var(--color-rule-solid)]">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-6">
        <img
          src={member.avatarSrc}
          alt={member.name}
          className="w-24 h-24 rounded-full object-cover"
        />
        <div className="flex-1">
          <h1 className="font-serif italic text-3xl sm:text-4xl">{member.name}</h1>
          {member.role && (
            <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-text-muted)] mt-2">
              {member.role}
            </div>
          )}
          {member.bio && <p className="mt-4 text-[color:var(--color-text-muted)]">{member.bio}</p>}
          <div className="flex gap-4 mt-4 text-[color:var(--color-text-muted)]">
            {member.githubUsername && (
              <a href={`https://github.com/${member.githubUsername}`} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <FaGithub size={18} />
              </a>
            )}
            {member.twitterUsername && (
              <a href={`https://twitter.com/${member.twitterUsername}`} target="_blank" rel="noopener noreferrer" aria-label="X/Twitter">
                <FaTwitter size={18} />
              </a>
            )}
            {member.websiteUrl && (
              <a href={member.websiteUrl} target="_blank" rel="noopener noreferrer" aria-label="Website">
                <FaGlobe size={18} />
              </a>
            )}
          </div>
          <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-[color:var(--color-text-dim)] mt-6">
            {postCount} posts
          </div>
        </div>
      </div>
    </section>
  );
}

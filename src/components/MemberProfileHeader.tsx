import type { Member } from "@/types";
import { FaGithub, FaGlobe } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiZenn, SiQiita, SiNote } from "react-icons/si";

const BLOG_PLATFORMS: Array<{
  key: "zenn" | "qiita" | "note";
  label: string;
  Icon: typeof SiZenn;
  match: RegExp;
  profileUrl: (user: string) => string;
}> = [
  {
    key: "zenn",
    label: "Zenn",
    Icon: SiZenn,
    match: /^https?:\/\/zenn\.dev\/([^/]+)\//i,
    profileUrl: (user) => `https://zenn.dev/${user}`,
  },
  {
    key: "qiita",
    label: "Qiita",
    Icon: SiQiita,
    match: /^https?:\/\/qiita\.com\/([^/]+)\//i,
    profileUrl: (user) => `https://qiita.com/${user}`,
  },
  {
    key: "note",
    label: "note",
    Icon: SiNote,
    match: /^https?:\/\/note\.com\/([^/]+)\//i,
    profileUrl: (user) => `https://note.com/${user}`,
  },
];

function detectBlogLinks(sources: string[] | undefined) {
  if (!sources?.length) return [];
  const seen = new Set<string>();
  const links: Array<{ key: string; label: string; href: string; Icon: typeof SiZenn }> = [];
  for (const source of sources) {
    for (const platform of BLOG_PLATFORMS) {
      const match = source.match(platform.match);
      if (!match) continue;
      if (seen.has(platform.key)) continue;
      seen.add(platform.key);
      links.push({
        key: platform.key,
        label: platform.label,
        href: platform.profileUrl(match[1]),
        Icon: platform.Icon,
      });
    }
  }
  return links;
}

export function MemberProfileHeader({ member, postCount }: { member: Member; postCount: number }) {
  const blogLinks = detectBlogLinks(member.sources);
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
            {blogLinks.map(({ key, label, href, Icon }) => (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer" aria-label={label}>
                <Icon size={18} />
              </a>
            ))}
            {member.githubUsername && (
              <a href={`https://github.com/${member.githubUsername}`} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                <FaGithub size={18} />
              </a>
            )}
            {member.twitterUsername && (
              <a href={`https://x.com/${member.twitterUsername}`} target="_blank" rel="noopener noreferrer" aria-label="X">
                <FaXTwitter size={18} />
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

import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllMembers, getMember } from "@/lib/members";
import { getPostsByAuthor } from "@/lib/posts";
import { MemberProfileHeader } from "@/components/MemberProfileHeader";
import { PostRow } from "@/components/PostRow";

export const dynamic = "force-static";

export function generateStaticParams() {
  return getAllMembers().map((m) => ({ id: m.id }));
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const member = getMember(id);
  return { title: member?.name ?? "Member" };
}

export default async function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const member = getMember(id);
  if (!member) notFound();
  const posts = getPostsByAuthor(id);
  return (
    <>
      <MemberProfileHeader member={member} postCount={posts.length} />
      <div className="hidden sm:grid sm:grid-cols-[92px_52px_1fr] gap-[18px] pt-6 pb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[color:var(--color-text-muted)]">
        <span>Date</span><span></span><span>Title</span>
      </div>
      {posts.map((p) => <PostRow key={p.link} post={p} member={member} showAuthor={false} />)}
      {posts.length === 0 && (
        <p className="py-12 text-center font-mono text-[color:var(--color-text-muted)]">
          No posts yet.
        </p>
      )}
    </>
  );
}

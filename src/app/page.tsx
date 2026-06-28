import { Hero } from "@/components/Hero";
import { MemberBelt } from "@/components/MemberBelt";
import { getAllMembers } from "@/lib/members";
import { getAllPosts } from "@/lib/posts";

export default function HomePage() {
  const members = getAllMembers();
  const posts = getAllPosts();
  return (
    <>
      <Hero memberCount={members.length} postCount={posts.length} />
      <MemberBelt members={members} />
    </>
  );
}

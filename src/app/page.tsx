import { Suspense } from "react";
import { Hero } from "@/components/Hero";
import { PostList } from "@/components/PostList";
import { getAllMembers } from "@/lib/members";
import { getAllPosts } from "@/lib/posts";

export default function HomePage() {
  const members = getAllMembers();
  const posts = getAllPosts();
  return (
    <>
      <Hero memberCount={members.length} postCount={posts.length} />
      <Suspense fallback={null}>
        <PostList posts={posts} members={members} />
      </Suspense>
    </>
  );
}

import postsJson from "@contents/posts.json";
import type { PostItem } from "@/types";

export function getAllPosts(): PostItem[] {
  return postsJson as PostItem[];
}

export function getPostsByAuthor(id: string): PostItem[] {
  return getAllPosts().filter((p) => p.authorId === id);
}

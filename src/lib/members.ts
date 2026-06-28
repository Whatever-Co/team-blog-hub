import { members } from "@members";
import type { Member } from "@/types";

export function getAllMembers(): Member[] {
  return members;
}

export function getMember(id: string): Member | undefined {
  return members.find((m) => m.id === id);
}

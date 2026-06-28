import type { Metadata } from "next";
import { getAllMembers } from "@/lib/members";
import { MemberCard } from "@/components/MemberCard";

export const metadata: Metadata = { title: "Members" };

export default function MembersPage() {
  const members = getAllMembers();
  return (
    <section className="pt-16">
      <h1 className="font-serif italic text-4xl mb-8">Members</h1>
      <div>
        {members.map((m) => <MemberCard key={m.id} member={m} />)}
      </div>
    </section>
  );
}

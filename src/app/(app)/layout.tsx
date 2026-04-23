import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { HarnessTopBar } from "@/components/harness/harness-top-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <HarnessTopBar user={session.user} />
      <main className="flex-1 p-6 lg:p-8">{children}</main>
    </div>
  );
}

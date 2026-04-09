import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function Home() {
  const session = await getSession();

  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 px-4">
      <div className="text-center">
        <h1 className="text-4xl font-bold">Lex Build</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          Peças processuais de alta qualidade, assistidas por IA.
        </p>
      </div>

      <div className="flex gap-3">
        <Link href="/login">
          <Button size="lg">Entrar</Button>
        </Link>
        <Link href="/register">
          <Button size="lg" variant="outline">
            Criar conta
          </Button>
        </Link>
      </div>
    </div>
  );
}

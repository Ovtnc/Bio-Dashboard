import { redirect } from "next/navigation";
import { DnaIcon } from "lucide-react";

import { auth } from "@/auth";
import { LoginForm } from "@/components/auth/login-form";

type LoginPageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
    reauth?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const session = await auth();
  const forceReauth = params.reauth === "1";

  if (session?.user && !forceReauth) {
    redirect("/dashboard");
  }

  const callbackUrl =
    typeof params.callbackUrl === "string" && params.callbackUrl.startsWith("/")
      ? params.callbackUrl
      : "/dashboard";
  const googleEnabled = Boolean(
    process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
  );

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-100 via-zinc-50 to-emerald-50 p-4 dark:from-zinc-950 dark:via-zinc-900 dark:to-emerald-950/40">
      <div className="absolute -top-28 -left-28 size-64 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/20" />
      <div className="absolute -right-24 -bottom-24 size-64 rounded-full bg-emerald-300/30 blur-3xl dark:bg-emerald-500/20" />

      <section className="relative grid w-full max-w-5xl gap-6 md:grid-cols-[1.1fr_1fr]">
        <div className="hidden rounded-2xl border bg-card/80 p-8 backdrop-blur md:block">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            <DnaIcon className="size-3.5" />
            Bio Dash Secure Access
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Biyoinformatik analizlerini tek merkezden yönetin
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            QC, genom tarayıcı, diferansiyel ifade ve raporlama modüllerine güvenli erişim
            sağlayan kurumsal giriş ekranı.
          </p>
        </div>

        <LoginForm callbackUrl={callbackUrl} googleEnabled={googleEnabled} />
      </section>
    </main>
  );
}

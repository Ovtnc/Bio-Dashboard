import { redirect } from "next/navigation";
import { ShieldCheckIcon } from "lucide-react";

import { auth } from "@/auth";
import { RegisterForm } from "@/components/auth/register-form";

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) {
    redirect("/dashboard");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-100 via-zinc-50 to-blue-50 p-4 dark:from-zinc-950 dark:via-zinc-900 dark:to-blue-950/40">
      <div className="absolute -top-28 -right-28 size-64 rounded-full bg-blue-300/30 blur-3xl dark:bg-blue-500/20" />
      <div className="absolute -left-24 -bottom-24 size-64 rounded-full bg-cyan-300/30 blur-3xl dark:bg-cyan-500/20" />

      <section className="relative grid w-full max-w-5xl gap-6 md:grid-cols-[1.1fr_1fr]">
        <div className="hidden rounded-2xl border bg-card/80 p-8 backdrop-blur md:block">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            <ShieldCheckIcon className="size-3.5" />
            Kurumsal Kimlik Yönetimi
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">
            Güvenli hesap oluşturma ve rol tabanlı erişim
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Yeni kullanıcı hesabınızı oluşturarak analiz panellerine, dosya yönetimine ve rapor
            modüllerine güvenli şekilde erişin.
          </p>
        </div>

        <RegisterForm />
      </section>
    </main>
  );
}

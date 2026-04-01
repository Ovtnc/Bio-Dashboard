"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { GlobeIcon, LoaderCircleIcon, LogInIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { loginRequestSchema, type LoginRequestInput } from "@/lib/schemas/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type LoginFormProps = {
  callbackUrl: string;
  googleEnabled: boolean;
};

export function LoginForm({ callbackUrl, googleEnabled }: LoginFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const form = useForm<LoginRequestInput>({
    resolver: zodResolver(loginRequestSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const handleCredentialsLogin = form.handleSubmit(async (values) => {
    setError(null);

    try {
      const result = await signIn("credentials", {
        email: values.email,
        password: values.password,
        redirect: false,
        callbackUrl,
      });

      if (result?.error) {
        setError("E-posta veya şifre hatalı.");
        return;
      }

      router.push(callbackUrl);
      router.refresh();
    } catch {
      setError("Giriş sırasında beklenmeyen bir hata oluştu.");
    }
  });

  return (
    <Card className="border border-border/80 bg-background/95 shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl tracking-tight">Giriş Yap</CardTitle>
        <CardDescription>
          E-posta/şifre veya Google hesabınızla platforma giriş yapın.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleCredentialsLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">E-posta</Label>
            <Input
              id="email"
              type="email"
              {...form.register("email")}
              placeholder="ornek@kurum.com"
              autoComplete="email"
            />
            {form.formState.errors.email?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Şifre</Label>
            <Input
              id="password"
              type="password"
              {...form.register("password")}
              placeholder="********"
              autoComplete="current-password"
            />
            {form.formState.errors.password?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          {error ? (
            <p className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? (
              <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
            ) : (
              <LogInIcon className="mr-2 size-4" />
            )}
            Giriş Yap
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">veya</span>
          </div>
        </div>

        <Button
          variant="outline"
          className="w-full"
          disabled={!googleEnabled || isGoogleLoading}
          onClick={async () => {
            if (!googleEnabled) {
              setError("Google girişi henüz yapılandırılmadı.");
              return;
            }

            setError(null);
            setIsGoogleLoading(true);
            await signIn("google", { callbackUrl });
          }}
        >
          {isGoogleLoading ? (
            <LoaderCircleIcon className="mr-2 size-4 animate-spin" />
          ) : (
            <GlobeIcon className="mr-2 size-4" />
          )}
          Google ile Giriş Yap
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Hesabın yok mu?{" "}
          <Link href="/register" className="font-medium text-foreground hover:underline">
            Kayıt ol
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import { LoaderCircleIcon, UserPlusIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import {
  apiMessageResponseSchema,
  registerFormSchema,
  registerRequestSchema,
  registerResponseSchema,
  type RegisterFormInput,
} from "@/lib/schemas/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const form = useForm<RegisterFormInput>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
    },
  });

  const handleSubmit = form.handleSubmit(async (values) => {
    setError(null);

    const requestPayload = registerRequestSchema.parse({
      name: values.name,
      email: values.email,
      password: values.password,
    });

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestPayload),
      });

      if (!response.ok) {
        const payload = apiMessageResponseSchema.safeParse(await response.json());
        setError(payload.success ? payload.data.message : "Kayıt oluşturulamadı.");
        return;
      }

      const successPayload = registerResponseSchema.safeParse(await response.json());
      if (!successPayload.success) {
        setError("Kayıt yanıtı doğrulanamadı.");
        return;
      }

      const result = await signIn("credentials", {
        email: requestPayload.email,
        password: requestPayload.password,
        redirect: false,
        callbackUrl: "/dashboard",
      });

      if (result?.error) {
        router.push("/login");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Kayıt sırasında beklenmeyen bir hata oluştu.");
    }
  });

  return (
    <Card className="border border-border/80 bg-background/95 shadow-lg">
      <CardHeader className="space-y-2">
        <CardTitle className="text-2xl tracking-tight">Kayıt Ol</CardTitle>
        <CardDescription>
          Bio Dash platformuna erişmek için yeni bir kullanıcı hesabı oluşturun.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Ad Soyad</Label>
            <Input
              id="name"
              {...form.register("name")}
              placeholder="Okan Vatanci"
              autoComplete="name"
            />
            {form.formState.errors.name?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>

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
              placeholder="En az 8 karakter"
              autoComplete="new-password"
            />
            {form.formState.errors.password?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Şifre Tekrar</Label>
            <Input
              id="confirmPassword"
              type="password"
              {...form.register("confirmPassword")}
              placeholder="Şifrenizi tekrar girin"
              autoComplete="new-password"
            />
            {form.formState.errors.confirmPassword?.message ? (
              <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>
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
              <UserPlusIcon className="mr-2 size-4" />
            )}
            Hesap Oluştur
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground">
          Zaten hesabın var mı?{" "}
          <Link href="/login" className="font-medium text-foreground hover:underline">
            Giriş yap
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

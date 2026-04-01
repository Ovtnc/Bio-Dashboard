"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { LogInIcon, LogOutIcon, MenuIcon, UserPlusIcon } from "lucide-react";

import { GlobalCommandPalette } from "@/components/layout/global-command-palette";
import { NotificationCenter } from "@/components/layout/notification-center";
import { ModeToggle } from "@/components/layout/theme-toggle";
import { SidebarContent } from "@/components/layout/app-sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function AppHeader() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const userName = session?.user?.name?.trim() || "Kullanıcı";
  const hideAuthCtas = !session?.user && pathname.startsWith("/qc");

  return (
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6">
        <Sheet>
          <SheetTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="md:hidden"
              />
            }
          >
            <MenuIcon />
            <span className="sr-only">Open sidebar</span>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0" showCloseButton={false}>
            <SidebarContent />
          </SheetContent>
        </Sheet>

        <div className="w-full">
          <GlobalCommandPalette />
        </div>

        <div className="ml-auto flex items-center gap-2">
          {session?.user ? <NotificationCenter /> : null}
          <ModeToggle />
          {session?.user ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  void signOut({ callbackUrl: "/" });
                }}
              >
                <LogOutIcon className="mr-1 size-3.5" />
                Çıkış
              </Button>
              <p className="hidden max-w-36 truncate text-sm text-muted-foreground md:block">
                {userName}
              </p>
              <Avatar className="size-9">
                {session.user.image ? (
                  <AvatarImage src={session.user.image} alt={userName} />
                ) : null}
                <AvatarFallback>
                  {userName.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          ) : hideAuthCtas ? null : (
            <div className="hidden items-center gap-2 md:flex">
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<Link href="/login" />}
              >
                <LogInIcon className="mr-1 size-3.5" />
                Giriş
              </Button>
              <Button size="sm" nativeButton={false} render={<Link href="/register" />}>
                <UserPlusIcon className="mr-1 size-3.5" />
                Kayıt Ol
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

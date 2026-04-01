"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

export function AuthSessionProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      refetchOnWindowFocus
      refetchInterval={5 * 60}
    >
      {children}
    </SessionProvider>
  );
}

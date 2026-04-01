import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { AuthSessionProvider } from "@/components/auth/session-provider";
import { QuickLabNotes } from "@/components/notes/quick-lab-notes";
import { AnalysisWebsocketNotifier } from "@/components/notifications/analysis-websocket-notifier";
import { NotificationProvider } from "@/components/notifications/notification-provider";
import { FrontendErrorBridge } from "@/components/observability/frontend-error-bridge";
import { GeneBasketProvider } from "@/components/providers/gene-basket-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bio Dash",
  description: "Bio Dash dashboard application",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AuthSessionProvider>
          <ThemeProvider>
            <NotificationProvider>
              <GeneBasketProvider>
                <FrontendErrorBridge />
                <AnalysisWebsocketNotifier />
                {children}
                <QuickLabNotes />
                <Toaster position="top-right" richColors />
              </GeneBasketProvider>
            </NotificationProvider>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}

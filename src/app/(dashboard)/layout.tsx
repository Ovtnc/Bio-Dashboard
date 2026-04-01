import type { ReactNode } from "react";

import { AppHeader } from "@/components/layout/app-header";
import { AnalysisNavigator } from "@/components/layout/AnalysisNavigator";
import { DesktopSidebar } from "@/components/layout/app-sidebar";
import { DashboardPageTransition } from "@/components/layout/dashboard-page-transition";

type DashboardLayoutProps = {
  children: ReactNode;
};

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="print:hidden" data-app-sidebar>
        <DesktopSidebar />
      </div>
      <div className="flex min-h-screen flex-col md:pl-72 print:pl-0">
        <div className="print:hidden" data-app-header>
          <AppHeader />
        </div>
        <div className="print:hidden" data-analysis-navigator>
          <AnalysisNavigator />
        </div>
        <DashboardPageTransition>{children}</DashboardPageTransition>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  BarChart3Icon,
  DnaIcon,
  FileTextIcon,
  FolderKanbanIcon,
  HomeIcon,
  LayoutDashboardIcon,
  MicroscopeIcon,
  SettingsIcon,
} from "lucide-react";

import { Separator } from "@/components/ui/separator";

const navItems = [
  { label: "Anasayfa", icon: HomeIcon, href: "/" },
  { label: "Dashboard Özet", icon: LayoutDashboardIcon, href: "/dashboard" },
  { label: "Veri Kalite Kontrolü (QC)", icon: BarChart3Icon, href: "/qc" },
  { label: "Genom Tarayıcı", icon: DnaIcon, href: "/genome-browser" },
  { label: "Diferansiyel İfade", icon: MicroscopeIcon, href: "/differential-expression" },
  { label: "Raporlar", icon: FileTextIcon, href: "/reports" },
  { label: "Analiz Durumu", icon: ActivityIcon, href: "/analysis-status" },
  { label: "Dosya Yöneticisi", icon: FolderKanbanIcon, href: "/files" },
  { label: "Ayarlar", icon: SettingsIcon, href: "/settings" },
];

function SidebarNav() {
  const pathname = usePathname();

  const isActiveItem = (href: string) => {
    if (href === "/") {
      return pathname === "/";
    }

    return pathname.startsWith(href);
  };

  return (
    <nav className="space-y-1 p-3">
      {navItems.map(({ label, icon: Icon, href }) => (
        <Link
          key={label}
          href={href}
          className={[
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
            isActiveItem(href)
              ? "bg-sidebar-accent text-sidebar-accent-foreground"
              : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
          ].join(" ")}
        >
          <Icon className="size-4 shrink-0" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

export function SidebarContent() {
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="px-5 py-5">
        <p className="text-lg font-semibold tracking-tight text-sidebar-foreground">
          Bio Dash
        </p>
        <p className="mt-1 text-xs text-muted-foreground">Bioinformatics Platform</p>
      </div>
      <Separator />
      <div className="px-6 pt-4">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          Navigasyon
        </p>
      </div>
      <SidebarNav />
    </div>
  );
}

export function DesktopSidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-sidebar-border md:block">
      <SidebarContent />
    </aside>
  );
}

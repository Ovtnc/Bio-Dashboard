"use client";

import { BellIcon, CheckCheckIcon, Trash2Icon } from "lucide-react";

import { useNotifications } from "@/components/notifications/notification-provider";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function formatDate(value: string) {
  return new Date(value).toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationCenter() {
  const { notifications, unreadCount, markAllAsRead, clearNotifications } = useNotifications();

  return (
    <Popover onOpenChange={(open) => open && markAllAsRead()}>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            className="relative"
            aria-label="Bildirim merkezi"
          />
        }
      >
        <BellIcon className="size-4" />
        {unreadCount > 0 ? (
          <span className="absolute -top-1 -right-1 inline-flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <p className="text-sm font-semibold">Bildirimler</p>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={markAllAsRead}
              aria-label="Tümünü okundu işaretle"
            >
              <CheckCheckIcon className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={clearNotifications}
              aria-label="Bildirimleri temizle"
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          </div>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {notifications.length ? (
            <div className="space-y-1">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={[
                    "rounded-md border p-2.5",
                    notification.read
                      ? "bg-background"
                      : "bg-primary/5 ring-1 ring-primary/20",
                  ].join(" ")}
                >
                  <p className="text-sm font-medium">{notification.title}</p>
                  {notification.description ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {notification.description}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {formatDate(notification.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Henüz bildirim yok.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

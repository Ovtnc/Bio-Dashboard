"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type NotificationItem = {
  id: string;
  title: string;
  description?: string;
  createdAt: string;
  read: boolean;
};

type NotificationInput = {
  title: string;
  description?: string;
};

type NotificationContextValue = {
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (payload: NotificationInput) => void;
  markAllAsRead: () => void;
  clearNotifications: () => void;
};

const NOTIFICATION_STORAGE_KEY = "bio-dash.notifications";

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(NOTIFICATION_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as NotificationItem[];
        if (Array.isArray(parsed)) {
          setNotifications(parsed);
        }
      }
    } catch {
      // Yerel depolama bozuksa sessizce varsayılan liste ile devam et.
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    localStorage.setItem(NOTIFICATION_STORAGE_KEY, JSON.stringify(notifications));
  }, [isHydrated, notifications]);

  const addNotification = useCallback((payload: NotificationInput) => {
    setNotifications((prev) => [
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: payload.title,
        description: payload.description,
        createdAt: new Date().toISOString(),
        read: false,
      },
      ...prev,
    ]);
  }, []);

  const markAllAsRead = useCallback(() => {
    setNotifications((prev) =>
      prev.map((notification) => ({
        ...notification,
        read: true,
      }))
    );
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.read).length,
    [notifications]
  );

  const value = useMemo<NotificationContextValue>(
    () => ({
      notifications,
      unreadCount,
      addNotification,
      markAllAsRead,
      clearNotifications,
    }),
    [notifications, unreadCount, addNotification, markAllAsRead, clearNotifications]
  );

  return (
    <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);

  if (!context) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }

  return context;
}

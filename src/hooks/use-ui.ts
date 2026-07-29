"use client";

import { useUIStore } from "@/store/ui.store";

export function useUI() {
  const { sidebarOpen, toggleSidebar, setSidebarOpen } = useUIStore();
  return { sidebarOpen, toggleSidebar, setSidebarOpen };
}

// src/store/ui.store.ts
import { create } from "zustand";

interface UiState {
  sidebarCollapsed: boolean;
  activeModals: Record<string, boolean>;
  toasts: Array<{
    id: string;
    message: string;
    type: "success" | "error" | "info";
  }>;
  setSidebarCollapsed: (v: boolean) => void;
  toggleSidebar: () => void;
  openModal: (key: string) => void;
  closeModal: (key: string) => void;
  isModalOpen: (key: string) => boolean;
  addToast: (message: string, type?: "success" | "error" | "info") => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiState>((set, get) => ({
  sidebarCollapsed: false,
  activeModals: {},
  toasts: [],

  setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  openModal: (key) =>
    set((s) => ({ activeModals: { ...s.activeModals, [key]: true } })),
  closeModal: (key) =>
    set((s) => ({ activeModals: { ...s.activeModals, [key]: false } })),
  isModalOpen: (key) => get().activeModals[key] ?? false,
  addToast: (message, type = "info") => {
    const id = Math.random().toString(36).slice(2);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => get().removeToast(id), 4000);
  },
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

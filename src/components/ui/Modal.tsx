"use client";
import { useEffect } from "react";
interface ModalProps { open: boolean; onClose: () => void; title?: string; children: React.ReactNode; size?: "sm" | "md" | "lg"; }
export function Modal({ open, onClose, title, children, size = "md" }: ModalProps) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);
  if (!open) return null;
  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className={`relative w-full ${widths[size]} rounded-xl bg-white shadow-xl`}>
        {title && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
            <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 text-xl leading-none">×</button>
          </div>
        )}
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

import { create } from "zustand";

export type ToastKind = "success" | "info" | "warning" | "danger";

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  description?: string;
  durationMs: number;
}

interface ToastState {
  toasts: Toast[];
  push: (toast: Omit<Toast, "id" | "durationMs"> & { durationMs?: number }) => number;
  dismiss: (id: number) => void;
  clear: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  push(toast) {
    const id = nextId++;
    const entry: Toast = { id, durationMs: toast.kind === "danger" ? 8000 : 4500, ...toast };
    set((state) => ({ toasts: [...state.toasts.slice(-3), entry] }));
    return id;
  },
  dismiss(id) {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  },
  clear() {
    set({ toasts: [] });
  },
}));

export const toast = {
  success: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: "success", title, description }),
  info: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: "info", title, description }),
  warning: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: "warning", title, description }),
  danger: (title: string, description?: string) =>
    useToastStore.getState().push({ kind: "danger", title, description }),
};

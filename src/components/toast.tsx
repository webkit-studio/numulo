"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface ToastAction {
  label: string;
  run: () => void | Promise<void>;
}

interface Toast {
  id: number;
  text: string;
  tone: "info" | "success" | "danger";
  /** One optional way back — "vrátit zpět" on a destructive-feeling change. */
  action?: ToastAction;
}

const ToastContext = createContext<{
  show: (text: string, tone?: Toast["tone"], action?: ToastAction) => void;
}>({
  show: () => {},
});

export const useToast = () => useContext(ToastContext);

let nextId = 1;

/** Spec §2: dark green pill at the bottom, 2.8 s, one per action. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (text: string, tone: Toast["tone"] = "success", action?: ToastAction) => {
      setToasts((current) => [...current, { id: nextId++, text, tone, action }]);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <ToastPill
            key={toast.id}
            toast={toast}
            onDone={() => setToasts((c) => c.filter((t) => t.id !== toast.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastPill({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  useEffect(() => {
    // A pill with a way back stays long enough to take it.
    const timer = setTimeout(onDone, toast.action ? 6000 : 2800);
    return () => clearTimeout(timer);
  }, [onDone, toast.action]);

  return (
    <div className={`toast fade toast-${toast.tone}`}>
      {toast.text}
      {toast.action ? (
        <button
          type="button"
          className="toast-action"
          onClick={() => {
            void toast.action?.run();
            onDone();
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
    </div>
  );
}

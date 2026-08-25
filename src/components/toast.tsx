"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "success" | "danger";
}

const ToastContext = createContext<{ show: (text: string, tone?: Toast["tone"]) => void }>({
  show: () => {},
});

export const useToast = () => useContext(ToastContext);

let nextId = 1;

/** Spec §2: dark green pill at the bottom, 2.8 s, one per action. */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback((text: string, tone: Toast["tone"] = "success") => {
    setToasts((current) => [...current, { id: nextId++, text, tone }]);
  }, []);

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
    const timer = setTimeout(onDone, 2800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return <div className={`toast fade toast-${toast.tone}`}>{toast.text}</div>;
}

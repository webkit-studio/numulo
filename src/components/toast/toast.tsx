"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

interface Toast {
  id: number;
  text: string;
  tone: "info" | "success" | "danger";
  /** Optional undo, shown as a button inside the toast. */
  undo?: () => void | Promise<void>;
}

interface ToastApi {
  show: (
    text: string,
    options?: { tone?: Toast["tone"]; undo?: Toast["undo"] },
  ) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  // A component rendered outside the provider should not crash the page over
  // a notification — it just loses the toast.
  return api ?? { show: () => {} };
}

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback<ToastApi["show"]>((text, options = {}) => {
    const toast: Toast = {
      id: nextId++,
      text,
      tone: options.tone ?? "info",
      undo: options.undo,
    };
    setToasts((current) => [...current, toast]);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onDone={() =>
              setToasts((current) => current.filter((t) => t.id !== toast.id))
            }
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDone }: { toast: Toast; onDone: () => void }) {
  const [undone, setUndone] = useState(false);

  useEffect(() => {
    // An undoable toast stays longer — the offer is worthless if it vanishes
    // before it can be read.
    const timeout = setTimeout(onDone, toast.undo ? 8000 : 4000);
    return () => clearTimeout(timeout);
  }, [onDone, toast.undo]);

  return (
    <div className={`toast toast-${toast.tone}`}>
      <span>{toast.text}</span>
      {toast.undo && !undone ? (
        <button
          type="button"
          onClick={async () => {
            setUndone(true);
            await toast.undo?.();
            onDone();
          }}
        >
          Vrátit
        </button>
      ) : null}
    </div>
  );
}

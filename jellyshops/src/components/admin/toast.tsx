"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, X, XCircle } from "lucide-react";

type Toast = { id: number; message: string; tone: "success" | "critical"; action?: { label: string; onAction: () => void } };
type ShowToast = (message: string, options?: { tone?: Toast["tone"]; action?: Toast["action"] }) => void;

const ToastContext = createContext<ShowToast | null>(null);
const noop: ShowToast = () => undefined;
const TOAST_MS = 5000;

/** Short confirmation after an action ("Product saved"). Without a provider it does nothing. */
export const useToast = (): ShowToast => useContext(ToastContext) ?? noop;

function ToastItem({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  useEffect(() => { const timer = window.setTimeout(onClose, TOAST_MS); return () => window.clearTimeout(timer); }, [onClose]);
  const Icon = toast.tone === "critical" ? XCircle : CheckCircle2;
  return <div className={`jk-toast jk-tone-${toast.tone}`}>
    <Icon size={16} aria-hidden="true" /><span>{toast.message}</span>
    {toast.action && <button type="button" className="jk-toast-action" onClick={() => { toast.action?.onAction(); onClose(); }}>{toast.action.label}</button>}
    <button type="button" className="jk-icon-button" aria-label="Dismiss message" onClick={onClose}><X size={14} /></button>
  </div>;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const show = useCallback<ShowToast>((message, options) => {
    const id = next.current++;
    setToasts((current) => [...current.slice(-2), { id, message, tone: options?.tone ?? "success", action: options?.action }]);
  }, []);
  const close = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);
  const value = useMemo(() => show, [show]);
  return <ToastContext.Provider value={value}>
    {children}
    <div className="jk-toasts" role="status" aria-live="polite">{toasts.map((toast) => <ToastItem key={toast.id} toast={toast} onClose={() => close(toast.id)} />)}</div>
  </ToastContext.Provider>;
}

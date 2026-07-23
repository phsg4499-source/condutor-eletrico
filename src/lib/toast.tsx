import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, Info, AlertTriangle, X } from 'lucide-react';

type ToastKind = 'success' | 'info' | 'warning';
interface ToastItem { id: number; message: string; kind: ToastKind; }

interface ToastContextValue {
  show: (message: string, kind?: ToastKind) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const icons: Record<ToastKind, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircle2, info: Info, warning: AlertTriangle,
};
const colors: Record<ToastKind, string> = {
  success: 'border-emerald-500/40 text-emerald-300',
  info: 'border-blue-500/40 text-blue-300',
  warning: 'border-amber-500/40 text-amber-300',
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const show = useCallback((message: string, kind: ToastKind = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, kind }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500);
  }, []);

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 w-[calc(100%-2rem)] max-w-sm">
        {toasts.map(t => {
          const Icon = icons[t.kind];
          return (
            <div key={t.id} className={`ce-toast-in flex items-start gap-2 bg-[#16181d] border ${colors[t.kind]} rounded-lg px-4 py-3 shadow-xl`}>
              <Icon size={18} className="shrink-0 mt-0.5" />
              <span className="text-sm text-gray-100 flex-1">{t.message}</span>
              <button onClick={() => setToasts(prev => prev.filter(x => x.id !== t.id))} className="text-gray-500 hover:text-gray-300">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast precisa estar dentro de <ToastProvider>');
  return ctx;
}

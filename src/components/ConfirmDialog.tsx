import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button. Defaults to true (most confirmations here are deletes). */
  destructive?: boolean;
}

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const normalized = typeof opts === 'string' ? { message: opts } : opts;
    return new Promise<boolean>(resolve => {
      resolveRef.current = resolve;
      setOptions(normalized);
    });
  }, []);

  const handle = useCallback((result: boolean) => {
    setOptions(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  }, []);

  useEffect(() => {
    if (!options) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handle(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [options, handle]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center" role="dialog" aria-modal="true" aria-label={options.title || 'Confirm'}>
          <div className="absolute inset-0 bg-black/40" onClick={() => handle(false)} />
          <div className="relative bg-white rounded-lg shadow-xl max-w-sm w-full mx-4 p-5">
            {options.title && <h2 className="text-base font-semibold text-gray-900 mb-2">{options.title}</h2>}
            <p className="text-sm text-gray-600 mb-4">{options.message}</p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => handle(false)}
                className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-md min-h-[40px]"
              >
                {options.cancelLabel || 'Cancel'}
              </button>
              <button
                type="button"
                autoFocus
                onClick={() => handle(true)}
                className={`px-3 py-1.5 text-sm rounded-md text-white min-h-[40px] ${
                  options.destructive === false ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {options.confirmLabel || 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

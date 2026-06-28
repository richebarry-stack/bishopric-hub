export type ToastType = 'error' | 'success' | 'info';

type ToastListener = (msg: string, type: ToastType) => void;
let _listener: ToastListener | null = null;

export const toast = {
  error:   (msg: string) => _listener?.(msg, 'error'),
  success: (msg: string) => _listener?.(msg, 'success'),
  info:    (msg: string) => _listener?.(msg, 'info'),
  _register:   (fn: ToastListener) => { _listener = fn; },
  _unregister: ()                  => { _listener = null; },
};

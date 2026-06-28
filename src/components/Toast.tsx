import { useState, useEffect, useCallback } from 'react';
import { toast, type ToastType } from '../lib/toast';

interface ToastItem { id: number; msg: string; type: ToastType; }

const BG: Record<ToastType, string> = {
  error:   'bg-red-600',
  success: 'bg-green-600',
  info:    'bg-gray-700',
};

export default function ToastContainer() {
  const [items, setItems] = useState<ToastItem[]>([]);
  let nextId = 0;

  const add = useCallback((msg: string, type: ToastType) => {
    const id = ++nextId;
    setItems(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setItems(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);

  useEffect(() => {
    toast._register(add);
    return () => toast._unregister();
  }, [add]);

  if (!items.length) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {items.map(t => (
        <div key={t.id}
          className={`${BG[t.type]} text-white text-sm px-4 py-2.5 rounded-lg shadow-lg max-w-sm pointer-events-auto`}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

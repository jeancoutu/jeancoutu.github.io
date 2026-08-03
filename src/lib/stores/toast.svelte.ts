export interface ToastEvent {
  message: string;
}

type ToastListener = (event: ToastEvent) => void;
const listeners = new Set<ToastListener>();

export function onToast(listener: ToastListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function showToast(message: string): void {
  for (const listener of listeners) listener({ message });
}

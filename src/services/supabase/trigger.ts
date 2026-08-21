type Listener = () => void;
const listeners = new Set<Listener>();
let timer: ReturnType<typeof setTimeout> | null = null;

export function requestSyncSoon(delay = 1500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => {
    timer = null;
    listeners.forEach((listener) => listener());
  }, delay);
}

export function subscribeToSyncRequests(listener: Listener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const isDev = () =>
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.__DEV__ === true);

export function devLog(...args) {
  if (isDev()) console.log(...args);
}

export function devWarn(...args) {
  if (isDev()) console.warn(...args);
}

export function devError(...args) {
  if (isDev()) console.error(...args);
}

// Limite de tentativas de login (em memoria; em varias replicas, mover para Redis).
const MAX = 5, WINDOW_MS = 15 * 60 * 1000;
const hits = new Map<string, { n: number; first: number }>();
export function blocked(key: string): boolean {
  const h = hits.get(key);
  if (!h) return false;
  if (Date.now() - h.first > WINDOW_MS) { hits.delete(key); return false; }
  return h.n >= MAX;
}
export function fail(key: string) {
  const h = hits.get(key);
  if (!h || Date.now() - h.first > WINDOW_MS) hits.set(key, { n: 1, first: Date.now() });
  else h.n++;
}
export const reset = (key: string) => hits.delete(key);

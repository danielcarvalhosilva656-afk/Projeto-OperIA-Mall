export const API = (import.meta.env.VITE_API_URL as string) || 'http://localhost:3000';
export const PRIORITY_LABEL: Record<string, string> = { CRITICA: 'Crítica', ALTA: 'Alta', MEDIA: 'Média', BAIXA: 'Baixa' };
export const PRIORITY_ICON: Record<string, string> = { CRITICA: '▲', ALTA: '◆', MEDIA: '●', BAIXA: '▼' };
export const STATUS_LABEL: Record<string, string> = { ABERTA: 'Aberta', EM_ATENDIMENTO: 'Em atendimento', PAUSADA: 'Pausada', CONCLUIDA: 'Concluída' };

export interface User { id: number; role: string; team_id: number | null; name: string }
let token = sessionStorage.getItem('token') || '';
export const getToken = () => token;
export const setToken = (t: string) => { token = t; t ? sessionStorage.setItem('token', t) : sessionStorage.removeItem('token'); };

export async function api<T = any>(path: string, opts: { method?: string; body?: unknown; query?: Record<string, any> } = {}): Promise<T> {
  const qs = opts.query ? '?' + new URLSearchParams(Object.entries(opts.query).filter(([, v]) => v !== '' && v != null) as [string, string][]) : '';
  const r = await fetch(API + path + qs, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Falha na requisição.');
  return data as T;
}

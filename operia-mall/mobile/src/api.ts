import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const API = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:3000'; // 10.0.2.2 = host no emulador Android
let token = '';
export const loadToken = async () => (token = (await SecureStore.getItemAsync('token')) || '');
export const setToken = async (t: string) => { token = t; t ? await SecureStore.setItemAsync('token', t) : await SecureStore.deleteItemAsync('token'); };
export const getToken = () => token;

export class NetworkError extends Error {}

export async function api<T = any>(path: string, body?: unknown, method?: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API + path, {
      method: method || (body ? 'POST' : 'GET'),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new NetworkError('Sem conexão.'); }
  if (r.status === 204) return undefined as T;
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || 'Falha na requisição.');
  return data as T;
}

export async function uploadAttachment(occId: number, uri: string, mime: string, name: string) {
  const form = new FormData();
  form.append('file', { uri, type: mime, name } as any);
  let r: Response;
  try { r = await fetch(`${API}/occurrences/${occId}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }); }
  catch { throw new NetworkError('Sem conexão.'); }
  if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Falha ao enviar anexo.');
}

// ---- Fila local de envio (conectividade instavel em subsolos) ----
export interface Pending { key: string; body: { category_id: number; location_id: number; description: string }; files: { uri: string; mime: string; name: string }[] }
const KEY = 'pending-occurrences';
export const readQueue = async (): Promise<Pending[]> => JSON.parse((await AsyncStorage.getItem(KEY)) || '[]');
const writeQueue = (q: Pending[]) => AsyncStorage.setItem(KEY, JSON.stringify(q));
export async function enqueue(p: Pending) { await writeQueue([...(await readQueue()), p]); }

// Reenvia pendentes; retorna quantidade sincronizada. Falha de rede interrompe e mantem o restante.
export async function flushQueue(): Promise<number> {
  let done = 0;
  for (const p of await readQueue()) {
    try {
      const occ = await api('/occurrences', p.body);
      for (const f of p.files) await uploadAttachment(occ.id, f.uri, f.mime, f.name);
      await writeQueue((await readQueue()).filter(x => x.key !== p.key)); done++;
    } catch (e) {
      if (e instanceof NetworkError) break;
      await writeQueue((await readQueue()).filter(x => x.key !== p.key)); // erro de validacao: descarta
    }
  }
  return done;
}

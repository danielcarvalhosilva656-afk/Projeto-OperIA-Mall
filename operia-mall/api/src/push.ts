import { q } from './db';

// Push nativo via servico da Expo (encaminha para FCM/APNs). Falhas nunca derrubam o fluxo principal.
export async function sendPush(userIds: number[], title: string, body: string, data: Record<string, unknown> = {}) {
  if (!userIds.length) return;
  try {
    const rows = await q<{ token: string }>('SELECT token FROM push_tokens WHERE user_id = ANY($1::int[])', [userIds]);
    if (!rows.length) return;
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(rows.map(r => ({ to: r.token, title, body, sound: 'default', data }))),
      signal: AbortSignal.timeout(5000),
    });
  } catch (e) { console.warn('[push] falhou', (e as Error).message); }
}

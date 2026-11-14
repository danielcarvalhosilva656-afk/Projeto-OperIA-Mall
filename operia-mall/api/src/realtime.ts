import { Server } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import { AuthUser, verifyToken } from './auth';
import { q } from './db';
import { sendPush } from './push';

const clients = new Set<{ ws: WebSocket; user: AuthUser }>();

export function attachRealtime(server: Server) {
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws, req) => {
    try {
      const token = new URL(req.url || '', 'http://x').searchParams.get('token') || '';
      const user = verifyToken(token);
      const c = { ws, user };
      clients.add(c);
      ws.on('close', () => clients.delete(c));
      ws.send(JSON.stringify({ type: 'connected' }));
    } catch {
      ws.close(4401, 'unauthorized');
    }
  });
}

// Admin recebe tudo; equipe recebe eventos da propria equipe; solicitante recebe os seus.
export function emitOccurrence(type: string, occ: { id: number; protocol: string; team_id: number | null; requester_id: number; priority?: string; status?: string }) {
  const msg = JSON.stringify({ type, occurrence: occ, at: new Date().toISOString() });
  for (const { ws, user } of clients) {
    const allowed = user.role === 'ADMIN' || user.team_id === occ.team_id || user.id === occ.requester_id;
    if (allowed && ws.readyState === WebSocket.OPEN) ws.send(msg);
  }
}

export async function notify(userIds: number[], occurrenceId: number, content: string) {
  const unique = [...new Set(userIds)];
  for (const uid of unique) {
    await q('INSERT INTO notifications (user_id, occurrence_id, content) VALUES ($1,$2,$3)', [uid, occurrenceId, content]);
  }
  void sendPush(unique, 'OperIA Mall', content, { occurrence_id: occurrenceId });
  const msg = JSON.stringify({ type: 'notification', occurrence_id: occurrenceId, content });
  for (const { ws, user } of clients)
    if (unique.includes(user.id) && ws.readyState === WebSocket.OPEN) ws.send(msg);
}

export async function recipientsFor(teamId: number | null): Promise<number[]> {
  const rows = await q<{ id: number }>(
    `SELECT id FROM users WHERE active AND (role='ADMIN' OR ($1::int IS NOT NULL AND team_id=$1))`, [teamId]);
  return rows.map(r => r.id);
}

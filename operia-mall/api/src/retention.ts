import { q } from './db';
import { config } from './config';
import { storage } from './storage';

// Politica de retencao (LGPD): descarta anexos e notificacoes antigos. Ocorrencias e historico
// permanecem para auditoria, com dados pessoais anonimizaveis via endpoint administrativo.
export async function runRetention() {
  const old = await q<{ id: number; storage_key: string }>(
    `SELECT id, storage_key FROM attachments WHERE created_at < now() - ($1 || ' days')::interval`, [config.retention.attachmentDays]);
  for (const a of old) {
    try { await storage.remove(a.storage_key); await q('DELETE FROM attachments WHERE id=$1', [a.id]); }
    catch (e) { console.warn('[retencao] falha no anexo', a.id, (e as Error).message); }
  }
  await q(`DELETE FROM notifications WHERE created_at < now() - ($1 || ' days')::interval`, [config.retention.notificationDays]);
  if (old.length) console.log(`[retencao] ${old.length} anexo(s) descartado(s)`);
}
export const scheduleRetention = () => { setTimeout(() => runRetention().catch(console.error), 30_000); setInterval(() => runRetention().catch(console.error), 24 * 3600 * 1000); };

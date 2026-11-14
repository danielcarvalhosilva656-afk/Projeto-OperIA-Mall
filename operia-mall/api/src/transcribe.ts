import { analyze } from './ai';
import { config } from './config';
import { q } from './db';
import { emitOccurrence, notify, recipientsFor } from './realtime';

const PLACEHOLDER = 'Ocorrência registrada por áudio';

// Transcreve em segundo plano (RF03). Se o ASR nao estiver instalado (HTTP 501), apenas ignora.
export async function transcribeAttachment(attId: number, occId: number, audio: Buffer, mime: string) {
  const r = await fetch(`${config.aiUrl}/transcribe`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ audio_b64: audio.toString('base64'), mime }), signal: AbortSignal.timeout(120_000),
  });
  if (!r.ok) return;
  const { text } = (await r.json()) as { text?: string };
  if (!text?.trim()) return;
  await q('UPDATE attachments SET transcription=$2 WHERE id=$1', [attId, text]);

  const [o] = await q(`SELECT o.*, c.name category_name, l.floor, l.sector, l.reference
    FROM occurrences o JOIN categories c ON c.id=o.category_id JOIN locations l ON l.id=o.location_id WHERE o.id=$1`, [occId]);
  if (!o) return;
  const description = o.description.startsWith(PLACEHOLDER) ? text : o.description;
  const ai = await analyze({ description: `${description} ${text}`, category: o.category_name, location_text: `${o.floor} ${o.sector} ${o.reference}` });
  const [u] = await q(
    `UPDATE occurrences SET description=$2, ai_priority=$3, ai_justification=$4,
       priority = CASE WHEN priority_confirmed THEN priority ELSE $3 END, updated_at=now() WHERE id=$1 RETURNING *`,
    [occId, description, ai.priority, ai.justification]);
  await q(`INSERT INTO history (occurrence_id,kind,author_id,note) VALUES ($1,'EDICAO',$2,$3)`,
    [occId, o.requester_id, 'Transcrição do áudio incorporada à análise da IA.']);
  emitOccurrence('occurrence.updated', u);
  if (ai.critical) await notify(await recipientsFor(u.team_id), occId, `CRÍTICA — ${u.protocol}: áudio indica situação crítica.`);
}

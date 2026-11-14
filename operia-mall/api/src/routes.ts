import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { z } from 'zod';
import { q } from './db';
import { config } from './config';
import { auth, AuthedRequest, requireRole, signFileToken, signToken, verifyFileToken, verifyToken } from './auth';
import { analyze } from './ai';
import { emitOccurrence, notify, recipientsFor } from './realtime';
import { Action, nextStatus } from './transitions';
import { storage } from './storage';
import { transcribeAttachment } from './transcribe';
import { blocked, fail, reset } from './ratelimit';

export const router = Router();
const wrap = (fn: (req: AuthedRequest, res: Response) => Promise<any>) =>
  (req: Request, res: Response, next: NextFunction) => fn(req as AuthedRequest, res).catch(next);
const PRIORITIES = ['CRITICA', 'ALTA', 'MEDIA', 'BAIXA'] as const;

// ---------- Auth (RF01) ----------
router.post('/auth/login', wrap(async (req, res) => {
  const b = z.object({ login: z.string().min(1), password: z.string().min(1) }).safeParse(req.body);
  if (!b.success) return res.status(400).json({ error: 'Informe email/matrícula e senha.' });
  const rlKey = `${req.ip}|${b.data.login.toLowerCase()}`;
  if (blocked(rlKey)) return res.status(429).json({ error: 'Muitas tentativas. Aguarde 15 minutos.' });
  const [u] = await q(`SELECT * FROM users WHERE active AND (lower(email)=lower($1) OR lower(registration)=lower($1))`, [b.data.login]);
  if (!u || !(await bcrypt.compare(b.data.password, u.password_hash))) {
    fail(rlKey);
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }
  reset(rlKey);
  const user = { id: u.id, role: u.role, team_id: u.team_id, name: u.name };
  res.json({ token: signToken(user), user });
}));
router.get('/me', auth, (req, res) => res.json((req as AuthedRequest).user));

// ---------- Catalogo ----------
router.get('/catalog', auth, wrap(async (_req, res) => {
  res.json({
    categories: await q('SELECT * FROM categories ORDER BY name'),
    locations: await q('SELECT * FROM locations ORDER BY floor, sector, reference'),
    teams: await q('SELECT * FROM teams ORDER BY name'),
  });
}));

// ---------- Filtros / visibilidade ----------
function buildWhere(user: AuthedRequest['user'], f: Record<string, any>) {
  const w: string[] = []; const p: any[] = [];
  const add = (sql: string, v: any) => { p.push(v); w.push(sql.replace('?', `$${p.length}`)); };
  if (user.role !== 'ADMIN') {
    p.push(user.team_id); p.push(user.id);
    w.push(`(o.team_id = $${p.length - 1} OR o.requester_id = $${p.length})`);
  }
  if (f.from) add('o.created_at >= ?', f.from);
  if (f.to) add('o.created_at <= ?', f.to);
  if (f.category_id) add('o.category_id = ?', Number(f.category_id));
  if (f.sector) add('l.sector = ?', f.sector);
  if (f.floor) add('l.floor = ?', f.floor);
  if (f.team_id) add('o.team_id = ?', Number(f.team_id));
  if (f.status) add('o.status = ?', f.status);
  return { where: w.length ? 'WHERE ' + w.join(' AND ') : '', params: p };
}
const BASE = `FROM occurrences o JOIN categories c ON c.id=o.category_id JOIN locations l ON l.id=o.location_id
  LEFT JOIN teams t ON t.id=o.team_id JOIN users r ON r.id=o.requester_id`;
const COLS = `o.*, c.name category_name, c.sla_minutes, l.floor, l.sector, l.reference, l.x, l.y, t.name team_name, r.name requester_name`;
const RANK = `CASE o.priority WHEN 'CRITICA' THEN 0 WHEN 'ALTA' THEN 1 WHEN 'MEDIA' THEN 2 ELSE 3 END`;

async function loadOccurrence(id: number, user: AuthedRequest['user']) {
  const { where, params } = buildWhere(user, {});
  const extra = `${where ? where + ' AND' : 'WHERE'} o.id = $${params.length + 1}`;
  const [o] = await q(`SELECT ${COLS} ${BASE} ${extra}`, [...params, id]);
  return o;
}
const addHistory = (occId: number, kind: string, from: string | null, to: string | null, author: number, note?: string) =>
  q('INSERT INTO history (occurrence_id,kind,from_value,to_value,author_id,note) VALUES ($1,$2,$3,$4,$5,$6)', [occId, kind, from, to, author, note ?? null]);

// ---------- Ocorrencias (RF02, RF04, RF09) ----------
router.get('/occurrences', auth, wrap(async (req, res) => {
  const { where, params } = buildWhere(req.user, req.query);
  const page = Math.max(1, Number(req.query.page) || 1);
  const size = Math.min(100, Number(req.query.size) || 20);
  const [{ n }] = await q(`SELECT count(*) n ${BASE} ${where}`, params);
  const rows = await q(
    `SELECT ${COLS} ${BASE} ${where} ORDER BY ${RANK}, o.created_at ASC LIMIT ${size} OFFSET ${(page - 1) * size}`, params);
  res.json({ total: Number(n), page, size, items: rows });
}));

const createSchema = z.object({
  category_id: z.number().int(), location_id: z.number().int(),
  description: z.string().trim().min(3, 'Descreva a ocorrência.').max(4000),
});
router.post('/occurrences', auth, wrap(async (req, res) => {
  const b = createSchema.safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: b.error.issues[0].message });
  const [cat] = await q('SELECT * FROM categories WHERE id=$1', [b.data.category_id]);
  const [loc] = await q('SELECT * FROM locations WHERE id=$1', [b.data.location_id]);
  if (!cat || !loc) return res.status(422).json({ error: 'Categoria ou localização inexistente.' });

  const [{ n }] = await q(`SELECT count(*) n FROM occurrences WHERE location_id=$1 AND created_at > now() - interval '7 days'`, [loc.id]);
  const ai = await analyze({
    description: b.data.description, category: cat.name,
    location_text: `${loc.floor} ${loc.sector} ${loc.reference}`, recurrence_count: Number(n),
  });
  const [aiCat] = ai.category ? await q('SELECT id FROM categories WHERE name=$1', [ai.category]) : [];
  const [team] = await q(
    `SELECT id FROM teams WHERE specialty=$1 ORDER BY available DESC, id LIMIT 1`, [ai.critical ? 'SEGURANCA' : cat.default_specialty]);

  const [{ seq }] = await q(`SELECT nextval('protocol_seq') seq`);
  const protocol = `OP-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
  const [o] = await q(
    `INSERT INTO occurrences (protocol,description,category_id,location_id,requester_id,team_id,ai_category_id,ai_priority,ai_justification,priority)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$8) RETURNING *`,
    [protocol, b.data.description, cat.id, loc.id, req.user.id, team?.id ?? null, aiCat?.id ?? null, ai.priority, ai.justification]);
  await addHistory(o.id, 'CRIACAO', null, 'ABERTA', req.user.id, ai.justification);
  if (team) await q('INSERT INTO assignments (occurrence_id,team_id,author_id) VALUES ($1,$2,$3)', [o.id, team.id, req.user.id]);

  emitOccurrence('occurrence.created', o);
  const prefix = ai.critical ? 'CRÍTICA — ' : '';
  await notify(await recipientsFor(o.team_id), o.id, `${prefix}Nova ocorrência ${protocol}: ${cat.name} em ${loc.sector}.`);
  res.status(201).json(o);
}));

router.get('/occurrences/:id', auth, wrap(async (req, res) => {
  const o = await loadOccurrence(Number(req.params.id), req.user);
  if (!o) return res.status(404).json({ error: 'Ocorrência não encontrada.' });
  const attachments = await q('SELECT id,kind,mime,size_bytes,transcription,created_at FROM attachments WHERE occurrence_id=$1 ORDER BY id', [o.id]);
  const history = await q(`SELECT h.*, u.name author_name FROM history h JOIN users u ON u.id=h.author_id WHERE occurrence_id=$1 ORDER BY h.id`, [o.id]);
  res.json({ ...o, attachments: attachments.map(a => ({ ...a, url: `/files/${a.id}?t=${signFileToken(a.id)}` })), history });
}));

// Edicao de dados: admin, ou solicitante enquanto ABERTA
router.patch('/occurrences/:id', auth, wrap(async (req, res) => {
  const o = await loadOccurrence(Number(req.params.id), req.user);
  if (!o) return res.status(404).json({ error: 'Ocorrência não encontrada.' });
  const can = req.user.role === 'ADMIN' || (o.requester_id === req.user.id && o.status === 'ABERTA');
  if (!can) return res.status(403).json({ error: 'Você não pode editar esta ocorrência.' });
  const b = z.object({ description: z.string().trim().min(3).optional(), category_id: z.number().int().optional(), location_id: z.number().int().optional() }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: 'Dados inválidos.' });
  const d = { ...o, ...Object.fromEntries(Object.entries(b.data).filter(([, v]) => v !== undefined)) };
  const [u] = await q(`UPDATE occurrences SET description=$2, category_id=$3, location_id=$4, updated_at=now() WHERE id=$1 RETURNING *`,
    [o.id, d.description, d.category_id, d.location_id]);
  await addHistory(o.id, 'EDICAO', null, null, req.user.id, 'Dados da ocorrência editados.');
  emitOccurrence('occurrence.updated', u);
  res.json(u);
}));

// ---------- Status (RF05, RF08) ----------
router.post('/occurrences/:id/status', auth, wrap(async (req, res) => {
  const b = z.object({ action: z.enum(['iniciar', 'pausar', 'retomar', 'concluir']), note: z.string().optional() }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: 'Ação inválida.' });
  const o = await loadOccurrence(Number(req.params.id), req.user);
  if (!o) return res.status(404).json({ error: 'Ocorrência não encontrada.' });
  const isTeam = req.user.team_id !== null && req.user.team_id === o.team_id;
  if (req.user.role !== 'ADMIN' && !isTeam) return res.status(403).json({ error: 'Somente a equipe responsável pode alterar o status.' });
  const r = nextStatus(o.status, b.data.action as Action, b.data.note);
  if (!r.ok) return res.status(409).json({ error: r.error });
  const [u] = await q(
    `UPDATE occurrences SET status=$2, updated_at=now(),
       assignee_id = COALESCE(assignee_id, $3),
       first_response_at = COALESCE(first_response_at, CASE WHEN $2='EM_ATENDIMENTO' THEN now() END),
       resolved_at = CASE WHEN $2='CONCLUIDA' THEN now() ELSE resolved_at END,
       final_note = CASE WHEN $2='CONCLUIDA' THEN $4 ELSE final_note END
     WHERE id=$1 RETURNING *`, [o.id, r.to, req.user.id, b.data.note ?? null]);
  await addHistory(o.id, 'STATUS', o.status, r.to, req.user.id, b.data.note);
  emitOccurrence('occurrence.status', u);
  await notify(await recipientsFor(u.team_id), o.id, `${o.protocol}: status alterado para ${r.to.replace('_', ' ')}.`);
  if (u.requester_id) await notify([u.requester_id], o.id, `${o.protocol}: ${r.to === 'CONCLUIDA' ? 'atendimento concluído' : 'status ' + r.to.replace('_', ' ')}.`);
  res.json(u);
}));

// ---------- Prioridade (RF09) e atribuicao ----------
router.post('/occurrences/:id/priority', auth, requireRole('ADMIN'), wrap(async (req, res) => {
  const b = z.object({ priority: z.enum(PRIORITIES), justification: z.string().trim().min(3, 'Informe a justificativa.') }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: b.error.issues[0].message });
  const o = await loadOccurrence(Number(req.params.id), req.user);
  if (!o) return res.status(404).json({ error: 'Ocorrência não encontrada.' });
  const [u] = await q('UPDATE occurrences SET priority=$2, priority_confirmed=true, updated_at=now() WHERE id=$1 RETURNING *', [o.id, b.data.priority]);
  await addHistory(o.id, 'PRIORIDADE', o.priority, b.data.priority, req.user.id, b.data.justification);
  emitOccurrence('occurrence.priority', u);
  await notify(await recipientsFor(u.team_id), o.id, `${o.protocol}: prioridade alterada para ${b.data.priority}.`);
  res.json(u);
}));

router.post('/occurrences/:id/assign', auth, requireRole('ADMIN'), wrap(async (req, res) => {
  const b = z.object({ team_id: z.number().int(), assignee_id: z.number().int().nullable().optional(), justification: z.string().trim().min(3, 'Informe a justificativa.') }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: b.error.issues[0].message });
  const o = await loadOccurrence(Number(req.params.id), req.user);
  if (!o) return res.status(404).json({ error: 'Ocorrência não encontrada.' });
  const [team] = await q('SELECT id,name FROM teams WHERE id=$1', [b.data.team_id]);
  if (!team) return res.status(422).json({ error: 'Equipe inexistente.' });
  const [u] = await q('UPDATE occurrences SET team_id=$2, assignee_id=$3, updated_at=now() WHERE id=$1 RETURNING *', [o.id, team.id, b.data.assignee_id ?? null]);
  await q('INSERT INTO assignments (occurrence_id,team_id,assignee_id,author_id) VALUES ($1,$2,$3,$4)', [o.id, team.id, b.data.assignee_id ?? null, req.user.id]);
  await addHistory(o.id, 'ATRIBUICAO', String(o.team_id), String(team.id), req.user.id, b.data.justification);
  emitOccurrence('occurrence.assigned', u);
  await notify(await recipientsFor(team.id), o.id, `${o.protocol}: atribuída à equipe ${team.name}.`);
  res.json(u);
}));

// ---------- Anexos (RF03) ----------
const ALLOWED: Record<string, { ext: string[]; kind: 'IMAGEM' | 'AUDIO' }> = {
  'image/jpeg': { ext: ['.jpg', '.jpeg'], kind: 'IMAGEM' },
  'image/png': { ext: ['.png'], kind: 'IMAGEM' },
  'audio/mpeg': { ext: ['.mp3'], kind: 'AUDIO' },
  'audio/mp4': { ext: ['.m4a', '.mp4'], kind: 'AUDIO' },
  'audio/x-m4a': { ext: ['.m4a'], kind: 'AUDIO' },
  'audio/aac': { ext: ['.aac'], kind: 'AUDIO' },
  'audio/wav': { ext: ['.wav'], kind: 'AUDIO' },
  'audio/webm': { ext: ['.webm'], kind: 'AUDIO' },
};
// Confere a assinatura real do arquivo (nao confia so no MIME informado pelo cliente)
const magicOk = (mime: string, b: Buffer) =>
  mime === 'image/jpeg' ? b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff
  : mime === 'image/png' ? b.length > 4 && b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  : b.length > 0;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadBytes },
  fileFilter: (_r, f, cb) => {
    const a = ALLOWED[f.mimetype];
    cb(null, !!a && a.ext.includes(path.extname(f.originalname).toLowerCase()));
  },
});
router.post('/occurrences/:id/attachments', auth, upload.single('file'), wrap(async (req, res) => {
  if (!req.file || !magicOk(req.file.mimetype, req.file.buffer))
    return res.status(415).json({ error: 'Arquivo inválido. Use JPG/PNG (imagem) ou áudio MP3/M4A/AAC/WAV até 10 MB.' });
  const o = await loadOccurrence(Number(req.params.id), req.user);
  if (!o) return res.status(404).json({ error: 'Ocorrência não encontrada.' });
  const kind = ALLOWED[req.file.mimetype].kind;
  const key = crypto.randomUUID() + path.extname(req.file.originalname).toLowerCase();
  await storage.put(key, req.file.buffer, req.file.mimetype);
  const [a] = await q(
    `INSERT INTO attachments (occurrence_id,kind,storage_key,mime,size_bytes) VALUES ($1,$2,$3,$4,$5) RETURNING id,kind,mime,size_bytes`,
    [o.id, kind, key, req.file.mimetype, req.file.size]);
  if (kind === 'AUDIO') transcribeAttachment(a.id, o.id, req.file.buffer, req.file.mimetype).catch(e => console.warn('[asr]', e.message));
  emitOccurrence('occurrence.updated', o);
  res.status(201).json(a);
}));
// Download via URL assinada (5 min) ou Bearer
router.get('/files/:id', wrap(async (req, res) => {
  const id = Number(req.params.id);
  let ok = false;
  try { ok = verifyFileToken(String(req.query.t)) === id; } catch {
    try {
      const h = req.headers.authorization;
      if (h?.startsWith('Bearer ')) {
        const user = verifyToken(h.slice(7));
        const [a] = await q('SELECT occurrence_id FROM attachments WHERE id=$1', [id]);
        ok = !!a && !!(await loadOccurrence(a.occurrence_id, user));
      }
    } catch { /* ignorado */ }
  }
  if (!ok) return res.status(403).json({ error: 'Acesso negado.' });
  const [a] = await q('SELECT * FROM attachments WHERE id=$1', [id]);
  if (!a) return res.status(404).end();
  res.type(a.mime);
  (await storage.get(a.storage_key)).pipe(res);
}));

// ---------- Indicadores (RF06) ----------
router.get('/metrics', auth, requireRole('ADMIN'), wrap(async (req, res) => {
  const { where, params } = buildWhere(req.user, req.query);
  const [m] = await q(
    `SELECT
       count(*) FILTER (WHERE o.status='ABERTA') abertas,
       count(*) FILTER (WHERE o.status='EM_ATENDIMENTO') em_atendimento,
       count(*) FILTER (WHERE o.status='PAUSADA') pausadas,
       count(*) FILTER (WHERE o.status='CONCLUIDA') concluidas,
       count(*) FILTER (WHERE o.priority='CRITICA' AND o.status<>'CONCLUIDA') criticas,
       round(avg(extract(epoch FROM o.first_response_at - o.created_at)/60)::numeric, 1) tma_min,
       round(avg(extract(epoch FROM o.resolved_at - o.created_at)/60)::numeric, 1) tmr_min,
       count(*) FILTER (WHERE o.status='CONCLUIDA' AND o.resolved_at <= o.created_at + c.sla_minutes * interval '1 minute') dentro_sla
     ${BASE} ${where}`, params);
  const concl = Number(m.concluidas);
  res.json({
    abertas: +m.abertas, em_atendimento: +m.em_atendimento, pausadas: +m.pausadas, concluidas: concl, criticas: +m.criticas,
    tma_min: m.tma_min === null ? null : +m.tma_min, tmr_min: m.tmr_min === null ? null : +m.tmr_min,
    sla_pct: concl ? Math.round((+m.dentro_sla / concl) * 100) : null,
  });
}));

// ---------- Notificacoes ----------
router.get('/notifications', auth, wrap(async (req, res) =>
  res.json(await q('SELECT * FROM notifications WHERE user_id=$1 ORDER BY id DESC LIMIT 50', [req.user.id]))));
router.post('/notifications/:id/read', auth, wrap(async (req, res) => {
  await q('UPDATE notifications SET read_at=now() WHERE id=$1 AND user_id=$2', [Number(req.params.id), req.user.id]);
  res.status(204).end();
}));

// ---------- Cadastros (W05) ----------
const admin = [auth, requireRole('ADMIN')];
router.get('/admin/users', ...admin, wrap(async (_r, res) =>
  res.json(await q('SELECT u.id,u.name,u.email,u.registration,u.role,u.active,t.name team_name FROM users u LEFT JOIN teams t ON t.id=u.team_id ORDER BY u.id'))));
router.post('/admin/users', ...admin, wrap(async (req, res) => {
  const b = z.object({ name: z.string().min(2), email: z.string().email(), registration: z.string().min(2),
    password: z.string().min(8, 'Senha com no mínimo 8 caracteres.'), role: z.enum(['ADMIN', 'MANUTENCAO', 'LIMPEZA', 'SEGURANCA']),
    team_id: z.number().int().nullable().optional() }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: b.error.issues[0].message });
  const [u] = await q(`INSERT INTO users (name,email,registration,password_hash,role,team_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id,name,email,role`,
    [b.data.name, b.data.email, b.data.registration, await bcrypt.hash(b.data.password, 10), b.data.role, b.data.team_id ?? null]);
  res.status(201).json(u);
}));
router.patch('/admin/users/:id', ...admin, wrap(async (req, res) => {
  const b = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: 'Dados inválidos.' });
  await q('UPDATE users SET active=$2 WHERE id=$1', [Number(req.params.id), b.data.active]);
  res.status(204).end();
}));
router.patch('/admin/teams/:id', ...admin, wrap(async (req, res) => {
  const b = z.object({ available: z.boolean() }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: 'Dados inválidos.' });
  await q('UPDATE teams SET available=$2 WHERE id=$1', [Number(req.params.id), b.data.available]);
  res.status(204).end();
}));
router.post('/admin/locations', ...admin, wrap(async (req, res) => {
  const b = z.object({ floor: z.string().min(1), sector: z.string().min(1), reference: z.string().min(1), x: z.number().min(0).max(100), y: z.number().min(0).max(100) }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: 'Dados inválidos.' });
  const [l] = await q('INSERT INTO locations (floor,sector,reference,x,y) VALUES ($1,$2,$3,$4,$5) RETURNING *', [b.data.floor, b.data.sector, b.data.reference, b.data.x, b.data.y]);
  res.status(201).json(l);
}));
router.post('/admin/categories', ...admin, wrap(async (req, res) => {
  const b = z.object({ name: z.string().min(2), sla_minutes: z.number().int().positive(), default_specialty: z.enum(['MANUTENCAO', 'LIMPEZA', 'SEGURANCA']) }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: 'Dados inválidos.' });
  const [c] = await q('INSERT INTO categories (name,sla_minutes,default_specialty) VALUES ($1,$2,$3) RETURNING *', [b.data.name, b.data.sla_minutes, b.data.default_specialty]);
  res.status(201).json(c);
}));

// ---------- Push nativo ----------
router.post('/push-token', auth, wrap(async (req, res) => {
  const b = z.object({ token: z.string().min(10) }).safeParse(req.body);
  if (!b.success) return res.status(422).json({ error: 'Token inválido.' });
  await q(`INSERT INTO push_tokens (user_id, token) VALUES ($1,$2) ON CONFLICT (token) DO UPDATE SET user_id=$1`, [req.user.id, b.data.token]);
  res.status(204).end();
}));
router.delete('/push-token', auth, wrap(async (req, res) => {
  await q('DELETE FROM push_tokens WHERE user_id=$1', [req.user.id]);
  res.status(204).end();
}));

// ---------- LGPD: direito de anonimizacao do titular ----------
router.post('/admin/users/:id/anonymize', ...admin, wrap(async (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(409).json({ error: 'Não é possível anonimizar a própria conta.' });
  await q(`UPDATE users SET name=$2, email=$3, registration=$4, password_hash='!', active=false WHERE id=$1`,
    [id, `Usuário anonimizado ${id}`, `anon-${id}@anonimizado.invalid`, `ANON-${id}`]);
  await q('DELETE FROM push_tokens WHERE user_id=$1', [id]);
  await q('DELETE FROM notifications WHERE user_id=$1', [id]);
  res.status(204).end();
}));

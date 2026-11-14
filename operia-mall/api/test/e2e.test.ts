// Testes E2E + autorizacao + tempo real. Requer a stack no ar: E2E_API=http://localhost:3000 npm run test:e2e
import test from 'node:test';
import assert from 'node:assert/strict';

const API = process.env.E2E_API;
const skip = !API;
const PWD = process.env.SEED_PASSWORD || 'operia123';

async function call(path: string, opts: { token?: string; body?: any; method?: string } = {}) {
  const r = await fetch(API + path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return { status: r.status, data: r.status === 204 ? null : await r.json().catch(() => null) };
}
const login = async (l: string) => (await call('/auth/login', { body: { login: l, password: PWD } })).data.token as string;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

test('E2E: registro -> triagem -> execucao -> auditoria', { skip }, async () => {
  const admin = await login('admin@operia.mall'), man = await login('manutencao@operia.mall');
  const lim = await login('limpeza@operia.mall'), seg = await login('seguranca@operia.mall');
  const cat = (await call('/catalog', { token: admin })).data;
  const eletrica = cat.categories.find((c: any) => c.name === 'Elétrica').id;
  const loc = cat.locations[0].id;

  // RF02/RF09: criada pela limpeza, encaminhada a Manutencao, com sugestao de IA e justificativa
  const created = await call('/occurrences', { token: lim, body: { category_id: eletrica, location_id: loc, description: 'Lâmpada queimada no corredor, precisa troca' } });
  assert.equal(created.status, 201);
  const id = created.data.id;
  assert.equal(created.data.status, 'ABERTA');
  assert.match(created.data.protocol, /^OP-\d{4}-\d{6}$/);
  assert.equal(created.data.team_id, 1);
  assert.ok(created.data.ai_justification);

  // Autorizacao: Seguranca nao enxerga nem altera
  assert.equal((await call(`/occurrences/${id}`, { token: seg })).status, 404);
  assert.equal((await call(`/occurrences/${id}/status`, { token: seg, body: { action: 'iniciar' } })).status, 404);
  assert.equal((await call('/metrics', { token: man })).status, 403);
  assert.equal((await call(`/occurrences/${id}/priority`, { token: man, body: { priority: 'BAIXA', justification: 'x y z' } })).status, 403);
  assert.equal((await call('/occurrences')).status, 401);

  // RF05: fluxo de status com regras
  assert.equal((await call(`/occurrences/${id}/status`, { token: man, body: { action: 'iniciar' } })).data.status, 'EM_ATENDIMENTO');
  assert.equal((await call(`/occurrences/${id}/status`, { token: man, body: { action: 'pausar' } })).status, 409);
  assert.equal((await call(`/occurrences/${id}/status`, { token: man, body: { action: 'pausar', note: 'falta de peça' } })).data.status, 'PAUSADA');
  assert.equal((await call(`/occurrences/${id}/status`, { token: man, body: { action: 'retomar' } })).data.status, 'EM_ATENDIMENTO');
  assert.equal((await call(`/occurrences/${id}/status`, { token: man, body: { action: 'concluir' } })).status, 409);

  // Anexos: PNG valido ok; arquivo falso e PDF rejeitados
  const form = (buf: Buffer, type: string, name: string) => { const f = new FormData(); f.append('file', new Blob([buf], { type }), name); return f; };
  const up = (f: FormData) => fetch(`${API}/occurrences/${id}/attachments`, { method: 'POST', headers: { Authorization: `Bearer ${man}` }, body: f });
  assert.equal((await up(form(PNG, 'image/png', 'a.png'))).status, 201);
  assert.equal((await up(form(Buffer.from('not an image'), 'image/png', 'fake.png'))).status, 415);
  assert.equal((await up(form(Buffer.from('%PDF-1.4'), 'application/pdf', 'a.pdf'))).status, 415);

  // RF09: gestor sobrescreve prioridade, justificativa obrigatoria
  assert.equal((await call(`/occurrences/${id}/priority`, { token: admin, body: { priority: 'ALTA', justification: '' } })).status, 422);
  assert.equal((await call(`/occurrences/${id}/priority`, { token: admin, body: { priority: 'ALTA', justification: 'Corredor muito movimentado' } })).data.priority_confirmed, true);

  assert.equal((await call(`/occurrences/${id}/status`, { token: man, body: { action: 'concluir', note: 'Lâmpada trocada' } })).data.status, 'CONCLUIDA');

  // RF08: historico completo e anexos com URL assinada
  const d = (await call(`/occurrences/${id}`, { token: admin })).data;
  const kinds = d.history.map((h: any) => h.kind);
  assert.ok(kinds.includes('CRIACAO') && kinds.includes('PRIORIDADE') && kinds.filter((k: string) => k === 'STATUS').length >= 5);
  assert.ok(d.history.every((h: any) => h.author_name && h.created_at));
  assert.equal(d.attachments.length, 1);
  assert.equal((await fetch(API + d.attachments[0].url)).status, 200);
  assert.equal((await fetch(`${API}/files/${d.attachments[0].id}?t=invalido`)).status, 403);

  // RF06: filtros e metricas
  const m = (await call('/metrics', { token: admin })).data;
  assert.ok(m.concluidas >= 1 && m.tma_min !== null && m.tmr_min !== null);
  const f = (await call(`/occurrences?status=CONCLUIDA&category_id=${eletrica}`, { token: admin })).data;
  assert.ok(f.items.length >= 1 && f.items.every((o: any) => o.status === 'CONCLUIDA'));
});

test('Regra critica prevalece e escala para Seguranca', { skip }, async () => {
  const admin = await login('admin@operia.mall'), lim = await login('limpeza@operia.mall');
  const cat = (await call('/catalog', { token: admin })).data;
  const limpeza = cat.categories.find((c: any) => c.name === 'Limpeza').id;
  const r = await call('/occurrences', { token: lim, body: { category_id: limpeza, location_id: cat.locations[0].id, description: 'Fumaça saindo de uma loja, cheiro de queimado' } });
  assert.equal(r.data.priority, 'CRITICA');
  assert.equal(r.data.team_id, 3);
});

test('RF07: evento em tempo real em ate 3 s', { skip }, async () => {
  const admin = await login('admin@operia.mall'), seg = await login('seguranca@operia.mall');
  const cat = (await call('/catalog', { token: admin })).data;
  const ws = new WebSocket(API!.replace(/^http/, 'ws') + '/ws?token=' + admin);
  await new Promise<void>((res, rej) => { ws.onopen = () => res(); ws.onerror = () => rej(new Error('ws')); });
  const got = new Promise<number>(res => { ws.onmessage = e => { if (JSON.parse(e.data).type === 'occurrence.created') res(Date.now()); }; });
  const t0 = Date.now();
  await call('/occurrences', { token: seg, body: { category_id: cat.categories[5].id, location_id: cat.locations[1].id, description: 'Pessoa suspeita rondando o corredor' } });
  const t1 = await Promise.race([got, new Promise<number>((_, rej) => setTimeout(() => rej(new Error('timeout 3s')), 3000))]);
  ws.close();
  assert.ok(t1 - t0 <= 3000);
});

test('Login invalido e limite de tentativas', { skip }, async () => {
  assert.equal((await call('/auth/login', { body: { login: 'admin@operia.mall', password: 'errada' } })).status, 401);
  let last = 0;
  for (let i = 0; i < 6; i++) last = (await call('/auth/login', { body: { login: 'bloqueio@teste', password: 'x' } })).status;
  assert.equal(last, 429);
});

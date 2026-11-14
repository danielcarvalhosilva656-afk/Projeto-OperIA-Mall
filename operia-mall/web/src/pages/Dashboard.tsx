import { useCallback, useEffect, useState } from 'react';
import { api, STATUS_LABEL } from '../api';
import { PriorityBadge } from '../components';
import { useRefreshOnEvent } from '../realtime';

const fmt = (v: number | null, unit: string) => (v === null ? 'sem dados' : `${v} ${unit}`);

export default function Dashboard() {
  const [m, setM] = useState<any>(null); const [queue, setQueue] = useState<any[]>([]); const [err, setErr] = useState('');
  const load = useCallback(() => {
    Promise.all([api('/metrics'), api('/occurrences', { query: { size: 10 } })])
      .then(([a, b]) => { setM(a); setQueue(b.items.filter((o: any) => o.status !== 'CONCLUIDA')); setErr(''); })
      .catch(e => setErr(e.message));
  }, []);
  useEffect(load, [load]); useRefreshOnEvent(load);
  return (
    <>
      <h2>Dashboard operacional</h2>
      {err && <div className="error" role="alert">{err}</div>}
      {m && (
        <>
          <section aria-label="Totais por status" className="tiles">
            <div className="tile"><strong>{m.abertas}</strong>Abertas</div>
            <div className="tile"><strong>{m.em_atendimento}</strong>Em atendimento</div>
            <div className="tile crit"><strong>{m.criticas}</strong>Críticas em aberto</div>
            <div className="tile"><strong>{m.concluidas}</strong>Concluídas</div>
          </section>
          <section aria-label="Indicadores de SLA" className="tiles">
            <div className="tile"><strong>{fmt(m.tma_min, 'min')}</strong>Tempo médio de resposta</div>
            <div className="tile"><strong>{fmt(m.tmr_min, 'min')}</strong>Tempo médio de resolução</div>
            <div className="tile"><strong>{m.sla_pct === null ? 'sem dados' : m.sla_pct + '%'}</strong>Concluídas dentro do SLA</div>
          </section>
        </>
      )}
      <section className="panel" aria-labelledby="fila">
        <h3 id="fila">Fila prioritária</h3>
        <table>
          <caption className="sr-only">Ocorrências abertas ordenadas por prioridade e tempo de espera</caption>
          <thead><tr><th scope="col">Protocolo</th><th scope="col">Prioridade</th><th scope="col">Categoria</th><th scope="col">Local</th><th scope="col">Status</th><th scope="col">Equipe</th></tr></thead>
          <tbody>
            {queue.map(o => (
              <tr key={o.id}><th scope="row">{o.protocol}</th><td><PriorityBadge p={o.priority} /></td><td>{o.category_name}</td>
                <td>{o.floor} · {o.sector}</td><td>{STATUS_LABEL[o.status]}</td><td>{o.team_name || '—'}</td></tr>
            ))}
            {!queue.length && <tr><td colSpan={6}>Nenhuma ocorrência em aberto.</td></tr>}
          </tbody>
        </table>
      </section>
    </>
  );
}

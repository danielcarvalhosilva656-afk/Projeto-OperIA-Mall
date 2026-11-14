import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, PRIORITY_LABEL, STATUS_LABEL } from '../api';
import { PriorityBadge } from '../components';
import { useRefreshOnEvent } from '../realtime';

const COLORS: Record<string, string> = { CRITICA: '#8f1010', ALTA: '#b45309', MEDIA: '#8a6d00', BAIXA: '#1b5a2b' };
// formas diferentes por gravidade (nao depende so da cor)
function Shape({ p, x, y }: { p: string; x: number; y: number }) {
  const c = COLORS[p]; const s = { fill: c, stroke: '#fff', strokeWidth: 2 };
  if (p === 'CRITICA') return <polygon points={`${x},${y - 16} ${x + 15},${y + 12} ${x - 15},${y + 12}`} {...s} />;
  if (p === 'ALTA') return <rect x={x - 12} y={y - 12} width="24" height="24" transform={`rotate(45 ${x} ${y})`} {...s} />;
  if (p === 'MEDIA') return <circle cx={x} cy={y} r="13" {...s} />;
  return <rect x={x - 11} y={y - 11} width="22" height="22" {...s} />;
}

export default function MapView() {
  const [catalog, setCatalog] = useState<any>(null); const [items, setItems] = useState<any[]>([]);
  const [floor, setFloor] = useState(''); const [sector, setSector] = useState<string | null>(null); const [err, setErr] = useState('');
  const load = useCallback(() => {
    api('/occurrences', { query: { size: 100 } }).then(r => setItems(r.items.filter((o: any) => o.status !== 'CONCLUIDA'))).catch(e => setErr(e.message));
  }, []);
  useEffect(() => { api('/catalog').then(c => { setCatalog(c); setFloor(c.locations[0]?.floor || ''); }).catch(e => setErr(e.message)); load(); }, [load]);
  useRefreshOnEvent(load);

  const floors: string[] = useMemo(() => [...new Set<string>((catalog?.locations || []).map((l: any) => l.floor))], [catalog]);
  const onFloor = items.filter(o => o.floor === floor);
  const selected = sector ? onFloor.filter(o => o.sector === sector) : onFloor;
  const W = 800, H = 480;

  return (
    <>
      <h2>Mapa operacional</h2>
      {err && <div className="error" role="alert">{err}</div>}
      <div className="filters">
        <label>Pavimento
          <select value={floor} onChange={e => { setFloor(e.target.value); setSector(null); }}>{floors.map(f => <option key={f}>{f}</option>)}</select>
        </label>
        {sector && <button className="btn alt" onClick={() => setSector(null)}>Limpar setor: {sector}</button>}
      </div>
      <div className="mapwrap">
        <svg className="plan" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`Planta do pavimento ${floor}: ${onFloor.length} ocorrências abertas`}>
          <rect x="10" y="10" width={W - 20} height={H - 20} fill="none" stroke="#8a97a8" strokeWidth="3" strokeDasharray="10 6" />
          {onFloor.map(o => {
            const x = (Number(o.x) / 100) * (W - 80) + 40, y = (Number(o.y) / 100) * (H - 80) + 40;
            const label = `${o.protocol}, prioridade ${PRIORITY_LABEL[o.priority]}, ${o.category_name}, ${o.sector}. Ativar para filtrar o setor.`;
            return (
              <g key={o.id} className="marker" tabIndex={0} role="button" aria-label={label}
                onClick={() => setSector(o.sector)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSector(o.sector); } }}>
                <Shape p={o.priority} x={x} y={y} />
                <text x={x + 20} y={y + 5} fontSize="14" fontWeight="700" fill="currentColor">{o.sector}</text>
              </g>
            );
          })}
        </svg>
        <aside className="panel" aria-label="Resumo das ocorrências" aria-live="polite">
          <h3>{sector || floor}</h3>
          <p>{selected.length} ocorrência(s) aberta(s).</p>
          <ul style={{ paddingLeft: '1.1rem' }}>
            {selected.map(o => <li key={o.id}><PriorityBadge p={o.priority} /> <strong>{o.protocol}</strong> — {o.category_name}, {o.reference} ({STATUS_LABEL[o.status]})</li>)}
          </ul>
        </aside>
      </div>
    </>
  );
}

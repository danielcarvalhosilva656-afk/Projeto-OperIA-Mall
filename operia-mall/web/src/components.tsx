import { ReactNode, useEffect, useRef } from 'react';
import { PRIORITY_ICON, PRIORITY_LABEL } from './api';

// Cor nunca e o unico indicador: icone + rotulo textual
export const PriorityBadge = ({ p }: { p: string }) => (
  <span className={`badge ${p}`}><span aria-hidden="true">{PRIORITY_ICON[p]}</span>{PRIORITY_LABEL[p]}</span>
);

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal();          // foco preso + Esc nativos
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className="drawer" aria-labelledby="drawer-title" onClose={onClose}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <h2 id="drawer-title">{title}</h2>
        <button className="btn alt" onClick={onClose}>Fechar</button>
      </div>
      {open && children}
    </dialog>
  );
}

// Abas com navegacao por setas (padrao WAI-ARIA)
export function Tabs({ tabs, active, onChange, children }: { tabs: { id: string; label: string }[]; active: string; onChange: (id: string) => void; children: ReactNode }) {
  const onKey = (e: React.KeyboardEvent, i: number) => {
    let n = i;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0; else if (e.key === 'End') n = tabs.length - 1; else return;
    e.preventDefault(); onChange(tabs[n].id);
    setTimeout(() => document.getElementById('tab-' + tabs[n].id)?.focus(), 0);
  };
  return (
    <div className="tabs">
      <div role="tablist" aria-label="Cadastros">
        {tabs.map((t, i) => (
          <button key={t.id} id={'tab-' + t.id} role="tab" aria-selected={active === t.id} aria-controls={'panel-' + t.id}
            tabIndex={active === t.id ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={e => onKey(e, i)}>{t.label}</button>
        ))}
      </div>
      <div role="tabpanel" id={'panel-' + active} aria-labelledby={'tab-' + active} tabIndex={0}>{children}</div>
    </div>
  );
}

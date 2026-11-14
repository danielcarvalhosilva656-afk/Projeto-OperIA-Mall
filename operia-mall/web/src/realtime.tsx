import { createContext, useCallback, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { API, getToken } from './api';

type Listener = (ev: any) => void;
const Ctx = createContext<{ announce: (m: string) => void; subscribe: (l: Listener) => () => void }>({ announce: () => {}, subscribe: () => () => {} });
export const useLive = () => useContext(Ctx);

// WebSocket com reconexao + regiao aria-live para leitores de tela (RF07)
export function LiveProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('');
  const listeners = useRef(new Set<Listener>());
  const announce = useCallback((m: string) => { setMsg(''); setTimeout(() => setMsg(m), 50); }, []);
  const subscribe = useCallback((l: Listener) => { listeners.current.add(l); return () => { listeners.current.delete(l); }; }, []);

  useEffect(() => {
    let ws: WebSocket | null = null; let stop = false; let retry = 1000;
    const connect = () => {
      ws = new WebSocket(API.replace(/^http/, 'ws') + '/ws?token=' + encodeURIComponent(getToken()));
      ws.onopen = () => { retry = 1000; };
      ws.onmessage = e => {
        const ev = JSON.parse(e.data);
        if (ev.type === 'notification') announce(ev.content);
        listeners.current.forEach(l => l(ev));
      };
      ws.onclose = () => { if (!stop) setTimeout(connect, (retry = Math.min(retry * 2, 15000))); };
    };
    connect();
    return () => { stop = true; ws?.close(); };
  }, [announce]);

  return (
    <Ctx.Provider value={{ announce, subscribe }}>
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">{msg}</div>
    </Ctx.Provider>
  );
}

// Recarrega dados quando chega qualquer evento de ocorrencia
export function useRefreshOnEvent(reload: () => void) {
  const { subscribe } = useLive();
  useEffect(() => subscribe(ev => { if (String(ev.type).startsWith('occurrence.')) reload(); }), [subscribe, reload]);
}

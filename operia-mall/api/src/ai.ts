import { config } from './config';

export interface AiResult {
  priority: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAIXA';
  category: string | null;
  critical: boolean;
  justification: string;
}
const CRITICAL = /(inc[eê]ndio|fogo|fuma[cç]a|g[aá]s|desmai|inconsciente|infarto|briga|agress|arma|assalto|emerg[eê]ncia m[eé]dica|ferido|sangrando)/i;

// Se o servico de IA estiver fora, as regras criticas continuam valendo (human-in-the-loop).
function fallback(description: string): AiResult {
  const critical = CRITICAL.test(description);
  return {
    priority: critical ? 'CRITICA' : 'MEDIA',
    category: null,
    critical,
    justification: critical
      ? 'Regra determinística local: situação crítica detectada. Revisão humana obrigatória.'
      : 'Serviço de IA indisponível: prioridade padrão aplicada. Requer triagem manual.',
  };
}

export async function analyze(body: {
  description: string; category?: string; location_text?: string;
  recurrence_count?: number; waiting_minutes?: number;
}): Promise<AiResult> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 3000);
  try {
    const r = await fetch(`${config.aiUrl}/analyze`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: ctl.signal,
    });
    if (!r.ok) throw new Error(String(r.status));
    return (await r.json()) as AiResult;
  } catch {
    return fallback(body.description);
  } finally {
    clearTimeout(timer);
  }
}

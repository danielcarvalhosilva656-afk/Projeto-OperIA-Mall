// Maquina de estados das ocorrencias (RF05) - funcao pura, testavel.
export type Status = 'ABERTA' | 'EM_ATENDIMENTO' | 'PAUSADA' | 'CONCLUIDA';
export type Action = 'iniciar' | 'pausar' | 'retomar' | 'concluir';

const table: Record<Action, { from: Status[]; to: Status; noteRequired: boolean }> = {
  iniciar: { from: ['ABERTA'], to: 'EM_ATENDIMENTO', noteRequired: false },
  pausar: { from: ['EM_ATENDIMENTO'], to: 'PAUSADA', noteRequired: true },
  retomar: { from: ['PAUSADA'], to: 'EM_ATENDIMENTO', noteRequired: false },
  concluir: { from: ['EM_ATENDIMENTO', 'PAUSADA'], to: 'CONCLUIDA', noteRequired: true },
};

export function nextStatus(current: Status, action: Action, note?: string):
  { ok: true; to: Status } | { ok: false; error: string } {
  const t = table[action];
  if (!t) return { ok: false, error: 'Ação inválida.' };
  if (!t.from.includes(current)) return { ok: false, error: `Não é possível ${action} uma ocorrência ${current}.` };
  if (t.noteRequired && !(note && note.trim().length >= 3))
    return { ok: false, error: 'Observação obrigatória para esta ação.' };
  return { ok: true, to: t.to };
}

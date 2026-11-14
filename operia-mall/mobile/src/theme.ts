// Mesma paleta do painel web (contraste >= 4,5:1). Alvos de toque >= 48dp.
export const C = {
  bg: '#e9eef4', surface: '#ffffff', ink: '#121c2b', muted: '#3d4c61', line: '#8a97a8',
  brand: '#0a4aa0', brandInk: '#ffffff', danger: '#8f1010',
  prio: {
    CRITICA: { bg: '#fde8e8', fg: '#8f1010', icon: '▲', label: 'Crítica' },
    ALTA: { bg: '#ffecd2', fg: '#7a3d00', icon: '◆', label: 'Alta' },
    MEDIA: { bg: '#fff6c2', fg: '#5c4a00', icon: '●', label: 'Média' },
    BAIXA: { bg: '#e3f1e6', fg: '#1b5a2b', icon: '▼', label: 'Baixa' },
  } as Record<string, { bg: string; fg: string; icon: string; label: string }>,
};
export const STATUS: Record<string, string> = { ABERTA: 'Aberta', EM_ATENDIMENTO: 'Em atendimento', PAUSADA: 'Pausada', CONCLUIDA: 'Concluída' };

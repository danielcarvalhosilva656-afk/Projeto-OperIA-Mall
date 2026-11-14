# Plano e evidências de testes (Etapa 8)

| Estratégia (doc. §14) | Onde | Como executar |
|---|---|---|
| Unitários (regras, SLA, criticidade) | `ai-service/tests`, `api/test/transitions.test.ts` | `pytest` / `npm test` |
| Integração e ponta a ponta | `api/test/e2e.test.ts` | `E2E_API=http://localhost:3000 npm run test:e2e` (stack no ar) |
| Autorização entre perfis | `e2e.test.ts` (Segurança não vê/altera; não-admin sem `/metrics` nem prioridade; 401 sem token) | idem |
| Tempo real ≤ 3 s (RF07) | `e2e.test.ts` (WebSocket) | idem |
| Segurança de upload | `e2e.test.ts` (PNG falso e PDF → 415) | idem |
| Acessibilidade automatizada | `web/e2e/a11y.spec.ts` (axe WCAG 2.1 A/AA em Login, Dashboard, Mapa, Triagem, Cadastros, Drawer) e `web/lighthouserc.json` (≥ 95) | `cd web && npm run test:e2e && npm run lighthouse` |
| Teclado exclusivo | `web/e2e/keyboard.spec.ts` (login, triagem, abas, mapa, Esc, foco preso) | idem |
| Leitor de tela (manual) | roteiro abaixo | NVDA (web), TalkBack/VoiceOver (app) |
| Carga e pico | `loadtest/k6.js` (20 → 150 usuários; p95 < 800 ms; erros < 1 %) | `k6 run loadtest/k6.js` |
| Backup/restauração | `scripts/backup.sh`, `scripts/restore.sh` | ver `docs/IMPLANTACAO.md` |

## Roteiro manual com leitor de tela
1. **Web/NVDA:** entrar no login; confirmar leitura de rótulos e erro (`role=alert`). Navegar por landmarks (`D`) e tabelas (`T`); abrir ocorrência e ouvir título do diálogo; alterar prioridade e ouvir “Prioridade atualizada.”
2. **Tempo real:** com o painel aberto, criar ocorrência no app; confirmar anúncio da notificação sem mover o foco.
3. **App/TalkBack e VoiceOver:** logar; percorrer fila (cada cartão lê protocolo, prioridade, categoria, local e status); registrar ocorrência escolhendo categoria/piso/setor/referência; gravar áudio (anúncio “Gravando.”); iniciar, pausar com motivo e concluir.

## Registro de execução (preencher no piloto)
| Data | Suíte | Resultado | Responsável | Observações |
|---|---|---|---|---|
| | | | | |

> Estado da entrega: as suítes foram escritas e a de IA e de transições foram executadas localmente. As demais exigem a stack no ar (Docker) e **devem ser executadas e registradas na tabela acima** antes do aceite.

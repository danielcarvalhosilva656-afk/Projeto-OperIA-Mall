<<<<<<< HEAD
# OperIA Mall — Sistema de Gestão Operacional Inteligente
Equipe 2 HacKaRun · Implementação seguindo as Etapas 1–8 da documentação.

## Como executar
```bash
cp .env.example .env
docker compose up --build
```
| Serviço | URL |
|---|---|
| Painel web (W01–W05) | http://localhost:5173 |
| API + WebSocket (`/ws`) | http://localhost:3000 |
| Serviço de IA | http://localhost:8000/docs |

Usuários de desenvolvimento (senha `operia123`, ajustável em `SEED_PASSWORD`; **só existem no primeiro boot com banco vazio**):
`admin@operia.mall` (ADM001) · `manutencao@operia.mall` · `limpeza@operia.mall` · `seguranca@operia.mall`.
O painel web aceita apenas o perfil Administração; os demais usam o app móvel.

App móvel: `cd mobile && npm install && EXPO_PUBLIC_API_URL=http://<IP-da-sua-máquina>:3000 npx expo start`

## Mapa de etapas → código
| Etapa | Onde |
|---|---|
| 3 Fundação técnica | `docker-compose.yml`, `db/init.sql`, `api/src/{config,db,auth}.ts` |
| 4 MVP operacional | `api/src/routes.ts` (ocorrências, status, anexos), `api/src/transitions.ts` |
| 5 Interfaces integradas | `web/src/pages/*` (W01–W05), `mobile/src/screens.tsx` (M01–M04) |
| 6 Tempo real e relatórios | `api/src/realtime.ts`, `web/src/realtime.tsx`, `GET /metrics`, tabela `history` imutável |
| 7 IA assistiva | `ai-service/rules.py` (regras críticas determinísticas + semântica), `api/src/ai.ts` (fallback) |
| 8 Testes e piloto | `ai-service/tests`, `api/test`, `web/e2e`, `loadtest`, `docs/PLANO_DE_TESTES.md` |

## Requisitos × implementação
| RF | Implementação |
|---|---|
| RF01 | `POST /auth/login`, JWT, `requireRole`, visibilidade por equipe em `buildWhere` |
| RF02 | `POST/GET/PATCH /occurrences`, protocolo `OP-AAAA-NNNNNN`, status inicial ABERTA, conclusão exige observação |
| RF03 | `POST /occurrences/:id/attachments` (JPG/PNG/áudio, MIME+extensão+10 MB), download por URL assinada de 5 min |
| RF04 | FK obrigatória para categoria/localização, 422 se inexistente; coordenadas x/y na planta |
| RF05 | `POST /occurrences/:id/status` (iniciar/pausar/retomar/concluir) |
| RF06 | filtros período/categoria/setor/equipe/status em lista **e** `/metrics` (TMA, TMR, SLA) |
| RF07 | WebSocket com eventos por perfil/equipe; reconexão automática; recarga sem refresh |
| RF08 | trigger `history_immutable` bloqueia UPDATE/DELETE; toda transição grava autor, antes/depois, data e nota |
| RF09 | IA sugere categoria + prioridade + justificativa; admin confirma/sobrescreve (justificativa obrigatória) |

## Acessibilidade (prática sorteada)
- Paleta com contraste ≥ 4,5:1 (claro e escuro); prioridade = cor **+ ícone + rótulo** (no mapa, também formas distintas).
- Teclado: link "ir para o conteúdo", `:focus-visible` forte, abas com setas/Home/End, gaveta em `<dialog>` modal (foco preso, Esc fecha), marcadores do mapa focáveis (Enter/Espaço).
- Leitor de tela: landmarks (`header/nav/main`), `<th scope>`, `<caption>`, `aria-live` para eventos em tempo real, `accessibilityRole/Label/Hint/State` e `announceForAccessibility` no app.
- **Validação:** axe/Lighthouse e teclado automatizados em `web/e2e`; roteiro manual de leitor de tela em `docs/PLANO_DE_TESTES.md` (a executar).

## Etapa 8 e complementos
| Item | Onde |
|---|---|
| Transcrição de áudio (pt-BR, faster-whisper) | `ai-service/main.py` `/transcribe`, `api/src/transcribe.ts` (reanalisa prioridade, escala se crítico). Ativar: `WITH_ASR=true` |
| Armazenamento de objetos (MinIO/S3) | `api/src/storage.ts`, serviço `minio` no compose; validação de assinatura real de JPG/PNG |
| Cadastros completos (W05) | `web/src/pages/Admin.tsx` (criar usuário/local/categoria, equipe, anonimizar) |
| Push nativo | `api/src/push.ts`, `mobile/src/push.ts`, tabela `push_tokens` |
| LGPD | retenção automática, anonimização, `docs/LGPD.md` |
| Segurança | limite de login (429), API recusa `JWT_SECRET` fraco em produção |
| Testes E2E/autorização/tempo real | `api/test/e2e.test.ts` |
| Acessibilidade automatizada e teclado | `web/e2e/*.spec.ts` (axe + Playwright), `web/lighthouserc.json` |
| Carga e pico | `loadtest/k6.js` |
| Produção, HTTPS, backup | `docker-compose.prod.yml`, `deploy/Caddyfile`, `scripts/backup.sh`, `scripts/restore.sh` |
| CI | `.github/workflows/ci.yml` |
| Documentos | `docs/PLANO_DE_TESTES.md`, `docs/MANUAL_DE_USO.md`, `docs/IMPLANTACAO.md`, `docs/LGPD.md` |

## Estado de verificação (transparência)
Escrito sem acesso à rede: **não houve `npm install`, build, Docker nem execução ponta a ponta**.
- Executado: testes da IA (6 ok), máquina de estados da API, checagem de sintaxe de todo o TypeScript e Python.
- A executar por vocês (e registrar em `docs/PLANO_DE_TESTES.md`): `npm run build` nos três projetos (podem surgir ajustes de tipos), `docker compose up`, `npm run test:e2e` (API e web), Lighthouse, k6, roteiro com leitor de tela e teste de restauração de backup.

## Fora do alcance do código
Planta real do shopping (o mapa usa planta esquemática), credenciais FCM/APNs e `projectId` da Expo, domínio/DNS, decisões jurídicas da LGPD (base legal, prazos finais) e o piloto com usuários.
=======
# Documentacao-OperIA-Mall
>>>>>>> 0ecef4ca76e166c4b50278085c056cc52a0496fa

# Implantação e operação

## Desenvolvimento / homologação
```bash
cp .env.example .env && docker compose up --build
```
Serviços: web `:5173`, API `:3000`, IA `:8000`, MinIO console `:9001`. Dados fictícios são criados no primeiro boot (`SEED=true`).
Para ativar a transcrição de áudio: `WITH_ASR=true docker compose up --build` (baixa o modelo Whisper no primeiro uso; ajuste `WHISPER_MODEL`).
> Mudanças no `db/init.sql` só valem em banco novo: `docker compose down -v` em desenvolvimento.

## Produção
1. Crie `.env.prod` com: `DB_PASSWORD`, `JWT_SECRET` (24+ caracteres aleatórios), `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `SEED=false`, `CORS_ORIGIN=https://app.seudominio`, `DOMAIN_APP`, `DOMAIN_API`.
2. Aponte os DNS para o servidor e execute:
   `docker compose -f docker-compose.yml -f docker-compose.prod.yml --env-file .env.prod up -d --build`
3. O Caddy emite o HTTPS/TLS automaticamente; apenas 80/443 ficam expostos.
4. Crie o primeiro administrador diretamente no banco (hash bcrypt) ou habilite `SEED=true` uma única vez e **troque a senha** em seguida.
5. A API recusa subir em produção com `JWT_SECRET` fraco.

## Backup e restauração
- Diário: `0 2 * * * cd /opt/operia && ./scripts/backup.sh` (retém 14 dias; copie para fora do servidor).
- Restauração: `./scripts/restore.sh backups/db-….dump backups/objetos-….tar.gz` (pede confirmação).
- Teste a restauração em homologação a cada trimestre.

## Monitoramento mínimo
`GET /health` (API) e `/health` (IA) para sonda externa (UptimeRobot, Prometheus blackbox). Observe logs com `docker compose logs -f api`. Alertar: API fora, disco > 80 %, fila de ocorrências críticas sem resposta.

## Push nativo
O app usa o serviço de push da Expo. Para builds de loja, configure credenciais FCM (Android) e APNs (iOS) no projeto EAS e informe `projectId` no `app.json`.

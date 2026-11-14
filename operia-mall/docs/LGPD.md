# Privacidade e LGPD — controles implementados e pendências jurídicas

## Implementado
- Senhas com bcrypt; HTTPS/TLS via Caddy; segredos por variável de ambiente; RBAC e menor privilégio.
- Anexos fora do banco (S3/MinIO), acesso por URL assinada de 5 min; validação de MIME, extensão, assinatura do arquivo e 10 MB.
- Retenção automática diária (`api/src/retention.ts`): anexos > `RETENTION_ATTACHMENT_DAYS` (365) e notificações > `RETENTION_NOTIFICATION_DAYS` (90).
- Direito de anonimização: `POST /admin/users/:id/anonymize` (Cadastros → Usuários → Anonimizar) remove nome, e-mail, matrícula, tokens e notificações; o histórico de auditoria é preservado sem identificar a pessoa.
- Logs sem senhas/tokens.

## Pendente de validação com a área jurídica (não é decisão técnica)
Base legal do tratamento, definição de controlador/operadores, prazos de retenção finais, aviso de privacidade aos colaboradores, e política de resposta a incidentes (art. 48). Ajuste as variáveis `RETENTION_*` conforme definido.

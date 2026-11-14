const secret = process.env.JWT_SECRET || 'dev-secret-change-me';
const prod = process.env.NODE_ENV === 'production';
if (prod && (secret.startsWith('troque') || secret.startsWith('dev-') || secret.length < 24))
  throw new Error('JWT_SECRET fraco ou padrão em produção. Defina um segredo com 24+ caracteres.');
export const config = {
  port: Number(process.env.PORT || 3000),
  jwtSecret: secret,
  databaseUrl: process.env.DATABASE_URL || 'postgres://operia:operia@localhost:5432/operia',
  aiUrl: process.env.AI_URL || 'http://localhost:8000',
  corsOrigin: process.env.CORS_ORIGIN || '*',
  seed: process.env.SEED ? process.env.SEED === 'true' : !prod,
  seedPassword: process.env.SEED_PASSWORD || 'operia123',
  maxUploadBytes: 10 * 1024 * 1024,
  storage: {
    driver: (process.env.STORAGE_DRIVER || 'local') as 'local' | 's3',
    uploadDir: process.env.UPLOAD_DIR || './uploads',
    endpoint: process.env.S3_ENDPOINT || '',
    bucket: process.env.S3_BUCKET || 'operia-anexos',
    accessKey: process.env.S3_ACCESS_KEY || '',
    secretKey: process.env.S3_SECRET_KEY || '',
    region: process.env.S3_REGION || 'us-east-1',
  },
  retention: {
    attachmentDays: Number(process.env.RETENTION_ATTACHMENT_DAYS || 365),
    notificationDays: Number(process.env.RETENTION_NOTIFICATION_DAYS || 90),
  },
};

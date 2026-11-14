import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import http from 'http';
import { config } from './config';
import { router } from './routes';
import { attachRealtime } from './realtime';
import { seedIfEmpty } from './seed';
import { storage } from './storage';
import { scheduleRetention } from './retention';

const app = express();
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_q, r) => r.json({ status: 'ok' }));
app.use(router);
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err?.code === 'LIMIT_FILE_SIZE') return res.status(413).json({ error: 'Arquivo acima de 10 MB.' });
  if (err?.code === '23505') return res.status(409).json({ error: 'Registro já existe.' });
  console.error(err);
  res.status(500).json({ error: 'Erro interno.' });
});

const server = http.createServer(app);
attachRealtime(server);
storage.init()
  .then(() => seedIfEmpty())
  .catch(e => console.error('inicializacao falhou', e))
  .finally(() => { server.listen(config.port, () => console.log(`API em :${config.port}`)); scheduleRetention(); });

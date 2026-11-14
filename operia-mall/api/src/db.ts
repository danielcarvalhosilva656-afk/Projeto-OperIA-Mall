import { Pool } from 'pg';
import { config } from './config';
export const pool = new Pool({ connectionString: config.databaseUrl });
export const q = <T = any>(text: string, params: any[] = []) =>
  pool.query(text, params).then(r => r.rows as T[]);

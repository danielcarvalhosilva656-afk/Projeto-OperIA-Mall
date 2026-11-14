import jwt from 'jsonwebtoken';
import { NextFunction, Request, Response } from 'express';
import { config } from './config';

export type Role = 'ADMIN' | 'MANUTENCAO' | 'LIMPEZA' | 'SEGURANCA';
export interface AuthUser { id: number; role: Role; team_id: number | null; name: string }
export interface AuthedRequest extends Request { user: AuthUser }

export const signToken = (u: AuthUser) =>
  jwt.sign(u, config.jwtSecret, { expiresIn: '12h' });
export const verifyToken = (t: string): AuthUser => jwt.verify(t, config.jwtSecret) as AuthUser;

export function auth(req: Request, res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return res.status(401).json({ error: 'Não autenticado.' });
  try {
    (req as AuthedRequest).user = verifyToken(h.slice(7));
    next();
  } catch {
    res.status(401).json({ error: 'Sessão inválida ou expirada.' });
  }
}

export const requireRole = (...roles: Role[]) =>
  (req: Request, res: Response, next: NextFunction) => {
    if (!roles.includes((req as AuthedRequest).user.role))
      return res.status(403).json({ error: 'Acesso negado para o seu perfil.' });
    next();
  };

// URL assinada de curta duracao para anexos
export const signFileToken = (attachmentId: number) =>
  jwt.sign({ att: attachmentId }, config.jwtSecret, { expiresIn: '5m' });
export const verifyFileToken = (t: string): number => (jwt.verify(t, config.jwtSecret) as any).att;

import bcrypt from 'bcryptjs';
import { q } from './db';
import { config } from './config';

export async function seedIfEmpty() {
  if (!config.seed) return;
  const [{ n }] = await q<{ n: string }>('SELECT count(*) n FROM users');
  if (Number(n) > 0) return;
  console.log('[seed] populando dados iniciais (apenas desenvolvimento/homologação)');
  await q(`INSERT INTO teams (name, specialty) VALUES
    ('Manutenção Geral','MANUTENCAO'),('Equipe de Limpeza','LIMPEZA'),('Segurança Patrimonial','SEGURANCA')`);
  await q(`INSERT INTO categories (name, sla_minutes, default_specialty) VALUES
    ('Elétrica',120,'MANUTENCAO'),('Hidráulica',90,'MANUTENCAO'),('Climatização',240,'MANUTENCAO'),
    ('Elevadores e Escadas',60,'MANUTENCAO'),('Limpeza',45,'LIMPEZA'),('Segurança',15,'SEGURANCA')`);
  await q(`INSERT INTO locations (floor, sector, reference, x, y) VALUES
    ('Térreo','Praça de Alimentação','Mesas centrais',70,30),
    ('Térreo','Corredor Norte','Próximo à loja 12',25,20),
    ('Térreo','Entrada Principal','Portas giratórias',50,90),
    ('Térreo','Banheiros','Banheiro feminino',85,70),
    ('1º Piso','Corredor Leste','Escada rolante',75,50),
    ('1º Piso','Cinema','Bilheteria',30,40),
    ('Subsolo','Estacionamento','Rampa B',40,60),
    ('Subsolo','Casa de Máquinas','Quadro elétrico 2',80,25)`);
  const hash = await bcrypt.hash(config.seedPassword, 10);
  const users: [string, string, string, string, number | null][] = [
    ['Administrador', 'admin@operia.mall', 'ADM001', 'ADMIN', null],
    ['Carlos (Manutenção)', 'manutencao@operia.mall', 'MAN001', 'MANUTENCAO', 1],
    ['Marta (Limpeza)', 'limpeza@operia.mall', 'LIM001', 'LIMPEZA', 2],
    ['Sérgio (Segurança)', 'seguranca@operia.mall', 'SEG001', 'SEGURANCA', 3],
  ];
  for (const [name, email, reg, role, team] of users)
    await q('INSERT INTO users (name,email,registration,password_hash,role,team_id) VALUES ($1,$2,$3,$4,$5,$6)',
      [name, email, reg, hash, role, team]);
}

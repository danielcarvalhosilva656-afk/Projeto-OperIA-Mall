-- OperIA Mall - esquema relacional (Etapa 3)
CREATE TABLE teams (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  specialty TEXT NOT NULL CHECK (specialty IN ('MANUTENCAO','LIMPEZA','SEGURANCA')),
  available BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  registration TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('ADMIN','MANUTENCAO','LIMPEZA','SEGURANCA')),
  team_id INT REFERENCES teams(id),
  active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE locations (
  id SERIAL PRIMARY KEY,
  unit TEXT NOT NULL DEFAULT 'Shopping Central',
  floor TEXT NOT NULL,
  sector TEXT NOT NULL,
  reference TEXT NOT NULL,
  x NUMERIC NOT NULL DEFAULT 50,  -- % na planta
  y NUMERIC NOT NULL DEFAULT 50,
  UNIQUE (unit, floor, sector, reference)
);
CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  sla_minutes INT NOT NULL,
  default_specialty TEXT NOT NULL CHECK (default_specialty IN ('MANUTENCAO','LIMPEZA','SEGURANCA'))
);
CREATE SEQUENCE protocol_seq START 1;
CREATE TABLE occurrences (
  id SERIAL PRIMARY KEY,
  protocol TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  category_id INT NOT NULL REFERENCES categories(id),
  location_id INT NOT NULL REFERENCES locations(id),
  requester_id INT NOT NULL REFERENCES users(id),
  team_id INT REFERENCES teams(id),
  assignee_id INT REFERENCES users(id),
  ai_category_id INT REFERENCES categories(id),
  ai_priority TEXT CHECK (ai_priority IN ('CRITICA','ALTA','MEDIA','BAIXA')),
  ai_justification TEXT,
  priority TEXT NOT NULL DEFAULT 'MEDIA' CHECK (priority IN ('CRITICA','ALTA','MEDIA','BAIXA')),
  priority_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'ABERTA' CHECK (status IN ('ABERTA','EM_ATENDIMENTO','PAUSADA','CONCLUIDA')),
  final_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  first_response_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_occ_status ON occurrences(status);
CREATE INDEX idx_occ_team ON occurrences(team_id);
CREATE INDEX idx_occ_loc_created ON occurrences(location_id, created_at);
CREATE TABLE attachments (
  id SERIAL PRIMARY KEY,
  occurrence_id INT NOT NULL REFERENCES occurrences(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('IMAGEM','AUDIO')),
  storage_key TEXT NOT NULL,
  mime TEXT NOT NULL,
  size_bytes INT NOT NULL,
  transcription TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE assignments (
  id SERIAL PRIMARY KEY,
  occurrence_id INT NOT NULL REFERENCES occurrences(id),
  team_id INT REFERENCES teams(id),
  assignee_id INT REFERENCES users(id),
  author_id INT NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE history (
  id BIGSERIAL PRIMARY KEY,
  occurrence_id INT NOT NULL REFERENCES occurrences(id),
  kind TEXT NOT NULL CHECK (kind IN ('CRIACAO','STATUS','PRIORIDADE','ATRIBUICAO','EDICAO')),
  from_value TEXT,
  to_value TEXT,
  author_id INT NOT NULL REFERENCES users(id),
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- RF08: registro imutavel de auditoria
CREATE FUNCTION history_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'history e imutavel'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER history_no_update BEFORE UPDATE OR DELETE ON history
  FOR EACH ROW EXECUTE FUNCTION history_immutable();
CREATE TABLE notifications (
  id BIGSERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  occurrence_id INT REFERENCES occurrences(id),
  content TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'IN_APP',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX idx_notif_user ON notifications(user_id, read_at);

-- Notificacoes push nativas (Expo/FCM/APNs)
CREATE TABLE push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id),
  token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

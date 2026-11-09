-- migrate:up
CREATE TABLE reading_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          text NOT NULL CHECK (kind IN ('livro','artigo','obra')),
  title         text NOT NULL,
  author        text,
  status        text NOT NULL DEFAULT 'quero' CHECK (status IN ('quero','lendo','lido','abandonado','arquivado')),
  serial_status text CHECK (serial_status IN ('em_dia','aguardando','pausada')),
  current_page  integer CHECK (current_page IS NULL OR current_page >= 0),
  total_pages   integer CHECK (total_pages IS NULL OR total_pages > 0),
  last_chapter  text,
  url           text,
  cover_url     text,
  rating        smallint CHECK (rating BETWEEN 1 AND 5),
  review        text,
  tags          text[] NOT NULL DEFAULT '{}',
  minutes_hint  smallint,
  started_on    date,
  finished_on   date,
  source        text NOT NULL DEFAULT 'manual',
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX reading_items_user_idx ON reading_items (user_id, kind, status);

CREATE TABLE reading_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id    uuid NOT NULL REFERENCES reading_items(id) ON DELETE CASCADE,
  quote      text,
  note       text,
  page       integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE reading_logs (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES reading_items(id) ON DELETE CASCADE,
  date    date NOT NULL,
  pages   integer NOT NULL DEFAULT 0 CHECK (pages >= 0),
  minutes integer
);
CREATE INDEX reading_logs_user_date_idx ON reading_logs (user_id, date);

CREATE TABLE activities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  icon        text NOT NULL DEFAULT 'star',
  minutes     smallint NOT NULL DEFAULT 30 CHECK (minutes BETWEEN 5 AND 600),
  energy      text NOT NULL DEFAULT 'media' CHECK (energy IN ('baixa','media','alta')),
  place       text,
  tags        text[] NOT NULL DEFAULT '{}',
  screen_type text NOT NULL DEFAULT 'sem_tela' CHECK (screen_type IN ('com_tela','sem_tela')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE activity_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id  uuid NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  date         date NOT NULL,
  duration_min smallint NOT NULL CHECK (duration_min BETWEEN 1 AND 1440),
  comment      text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX activity_logs_user_date_idx ON activity_logs (user_id, date);

CREATE TABLE media_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('filme','serie','jogo','anime')),
  title      text NOT NULL,
  status     text NOT NULL DEFAULT 'quero' CHECK (status IN ('quero','em_andamento','concluido')),
  rating     smallint CHECK (rating BETWEEN 1 AND 5),
  platform   text,
  progress   text,
  cover_url  text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  description text,
  notes       text,
  progress    smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  cover_url   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE project_steps (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  position   integer NOT NULL DEFAULT 0
);

CREATE TABLE audio_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       text NOT NULL CHECK (kind IN ('album','artista','musica','podcast')),
  title      text NOT NULL,
  creator    text,
  status     text NOT NULL DEFAULT 'quero' CHECK (status IN ('quero','ouvido')),
  rating     numeric(2,1) CHECK (rating BETWEEN 0 AND 5),
  comment    text,
  cover_url  text,
  link       text,
  progress   text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE playlists (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  subtitle   text,
  url        text,
  cover_url  text,
  mood       text,
  is_today   boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE ideas (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:down
DROP TABLE ideas, playlists, audio_items, project_steps, projects, media_items, activity_logs, activities, reading_logs, reading_notes, reading_items;

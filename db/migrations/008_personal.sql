-- migrate:up
-- Receitas e cozinha
CREATE TABLE recipes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  ingredients text,
  steps       text,
  minutes     smallint CHECK (minutes IS NULL OR minutes BETWEEN 1 AND 1440),
  servings    smallint CHECK (servings IS NULL OR servings BETWEEN 1 AND 100),
  photo_url   text,
  rating      numeric(2,1) CHECK (rating IS NULL OR rating BETWEEN 0 AND 5),
  tags        text[] NOT NULL DEFAULT '{}',
  source_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE meal_plans (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      date NOT NULL,
  meal      text NOT NULL CHECK (meal IN ('cafe','almoco','jantar','lanche')),
  recipe_id uuid REFERENCES recipes(id) ON DELETE SET NULL,
  custom    text,
  UNIQUE (user_id, date, meal)
);
CREATE TABLE shopping_items (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  checked    boolean NOT NULL DEFAULT false,
  recipe_id  uuid REFERENCES recipes(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cooked_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipe_id  uuid NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  date       date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cooked_log_user_date_idx ON cooked_log (user_id, date);

-- Estúdio criativo
CREATE TABLE creative_projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL,
  kind        text NOT NULL DEFAULT 'desenho' CHECK (kind IN ('desenho','escrita','programacao','artesanato','fotografia','outro')),
  description text,
  cover_url   text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE creative_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES creative_projects(id) ON DELETE CASCADE,
  title      text NOT NULL,
  image_url  text,
  note       text,
  date       date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE inspirations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES creative_projects(id) ON DELETE SET NULL,
  image_url  text,
  link       text,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (image_url IS NOT NULL OR link IS NOT NULL OR note IS NOT NULL)
);
CREATE TABLE challenges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       text NOT NULL,
  week_start date NOT NULL,
  done       boolean NOT NULL DEFAULT false,
  UNIQUE (user_id, week_start)
);
CREATE TABLE creative_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES creative_projects(id) ON DELETE SET NULL,
  date       date NOT NULL,
  minutes    smallint NOT NULL CHECK (minutes BETWEEN 1 AND 720),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX creative_sessions_user_date_idx ON creative_sessions (user_id, date);

-- Viagens e passeios
CREATE TABLE trips (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 text NOT NULL,
  status               text NOT NULL DEFAULT 'quero_ir' CHECK (status IN ('quero_ir','planejado','visitado')),
  notes                text,
  link                 text,
  estimated_cost_cents integer CHECK (estimated_cost_cents IS NULL OR estimated_cost_cents >= 0),
  start_on             date,
  end_on               date,
  cover_url            text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  CHECK (end_on IS NULL OR start_on IS NULL OR end_on >= start_on)
);
CREATE TABLE trip_days (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  day_number smallint NOT NULL CHECK (day_number BETWEEN 1 AND 90),
  title      text NOT NULL,
  notes      text
);
-- trip_id NULL = item do modelo de mala (reaproveitável em todas as viagens)
CREATE TABLE packing_items (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES trips(id) ON DELETE CASCADE,
  title   text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE trip_entries (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trip_id   uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  date      date NOT NULL,
  text      text,
  photo_url text,
  CHECK (text IS NOT NULL OR photo_url IS NOT NULL)
);
-- gastos da viagem ficam separados dos gastos do dia a dia (Finanças ignora trip_id)
ALTER TABLE expenses ADD CONSTRAINT expenses_trip_fk FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE;

-- Lista de desejos
CREATE TABLE wishlist_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        text NOT NULL,
  price_cents integer CHECK (price_cents IS NULL OR price_cents >= 0),
  url         text,
  photo_url   text,
  priority    text NOT NULL DEFAULT 'media' CHECK (priority IN ('alta','media','baixa')),
  category    text,
  status      text NOT NULL DEFAULT 'quero' CHECK (status IN ('quero','esperando','comprei','ganhei')),
  wait_days   smallint NOT NULL DEFAULT 30 CHECK (wait_days BETWEEN 0 AND 365),
  created_at  timestamptz NOT NULL DEFAULT now(),
  -- data em que a compra é liberada: criação + período de espera (evita compras por impulso)
  release_on  date GENERATED ALWAYS AS (((created_at AT TIME ZONE 'America/Sao_Paulo')::date) + wait_days) STORED
);

-- migrate:down
DROP TABLE wishlist_items;
ALTER TABLE expenses DROP CONSTRAINT expenses_trip_fk;
DROP TABLE trip_entries, packing_items, trip_days, trips;
DROP TABLE creative_sessions, challenges, inspirations, creative_entries, creative_projects;
DROP TABLE cooked_log, shopping_items, meal_plans, recipes;

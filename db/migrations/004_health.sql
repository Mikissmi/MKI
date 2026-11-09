-- migrate:up
CREATE TABLE habits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  icon            text NOT NULL DEFAULT 'check',
  frequency       text NOT NULL DEFAULT 'daily' CHECK (frequency IN ('daily','weekdays','times_per_week')),
  weekdays        smallint[] NOT NULL DEFAULT '{}',           -- 0 = domingo … 6 = sábado
  times_per_week  smallint CHECK (times_per_week IS NULL OR times_per_week BETWEEN 1 AND 7),
  routine         text CHECK (routine IN ('manha','noite')),
  archived        boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX habits_user_idx ON habits (user_id);

CREATE TABLE habit_logs (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  date     date NOT NULL,
  UNIQUE (habit_id, date)
);
CREATE INDEX habit_logs_user_date_idx ON habit_logs (user_id, date);

CREATE TABLE quick_wins (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        text NOT NULL,
  duration_min smallint NOT NULL DEFAULT 10 CHECK (duration_min BETWEEN 1 AND 30),
  energy       text NOT NULL DEFAULT 'baixa' CHECK (energy IN ('baixa','media','alta')),
  screen_type  text NOT NULL DEFAULT 'sem_tela' CHECK (screen_type IN ('com_tela','sem_tela')),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sleep_logs (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      date NOT NULL,                 -- dia em que acordou
  slept_at  time NOT NULL,
  woke_at   time NOT NULL,
  quality   smallint CHECK (quality BETWEEN 1 AND 5),
  UNIQUE (user_id, date)
);

CREATE TABLE water_logs (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    date NOT NULL,
  glasses smallint NOT NULL DEFAULT 0 CHECK (glasses BETWEEN 0 AND 40),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE meal_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date        date NOT NULL,
  meal        text NOT NULL CHECK (meal IN ('cafe','almoco','jantar','lanche')),
  description text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX meal_logs_user_date_idx ON meal_logs (user_id, date);

CREATE TABLE workout_logs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  kind         text NOT NULL,
  duration_min smallint NOT NULL CHECK (duration_min BETWEEN 1 AND 600),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workout_logs_user_date_idx ON workout_logs (user_id, date);

CREATE TABLE body_measures (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date      date NOT NULL,
  weight_kg numeric(5,2),
  waist_cm  numeric(5,1),
  hip_cm    numeric(5,1),
  steps     integer CHECK (steps IS NULL OR steps >= 0),
  UNIQUE (user_id, date)
);

-- migrate:down
DROP TABLE body_measures, workout_logs, meal_logs, water_logs, sleep_logs, quick_wins, habit_logs, habits;

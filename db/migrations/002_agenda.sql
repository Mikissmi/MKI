-- migrate:up
CREATE TABLE events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title            text NOT NULL,
  starts_at        timestamptz NOT NULL,
  ends_at          timestamptz NOT NULL,
  location         text,
  category         text NOT NULL DEFAULT 'pessoal',
  notes            text,
  recurrence       text NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
  recurrence_until date,
  remind_minutes   integer CHECK (remind_minutes IS NULL OR remind_minutes BETWEEN 0 AND 1440),
  created_at       timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX events_user_start_idx ON events (user_id, starts_at);

-- Rotina-modelo: blocos recorrentes (trabalho, estudo...). O sono vem de acordar/dormir em settings.
CREATE TABLE routine_blocks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title      text NOT NULL,
  weekdays   smallint[] NOT NULL,           -- 0 = domingo … 6 = sábado
  start_time time NOT NULL,
  end_time   time NOT NULL,
  category   text NOT NULL DEFAULT 'trabalho',
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (end_time > start_time)
);
CREATE INDEX routine_blocks_user_idx ON routine_blocks (user_id);

CREATE TABLE checkins (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  mood       smallint NOT NULL CHECK (mood BETWEEN 1 AND 5),
  energy     smallint NOT NULL CHECK (energy BETWEEN 1 AND 5),
  note       text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, date)
);

-- Valores de exemplo da rotina-modelo (editáveis no app): acordar 07:00, dormir 23:00, trabalho em horário comercial.
CREATE FUNCTION seed_routine(uid uuid) RETURNS void AS $$
BEGIN
  INSERT INTO settings (user_id, data) VALUES (uid, '{"wake":"07:00","sleep":"23:00"}')
  ON CONFLICT (user_id) DO UPDATE
    SET data = settings.data || jsonb_strip_nulls(jsonb_build_object(
          'wake',  CASE WHEN settings.data ? 'wake'  THEN NULL ELSE '07:00' END,
          'sleep', CASE WHEN settings.data ? 'sleep' THEN NULL ELSE '23:00' END));
  IF NOT EXISTS (SELECT 1 FROM routine_blocks WHERE user_id = uid) THEN
    INSERT INTO routine_blocks (user_id, title, weekdays, start_time, end_time, category)
    VALUES (uid, 'Trabalho', '{1,2,3,4,5}', '09:00', '18:00', 'trabalho');
  END IF;
END;
$$ LANGUAGE plpgsql;

SELECT seed_routine(id) FROM users;

-- migrate:down
DROP FUNCTION seed_routine(uuid);
DROP TABLE checkins;
DROP TABLE routine_blocks;
DROP TABLE events;

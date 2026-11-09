-- migrate:up
-- Rotina com deslocamento e horários flexíveis (o início/fim existentes passam a valer para o modo "fixed";
-- no modo "flexible" start_time/end_time guardam o horário preferido e o fim correspondente).
ALTER TABLE routine_blocks
  ADD COLUMN mode text NOT NULL DEFAULT 'fixed' CHECK (mode IN ('fixed','flexible')),
  ADD COLUMN start_earliest time,
  ADD COLUMN start_latest time,
  ADD COLUMN preferred_start time,
  ADD COLUMN duration_min integer CHECK (duration_min IS NULL OR duration_min BETWEEN 5 AND 1439),
  ADD COLUMN travel_to_min integer NOT NULL DEFAULT 0 CHECK (travel_to_min BETWEEN 0 AND 600),
  ADD COLUMN travel_from_min integer NOT NULL DEFAULT 0 CHECK (travel_from_min BETWEEN 0 AND 600),
  ADD COLUMN travel_mode text CHECK (travel_mode IN ('onibus','metro','carro','a_pe','bicicleta')),
  ADD COLUMN travel_suggestions boolean NOT NULL DEFAULT false;

ALTER TABLE routine_blocks ADD CONSTRAINT routine_flexible_ck CHECK (
  mode = 'fixed' OR (
    start_earliest IS NOT NULL AND start_latest IS NOT NULL AND preferred_start IS NOT NULL AND duration_min IS NOT NULL
    AND start_earliest <= preferred_start AND preferred_start <= start_latest));

-- Exceções de um dia: horário real do bloco flexível, sem deslocamento (ex.: home office) ou bloco cancelado.
CREATE TABLE routine_overrides (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  block_id     uuid NOT NULL REFERENCES routine_blocks(id) ON DELETE CASCADE,
  date         date NOT NULL,
  start_actual time,
  skip_travel  boolean NOT NULL DEFAULT false,
  canceled     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (block_id, date)
);
CREATE INDEX routine_overrides_user_date_idx ON routine_overrides (user_id, date);

-- migrate:down
DROP TABLE routine_overrides;
ALTER TABLE routine_blocks DROP CONSTRAINT routine_flexible_ck;
ALTER TABLE routine_blocks
  DROP COLUMN travel_suggestions, DROP COLUMN travel_mode, DROP COLUMN travel_from_min, DROP COLUMN travel_to_min,
  DROP COLUMN duration_min, DROP COLUMN preferred_start, DROP COLUMN start_latest, DROP COLUMN start_earliest, DROP COLUMN mode;

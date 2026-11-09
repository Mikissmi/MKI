-- migrate:up
CREATE TABLE retrospectives (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  period       text NOT NULL CHECK (period IN ('semana','mes')),
  start_on     date NOT NULL,
  end_on       date NOT NULL,
  data         jsonb NOT NULL,
  reflection   text,
  generated_at timestamptz NOT NULL DEFAULT now(),
  viewed_at    timestamptz,
  UNIQUE (user_id, period, start_on)
);

-- datas para a retrospectiva saber "o que você ouviu e assistiu" em cada período
ALTER TABLE audio_items ADD COLUMN listened_on date;
ALTER TABLE media_items ADD COLUMN finished_on date;
UPDATE audio_items SET listened_on = created_at::date WHERE status = 'ouvido' AND listened_on IS NULL;
UPDATE media_items SET finished_on = created_at::date WHERE status = 'concluido' AND finished_on IS NULL;

-- migrate:down
ALTER TABLE media_items DROP COLUMN finished_on;
ALTER TABLE audio_items DROP COLUMN listened_on;
DROP TABLE retrospectives;

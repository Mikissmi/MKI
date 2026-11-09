-- migrate:up
CREATE TABLE ai_requests (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind            text NOT NULL,                       -- plan | chat | suggest | summary
  outcome         text NOT NULL CHECK (outcome IN ('ai','rules','cache','failed')),
  reason          text,
  provider_called boolean NOT NULL DEFAULT false,      -- só estas contam no limite diário
  input_hash      text,
  response        jsonb,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_requests_user_day_idx ON ai_requests (user_id, created_at);

-- Plano do dia em cache: reaproveitado enquanto agenda, energia e hábitos não mudam.
CREATE TABLE day_plans (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  input_hash   text NOT NULL,
  source       text NOT NULL CHECK (source IN ('ai','rules')),
  reason       text,
  light_day    boolean NOT NULL DEFAULT false,         -- Dia leve ligado manualmente
  generated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

CREATE TABLE plan_blocks (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  start_min    integer NOT NULL CHECK (start_min BETWEEN 0 AND 1439),
  duration_min integer NOT NULL CHECK (duration_min BETWEEN 5 AND 720),
  kind         text NOT NULL,
  title        text NOT NULL,
  reason       text,
  source       text NOT NULL DEFAULT 'rules',
  status       text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','accepted','dismissed')),
  screen_type  text CHECK (screen_type IN ('com_tela','sem_tela')),
  ref_type     text,
  ref_id       uuid,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX plan_blocks_user_date_idx ON plan_blocks (user_id, date);

CREATE TABLE chat_messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role       text NOT NULL CHECK (role IN ('user','assistant')),
  content    text NOT NULL,
  plan       jsonb,
  source     text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_user_idx ON chat_messages (user_id, created_at);

-- migrate:down
DROP TABLE chat_messages;
DROP TABLE plan_blocks;
DROP TABLE day_plans;
DROP TABLE ai_requests;

-- migrate:up
-- 11.6 Fechamento da noite
CREATE TABLE daily_closings (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       date NOT NULL,
  line       text,
  priorities text[] NOT NULL DEFAULT '{}' CHECK (cardinality(priorities) <= 3),
  focus      text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, date)
);

-- 11.8 Relembrar o que você guardou
CREATE TABLE memory_shown (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind      text NOT NULL,
  item_id   uuid NOT NULL,
  shown_on  date NOT NULL,
  -- shown: aparece hoje; swapped: o usuário pediu "outra"; hidden: "agora não" (o card some pelo resto do dia)
  state     text NOT NULL DEFAULT 'shown' CHECK (state IN ('shown','swapped','hidden')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, kind, item_id, shown_on)
);
CREATE INDEX memory_shown_user_idx ON memory_shown (user_id, shown_on);

-- 11.7 Boas-vindas de volta: dias de ausência que pausam hábitos sem quebrar a sequência
CREATE TABLE paused_days (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    date NOT NULL,
  PRIMARY KEY (user_id, date)
);

-- 11.4 Calendário assinável
CREATE TABLE calendar_tokens (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz
);

-- 11.5 Notificações opcionais
CREATE TABLE push_subscriptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint   text NOT NULL UNIQUE,
  p256dh     text NOT NULL,
  auth       text NOT NULL,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE push_log (
  id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind    text NOT NULL,
  ref     text NOT NULL DEFAULT '',
  sent_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_log_user_idx ON push_log (user_id, sent_at);
CREATE UNIQUE INDEX push_log_once_idx ON push_log (user_id, kind, ref) WHERE ref <> '';

-- migrate:down
DROP TABLE push_log, push_subscriptions, calendar_tokens, paused_days, memory_shown, daily_closings;

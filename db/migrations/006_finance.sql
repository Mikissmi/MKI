-- migrate:up
CREATE TABLE categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  color      text NOT NULL DEFAULT 'pink',
  icon       text NOT NULL DEFAULT 'wallet',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE expenses (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date         date NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents > 0),
  category_id  uuid REFERENCES categories(id) ON DELETE SET NULL,
  note         text,
  trip_id      uuid,                      -- gastos de viagem ficam separados do dia a dia (FK criada com as viagens)
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX expenses_user_date_idx ON expenses (user_id, date);

-- migrate:down
DROP TABLE expenses;
DROP TABLE categories;

-- migrate:up
CREATE TABLE topics (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  keywords   text[] NOT NULL DEFAULT '{}',
  tone       text NOT NULL DEFAULT 'pink',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE TABLE feeds (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title           text NOT NULL,
  url             text NOT NULL,
  site_url        text,
  topic_id        uuid REFERENCES topics(id) ON DELETE SET NULL,
  muted           boolean NOT NULL DEFAULT false,
  last_fetched_at timestamptz,
  last_error      text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, url)
);

CREATE TABLE news_items (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feed_id      uuid NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  topic_id     uuid REFERENCES topics(id) ON DELETE SET NULL,
  guid         text NOT NULL,
  title        text NOT NULL,
  link         text NOT NULL,
  summary      text,
  image_url    text,
  published_at timestamptz,
  read         boolean NOT NULL DEFAULT false,
  favorite     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (feed_id, guid)
);
CREATE INDEX news_items_user_idx ON news_items (user_id, published_at DESC);

-- migrate:down
DROP TABLE news_items, feeds, topics;

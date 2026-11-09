-- migrate:up
-- Registros rápidos feitos offline são reenviados ao voltar a conexão; este id evita gravar duas vezes.
CREATE TABLE quick_ops (
  client_id  uuid PRIMARY KEY,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- migrate:down
DROP TABLE quick_ops;

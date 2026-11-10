-- migrate:up
-- Integração com o Spotify (uso pessoal, modo de desenvolvimento).
-- Os tokens ficam criptografados (AES-256-GCM, chave em variável de ambiente): nunca em texto, nunca no navegador, nunca em logs.
CREATE TABLE spotify_accounts (
  user_id           uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  spotify_user_id   text NOT NULL,                 -- account_id (estável) do Spotify
  display_name      text,
  access_token_enc  text NOT NULL,
  refresh_token_enc text NOT NULL,
  expires_at        timestamptz NOT NULL,
  scopes            text[] NOT NULL DEFAULT '{}',
  needs_reconnect   boolean NOT NULL DEFAULT false,
  last_error        text,
  connected_at      timestamptz NOT NULL DEFAULT now()
);

-- Cache temporário (playlists, buscas, histórico recente, contadores de chamadas). Dados do Spotify não ficam guardados para sempre.
CREATE TABLE spotify_cache (
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  key        text NOT NULL,
  content    jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, key)
);

ALTER TABLE audio_items ADD COLUMN spotify_id text;
ALTER TABLE audio_items ADD COLUMN spotify_url text;
CREATE UNIQUE INDEX audio_items_spotify_uidx ON audio_items (user_id, spotify_id) WHERE spotify_id IS NOT NULL;

ALTER TABLE playlists ADD COLUMN spotify_playlist_id text;
ALTER TABLE playlists ADD COLUMN activity_id uuid REFERENCES activities(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX playlists_spotify_uidx ON playlists (user_id, spotify_playlist_id) WHERE spotify_playlist_id IS NOT NULL;

-- migrate:down
DROP INDEX playlists_spotify_uidx;
ALTER TABLE playlists DROP COLUMN activity_id;
ALTER TABLE playlists DROP COLUMN spotify_playlist_id;
DROP INDEX audio_items_spotify_uidx;
ALTER TABLE audio_items DROP COLUMN spotify_url;
ALTER TABLE audio_items DROP COLUMN spotify_id;
DROP TABLE spotify_cache;
DROP TABLE spotify_accounts;

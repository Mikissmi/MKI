-- migrate:up
-- Notícias lidas dentro do app: resumo guardado (com a origem dele) e ligação com o item de Leituras.
ALTER TABLE reading_items ADD COLUMN summary text;
ALTER TABLE reading_items ADD COLUMN source_news_id uuid REFERENCES news_items(id) ON DELETE SET NULL;
ALTER TABLE news_items ADD COLUMN summary_source text CHECK (summary_source IN ('feed','texto','ia'));
ALTER TABLE news_items ADD COLUMN reading_item_id uuid REFERENCES reading_items(id) ON DELETE SET NULL;
UPDATE news_items SET summary_source = 'feed' WHERE summary IS NOT NULL AND summary <> '';

-- Um artigo por link: juntar os repetidos que já existam (anotações e histórico vão para o que fica) antes do índice único.
CREATE TEMP TABLE _dups AS
  SELECT id, keep FROM (
    SELECT id, first_value(id) OVER (PARTITION BY user_id, url ORDER BY (status = 'lido') DESC, created_at, id) AS keep
      FROM reading_items WHERE kind = 'artigo' AND url IS NOT NULL
  ) r WHERE id <> keep;
UPDATE reading_notes n SET item_id = d.keep FROM _dups d WHERE n.item_id = d.id;
UPDATE reading_logs l SET item_id = d.keep FROM _dups d WHERE l.item_id = d.id;
DELETE FROM reading_items WHERE id IN (SELECT id FROM _dups);
DROP TABLE _dups;
CREATE UNIQUE INDEX reading_items_article_url_uidx ON reading_items (user_id, url) WHERE kind = 'artigo' AND url IS NOT NULL;

-- migrate:down
DROP INDEX reading_items_article_url_uidx;
ALTER TABLE news_items DROP COLUMN reading_item_id;
ALTER TABLE news_items DROP COLUMN summary_source;
ALTER TABLE reading_items DROP COLUMN source_news_id;
ALTER TABLE reading_items DROP COLUMN summary;

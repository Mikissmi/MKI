-- migrate:up
-- O chat pode montar o plano de outro dia (ex.: amanhã): guarda a data para "Aceitar plano" valer para o dia certo.
ALTER TABLE chat_messages ADD COLUMN plan_date date;

-- migrate:down
ALTER TABLE chat_messages DROP COLUMN plan_date;

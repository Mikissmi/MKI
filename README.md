# MKI

Painel pessoal da vida (PWA): agenda, rotina, leituras, lazer, saúde, finanças e notícias. Veja a especificação completa no doc "MKI — Especificação".

**Estado:** etapas 1 (Base) e 2 (Agenda e Hoje) prontas.

- Etapa 1: Next.js + Mantine, PWA, login próprio (senha + cookie de sessão), Neon, proxy que protege as rotas.
- Etapa 2: Agenda (dia, semana, mês), eventos com repetição e lembretes dentro do app, rotina-modelo (acordar/dormir + blocos fixos), horários livres de 30 min ou mais, check-in de humor e energia (1 a 5) e a tela Hoje com a linha do tempo.

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e SESSION_SECRET
npm run migrate              # requer dbmate (https://github.com/amacneil/dbmate)
npm run create-user -- seu_usuario
npm run dev
npm test                     # recorrência, horários livres e fuso
```

Para desenvolver sem Neon dá para apontar `DATABASE_URL` para um Postgres em `localhost` (o app usa o driver `pg` só nesse caso).

## Estrutura

- `app/` rotas (`(app)` = telas protegidas, `login`, `api`)
- `lib/db` acesso único ao Neon (SQL parametrizado) · `lib/auth` senha, sessão, limite de tentativas
- `db/migrations` migrações SQL do dbmate · `proxy.ts` barreira de autenticação e checagem de origem
- `public/brand/logo-mki.svg` **logo provisória** — troque pela original e rode `npm run icons`

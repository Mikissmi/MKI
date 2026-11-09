# MKI

Painel pessoal da vida (PWA): agenda, rotina, leituras, lazer, saúde, finanças e notícias. Veja a especificação completa no doc "MKI — Especificação".

**Estado:** etapa 1 (Base) — Next.js + Mantine, PWA, login próprio (senha + cookie de sessão), Neon, proxy que protege as rotas.

## Rodando

```bash
npm install
cp .env.example .env.local   # preencha DATABASE_URL e SESSION_SECRET
npm run migrate              # requer dbmate (https://github.com/amacneil/dbmate)
npm run create-user -- seu_usuario
npm run dev
```

## Estrutura

- `app/` rotas (`(app)` = telas protegidas, `login`, `api`)
- `lib/db` acesso único ao Neon (SQL parametrizado) · `lib/auth` senha, sessão, limite de tentativas
- `db/migrations` migrações SQL do dbmate · `proxy.ts` barreira de autenticação e checagem de origem
- `public/brand/logo-mki.svg` **logo provisória** — troque pela original e rode `npm run icons`

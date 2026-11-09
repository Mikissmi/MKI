# MKI

Painel pessoal da vida (PWA): agenda, rotina, leituras, lazer, saúde, finanças e notícias. Veja a especificação completa no doc "MKI — Especificação".

**Estado:** etapas 1 (Base) e 2 (Agenda e Hoje) prontas.

- Etapa 1: Next.js + Mantine, PWA, login próprio (senha + cookie de sessão), Neon, proxy que protege as rotas.
- Etapa 2: Agenda (dia, semana, mês), eventos com repetição e lembretes dentro do app, rotina-modelo (acordar/dormir + blocos fixos), horários livres de 30 min ou mais, check-in de humor e energia (1 a 5) e a tela Hoje com a linha do tempo.

## Deploy (Vercel) — sem passos manuais

Defina estas variáveis na Vercel (Settings → Environment Variables):

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | string de conexão do Neon |
| `SESSION_SECRET` | valor aleatório longo (`openssl rand -base64 48`) |
| `MKI_ADMIN_USER` | seu usuário |
| `MKI_ADMIN_PASSWORD` | sua senha (mín. 10 caracteres) |

A cada deploy o script `vercel-build` (`scripts/bootstrap.ts`) aplica as migrações pendentes e cria o usuário, ou atualiza a senha se ela mudou na variável. Não precisa rodar dbmate nem `create-user`. Se uma migração falhar, o deploy falha de propósito.

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run bootstrap            # migrações + usuário (equivale ao que roda no deploy)
npm run dev
npm test                     # recorrência, horários livres e fuso
```

Para desenvolver sem Neon dá para apontar `DATABASE_URL` para um Postgres em `localhost`. `npm run create-user -- nome` continua existindo para criar outro usuário à mão.

## Estrutura

- `app/` rotas (`(app)` = telas protegidas, `login`, `api`)
- `lib/db` acesso único ao Neon (SQL parametrizado) · `lib/auth` senha, sessão, limite de tentativas
- `db/migrations` migrações SQL do dbmate · `proxy.ts` barreira de autenticação e checagem de origem
- `public/brand/logo-mki.svg` **logo provisória** — troque pela original e rode `npm run icons`

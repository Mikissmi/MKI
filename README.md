# MKI

Painel pessoal da vida (PWA): agenda, rotina, hábitos, leituras, lazer, saúde, finanças, notícias, receitas, viagens e mais, com um assistente de IA que sugere o dia. Uso pessoal, pensado para o celular. A especificação completa está no doc "MKI — Especificação".

## O que tem

| Área | O que faz |
| --- | --- |
| **Hoje** | check-in de humor/energia (1 a 5), plano do dia (agenda + sugestões da IA ou das regras), Dia leve, hábitos, água, gasto do dia, manchetes |
| **Assistente** | conversa sobre a rotina; Gemini primeiro, motor de regras como plano B (limite de 10 chamadas por dia, espera de 5 min após falha) |
| **Agenda** | dia/semana/mês, eventos com repetição e lembretes dentro do app, rotina-modelo, horários livres de 30 min ou mais |
| **Hábitos e Saúde** | sequências, calendário de calor, rotinas, mini-vitórias, sono, água, refeições, exercício, medidas |
| **Leituras, Hobbies, Música** | livros/artigos/obras, atividades com marca de tela, mídia, projetos, trilha do dia |
| **Finanças, Notícias (RSS)** | gastos por categoria, orçamento, rosca; feeds com temas e "ler depois" |
| **Receitas, Estúdio, Viagens, Desejos** | planejador semanal e lista de compras, sessões com timer, roteiros e mala, período de espera antes de comprar |
| **Retrospectivas** | semanal e mensal, geradas ao abrir e guardadas, com comparação e reflexão |
| **Configurações** | perfil, tema e cor, rotina, IA e o que compartilhar, metas, exportar/importar |
| **Offline** | páginas já visitadas abrem sem internet; registros rápidos ficam numa fila e são enviados ao voltar |

## Deploy (Vercel) sem passos manuais

Variáveis em Settings → Environment Variables:

| Variável | Para quê |
| --- | --- |
| `DATABASE_URL` | string de conexão do Neon |
| `SESSION_SECRET` | valor aleatório longo (`openssl rand -base64 48`) |
| `MKI_ADMIN_USER` / `MKI_ADMIN_PASSWORD` | seu usuário e senha (mín. 10 caracteres); criados/atualizados a cada deploy |
| `GEMINI_API_KEY` | chave do Google AI Studio (opcional: sem ela o app usa só o motor de regras) |

A cada deploy o script `vercel-build` (`scripts/bootstrap.ts`) aplica as migrações pendentes e garante o usuário. Se uma migração falhar, o deploy falha de propósito.

Opcionais: `GEMINI_MODEL` (padrão `gemini-2.5-flash`).

## Rodando localmente

```bash
npm install
cp .env.example .env.local   # preencha as variáveis
npm run bootstrap            # migrações + usuário (o mesmo que roda no deploy)
npm run dev
npm run check                # tipos + verificação de links + testes
```

Dá para apontar `DATABASE_URL` para um Postgres em `localhost` (o app usa o driver `pg` só nesse caso). `npm run create-user -- nome` cria outro usuário.

## Decisões e limites

- **Sem upload de imagens**: capas e fotos guardam o link da imagem.
- **Sem tarefas agendadas**: notícias e retrospectivas são atualizadas ao abrir a tela; lembretes aparecem com o app aberto.
- **Privacidade da IA**: por padrão diário, gastos e saúde não vão para a IA (Configurações).
- **Offline**: service worker (páginas visitadas) + fila em IndexedDB para o registro rápido. Não usa TanStack Query.
- **Backup**: exportação completa em JSON, CSV por tabela, e restauração do JSON (soma ao que já existe).
- **Segurança**: SQL sempre parametrizado, sessão com hash no banco e cookie httpOnly, limite de tentativas de login, checagem de origem nas mutações, busca de links/feeds bloqueia endereços internos.

## Estrutura

- `app/` rotas (`(app)` = telas protegidas, `login`, `api`) · `components/` interface · `lib/` regras de negócio
- `lib/planner` motor de regras, contexto e orquestração da IA · `lib/ai` provedor (trocar de modelo = trocar um arquivo)
- `db/migrations` SQL numerado · `proxy.ts` autenticação e checagem de origem
- `public/brand/logo-mki.svg` **logo provisória**: troque pela original e rode `npm run icons`

# MKI

Painel pessoal da vida (PWA): agenda, rotina, hábitos, leituras, lazer, saúde, finanças, notícias, receitas, viagens e mais, com um assistente de IA que sugere o dia. Uso pessoal, pensado para o celular. A especificação completa está no doc "MKI — Especificação".

## O que tem

| Área | O que faz |
| --- | --- |
| **Hoje** | check-in de humor/energia (1 a 5) que recolhe num selo depois de respondido, plano do dia (agenda + sugestões da IA ou das regras), Dia leve, hábitos, água, gasto do dia, manchetes |
| **Assistente** | conversa sobre a rotina; Gemini primeiro, motor de regras como plano B (limite de 10 chamadas por dia, espera de 5 min após falha) |
| **Agenda** | dia/semana/mês, eventos com repetição e lembretes dentro do app, rotina-modelo com blocos fixos ou flexíveis (janela de início + duração) e deslocamento de ida e volta, horários livres de 30 min ou mais |
| **Hábitos e Saúde** | sequências, calendário de calor, rotinas, mini-vitórias, sono, água, refeições, exercício, medidas |
| **Leituras, Hobbies, Música** | livros/artigos/obras, atividades com marca de tela, mídia, projetos, trilha do dia; com o Spotify conectado: suas playlists como trilha do dia, busca de álbum/artista/podcast para "Para ouvir" e histórico recente para marcar como ouvido |
| **Finanças, Notícias (RSS)** | gastos por categoria, orçamento, rosca; feeds com temas; matérias lidas dentro do app (texto em modo leitura, resumo simples ou com IA), marcar como lida cria o artigo em Leituras |
| **Receitas, Estúdio, Viagens, Desejos** | planejador semanal e lista de compras, sessões com timer, roteiros e mala, período de espera antes de comprar |
| **Retrospectivas** | semanal e mensal, geradas ao abrir e guardadas, com comparação e reflexão |
| **Configurações** | perfil, tema e cor, rotina, IA e o que compartilhar, conexão com o Spotify, metas, exportar/importar |
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

Spotify (opcional; sem elas o app funciona igual e Configurações mostra o que falta): `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, `SPOTIFY_REDIRECT_URI` e `SPOTIFY_TOKEN_KEY`. Passo a passo abaixo.

## Spotify (uso pessoal)

O app usa o modo de desenvolvimento do Spotify: só a conta que você liberar consegue conectar, e o **dono do app precisa ter Premium**.

1. Em [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) (com a conta Premium), crie um app. Marque **Web API**.
2. Em *Redirect URIs* cadastre `https://SEU-APP.vercel.app/api/spotify/callback` e, para testar no computador, `http://127.0.0.1:3000/api/spotify/callback` (o Spotify **não aceita `localhost`**).
3. Em *User Management*, adicione o nome e o e-mail da sua conta do Spotify.
4. Na Vercel, crie as variáveis: `SPOTIFY_CLIENT_ID` e `SPOTIFY_CLIENT_SECRET` (da página do app), `SPOTIFY_REDIRECT_URI` (exatamente o endereço do passo 2 que você vai usar) e `SPOTIFY_TOKEN_KEY` (uma chave que você gera com `openssl rand -base64 32`; guarde uma cópia, pois sem ela os tokens guardados não abrem e é preciso reconectar). Faça um novo deploy; a migração `014_spotify.sql` roda sozinha.
5. Em Configurações → Spotify, toque em **Conectar Spotify**.

Como funciona: o login é feito no servidor (OAuth com `state` contra falsificação); os tokens ficam **criptografados** (AES-256-GCM) no banco e nunca vão para o navegador, para o log nem para a exportação; cada recurso ligado pede só a permissão de que precisa; **Desconectar** apaga tokens e cache. Playlists, capas e buscas ficam em cache (no máximo 7 dias; atualiza ao abrir Música, no intervalo mínimo e com o limite diário de chamadas definidos em Configurações). Se o Spotify cair, pedir para esperar (429), a autorização expirar ou o Premium acabar, o app mostra o que já estava guardado e um botão **Reconectar**; nada bloqueia. O histórico recente do Spotify não é guardado, só a data em que um item de "Para ouvir" foi ouvido, e nada do Spotify vai para a IA (a opção "Música" em *O que compartilhar com a IA* envia apenas itens cadastrados por você).

Limites do Spotify que afetam o app: o histórico recente não traz podcasts (episódios continuam manuais), a busca devolve no máximo 10 resultados e as capas das playlists são temporárias (renovadas a cada atualização). O player dentro do app ficou para depois.

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

- **Notícias no app**: o texto da matéria é buscado na hora e fica só em cache temporário na memória; no banco ficam título, fonte, link, resumo e suas anotações. O resumo simples não gasta a IA; "Resumir com IA" conta no limite diário.
- **Rotina flexível**: a IA só *propõe* mover o início de um bloco dentro da janela; nada muda sem aceitar. O deslocamento acompanha o horário real do dia e não conta como tempo livre.
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

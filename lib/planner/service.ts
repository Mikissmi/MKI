import { query, queryOne } from "@/lib/db";
import { AiError, getProvider } from "@/lib/ai";
import { AI_DAILY_LIMIT, type Settings } from "@/lib/settings";
import { addDays, fmtMin, localDateKey, zonedToUtc } from "@/lib/time";
import { freeSlots } from "@/lib/agenda/free-slots";
import { loadPlanContext, type LoadedContext } from "./context";
import { buildRulesPlan, buildScreenFreePlan, buildTravelSuggestions, parseIntent, suggestForMinutes } from "./rules";
import { aiPlanSchema, sanitizeAiBlocks, sanitizeMoves } from "./validate";
import type { PlanBlock, PlanContext } from "./types";

export type PlanSource = "ai" | "rules" | "cache";
export type RulesReason = "disabled" | "no_key" | "limit" | "cooldown" | "failed" | "format" | "manual";
export type Availability = { ok: true } | { ok: false; reason: Exclude<RulesReason, "failed" | "format" | "manual"> };

const SYSTEM = `Você é o assistente do MKI, um painel pessoal de rotina. Responda sempre em português do Brasil, com tom gentil e sem cobrança.
Proponha blocos curtos de atividades apenas dentro dos horários livres informados; nunca use horários ocupados nem horários que já passaram.
Responda SOMENTE com JSON válido neste formato:
{"reply": string, "blocks": [{"start": "HH:MM", "durationMin": number, "kind": "leitura|atividade|habito|pausa|mini_vitoria|exercicio|artigo|podcast", "title": string, "reason": string}], "moves": [{"title": string, "start": "HH:MM", "reason": string}]}
Se a pessoa está cansada ou com energia baixa, proponha no máximo 3 itens fáceis e curtos (Dia leve).
Os "compromissos" já incluem blocos de trabalho/estudo e os deslocamentos: não coloque nada por cima deles.
Se houver "blocosFlexiveis" ainda não confirmados, você pode propor mover o início de um deles dentro da janela (campo "moves", com o título do bloco e o novo horário) quando isso ajudar a encaixar atividades. É só uma proposta: deixe "moves" vazio se não ajudar.`;

// ---------- disponibilidade da IA ----------

export async function aiUsageToday(userId: string, today = localDateKey()): Promise<number> {
  const row = await queryOne<{ n: string }>(
    "SELECT count(*)::text AS n FROM ai_requests WHERE user_id = $1 AND provider_called AND created_at >= $2", [userId, zonedToUtc(today, 0).toISOString()]);
  return Number(row?.n ?? 0);
}

export async function aiAvailability(userId: string, settings: Settings): Promise<Availability> {
  if (!settings.aiEnabled) return { ok: false, reason: "disabled" };
  if (!getProvider()) return { ok: false, reason: "no_key" };
  if ((await aiUsageToday(userId)) >= AI_DAILY_LIMIT) return { ok: false, reason: "limit" };
  // espera só se a chamada MAIS RECENTE falhou (um teste ou resumo que deu certo depois libera a IA de novo)
  const last = await queryOne<{ outcome: string; created_at: Date | string }>(
    "SELECT outcome, created_at FROM ai_requests WHERE user_id = $1 AND provider_called ORDER BY created_at DESC LIMIT 1", [userId]);
  if (last && last.outcome === "failed" && Date.now() - new Date(last.created_at).getTime() < settings.aiCooldownMin * 60_000) return { ok: false, reason: "cooldown" };
  return { ok: true };
}

/** Última falha da IA (se a chamada mais recente falhou): categoria e o detalhe curto devolvido pelo Google. */
export async function lastAiFailure(userId: string): Promise<{ reason: string; detail: string | null; at: string } | null> {
  const row = await queryOne<{ outcome: string; reason: string | null; detail: string | null; created_at: Date | string }>(
    "SELECT outcome, reason, response->>'detail' AS detail, created_at FROM ai_requests WHERE user_id = $1 AND provider_called ORDER BY created_at DESC LIMIT 1", [userId]);
  if (!row || row.outcome !== "failed") return null;
  return { reason: row.reason ?? "http", detail: row.detail, at: new Date(row.created_at).toISOString() };
}

async function logRequest(userId: string, kind: string, outcome: PlanSource | "failed", reason: string | null, called: boolean, hash: string | null, response: unknown = null) {
  await query(
    "INSERT INTO ai_requests (user_id, kind, outcome, reason, provider_called, input_hash, response) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)",
    [userId, kind, outcome, reason, called, hash, response === null ? null : JSON.stringify(response)],
  );
}

// ---------- contexto para a IA (só o que a pessoa liberou) ----------

export function buildAiPrompt(loaded: LoadedContext, request?: string): string {
  const { ctx, settings } = loaded;
  const from = Math.max(ctx.wake, ctx.nowMin ?? ctx.wake);
  const payload: Record<string, unknown> = {
    data: ctx.date,
    agora: ctx.nowMin !== null ? fmtMin(ctx.nowMin) : null,
    janela: { acordar: fmtMin(ctx.wake), dormir: fmtMin(ctx.sleep) },
    horariosLivres: freeSlots(ctx.busy, from, ctx.sleep).map((s) => ({ inicio: fmtMin(s.startMin), fim: fmtMin(s.endMin) })),
    compromissos: ctx.busy.map((b) => ({ inicio: fmtMin(b.startMin), fim: fmtMin(b.endMin) })),
    habitosPendentes: ctx.pendingHabits.map((h) => h.name),
    filaDeLeitura: ctx.readingQueue.map((r) => r.title),
    atividadesFavoritas: ctx.activities.map((a) => ({ nome: a.name, minutos: a.minutes, energia: a.energy, tela: a.screen, diasSemFazer: a.daysSince })),
    miniVitorias: ctx.quickWins.map((q) => ({ nome: q.title, minutos: q.minutes })),
    diaLeve: ctx.lightDay,
    blocosFlexiveis: ctx.flexBlocks.map((b) => ({ titulo: b.title, inicioAtual: fmtMin(b.startMin), duracaoMin: b.durationMin, janela: { maisCedo: fmtMin(b.earliest), maisTarde: fmtMin(b.latest) }, confirmado: b.confirmed })),
  };
  if (!settings.aiShare.agenda) payload.compromissos = ctx.busy.length ? "há compromissos nos horários ocupados" : [];
  if (settings.aiShare.mood) { payload.humor = ctx.mood; payload.energia = ctx.energy; }
  if (settings.aiShare.music && ctx.musicTitles.length) payload.musicaParaOuvir = ctx.musicTitles;
  if (request) payload.pedido = request;
  return JSON.stringify(payload);
}

function parseAi(text: string) {
  let raw: unknown;
  try {
    raw = JSON.parse(text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, ""));
  } catch {
    throw new AiError("format", "resposta não é JSON");
  }
  const parsed = aiPlanSchema.safeParse(raw);
  if (!parsed.success) throw new AiError("format", "resposta fora do formato");
  return parsed.data;
}

/** Liga os blocos da IA aos itens reais (para marcar tela e permitir histórico). */
function attachRefs(blocks: PlanBlock[], ctx: PlanContext): PlanBlock[] {
  const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  return blocks.map((b) => {
    const t = norm(b.title);
    const act = ctx.activities.find((a) => t.includes(norm(a.name)));
    if (act) return { ...b, screen: act.screen, refType: "activity", refId: act.id };
    const win = ctx.quickWins.find((w) => t.includes(norm(w.title)));
    if (win) return { ...b, screen: win.screen, refType: "quick_win", refId: win.id };
    const book = ctx.readingQueue.find((r) => t.includes(norm(r.title)));
    if (book) return { ...b, screen: "sem_tela", refType: "reading_item", refId: book.id };
    const habit = ctx.pendingHabits.find((h) => t.includes(norm(h.name)));
    if (habit) return { ...b, refType: "habit", refId: habit.id };
    return b;
  });
}

// ---------- gravação do plano ----------

export async function storePlan(userId: string, date: string, blocks: PlanBlock[], source: "ai" | "rules", hash: string, reason: string | null, lightDay?: boolean) {
  // Sugestões antigas saem; o que a pessoa já aceitou continua.
  await query("DELETE FROM plan_blocks WHERE user_id = $1 AND date = $2::date AND status IN ('proposed','dismissed')", [userId, date]);
  for (const b of blocks) {
    await query(
      `INSERT INTO plan_blocks (user_id, date, start_min, duration_min, kind, title, reason, source, screen_type, ref_type, ref_id)
       VALUES ($1,$2::date,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [userId, date, b.startMin, b.durationMin, b.kind, b.title, b.reason, source, b.screen, b.refType, b.refId],
    );
  }
  await query(
    `INSERT INTO day_plans (user_id, date, input_hash, source, reason, light_day) VALUES ($1,$2::date,$3,$4,$5,COALESCE($6, false))
     ON CONFLICT (user_id, date) DO UPDATE SET input_hash = $3, source = $4, reason = $5, generated_at = now(),
       light_day = COALESCE($6, day_plans.light_day)`,
    [userId, date, hash, source, reason, lightDay ?? null],
  );
}

export type PlanState = { exists: boolean; stale: boolean; source: "ai" | "rules" | null; reason: string | null; lightDay: boolean; ai: Availability };

export async function getPlanState(userId: string, date: string, today: string): Promise<PlanState & { loaded: LoadedContext }> {
  const loaded = await loadPlanContext(userId, date, { today });
  const row = await queryOne<{ input_hash: string; source: "ai" | "rules"; reason: string | null }>("SELECT input_hash, source, reason FROM day_plans WHERE user_id = $1 AND date = $2::date", [userId, date]);
  return {
    exists: Boolean(row), stale: Boolean(row && row.input_hash !== loaded.hash), source: row?.source ?? null, reason: row?.reason ?? null,
    lightDay: loaded.ctx.lightDay, ai: await aiAvailability(userId, loaded.settings), loaded,
  };
}

/** Tenta a IA primeiro; em qualquer falha o motor de regras assume, então o plano sempre aparece. */
export async function ensureDayPlan(userId: string, date: string, opts: { force?: boolean; allowAi?: boolean; today?: string; forceLight?: boolean } = {}): Promise<{ source: PlanSource; reason: RulesReason | null }> {
  const today = opts.today ?? localDateKey();
  const loaded = await loadPlanContext(userId, date, { today, forceLight: opts.forceLight });
  const { ctx, settings, hash } = loaded;
  const existing = await queryOne<{ input_hash: string; source: "ai" | "rules"; reason: string | null }>("SELECT input_hash, source, reason FROM day_plans WHERE user_id = $1 AND date = $2::date", [userId, date]);
  if (existing && existing.input_hash === hash && !opts.force) return { source: "cache", reason: (existing.reason as RulesReason | null) ?? null };

  let reason: RulesReason | null = opts.allowAi === false ? "manual" : null;
  if (opts.allowAi !== false) {
    const avail = await aiAvailability(userId, settings);
    if (avail.ok) {
      try {
        const text = await getProvider()!.generate({ system: SYSTEM, prompt: buildAiPrompt(loaded), json: true });
        const ai = parseAi(text);
        const blocks = attachRefs(sanitizeAiBlocks(ai, ctx), ctx);
        const moves = ctx.lightDay ? [] : sanitizeMoves(ai, ctx);
        // sem nenhum bloco válido e sem proposta de ajuste utilizável, a resposta não serve: cai nas regras
        if (blocks.length === 0 && moves.length === 0 && ctx.lightDay === false && freeSlots(ctx.busy, Math.max(ctx.wake, ctx.nowMin ?? ctx.wake), ctx.sleep).length > 0) {
          throw new AiError("format", "nenhum bloco válido");
        }
        // + sugestões no trajeto (regras) e propostas de mover o início de blocos flexíveis (só propostas)
        const extras = ctx.lightDay ? [] : [...buildTravelSuggestions(ctx), ...moves];
        await storePlan(userId, date, [...blocks, ...extras], "ai", hash, null, ctx.lightDay && loaded.lightManual ? true : undefined);
        await logRequest(userId, "plan", "ai", null, true, hash, { blocks: blocks.length });
        return { source: "ai", reason: null };
      } catch (e) {
        const why = e instanceof AiError ? e.reason : "http";
        console.warn(`[ai] plano do dia caiu para as regras: ${why}${e instanceof Error ? ` (${e.message})` : ""}`);
        await logRequest(userId, "plan", "failed", why, true, hash, { detail: e instanceof AiError ? (e.detail ?? null) : null });
        reason = why === "format" ? "format" : "failed";
      }
    } else {
      reason = avail.reason;
    }
  }

  const blocks = buildRulesPlan(ctx);
  await storePlan(userId, date, blocks, "rules", hash, reason, ctx.lightDay && loaded.lightManual ? true : undefined);
  await logRequest(userId, "plan", "rules", reason, false, hash, { blocks: blocks.length });
  return { source: "rules", reason };
}

// ---------- conversa ----------

export type ChatResult = { reply: string; blocks: PlanBlock[]; source: "ai" | "rules"; reason: RulesReason | null; date: string };

const DAY_LABEL = (date: string, today: string) => (date === today ? "hoje" : "amanhã");

export async function handleChat(userId: string, message: string): Promise<ChatResult> {
  const today = localDateKey();
  await query("INSERT INTO chat_messages (user_id, role, content) VALUES ($1,'user',$2)", [userId, message]);
  const intent = parseIntent(message);
  const date = intent.day === "amanha" ? addDays(today, 1) : today;
  const label = DAY_LABEL(date, today);
  let loaded = await loadPlanContext(userId, date, { today });
  const avail = await aiAvailability(userId, loaded.settings);
  let result: ChatResult | null = null;
  let reason: RulesReason | null = avail.ok ? null : avail.reason;

  // "semana" sempre vai pelas regras: 7 planos pela IA gastariam o limite diário de uma vez
  if (avail.ok && intent.kind !== "week") {
    try {
      const text = await getProvider()!.generate({ system: SYSTEM, prompt: buildAiPrompt(loaded, message), json: true });
      const parsed = parseAi(text);
      const blocks = attachRefs(sanitizeAiBlocks(parsed, loaded.ctx), loaded.ctx);
      const chatExtras = loaded.ctx.lightDay ? [] : [...buildTravelSuggestions(loaded.ctx), ...sanitizeMoves(parsed, loaded.ctx)];
      if (blocks.length || chatExtras.length) await storePlan(userId, date, [...blocks, ...chatExtras], "ai", loaded.hash, null, intent.kind === "light" ? true : undefined);
      await logRequest(userId, "chat", "ai", null, true, loaded.hash, { blocks: blocks.length });
      result = { reply: parsed.reply || (blocks.length ? `Montei uma proposta para ${label}.` : "Tudo bem por aqui."), blocks, source: "ai", reason: null, date };
    } catch (e) {
      const why = e instanceof AiError ? e.reason : "http";
      console.warn(`[ai] chat caiu para as regras: ${why}${e instanceof Error ? ` (${e.message})` : ""}`);
      await logRequest(userId, "chat", "failed", why, true, loaded.hash, { detail: e instanceof AiError ? (e.detail ?? null) : null });
      reason = why === "format" ? "format" : "failed";
    }
  }

  if (!result) {
    // Modo regras: entende pedidos simples e aplica Dia leve, equilíbrio de tela, plano curto, outro dia ou a semana.
    let blocks: PlanBlock[] = [];
    let reply: string;
    let planDate = date;
    const full = (d: string) => (d === today ? "Seu dia está cheio" : "Amanhã está cheio");
    if (intent.kind === "week") {
      let total = 0, days = 0;
      for (let i = 0; i < 7; i++) {
        const d = addDays(today, i);
        await ensureDayPlan(userId, d, { allowAi: false, force: true, today });
        const n = Number((await queryOne<{ n: string }>("SELECT count(*)::text AS n FROM plan_blocks WHERE user_id = $1 AND date = $2::date AND status = 'proposed'", [userId, d]))?.n ?? 0);
        total += n; if (n > 0) days++;
      }
      reply = total > 0
        ? `Montei ${total} sugestões pelas regras, em ${days} dos próximos 7 dias. Veja na Agenda, dia a dia, e aceite o que quiser (nada muda sem você aceitar).`
        : "Não achei horários livres de 30 minutos ou mais nos próximos 7 dias. Confira a rotina-modelo e a agenda.";
      planDate = today;
    } else if (intent.kind === "light") {
      loaded = await loadPlanContext(userId, date, { today, forceLight: true });
      blocks = buildRulesPlan(loaded.ctx);
      await storePlan(userId, date, blocks, "rules", loaded.hash, reason, true);
      reply = `Entendi. Ativei o Dia leve para ${label}: só 2 ou 3 coisas fáceis e gostosas, sem cobrança.`;
    } else if (intent.kind === "minutes") {
      const one = suggestForMinutes(loaded.ctx, intent.minutes ?? 30);
      blocks = one ? [one] : [];
      if (one) {
        await query(
          `INSERT INTO plan_blocks (user_id, date, start_min, duration_min, kind, title, reason, source, screen_type, ref_type, ref_id)
           VALUES ($1,$2::date,$3,$4,$5,$6,$7,'rules',$8,$9,$10)`,
          [userId, date, one.startMin, one.durationMin, one.kind, one.title, one.reason, one.screen, one.refType, one.refId],
        );
      }
      reply = one ? `Para ${intent.minutes} minutos, que tal isto?` : "Não achei nada cadastrado que caiba nesse tempo. Cadastre atividades e mini-vitórias para eu sugerir.";
    } else if (intent.kind === "screenfree") {
      blocks = buildScreenFreePlan(loaded.ctx);
      await storePlan(userId, date, blocks, "rules", loaded.hash, reason, undefined);
      reply = `Montei um plano com atividades sem tela para ${label}.`;
    } else if (intent.kind === "plan") {
      blocks = buildRulesPlan(loaded.ctx);
      await storePlan(userId, date, blocks, "rules", loaded.hash, reason, undefined);
      reply = blocks.length ? `Reorganizei ${label === "hoje" ? "o seu dia" : "o dia de amanhã"} pelas regras.` : `${full(date)}. Não há horários livres de 30 minutos ou mais.${date === today ? " Para outro dia, peça por exemplo \"organize meu dia amanhã\"." : ""}`;
    } else {
      reply = "Estou no modo regras agora: entendo pedidos como \"estou cansada\", \"tenho 40 minutos\", \"quero menos tela\", \"organize meu dia amanhã\" ou \"organize minha semana\". A conversa livre volta quando a IA estiver disponível.";
    }
    await logRequest(userId, "chat", "rules", reason, false, loaded.hash, { intent: intent.kind, blocks: blocks.length });
    result = { reply, blocks, source: "rules", reason, date: planDate };
  }

  await query("INSERT INTO chat_messages (user_id, role, content, plan, source, plan_date) VALUES ($1,'assistant',$2,$3::jsonb,$4,$5::date)", [userId, result.reply, result.blocks.length ? JSON.stringify(result.blocks) : null, result.source, result.date]);
  return result;
}

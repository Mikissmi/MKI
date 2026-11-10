import { describe, expect, it } from "vitest";
import { moodKeyFor, pickTrilha, type TrilhaPlaylist } from "./trilha";

const pl = (o: Partial<TrilhaPlaylist> & { id: string }): TrilhaPlaylist => ({ title: o.id, subtitle: null, url: null, cover_url: null, mood: null, is_today: false, activity_id: null, spotify_playlist_id: null, ...o });

describe("trilha do dia", () => {
  const list = [pl({ id: "a", mood: "calmo" }), pl({ id: "b", activity_id: "act1" }), pl({ id: "c", is_today: true }), pl({ id: "d", mood: "animado" })];
  it("a marcada como do dia vence", () => expect(pickTrilha(list, { moodKey: "calmo", activityIds: ["act1"] })?.id).toBe("c"));
  it("sem a do dia: atividade que está no plano de hoje", () => expect(pickTrilha(list.filter((p) => !p.is_today), { moodKey: "calmo", activityIds: ["act1"] })?.id).toBe("b"));
  it("sem atividade: humor de hoje", () => expect(pickTrilha(list.filter((p) => !p.is_today), { moodKey: "animado", activityIds: [] })?.id).toBe("d"));
  it("nada combina: vazio na tela Hoje, a mais recente em Música", () => {
    const rest = [pl({ id: "x" }), pl({ id: "y" })];
    expect(pickTrilha(rest, { moodKey: null, activityIds: [] })).toBeUndefined();
    expect(pickTrilha(rest, { moodKey: null, activityIds: [], fallback: true })?.id).toBe("x");
  });
  it("humor de hoje vira chave", () => { expect(moodKeyFor(1)).toBe("calmo"); expect(moodKeyFor(5)).toBe("animado"); expect(moodKeyFor(3)).toBeNull(); expect(moodKeyFor(null)).toBeNull(); });
});

import { describe, expect, it } from "vitest";
import { decryptToken, encryptToken, loadKey } from "./crypto";
import { missingScopes, redirectUriProblem, scopesFor, spotifyConfig } from "./config";
import { mapPlaylists, mapRecent, mapSearch, matchListened, pickImage } from "./normalize";

const KEY = Buffer.alloc(32, 7).toString("base64");

describe("criptografia dos tokens", () => {
  it("ida e volta; cada valor tem IV diferente e o texto não aparece", () => {
    const k = loadKey(KEY)!;
    const a = encryptToken("BQDtoken-secreto", k), b = encryptToken("BQDtoken-secreto", k);
    expect(a).not.toBe(b);
    expect(a).not.toContain("BQDtoken");
    expect(decryptToken(a, k)).toBe("BQDtoken-secreto");
    expect(decryptToken(b, k)).toBe("BQDtoken-secreto");
  });
  it("valor adulterado ou chave errada não abre", () => {
    const k = loadKey(KEY)!;
    const enc = encryptToken("segredo", k);
    const parts = enc.split(".");
    const tampered = [parts[0], parts[1], parts[2], Buffer.from("outro").toString("base64")].join(".");
    expect(decryptToken(tampered, k)).toBeNull();
    expect(decryptToken(enc, loadKey(Buffer.alloc(32, 9).toString("base64")))).toBeNull();
    expect(decryptToken("lixo", k)).toBeNull();
  });
  it("chave precisa ter 32 bytes", () => {
    expect(loadKey("curta")).toBeNull();
    expect(loadKey(undefined)).toBeNull();
    expect(() => encryptToken("x", null as never)).toThrow();
  });
});

describe("configuração", () => {
  const ok = { SPOTIFY_CLIENT_ID: "id", SPOTIFY_CLIENT_SECRET: "sec", SPOTIFY_REDIRECT_URI: "https://app.vercel.app/api/spotify/callback", SPOTIFY_TOKEN_KEY: KEY } as unknown as NodeJS.ProcessEnv;
  it("lista exatamente o que falta", () => {
    expect(spotifyConfig(ok).configured).toBe(true);
    expect(spotifyConfig({} as NodeJS.ProcessEnv).missing).toEqual(["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET", "SPOTIFY_REDIRECT_URI", "SPOTIFY_TOKEN_KEY"]);
    expect(spotifyConfig({ ...ok, SPOTIFY_TOKEN_KEY: "curta" } as NodeJS.ProcessEnv).missing).toEqual(["SPOTIFY_TOKEN_KEY"]);
  });
  it("em produção as bases são sempre as oficiais (sem desvio por variável)", () => {
    const c = spotifyConfig({ ...ok, SPOTIFY_AUTH_BASE: "http://evil", SPOTIFY_API_BASE: "http://evil" } as NodeJS.ProcessEnv);
    expect(c.authBase).toBe("https://accounts.spotify.com");
    expect(c.apiBase).toBe("https://api.spotify.com");
  });
  it("regras de redirect do Spotify: HTTPS ou 127.0.0.1; localhost proibido", () => {
    expect(redirectUriProblem("https://app.vercel.app/api/spotify/callback")).toBeNull();
    expect(redirectUriProblem("http://127.0.0.1:3000/api/spotify/callback")).toBeNull();
    expect(redirectUriProblem("http://localhost:3000/api/spotify/callback")).toMatch(/localhost/);
    expect(redirectUriProblem("http://app.vercel.app/api/spotify/callback")).toMatch(/HTTPS/);
    expect(redirectUriProblem("https://app.vercel.app/outro")).toMatch(/callback/);
    expect(redirectUriProblem("não é url")).toMatch(/válido/);
  });
  it("permissões só dos recursos ligados", () => {
    expect(scopesFor({ playlists: false, search: true, history: false })).toEqual([]);
    expect(scopesFor({ playlists: true, search: true, history: false })).toEqual(["playlist-read-private", "playlist-read-collaborative"]);
    expect(scopesFor({ playlists: false, search: false, history: true })).toEqual(["user-read-recently-played"]);
    expect(missingScopes({ playlists: true, search: true, history: true }, ["playlist-read-private", "playlist-read-collaborative"])).toEqual(["user-read-recently-played"]);
  });
});

describe("normalização das respostas", () => {
  it("playlists: ignora itens nulos/sem id, escolhe imagem e só aceita https", () => {
    const p = mapPlaylists({ items: [null, { id: "p1", name: "Manhã", images: [{ url: "https://i/640", width: 640 }, { url: "https://i/300", width: 300 }, { url: "https://i/64", width: 64 }], external_urls: { spotify: "https://open.spotify.com/playlist/p1" }, owner: { display_name: "Mari" } }, { id: "p2" }, { id: "p3", name: "Sem capa", images: [], external_urls: { spotify: "http://inseguro" } }] });
    expect(p).toEqual([
      { id: "p1", name: "Manhã", cover: "https://i/300", url: "https://open.spotify.com/playlist/p1", owner: "Mari" },
      { id: "p3", name: "Sem capa", cover: null, url: null, owner: null },
    ]);
  });
  it("busca: álbum, artista e podcast; publisher removido não quebra", () => {
    const r = mapSearch({
      albums: { items: [{ id: "a1", name: "Folklore", artists: [{ name: "Taylor Swift" }], images: [{ url: "https://i/a", width: 300 }], external_urls: { spotify: "https://open.spotify.com/album/a1" } }] },
      artists: { items: [{ id: "r1", name: "Taylor Swift", images: [], external_urls: { spotify: "https://open.spotify.com/artist/r1" }, popularity: undefined }] },
      shows: { items: [{ id: "s1", name: "Café e ideias", images: [{ url: "https://i/s" }], external_urls: { spotify: "https://open.spotify.com/show/s1" } }] },
    });
    expect(r.map((x) => `${x.kind}:${x.title}`)).toEqual(["album:Folklore", "artist:Taylor Swift", "podcast:Café e ideias"]);
    expect(r[0].creator).toBe("Taylor Swift");
    expect(r[2].creator).toBeNull();
  });
  it("resposta vazia ou torta vira lista vazia", () => {
    expect(mapSearch(null)).toEqual([]);
    expect(mapSearch({ albums: "x" })).toEqual([]);
    expect(mapPlaylists(undefined)).toEqual([]);
    expect(mapRecent({ items: [{ track: null, played_at: "ontem" }] })).toEqual([]);
    expect(pickImage(undefined)).toBeNull();
  });
  it("histórico recente: faixa, álbum e artistas", () => {
    const p = mapRecent({ items: [{ played_at: "2026-11-09T10:00:00Z", track: { name: "cardigan", album: { id: "a1", name: "folklore" }, artists: [{ id: "r1", name: "Taylor Swift" }] } }] });
    expect(p).toEqual([{ trackName: "cardigan", albumId: "a1", albumName: "folklore", artistIds: ["r1"], artistNames: ["Taylor Swift"], playedAt: "2026-11-09T10:00:00Z" }]);
  });
});

describe("marcar como ouvido", () => {
  const plays = mapRecent({ items: [
    { played_at: "2026-11-09T10:00:00Z", track: { name: "t1", album: { id: "a1" }, artists: [{ id: "r1" }] } },
    { played_at: "2026-11-09T12:00:00Z", track: { name: "t2", album: { id: "a1" }, artists: [{ id: "r1" }] } },
    { played_at: "2026-11-08T09:00:00Z", track: { name: "t3", album: { id: "a9" }, artists: [{ id: "r2" }] } },
  ] });
  const items = [
    { id: "i1", kind: "album", spotify_id: "a1", status: "quero" }, { id: "i2", kind: "artista", spotify_id: "r2", status: "quero" },
    { id: "i3", kind: "album", spotify_id: "zzz", status: "quero" }, { id: "i4", kind: "album", spotify_id: "a1", status: "ouvido" },
    { id: "i5", kind: "podcast", spotify_id: "a1", status: "quero" }, { id: "i6", kind: "album", spotify_id: null, status: "quero" },
  ];
  it("casa álbum e artista, usa a tocada mais recente e ignora podcast, já ouvido e itens sem id do Spotify", () => {
    expect(matchListened(items, plays)).toEqual([{ id: "i1", playedAt: "2026-11-09T12:00:00Z" }, { id: "i2", playedAt: "2026-11-08T09:00:00Z" }]);
  });
});

import { describe, expect, it } from "vitest";
import { discoverFeedUrl, matchTopic, parseFeed, toPlainText } from "./rss";

const RSS = `<?xml version="1.0"?><rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/"><channel>
<title>Revista Horizonte</title><link>https://horizonte.example/</link>
<item><title>Como a tecnologia está &amp; mudando hábitos</title><link>https://horizonte.example/a1</link><guid isPermaLink="false">id-1</guid>
<description><![CDATA[<p>Novas ferramentas <b>ajudam</b> pessoas.</p><script>alert(1)</script>]]></description><pubDate>Mon, 09 Nov 2026 10:00:00 GMT</pubDate><media:content url="https://horizonte.example/img.jpg" type="image/jpeg"/></item>
<item><title>Link perigoso</title><link>javascript:alert(1)</link></item>
<item><title></title><link>https://horizonte.example/vazio</link></item>
<item><title>Sem guid</title><link>https://horizonte.example/a3</link><description>&lt;img src="/capa.png"&gt; resumo</description></item>
</channel></rss>`;
const ATOM = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog Atom</title><link rel="alternate" href="https://atom.example/"/>
<entry><title>Post um</title><link rel="alternate" href="https://atom.example/p1"/><id>tag:1</id><updated>2026-11-08T10:00:00Z</updated><summary>Resumo do post</summary></entry></feed>`;

describe("leitura de feeds", () => {
  it("lê RSS: título, link, resumo em texto puro, imagem e data", () => {
    const f = parseFeed(RSS, "https://horizonte.example/feed");
    expect(f.title).toBe("Revista Horizonte");
    const a = f.items[0];
    expect(a.title).toBe("Como a tecnologia está & mudando hábitos");
    expect(a.summary).toBe("Novas ferramentas ajudam pessoas.");
    expect(a.summary).not.toMatch(/script|alert|<|>/);
    expect(a.imageUrl).toBe("https://horizonte.example/img.jpg");
    expect(a.publishedAt?.toISOString()).toBe("2026-11-09T10:00:00.000Z");
    expect(a.guid).toBe("id-1");
  });
  it("descarta itens com link javascript: e sem título", () => {
    const f = parseFeed(RSS, "https://horizonte.example/feed");
    expect(f.items.map((i) => i.title)).toEqual(["Como a tecnologia está & mudando hábitos", "Sem guid"]);
  });
  it("usa o link como guid e acha imagem no HTML do resumo", () => {
    const i = parseFeed(RSS, "https://horizonte.example/feed").items[1];
    expect(i.guid).toBe("https://horizonte.example/a3");
    expect(i.imageUrl).toBe("https://horizonte.example/capa.png");
  });
  it("lê Atom", () => {
    const f = parseFeed(ATOM, "https://atom.example/feed.xml");
    expect(f.title).toBe("Blog Atom");
    expect(f.items[0]).toMatchObject({ title: "Post um", link: "https://atom.example/p1", guid: "tag:1", summary: "Resumo do post" });
  });
  it("recusa o que não é feed", () => {
    expect(() => parseFeed("<html><body>oi</body></html>")).toThrow();
    expect(() => parseFeed("isso não é xml <<<")).toThrow();
  });
  it("descobre o feed em uma página HTML", () => {
    expect(discoverFeedUrl('<head><link rel="alternate" type="application/rss+xml" href="/feed.xml"></head>', "https://site.example/blog")).toBe("https://site.example/feed.xml");
    expect(discoverFeedUrl('<link rel="alternate" type="application/rss+xml" href="javascript:x">', "https://s.example")).toBeNull();
  });
  it("remove tags e decodifica entidades", () => {
    expect(toPlainText("<p>Caf&eacute;?</p><style>a{}</style> &amp; &#233;")).toBe("Café? & é");
  });
  it("decodifica acentos do português e preserva maiúsculas", () => {
    expect(toPlainText("S&atilde;o Paulo, &Aacute;gua, cora&ccedil;&atilde;o, a&ccedil;&otilde;es")).toBe("São Paulo, Água, coração, ações");
  });
  it("associa tema por palavra-chave", () => {
    const topics = [{ id: "t1", keywords: ["ciência", "pesquisa"] }, { id: "t2", keywords: ["livro"] }];
    expect(matchTopic("Nova PESQUISA sobre sono", topics)).toBe("t1");
    expect(matchTopic("Receita de bolo", topics)).toBeNull();
  });
});

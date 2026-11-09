import { describe, expect, it } from "vitest";
import { extractReadable, summarizeText } from "./article";

const P = (n: number) => `Este é o parágrafo número ${n}, com texto suficiente para contar como conteúdo real da matéria e passar do tamanho mínimo.`.repeat(2);
const PAGE = `<html><head><title>X</title><script>var evil = "<p>não deve aparecer</p>";</script></head><body>
<header><p>Menu do site com um texto longo de navegação que não faz parte da matéria em si, para teste.</p></header>
<nav><li>Início e outras seções do site que são só navegação para o leitor</li></nav>
<article><h1>Título</h1><h2>Subtítulo da seção</h2><p>${P(1)}</p><p>${P(2)}</p><p>Leia também: outra matéria qualquer do mesmo site que não importa aqui.</p><p>${P(3)}</p><p>${P(4)}</p></article>
<aside><p>Publicidade e links relacionados com bastante texto para tentar enganar o extrator de conteúdo da página.</p></aside>
<footer><p>Todos os direitos reservados, termos de uso e política de privacidade do site em texto longo.</p></footer></body></html>`;

describe("modo leitura", () => {
  it("extrai o texto principal e descarta menu, rodapé, anúncio e scripts", () => {
    const r = extractReadable(PAGE);
    expect(r.ok).toBe(true);
    const all = r.paragraphs.join("\n");
    expect(all).toContain("parágrafo número 1");
    expect(all).toContain("Subtítulo da seção");
    expect(all).not.toMatch(/Menu do site|Início e outras|Publicidade|Todos os direitos|não deve aparecer|Leia também/);
  });
  it("devolve só texto puro (sem tags nem script)", () => {
    const r = extractReadable(PAGE.replace("<p>" + P(1), "<p><b>negrito</b> <script>alert(1)</script>" + P(1)));
    expect(r.paragraphs.join(" ")).not.toMatch(/<|>|alert\(1\)/);
  });
  it("usa <main> quando não há <article>, e o corpo como último recurso", () => {
    const main = extractReadable(`<body><main>${[1, 2, 3, 4].map((n) => `<p>${P(n)}</p>`).join("")}</main></body>`);
    expect(main.ok).toBe(true);
    const bare = extractReadable(`<body><div>${[1, 2, 3, 4].map((n) => `<p>${P(n)}</p>`).join("")}</div></body>`);
    expect(bare.ok).toBe(true);
  });
  it("página com pouco texto não é considerada legível (cai no 'Abrir no site')", () => {
    expect(extractReadable("<article><p>Muito curto.</p></article>").ok).toBe(false);
  });
  it("detecta paywall", () => {
    const r = extractReadable(`<article><p>${P(1)}</p><p>Assine para continuar lendo esta matéria completa.</p></article>`);
    expect(r.paywall).toBe(true);
    expect(r.ok).toBe(false);
  });
});

describe("resumo simples", () => {
  const text = ["O governo anunciou hoje um novo plano para o transporte público. A medida começa na próxima semana. Os detalhes serão divulgados em breve. Uma quarta frase que não entra.", "Segundo parágrafo com mais informação, mas o resumo já está completo."];
  it("usa as primeiras frases, no máximo três", () => {
    const s = summarizeText(text)!;
    expect(s).toBe("O governo anunciou hoje um novo plano para o transporte público. A medida começa na próxima semana. Os detalhes serão divulgados em breve.");
  });
  it("respeita o tamanho máximo e não corta número decimal no meio", () => {
    const s = summarizeText(["O preço subiu de R$ 1.234,56 para R$ 2.000,00 neste mês, segundo o levantamento feito por pesquisadores independentes da área." + " texto".repeat(80)])!;
    expect(s.length).toBeLessThanOrEqual(321);
    expect(s).toContain("R$ 1.234,56");
  });
  it("sem parágrafos suficientes não inventa resumo", () => {
    expect(summarizeText([])).toBeNull();
    expect(summarizeText(["curto"])).toBeNull();
  });
});

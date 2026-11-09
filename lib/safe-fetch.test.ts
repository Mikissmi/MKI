import { describe, expect, it } from "vitest";
import { assertPublicUrl, extractMeta, isPrivateIp, UnsafeUrlError } from "./safe-fetch";

describe("bloqueio de endereços internos (SSRF)", () => {
  it.each(["127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "0.0.0.0", "100.64.0.1", "::1", "fe80::1", "fd00::1", "::ffff:127.0.0.1", "224.0.0.1"])("%s é privado", (ip) => expect(isPrivateIp(ip)).toBe(true));
  it.each(["8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])("%s é público", (ip) => expect(isPrivateIp(ip)).toBe(false));
  it("recusa localhost, IPs internos, esquemas e credenciais", async () => {
    for (const u of ["http://localhost/x", "http://127.0.0.1:3000", "http://169.254.169.254/latest/meta-data", "http://[::1]/", "file:///etc/passwd", "ftp://example.com", "http://user:pw@example.com", "http://app.internal/", "javascript:alert(1)", "não é url"]) {
      await expect(assertPublicUrl(u)).rejects.toBeInstanceOf(UnsafeUrlError);
    }
  });
  it("aceita IP público literal", async () => {
    await expect(assertPublicUrl("https://8.8.8.8/")).resolves.toBeInstanceOf(URL);
  });
});

describe("metadados de página", () => {
  it("prefere og:title e decodifica entidades", () => {
    const m = extractMeta('<head><title>Fallback</title><meta property="og:title" content="Caf&eacute; &amp; ideias"><meta property="og:image" content="https://x.com/a.jpg"></head>');
    expect(m.title).toContain("& ideias");
    expect(m.image).toBe("https://x.com/a.jpg");
  });
  it("usa <title> quando não há og:title e ignora imagem não http", () => {
    expect(extractMeta("<title> Olá   mundo </title>").title).toBe("Olá mundo");
    expect(extractMeta('<meta property="og:image" content="javascript:x">').image).toBeNull();
  });
});

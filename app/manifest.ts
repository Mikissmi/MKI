import type { MetadataRoute } from "next";
import { queryOne } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { getSettings } from "@/lib/settings";
import { resolveShortcuts, DEFAULT_CUSTOM } from "@/lib/shortcuts";

// O manifesto muda com o kit de atalhos escolhido em Configurações; por isso é gerado a cada pedido.
export const dynamic = "force-dynamic";

/**
 * O navegador busca o manifesto sem enviar o cookie de sessão. Como o app é pessoal, se não houver sessão
 * usa o kit do usuário mais antigo (o dono). O manifesto só tem nomes de atalhos, nada privado.
 */
async function shortcutKeys() {
  try {
    const id = (await getSessionUser())?.id ?? (await queryOne<{ id: string }>("SELECT id FROM users ORDER BY created_at LIMIT 1"))?.id;
    if (id) { const s = await getSettings(id); return resolveShortcuts(s.shortcutKit, s.shortcutCustom); }
  } catch { /* sem banco: usa o padrão */ }
  return resolveShortcuts("custom", DEFAULT_CUSTOM);
}

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const shortcuts = await shortcutKeys();
  return {
    name: "MKI",
    short_name: "MKI",
    description: "Meu painel pessoal",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "pt-BR",
    background_color: "#fbf5ec",
    theme_color: "#fbf5ec",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // O Android mostra de 3 a 4 itens; a ordem do kit já põe os mais importantes primeiro.
    shortcuts: shortcuts.map((s) => ({ name: s.name, short_name: s.short, url: s.url, icons: [{ src: `/icons/shortcuts/${s.key}.png`, sizes: "192x192", type: "image/png" }] })),
    // Compartilhar para o MKI (Android com o app instalado): abre a tela que pergunta o destino.
    share_target: { action: "/compartilhar", method: "GET", params: { title: "title", text: "text", url: "url" } },
  };
}

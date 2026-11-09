import { Box } from "@mantine/core";
import { IconTile } from "./Panel";
import type { Tone } from "@/lib/tones";

/** Capa/foto vinda de um link externo (o app não faz upload). Sem link, mostra um ícone no tom escolhido. */
export function Cover({ url, icon = "photo", tone = "pink", width = 64, height = 88, radius = 14 }: { url?: string | null; icon?: string; tone?: Tone; width?: number; height?: number; radius?: number }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" width={width} height={height} style={{ width, height, objectFit: "cover", borderRadius: radius, flexShrink: 0, background: "#f3e9dc" }} />;
  }
  return <Box style={{ width, height, borderRadius: radius, flexShrink: 0, display: "grid", placeItems: "center", background: "light-dark(#f7ece6, rgba(255,255,255,0.06))" }}><IconTile icon={icon} tone={tone} size={Math.min(width, height) * 0.55} round /></Box>;
}

export function Stars({ value, size = 14 }: { value: number | string | null | undefined; size?: number }) {
  const n = Math.round(Number(value ?? 0));
  if (!n) return null;
  return <span aria-label={`${n} de 5 estrelas`} style={{ display: "inline-flex", gap: 1, color: "#f2c534" }}>{Array.from({ length: 5 }, (_, i) => <svg key={i} width={size} height={size} viewBox="0 0 24 24" fill={i < n ? "currentColor" : "none"} stroke="currentColor" strokeWidth={2}><path d="M12 17.3l-5.4 3.2 1.4-6.1L3.3 10l6.2-.5L12 3.8l2.5 5.7 6.2.5-4.7 4.4 1.4 6.1z" /></svg>)}</span>;
}

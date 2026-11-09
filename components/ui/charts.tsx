import type { ReactNode } from "react";

/** Gráfico de linhas simples em SVG (sem dependências). Pontos nulos interrompem a linha. */
export function LineChart({ labels, series, min = 0, max = 5, height = 150 }: {
  labels: string[]; series: { name: string; color: string; points: (number | null)[] }[]; min?: number; max?: number; height?: number;
}) {
  const W = 320, H = height, padL = 22, padR = 8, padT = 10, padB = 22;
  const x = (i: number) => padL + (labels.length <= 1 ? 0 : (i * (W - padL - padR)) / (labels.length - 1));
  const y = (v: number) => padT + (1 - (v - min) / (max - min)) * (H - padT - padB);
  const ticks = [min, (min + max) / 2, max];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={`Gráfico: ${series.map((s) => s.name).join(" e ")}`}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={W - padR} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} strokeDasharray="3 3" />
          <text x={padL - 6} y={y(t) + 3} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.55}>{Number.isInteger(t) ? t : t.toFixed(1)}</text>
        </g>
      ))}
      {labels.map((l, i) => <text key={i} x={x(i)} y={H - 6} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.65}>{l}</text>)}
      {series.map((s) => {
        const segs: [number, number][][] = [[]];
        s.points.forEach((p, i) => { if (p === null) segs.push([]); else segs[segs.length - 1].push([x(i), y(p)]); });
        return (
          <g key={s.name}>
            {segs.filter((g) => g.length > 1).map((g, k) => <polyline key={k} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" points={g.map((p) => p.join(",")).join(" ")} />)}
            {s.points.map((p, i) => p === null ? null : <circle key={i} cx={x(i)} cy={y(p)} r={3.5} fill={s.color} stroke="#fff" strokeWidth={1.2} />)}
          </g>
        );
      })}
    </svg>
  );
}

/** Rosca (donut) em SVG com conteúdo no centro. */
export function Donut({ slices, size = 150, thickness = 26, center }: { slices: { label: string; value: number; color: string }[]; size?: number; thickness?: number; center?: ReactNode }) {
  const total = slices.reduce((a, s) => a + s.value, 0);
  const r = (size - thickness) / 2, c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Gráfico de rosca">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.1} strokeWidth={thickness} />
        {total > 0 && slices.filter((s) => s.value > 0).map((s) => {
          const len = (s.value / total) * c;
          const el = <circle key={s.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={thickness} strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`} />;
          offset += len;
          return el;
        })}
      </svg>
      {center && <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>{center}</div>}
    </div>
  );
}

/** Anel de progresso (ex.: 3/5 hábitos). */
export function Ring({ value, total, size = 120, color = "var(--mantine-color-lotus-5)", children }: { value: number; total: number; size?: number; color?: string; children?: ReactNode }) {
  const thickness = 12, r = (size - thickness) / 2, c = 2 * Math.PI * r;
  const frac = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${value} de ${total}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeOpacity={0.18} strokeWidth={thickness} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={thickness} strokeLinecap="round" strokeDasharray={`${frac * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center" }}>{children}</div>
    </div>
  );
}

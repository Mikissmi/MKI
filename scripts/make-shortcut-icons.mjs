// Gera um ícone de 192 px por atalho em public/icons/shortcuts/ (círculo pastel + ícone de linha).
// Uso: node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types scripts/make-shortcut-icons.mjs
import { mkdirSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import sharp from "sharp";
import * as T from "@tabler/icons-react";
import { SHORTCUTS } from "../lib/shortcuts.ts";

const COMP = { wallet: "IconWallet", droplet: "IconDroplet", "mood-4": "IconMoodSmile", bulb: "IconBulb", link: "IconLink", book2: "IconBook2", news: "IconNews", music: "IconMusic", sun: "IconSun", calendar: "IconCalendar", "mood-beam": "IconMoodSmileBeam", event: "IconCalendarEvent", bed: "IconBed", run: "IconRun", moon: "IconMoon", check: "IconCheck", chart: "IconChartPie", brush: "IconBrush", chef: "IconChefHat", gift: "IconGift", plane: "IconPlane" };
const COLORS = { pink: ["#f8c6d4", "#7a2448"], sage: ["#c4e2bf", "#2f5a2a"], sun: ["#f8e08c", "#6b4f06"], lavender: ["#d5c7f1", "#4a3680"], plain: ["#f5ead9", "#552640"] };

mkdirSync("public/icons/shortcuts", { recursive: true });
for (const s of SHORTCUTS) {
  const [bg, fg] = COLORS[s.tone];
  const glyph = renderToStaticMarkup(createElement(T[COMP[s.icon]], { size: 96, stroke: 1.8, color: fg }));
  const inner = glyph.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192"><circle cx="96" cy="96" r="96" fill="${bg}"/><g transform="translate(48 48)"><svg width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="${fg}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${inner}</svg></g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(`public/icons/shortcuts/${s.key}.png`);
}
console.log(SHORTCUTS.length + " ícones de atalho gerados");

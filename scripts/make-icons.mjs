// Gera os ícones do PWA a partir de public/brand/logo-mki.svg
import sharp from "sharp";
const src = "public/brand/logo-mki.svg";
const bg = "#fbf5ec";
async function icon(file, size, pad) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(src, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: bg } })
    .composite([{ input: logo, gravity: "center" }]).png().toFile(`public/icons/${file}`);
}
await icon("icon-192.png", 192, 0.1);
await icon("icon-512.png", 512, 0.1);
await icon("icon-maskable-512.png", 512, 0.22);
await icon("apple-touch-icon.png", 180, 0.1);
console.log("ícones gerados");

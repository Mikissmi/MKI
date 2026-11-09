// Falha se um server component usar `component={Link}` do Mantine (quebra em runtime com erro 500).
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const bad = [];
function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (f === "node_modules" || f === ".next") continue;
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.tsx$/.test(f)) {
      const src = readFileSync(p, "utf8");
      if (/component=\{Link\}/.test(src) && !/^\s*["']use client["']/.test(src)) bad.push(p);
    }
  }
}
for (const d of ["app", "components"]) walk(d);
if (bad.length) { console.error("component={Link} em server component:\n" + bad.join("\n")); process.exit(1); }
console.log("links ok");

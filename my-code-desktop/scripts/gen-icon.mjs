// Rasterize build/logo.svg into the icon set used by Electron.
//   build/icon.png (512)  — window icon (dev)
//   build/icon.ico        — packaged app / taskbar
//   build/logo-<n>.png    — assorted sizes
import { Resvg } from "@resvg/resvg-js";
import pngToIco from "png-to-ico";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const svg = readFileSync(join(root, "build", "logo.svg"), "utf8");

function render(size) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: size } });
  return r.render().asPng();
}

const sizes = [16, 32, 48, 64, 128, 256, 512];
for (const s of sizes) {
  writeFileSync(join(root, "build", `logo-${s}.png`), render(s));
}
writeFileSync(join(root, "build", "icon.png"), render(512));

const ico = await pngToIco([16, 32, 48, 64, 128, 256].map((s) => join(root, "build", `logo-${s}.png`)));
writeFileSync(join(root, "build", "icon.ico"), ico);

console.log("wrote build/icon.png, build/icon.ico, and logo-*.png");

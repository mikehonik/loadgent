// Empaqueta dist/ en un solo archivo HTML (dist/DarnelCube3D.html) que se abre sin servidor.
// Inserta en línea los <script type="module"> y <link rel="stylesheet"> que Vite dejó como archivos.
import { readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";

const dist = "dist";
let html = readFileSync(join(dist, "index.html"), "utf8");
const leer = (ruta) => readFileSync(join(dist, ruta.replace(/^\.?\//, "")), "utf8");
html = html.replace(/<script type="module"[^>]*src="([^"]+)"><\/script>/g, (_, src) => `<script type="module">${leer(src).replace(/<\/script>/gi, "<\\/script>")}</script>`);
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)">/g, (_, href) => `<style>${leer(href)}</style>`);
html = html.replace(/<link rel="modulepreload"[^>]*>\n?/g, "");
const salida = join(dist, "DarnelCube3D.html");
writeFileSync(salida, html);
console.log(`${salida}: ${(statSync(salida).size / 1024 / 1024).toFixed(2)} MB`);

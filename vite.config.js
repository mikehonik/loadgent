import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Versión visible (ver src/version.js): el número sale de package.json y el build del commit que se compila.
// Cloudflare Pages da el commit en CF_PAGES_COMMIT_SHA; en una computadora se toma de git.
const version = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
const build = (() => {
  if (process.env.CF_PAGES_COMMIT_SHA) return process.env.CF_PAGES_COMMIT_SHA.slice(0, 7);
  try { return execSync("git rev-parse --short HEAD", { stdio: ["ignore", "pipe", "ignore"] }).toString().trim(); } catch { return "local"; }
})();
const fecha = new Date().toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", day: "2-digit", month: "2-digit", year: "numeric" });

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __VERSION__: JSON.stringify(version),
    __BUILD__: JSON.stringify(build),
    __FECHA_BUILD__: JSON.stringify(fecha),
  },
});

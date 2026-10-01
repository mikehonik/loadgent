import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { empacarParaNube, abrirDeNube, FORMATO_GZIP } from "./comprimir.js";
import { leerMaestro } from "../archivos/maestro.js";

describe("compresión del maestro para la nube", () => {
  it("va y viene idéntico, y ocupa mucho menos", async () => {
    const r = leerMaestro(new Uint8Array(readFileSync("datos/maestro_productos.xlsx")));
    const maestro = { productos: r.productos, tarimas: r.tarimas, conversiones: r.conversiones };
    const empacado = await empacarParaNube(maestro);
    expect(empacado.formato).toBe(FORMATO_GZIP);
    expect(empacado.datos.length).toBeLessThan(JSON.stringify(maestro).length / 3);
    expect(await abrirDeNube(empacado)).toEqual(JSON.parse(JSON.stringify(maestro)));
  });
  it("lo guardado antes sin comprimir se sigue leyendo", async () => {
    const viejo = { productos: [{ sku: "A-1" }], tarimas: [] };
    expect(await abrirDeNube(viejo)).toBe(viejo);
    expect(await abrirDeNube(null)).toBeNull();
  });
});

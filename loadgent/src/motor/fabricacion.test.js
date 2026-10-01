import { describe, it, expect } from "vitest";
import { patronesFabricacion, metricasPallet, semaforos, FACTORES } from "./fabricacion.js";
import { prepararEntrada } from "./corrida.js";

const pal = { nombre: "Americano", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 };
const sku = (d) => prepararEntrada({ items: [{ nombre: "SKU", L: 600, W: 400, H: 400, peso: 10, qty: 1, oris: [true, true, false, false, false, false], piso: "libre", soportaEncima: true, ...d }], vehiculo: null, tarimas: [], reglas: { soporteMin: 75 } });
const patrones = (d, op = {}) => { const e = sku(d); return patronesFabricacion(e.items[0], pal, e.reglas, op); };
const sinEncimarse = (cajas) => cajas.every((a, i) => cajas.every((b, j) => i === j || Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x) <= 0.5 || Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y) <= 0.5 || Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z) <= 0.5));

describe("patronesFabricacion", () => {
  it("600×400×400 en americano: entrelazado, columnas e híbrido, 20 cajas cada uno, sin encimarse y dentro de la altura", () => {
    const ps = patrones({}, { bct: 300, humedad: "normal", tiempo: "mes", apilaEncima: 1 });
    expect(ps.map((p) => p.clave)).toEqual(["entrelazado", "columnas", "hibrido"]);
    ps.forEach((p) => { expect(p.def.n).toBe(20); expect(sinEncimarse(p.def.cajas)).toBe(true); expect(p.def.alto).toBeLessThanOrEqual(1800); });
    const [ent, col, hib] = ps;
    expect(col.metricas.entrelazado).toBe(1);                   // columnas: cada caja pisa una sola
    expect(ent.metricas.entrelazado).toBeGreaterThanOrEqual(2); // entrelazado: pisa dos o más
    expect(hib.metricas.entrelazado).toBeGreaterThan(1);
    expect(hib.metricas.entrelazado).toBeLessThan(ent.metricas.entrelazado);
    // entrelazar le quita resistencia a la caja de abajo; en el híbrido la de abajo sigue en columna
    expect(ent.metricas.factores.patron).toBe(FACTORES.patron.entrelazado);
    expect(col.metricas.factores.patron).toBe(1);
    expect(hib.metricas.margen).toBeCloseTo(col.metricas.margen, 5);
    expect(ent.metricas.margen).toBeLessThan(col.metricas.margen);
    expect(ps.filter((p) => p.sugerido)).toHaveLength(1);
    expect(ent.sugerido).toBe(true);                             // todo en verde
    expect(Object.values(ent.semaforos).map((s) => s.color)).toEqual(["verde", "verde", "verde"]);
  });

  it("la altura objetivo manda los niveles", () => {
    const ps = patrones({}, { alturaMax: 150 + 400 * 2 + 10 });
    ps.forEach((p) => { expect(p.def.capas).toBe(2); expect(p.def.alto).toBeLessThanOrEqual(960); });
  });

  it("si ninguno aguanta la compresión, ofrece la opción por resistencia con menos niveles y la sugiere", () => {
    const ps = patrones({ L: 400, W: 300, H: 250, peso: 8, pesoMaxEncima: 60 }, { apilaEncima: 1 });
    const res = ps.find((p) => p.clave === "resistencia");
    expect(res).toBeTruthy();
    expect(res.semaforos.compresion.color).toBe("verde");
    expect(res.niveles).toBeLessThan(ps[0].niveles);
    expect(res.sugerido).toBe(true);
    ps.filter((p) => p.clave !== "resistencia").forEach((p) => expect(p.semaforos.compresion.color).toBe("rojo"));
  });

  it("sin dato de resistencia, la compresión queda en gris", () => {
    const [p] = patrones({});
    expect(p.semaforos.compresion.color).toBe("gris");
  });

  it("la humedad y el tiempo en almacén bajan el margen con BCT", () => {
    const seco = patrones({}, { bct: 300, humedad: "normal", tiempo: "corto" })[1].metricas.margen;
    const humedo = patrones({}, { bct: 300, humedad: "alta", tiempo: "largo" })[1].metricas.margen;
    expect(humedo).toBeCloseTo(seco * (0.6 * 0.5) / (1 * 0.7), 5);
  });
});

describe("metricasPallet y semaforos", () => {
  const it0 = { peso: 10 };
  const palS = { ...pal, L: 1200, W: 1000 };
  it("una caja montada a medias sobre otra: apoyo al 50% en rojo", () => {
    const cajas = [{ x: 0, y: 0, z: 0, l: 600, w: 400, h: 400 }, { x: 300, y: 0, z: 400, l: 600, w: 400, h: 400 }];
    const m = metricasPallet(cajas, palS, it0);
    expect(m.apoyoMinimo).toBeCloseTo(0.5, 5);
    expect(semaforos(m).estabilidad.color).toBe("rojo");
  });
  it("torre alta y angosta: riesgo de volcadura en rojo", () => {
    const cajas = Array.from({ length: 8 }, (_, i) => ({ x: 400, y: 350, z: i * 400, l: 400, w: 300, h: 400 }));
    const m = metricasPallet(cajas, palS, it0);
    expect(m.vuelco).toBeLessThan(0.4);
    expect(semaforos(m).cg.color).toBe("rojo");
  });
  it("la carga baja de capa en capa: la caja de abajo de una torre de 3 carga 2 cajas", () => {
    const cajas = Array.from({ length: 3 }, (_, i) => ({ x: 0, y: 0, z: i * 400, l: 1200, w: 1000, h: 400 }));
    expect(metricasPallet(cajas, palS, it0).cargaMax).toBeCloseTo(20, 5);
  });
});

describe("piezas diminutas", () => {
  it("10 × 10 × 10 mm no se califica: avisa que son demasiadas cajas", () => {
    const ps = patrones({ L: 10, W: 10, H: 10, peso: 1 });
    expect(ps).toHaveLength(0);
    expect(ps.demasiadas).toBe(1200);   // topado por el peso máximo del pallet
  });
  it("si el peso del pallet corta niveles, el armado dice los niveles reales", () => {
    const ps = patrones({ peso: 100 });   // 1,200 kg / 100 kg = 12 cajas: 2 niveles de 5 y uno de 2
    ps.forEach((p) => { expect(p.def.n).toBe(12); expect(p.def.capas).toBe(3); });
  });
});

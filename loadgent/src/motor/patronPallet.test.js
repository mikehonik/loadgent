import { describe, it, expect } from "vitest";
import { capacidadPalletCompleto } from "./motor.js";
import { writeFileSync } from "node:fs";
const base = { nombre: "SBA", L: 190, W: 190, H: 459, peso: 22.15, oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, piezas: 1, paletizar: true, palletId: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: true, qty: 1140 };
const pal = { nombre: "Americano", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 2700, maxKg: 2000, ovL: 0, ovW: 0 };
const veh = { L: 12032, W: 2352, H: 2393, tara: 3800, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const reglas = { nivel: 2, limitarPeso: true, soporteMin: 0.75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna", cargaReal: true, rotarAlFinal: true };
describe("cajas por nivel pedidas", () => {
  it("20 por nivel × 3 sale rectangular", () => {
    const r = capacidadPalletCompleto({ ...base, porPallet: 60, porCapa: 20, capasPallet: 3 }, pal, veh, reglas);
    const capa = r.def.cajas.filter((c) => (c.z ?? 0) === (r.def.cajas[0].z ?? 0));
    const xs = [...new Set(capa.map((c) => Math.round(c.x)))], ys = [...new Set(capa.map((c) => Math.round(c.y)))];
    writeFileSync("/tmp/claude-0/sp/pat2.txt", `n=${r.def.n} porCapa=${r.def.porCapa} capas=${r.def.capas} alto=${r.def.alto} capa0=${capa.length} cols=${xs.length} filas=${ys.length} rect=${xs.length * ys.length === capa.length} huella=${r.def.L}x${r.def.W}`);
    expect(capa.length).toBe(20);
    expect(xs.length * ys.length).toBe(20);
  });
});

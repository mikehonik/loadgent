import { describe, it, expect } from "vitest";
import { correr, ejecutorEnProceso } from "./corrida.js";
import { optimizar } from "./motor.js";

// Reporte de Santiago: «no está utilizando el espacio libre que queda encima de los pallets».
// Antes, un pallet cuyo último tendido quedaba incompleto no recibía NADA encima (techoPlano = false),
// aunque físicamente sí hay dónde apoyar. Ahora la caja se apoya sobre el techo real del pallet y es el
// soporte mínimo el que decide, que es la prueba correcta.
const base = { id: 0, nombre: "X", desc: "", color: null, peso: 5, qty: 10, oris: [true, true, false, false, false, false],
  volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0,
  piezas: 1, paletizar: false, palletId: 0, porPallet: 0, porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false };
const vehiculo = { L: 12032, W: 2352, H: 2698, tara: 3900, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const tarimas = [{ nombre: "Americano", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1500, ovL: 0, ovW: 0 }];
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const ejecutor = ejecutorEnProceso(optimizar);

// Caja de 600×500×400: 4 por nivel en el Americano. Con 14 por pallet el último nivel va incompleto (2 de 4).
const conTecho = (n) => ({ ...base, id: 1, nombre: "PAL", L: 600, W: 500, H: 400, peso: 12, qty: 140, paletizar: true, porPallet: n });
const suelta = { ...base, id: 2, nombre: "SUELTA", L: 380, W: 280, H: 300, peso: 4, qty: 400 };

const encimaDePallet = (c) => {
  const v = c.resultado.contenedores[0];
  const tope = v.cajas.filter((x) => x.pal >= 0).reduce((m, x) => Math.max(m, x.z + x.h), 0);
  return v.cajas.filter((x) => x.pal < 0 && x.z >= tope - 1).length;
};

describe("espacio encima de los pallets", () => {
  it("con el último tendido incompleto ya se puede cargar encima", async () => {
    const c = await correr({ items: [conTecho(14), suelta], vehiculo, tarimas, reglas }, { ejecutor });
    const pal = c.resultado.pallets.find((p) => p.nombre === "PAL");
    expect(pal.n).toBe(14);
    expect(pal.techoPlano).toBe(false);          // 14 = 3 niveles de 4 + 1 de 2: no queda plano
    expect(pal.techo.length).toBe(2);            // y el perfil del techo son esas 2 cajas
    expect(encimaDePallet(c)).toBeGreaterThan(0);
  }, 300000);

  it("una caja no se apoya donde el pallet no tiene techo", async () => {
    const c = await correr({ items: [conTecho(14), suelta], vehiculo, tarimas, reglas }, { ejecutor });
    const v = c.resultado.contenedores[0], defs = c.resultado.pallets;
    const pals = v.cajas.filter((x) => x.pal >= 0);
    v.cajas.filter((x) => x.pal < 0).forEach((b) => {
      // Una caja puede quedar a caballo entre dos pallets: el apoyo es la suma de todos los que tiene debajo
      const debajo = pals.filter((p) => Math.abs(p.z + p.h - b.z) < 0.5 && b.x < p.x + p.l && b.x + b.l > p.x && b.y < p.y + p.w && b.y + b.w > p.y);
      if (!debajo.length) return;
      const area = debajo.reduce((total, ab) => {
        const d = defs[ab.pal];
        return total + d.techo.reduce((a, r) => {
          const rx = ab.ori === 2 ? ab.x + r.y : ab.x + r.x, ry = ab.ori === 2 ? ab.y + (d.L - r.x - r.l) : ab.y + r.y;
          const rl = ab.ori === 2 ? r.w : r.l, rw = ab.ori === 2 ? r.l : r.w;
          const ox = Math.min(b.x + b.l, rx + rl) - Math.max(b.x, rx), oy = Math.min(b.y + b.w, ry + rw) - Math.max(b.y, ry);
          return a + (ox > 0 && oy > 0 ? ox * oy : 0);
        }, 0);
      }, 0);
      expect(area / (b.l * b.w)).toBeGreaterThanOrEqual(0.75 - 1e-6);
    });
  }, 300000);

  it("un pallet completo sigue recibiendo carga encima como antes", async () => {
    const c = await correr({ items: [conTecho(12), suelta], vehiculo, tarimas, reglas }, { ejecutor });
    const pal = c.resultado.pallets.find((p) => p.nombre === "PAL");
    expect(pal.techoPlano).toBe(true);
    expect(encimaDePallet(c)).toBeGreaterThan(0);
  }, 300000);
});

// Reporte de Santiago: «en todos los escenarios deja más vehículos de los necesarios». La causa no era
// solo el techo: lo suelto entraba ANTES que los pallets (empaca mejor y gana la competencia por el
// hueco), se llevaba los primeros contenedores completo y los pallets terminaban viajando solos, a media
// altura y sin nada encima. Cargando los pallets primero, lo suelto rellena el piso que sobra y el hueco
// de arriba de cada pallet. Antes esto solo pasaba cuando la carga traía Bundles.
describe("orden de cargue: primero los pallets, luego lo suelto", () => {
  const mezcla = [
    { ...base, id: 1, nombre: "P1", L: 600, W: 500, H: 400, peso: 12, qty: 1400, paletizar: true, porPallet: 14 },
    { ...base, id: 2, nombre: "P2", L: 500, W: 400, H: 350, peso: 9, qty: 1150, paletizar: true, porPallet: 23 },
    { ...base, id: 3, nombre: "P3", L: 400, W: 330, H: 300, peso: 6, qty: 1380, paletizar: true, porPallet: 46 },
    { ...base, id: 4, nombre: "S1", L: 380, W: 280, H: 300, peso: 4, qty: 1800 },
    { ...base, id: 5, nombre: "S2", L: 300, W: 250, H: 220, peso: 3, qty: 1400 },
  ];
  const corre = (r) => correr({ items: mezcla, vehiculo, tarimas, reglas: { ...reglas, nivel: 4, ...r } }, { ejecutor });

  it("usa menos vehículos y carga cajas encima de los pallets", async () => {
    const con = await corre({});
    const sin = await corre({ ordenCargue: false });
    expect(con.resultado.contenedores.length).toBeLessThan(sin.resultado.contenedores.length);
    const encima = (c) => c.resultado.contenedores.reduce((n, v) => {
      const topes = v.cajas.filter((x) => x.pal >= 0).map((x) => x.z + x.h);
      return n + v.cajas.filter((b) => b.pal < 0 && topes.some((z) => Math.abs(z - b.z) < 1)).length;
    }, 0);
    // y con el orden de cargue sube muchísima más caja al techo de los pallets
    expect(encima(con)).toBeGreaterThan(10 * Math.max(1, encima(sin)));
  }, 300000);
});

// Orden que pidió el andén cuando hay Bundles: pallets, después la pared con las cajas de los Bundles
// que hubo que abrir, y al final los Bundles enteros (un movimiento cada uno, así se cierra más rápido).
describe("orden de cargue con Bundles abiertos", () => {
  const bdl = (d) => ({ ...base, oris: [true, true, false, false, false, false], ...d });
  it("la pared de cajas abiertas va antes que los Bundles enteros", async () => {
    const items = [
      bdl({ id: 1, nombre: "PAL", L: 500, W: 400, H: 350, peso: 9, qty: 460, paletizar: true, porPallet: 23 }),
      // el motor recibe los Bundles ya expandidos: enteros por un lado, cajas abiertas por el otro
      bdl({ id: 2, nombre: "BDL", L: 1100, W: 950, H: 1900, peso: 90, qty: 8, esBundle: true, cantidadPorBundle: 30, lineaId: 2 }),
      bdl({ id: "2-suelto", nombre: "BDL", L: 300, W: 250, H: 220, peso: 3, qty: 120, deBundle: true, abiertos: 4, lineaId: 2 }),
    ];
    const c = await correr({ items, vehiculo, tarimas, reglas: { ...reglas, nivel: 1 } }, { ejecutor });
    const v = c.resultado.contenedores[0];
    // El orden que importa es el de CARGUE (el orden en que el motor las coloca), no dónde quedan: una
    // subfase posterior puede meterse entre lo anterior, que es justo lo que hace que rellene huecos.
    const ult = (f) => v.cajas.reduce((m, b, i) => (f(b) ? i : m), -1);
    const pri = (f) => v.cajas.findIndex(f);
    const esAbierta = (b) => b.pal < 0 && items[b.idx].deBundle, esEntero = (b) => b.pal < 0 && items[b.idx].esBundle;
    expect(ult((b) => b.pal >= 0)).toBeLessThan(pri(esAbierta));
    expect(ult(esAbierta)).toBeLessThan(pri(esEntero));
  }, 300000);
});

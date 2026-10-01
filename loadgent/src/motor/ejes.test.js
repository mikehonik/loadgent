import { describe, it, expect } from "vitest";
import { cargaPorEje, tieneEjesConfigurados } from "./ejes.js";

const veh = { tara: 6000, ejeDelantero: 5000, ejeTrasero: 20000, xEjeDelantero: -1000, xEjeTrasero: 12000 };

describe("tieneEjesConfigurados", () => {
  it("solo si hay límites y geometría válida", () => {
    expect(tieneEjesConfigurados(veh)).toBe(true);
    expect(tieneEjesConfigurados({ ...veh, ejeDelantero: 0 })).toBe(false);
    expect(tieneEjesConfigurados({ ...veh, xEjeTrasero: -2000 })).toBe(false); // trasero antes del delantero
  });
});

describe("cargaPorEje", () => {
  it("sin geometría de ejes, no calcula nada", () => {
    expect(cargaPorEje({ tara: 1000, ejeDelantero: 0, ejeTrasero: 0 }, [])).toBeNull();
  });

  it("sin carga, reparte solo la tara (mitad y mitad por omisión)", () => {
    const r = cargaPorEje(veh, []);
    expect(r.delantero.carga).toBe(3000);
    expect(r.trasero.carga).toBe(3000);
  });

  it("respeta el reparto de tara si se especifica", () => {
    const r = cargaPorEje({ ...veh, taraDelantera: 4000, taraTrasera: 2000 }, []);
    expect(r.delantero.carga).toBe(4000);
    expect(r.trasero.carga).toBe(2000);
  });

  it("una caja justo sobre el eje trasero carga casi todo su peso ahí", () => {
    const r = cargaPorEje(veh, [{ x: 11900, l: 200, peso: 1000 }]); // centro en x=12000 = xEjeTrasero
    expect(r.trasero.carga).toBe(4000); // 3000 de tara + 1000 de la caja
    expect(r.delantero.carga).toBe(3000);
  });

  it("una caja a medio camino entre los dos ejes se reparte a la mitad", () => {
    const xMedio = (veh.xEjeDelantero + veh.xEjeTrasero) / 2;
    const r = cargaPorEje(veh, [{ x: xMedio - 100, l: 200, peso: 2000 }]);
    expect(r.delantero.carga).toBe(4000);
    expect(r.trasero.carga).toBe(4000);
  });

  it("una caja antes del eje delantero (voladizo) sigue sumando casi todo al delantero", () => {
    const r = cargaPorEje(veh, [{ x: -1100, l: 200, peso: 1000 }]); // centro en x=-1000 = xEjeDelantero
    expect(r.delantero.carga).toBe(4000);
    expect(r.trasero.carga).toBe(3000);
  });

  it("marca alerta cuando un eje se pasa de su máximo", () => {
    const r = cargaPorEje(veh, [{ x: 11900, l: 200, peso: 18000 }]);
    expect(r.trasero.alerta).toBe(true);
    expect(r.trasero.pct).toBeGreaterThan(100);
    expect(r.delantero.alerta).toBe(false);
  });

  it("el peso total repartido entre los dos ejes es el peso bruto total", () => {
    const cajas = [{ x: 500, l: 300, peso: 1500 }, { x: 8000, l: 400, peso: 2200 }];
    const r = cargaPorEje(veh, cajas);
    const total = veh.tara + cajas.reduce((a, c) => a + c.peso, 0);
    expect(r.delantero.carga + r.trasero.carga).toBeCloseTo(total, 0);
  });
});

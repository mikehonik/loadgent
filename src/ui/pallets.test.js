import { describe, it, expect } from "vitest";
import { PALLETS_INICIALES, VERSION_ESTADO, palletsAlDia } from "./referencia.js";

describe("catálogo de pallets de fábrica", () => {
  it("los tres traen el estándar: 15 mm de sobresaliente por lado y altura automática", () => {
    PALLETS_INICIALES.forEach((p) => {
      expect(p.ovL).toBe(15);
      expect(p.ovW).toBe(15);
      expect(p.autoAltura).toBe(true);
    });
  });
});

describe("pallets guardados antes de la v1.6.5", () => {
  const viejos = [{ nombre: "Americano", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 }];
  it("al abrirlos quedan con el sobresaliente estándar", () => {
    const r = palletsAlDia(viejos, 2);
    expect(r[0]).toMatchObject({ ovL: 15, ovW: 15 });
    // y no se toca nada más de lo que el usuario ya tenía
    expect(r[0]).toMatchObject({ altMax: 1800, maxKg: 1200 });
  });
  it("un sobresaliente capturado a mano manda sobre el estándar", () => {
    expect(palletsAlDia([{ ...viejos[0], ovL: 30, ovW: 0 }], 2)[0]).toMatchObject({ ovL: 30, ovW: 15 });
  });
  it("lo guardado con la versión nueva ya no se toca", () => {
    const r = palletsAlDia(viejos, VERSION_ESTADO);
    expect(r[0].ovL).toBe(0);
    expect(r).toBe(viejos);
  });
  it("sin pallets guardados no devuelve nada, para no pisar el catálogo de fábrica", () => {
    expect(palletsAlDia([], 1)).toBe(null);
    expect(palletsAlDia(undefined, 1)).toBe(null);
  });
});

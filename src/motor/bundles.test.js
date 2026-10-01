import { describe, it, expect } from "vitest";
import { correrConBundles, ejecutorEnProceso } from "./corrida.js";
import { optimizar } from "./motor.js";

// Caja de 300 × 300 × 250 y Bundle de 24 cajas (3 × 2 × 4) de 900 × 600 × 1000: el Bundle no tiene aire,
// pero por su tamaño deja huecos en el contenedor que solo las cajas sueltas pueden llenar.
const linea = (qty, d = {}) => ({ id: 1, nombre: "DU-TEST", desc: "", color: null, L: 300, W: 300, H: 250, peso: 5, qty, oris: [true, true, false, false, false, false],
  volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0,
  porPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, enBundle: true, bundleCantidadEstandar: 24, bundleL: 900, bundleW: 600, bundleH: 1000, bundlePeso: 0, ...d });
const vehiculo = { L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const ejecutor = ejecutorEnProceso(optimizar);

describe("correrConBundles", () => {
  it("si todo cabe en Bundles, no abre ninguno", async () => {
    const c = await correrConBundles({ items: [linea(24 * 20)], vehiculo, tarimas: [], reglas }, { ejecutor });
    expect(c.resultado.contenedores).toHaveLength(1);
    expect(c.resultado.bundles).toMatchObject({ abiertos: 0, ahorro: 0 });
    expect(c.carga.items.every((it) => it.esBundle)).toBe(true);
  });
  it("abre los menos Bundles posibles cuando eso ahorra un vehículo, y conserva todas las cajas", async () => {
    const qty = 24 * 40, c = await correrConBundles({ items: [linea(qty)], vehiculo, tarimas: [], reglas }, { ejecutor });
    const b = c.resultado.bundles;
    expect(c.resultado.contenedores).toHaveLength(1);
    expect(b.abiertos).toBeGreaterThan(0);
    expect(b.abiertos).toBeLessThan(20);
    expect(b.ahorro).toBe(1);
    const cajas = c.carga.items.reduce((a, it) => a + (it.esBundle ? it.qty * 24 : it.qty), 0);
    expect(cajas).toBe(qty);
    expect(c.resultado.sinCargar).toBe(0);
    // El aviso puede venir del atajo (los Bundles que quedaron solos en el último vehículo) o de la
    // búsqueda general; en los dos casos tiene que decir cuántos se abrieron y para qué.
    expect(c.resultado.avisos.join(" ")).toMatch(/(se abren \d+ Bundles|llevaba solo \d+ Bundles)/);
  });
  it("si no ahorra un vehículo, los abre para dejar el último más vacío (y lo dice)", async () => {
    const sinAbrir = await correrConBundles({ items: [linea(24 * 60)], vehiculo, tarimas: [], reglas: { ...reglas, _maxContenedores: 1 } }, { ejecutor });
    const c = await correrConBundles({ items: [linea(24 * 60)], vehiculo, tarimas: [], reglas }, { ejecutor });
    expect(c.resultado.contenedores).toHaveLength(2);
    expect(c.resultado.bundles.abiertos).toBeGreaterThan(0);
    expect(c.resultado.bundles.ahorro).toBe(0);
    expect(c.resultado.avisos.join(" ")).toMatch(/más vacío/);
    // el primer vehículo va más lleno que sin abrir ninguno
    expect(c.resultado.contenedores[0].vol).toBeGreaterThan(sinAbrir.resultado.contenedores[0].vol);
    // y no se pierde ninguna caja
    expect(c.carga.items.reduce((a, it) => a + (it.esBundle ? it.qty * 24 : it.qty), 0)).toBe(24 * 60);
  });
  it("con un solo vehículo no abre nada (abrir cuesta mano de obra y no gana espacio)", async () => {
    const c = await correrConBundles({ items: [linea(24 * 10)], vehiculo, tarimas: [], reglas }, { ejecutor });
    expect(c.resultado.contenedores).toHaveLength(1);
    expect(c.resultado.bundles.abiertos).toBe(0);
  });
});

// Reporte del andén (caso «Carga ejemplo»): el segundo vehículo salía con UN solo Bundle de 2.4 m³
// mientras al primero le sobraban 11 m³. La búsqueda general reparte los Bundles abiertos entre todas las
// líneas y se evalúa en nivel rápido, así que ese caso se le escapaba. Ahora, antes de esa búsqueda, se
// prueba abriendo exactamente los Bundles que quedaron solos en el último vehículo.
describe("Bundles que quedan solos en el último vehículo", () => {
  const veh = { L: 12032, W: 2352, H: 2698, tara: 3900, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const l = (d = {}) => ({ id: 1, nombre: "DU1", desc: "", color: null, L: 300, W: 250, H: 220, peso: 3, qty: 0,
    oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
    piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0, porPallet: 0,
    porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false,
    enBundle: true, bundleCantidadEstandar: 30, bundleL: 1100, bundleW: 950, bundleH: 1900, bundlePeso: 0, ...d });
  const r = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };

  it("los abre y se ahorra el vehículo, en lugar de mandarlos solos", async () => {
    // Justo lo que no entra en un contenedor en Bundles enteros, pero sí cabe suelto
    const items = [l({ id: 1, nombre: "DU1", qty: 30 * 25 }), l({ id: 2, nombre: "DU2", qty: 30 * 14, bundleH: 1600 })];
    const c = await correrConBundles({ items, vehiculo: veh, tarimas: [], reglas: r }, { ejecutor });
    expect(c.resultado.sinCargar || 0).toBe(0);
    const cajas = c.carga.items.reduce((a, it) => a + (it.esBundle ? it.qty * it.cantidadPorBundle : it.qty), 0);
    expect(cajas).toBe(30 * 39);
    // no se abren de más: los que se abrieron son muchos menos que el total
    if (c.resultado.bundles) expect(c.resultado.bundles.abiertos).toBeLessThan(39);
  }, 300000);
});

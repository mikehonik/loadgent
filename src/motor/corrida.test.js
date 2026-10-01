import { describe, it, expect, vi } from "vitest";
import { correr, validarCarga, prepararEntrada, ejecutorEnProceso, ejecutorWorker, ErrorCorrida } from "./corrida.js";
import { optimizar } from "./motor.js";

// Fixtures en unidades de UI, con la misma forma que App.jsx (id, color, desc incluidos; soporteMin en %).
let sig = 1;
const caja = (d = {}) => ({
  id: sig++, color: "#123456", desc: "", nombre: "SKU", L: 600, W: 400, H: 400, peso: 10, qty: 20,
  oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
  piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0, porPallet: 0,
  resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d,
});
const vehiculo = { L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const tarimas = [{ nombre: "Universal", L: 1200, W: 1000, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 }];
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const carga = (d = {}) => ({ items: [caja()], vehiculo, tarimas, reglas, ...d });

const real = ejecutorEnProceso(optimizar);

describe("validarCarga", () => {
  it("acepta una carga bien formada", () => {
    expect(validarCarga(carga())).toEqual([]);
  });

  it("señala cada problema con el id de la caja y el campo", () => {
    const mala = caja({ id: 42, nombre: "Rota", L: 0, qty: 2.5, oris: [false, false, false, false, false, false] });
    const problemas = validarCarga(carga({ items: [mala] }));
    expect(problemas.map((p) => [p.id, p.campo])).toEqual([[42, "L"], [42, "qty"], [42, "oris"]]);
  });

  it("rechaza vehículo sin medidas y peso máximo menor que la tara", () => {
    const problemas = validarCarga(carga({ vehiculo: { ...vehiculo, H: 0, maxKg: 1000, tara: 2200 } }));
    expect(problemas.map((p) => p.campo)).toEqual(["vehiculo.H", "vehiculo.maxKg"]);
  });

  it("rechaza una caja paletizada cuya tarima no existe", () => {
    const problemas = validarCarga(carga({ items: [caja({ paletizar: true, palletId: 7 })] }));
    expect(problemas.map((p) => p.campo)).toEqual(["palletId"]);
  });
});

describe("prepararEntrada", () => {
  it("quita los campos de UI y convierte el soporte mínimo a fracción", () => {
    const e = prepararEntrada(carga());
    expect(Object.keys(e.items[0])).not.toContain("id");
    expect(Object.keys(e.items[0])).not.toContain("color");
    expect(Object.keys(e.items[0])).not.toContain("desc");
    expect(e.reglas.soporteMin).toBe(0.75);
    expect(e.pallets).toBe(tarimas);
  });
});

describe("correr", () => {
  it("devuelve el resultado del motor junto con la carga que usó", async () => {
    const c = carga();
    const { resultado, carga: usada } = await correr(c, { ejecutor: real });
    expect(usada).toBe(c);
    expect(resultado.contenedores[0].cajas.length).toBe(20);
    // idx del resultado apunta a la caja original, con su id de UI intacto
    expect(usada.items[resultado.contenedores[0].cajas[0].idx].id).toBe(c.items[0].id);
  });

  it("rechaza la corrida completa si hay datos inválidos y no llama al motor", async () => {
    const ejecutor = vi.fn();
    const err = await correr(carga({ items: [caja({ L: 0 })] }), { ejecutor }).catch((e) => e);
    expect(err).toBeInstanceOf(ErrorCorrida);
    expect(err.tipo).toBe("entrada_invalida");
    expect(err.detalle.problemas).toHaveLength(1);
    expect(ejecutor).not.toHaveBeenCalled();
  });

  it("envuelve una falla del motor conservando el mensaje original", async () => {
    const ejecutor = ejecutorEnProceso(() => { throw new Error("explotó adentro"); });
    const err = await correr(carga(), { ejecutor }).catch((e) => e);
    expect(err.tipo).toBe("motor");
    expect(err.detalle.original).toBe("explotó adentro");
  });

  it("no arranca si la señal ya está cancelada", async () => {
    const ctrl = new AbortController(); ctrl.abort();
    const ejecutor = vi.fn();
    const err = await correr(carga(), { ejecutor, signal: ctrl.signal }).catch((e) => e);
    expect(err.tipo).toBe("cancelada");
    expect(ejecutor).not.toHaveBeenCalled();
  });

  it("pasa el progreso del motor al llamador", async () => {
    const vistos = [];
    await correr(carga(), { ejecutor: real, onProgreso: (i, n) => vistos.push([i, n]) });
    expect(vistos.length).toBeGreaterThan(0);
    expect(vistos.at(-1)[0]).toBeLessThanOrEqual(vistos.at(-1)[1]);
  });
});

describe("ejecutorWorker", () => {
  // Worker falso: nunca responde, para poder cancelarlo a la mitad.
  const workerFalso = () => ({ postMessage: vi.fn(), terminate: vi.fn(), onmessage: null, onerror: null });

  it("cancela una corrida en marcha y termina el Worker", async () => {
    const w = workerFalso();
    const ctrl = new AbortController();
    const pendiente = correr(carga(), { ejecutor: ejecutorWorker(() => w), signal: ctrl.signal });
    await Promise.resolve(); // deja que arranque
    expect(w.postMessage).toHaveBeenCalledTimes(1);
    ctrl.abort();
    const err = await pendiente.catch((e) => e);
    expect(err.tipo).toBe("cancelada");
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });

  it("convierte un error del Worker en ErrorCorrida tipo motor", async () => {
    const w = workerFalso();
    const pendiente = correr(carga(), { ejecutor: ejecutorWorker(() => w) });
    await Promise.resolve();
    w.onerror({ message: "se cayó el hilo" });
    const err = await pendiente.catch((e) => e);
    expect(err.tipo).toBe("motor");
    expect(err.detalle.original).toBe("se cayó el hilo");
    expect(w.terminate).toHaveBeenCalledTimes(1);
  });
});

import { describe, it, expect } from "vitest";
import { optimizar, marcarEntregas, capacidadSuelta, configuracionPallet, capacidadPalletCompleto } from "./motor.js";

// Fixtures mínimos con la misma forma que usa App.jsx (nuevoItem, VEHICULOS, reglas).
const caja = (d = {}) => ({
  nombre: "SKU", L: 600, W: 400, H: 400, peso: 10, qty: 20, oris: [true, true, false, false, false, false], volteoPiso: false,
  maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1,
  paletizar: false, palletId: 0, porPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d,
});
const veh20 = { L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
// soporteMin ya en fracción (App.jsx divide entre 100 antes de llamar al motor)
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 0.75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };

const seSolapan = (a, b) =>
  a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.w && b.y < a.y + a.w && a.z < b.z + b.h && b.z < a.z + a.h;

describe("optimizar", () => {
  it("coloca 20 cajas chicas en un contenedor de 20 pies sin dejar nada fuera", () => {
    const r = optimizar([caja()], veh20, reglas, () => {}, []);
    expect(r.contenedores.length).toBe(1);
    expect(r.contenedores[0].cajas.length).toBe(20);
    expect(r.sinCargar).toBe(0);
    expect(r.noCaben).toEqual([]);
  });

  it("no saca cajas del contenedor ni las solapa", () => {
    const r = optimizar([caja({ qty: 40 })], veh20, reglas, () => {}, []);
    const cajas = r.contenedores.flatMap((c) => c.cajas);
    for (const c of cajas) {
      expect(c.x).toBeGreaterThanOrEqual(0); expect(c.y).toBeGreaterThanOrEqual(0); expect(c.z).toBeGreaterThanOrEqual(0);
      expect(c.x + c.l).toBeLessThanOrEqual(veh20.L);
      expect(c.y + c.w).toBeLessThanOrEqual(veh20.W);
      expect(c.z + c.h).toBeLessThanOrEqual(veh20.H);
    }
    for (let i = 0; i < cajas.length; i++)
      for (let j = i + 1; j < cajas.length; j++) expect(seSolapan(cajas[i], cajas[j])).toBe(false);
  });

  it("reporta por nombre lo que no cabe en el vehículo", () => {
    const r = optimizar([caja({ nombre: "Enorme", L: 7000, W: 400, H: 400, qty: 3 })], veh20, reglas, () => {}, []);
    expect(r.noCaben).toContain("Enorme");
    // Contrato actual: lo que no cabe se nombra en noCaben y NO se suma en sinCargar (sinCargar solo cuenta lo que cabía pero no alcanzó lugar).
    expect(r.sinCargar).toBe(0);
    expect(r.contenedores.length).toBe(0);
  });
});

describe("entregas", () => {
  // 50 cajas de 600×400×400 llenan dos columnas de 600 mm a lo largo del contenedor de 20 pies: cada parada ocupa su propia zona.
  const xs = (r, idx) => r.contenedores[0].cajas.filter((c) => c.idx === idx).map((c) => c.x);
  const ruta = (reglasExtra = {}, itemsExtra = []) => optimizar([caja({ nombre: "Parada 1", qty: 50, orden: 1 }), caja({ nombre: "Parada 2", qty: 50, orden: 2 }), ...itemsExtra], veh20, { ...reglas, ...reglasExtra }, () => {}, []);

  it("la parada 1 se carga al final y queda junto a las puertas; la 2 va al fondo", () => {
    const r = ruta();
    expect(r.sinCargar).toBe(0);
    expect(r.contenedores).toHaveLength(1);
    expect(Math.min(...xs(r, 0))).toBeGreaterThanOrEqual(Math.max(...xs(r, 1)) + 600);
  });

  it("sin número va al fondo, detrás de todas las paradas", () => {
    const r = ruta({}, [caja({ nombre: "Libre", qty: 25 })]);
    expect(Math.max(...xs(r, 2)) + 600).toBeLessThanOrEqual(Math.min(...xs(r, 1)) + 1);
  });

  it("estricto: cada entrega en su zona y nada estorba", () => {
    const c = ruta({ rigor: "estricto" }).contenedores[0];
    expect(c.estorban).toBe(0);
    expect(c.entregas.map((e) => [e.orden, e.n, e.estorban])).toEqual([[1, 50, 0], [2, 50, 0]]);
    expect(c.entregas[0].x0).toBeGreaterThanOrEqual(c.entregas[1].x1);
    expect(c.entregas[0].vol).toBe(50 * 600 * 400 * 400);
  });

  it("flexible: la parada 1 puede meterse hasta un 12% del largo en la zona anterior", () => {
    const c = ruta({ rigor: "flexible" }).contenedores[0];
    expect(c.entregas[0].x0).toBeGreaterThanOrEqual(c.entregas[1].x1 - veh20.L * 0.12 - 1);
    expect(c.estorban).toBe(c.entregas.reduce((a, e) => a + e.estorban, 0));
  });
});

describe("marcarEntregas", () => {
  const cj = (idx, x, y = 0, z = 0) => ({ idx, x, y, z, l: 600, w: 400, h: 400 });
  const ordenDe = { 0: 1, 1: 2, 2: 0 };
  it("cuenta un bulto de parada posterior que queda entre las puertas y una parada anterior", () => {
    const c = marcarEntregas({ cajas: [cj(0, 0), cj(1, 600)] }, ordenDe);
    expect(c.estorban).toBe(1);
    expect(c.entregas).toEqual([{ orden: 1, x0: 0, x1: 600, n: 1, vol: 600 * 400 * 400, estorban: 1 }, { orden: 2, x0: 600, x1: 1200, n: 1, vol: 600 * 400 * 400, estorban: 0 }]);
  });
  it("no estorba si va por encima, en otro pasillo, más al fondo, o no tiene parada", () => {
    expect(marcarEntregas({ cajas: [cj(0, 0), cj(1, 600, 0, 400)] }, ordenDe).estorban).toBe(0);
    expect(marcarEntregas({ cajas: [cj(0, 0), cj(1, 600, 400)] }, ordenDe).estorban).toBe(0);
    expect(marcarEntregas({ cajas: [cj(0, 600), cj(1, 0)] }, ordenDe).estorban).toBe(0);
    expect(marcarEntregas({ cajas: [cj(0, 0), cj(2, 600)] }, ordenDe).estorban).toBe(0);
  });
});

describe("compresión bajo carga", () => {
  // Compresión escalonada: el % capturado es lo que cede la caja de MÁS ABAJO; hacia arriba cede menos
  // (en proporción a lo que lleva encima) y la de hasta arriba conserva su altura. Cajas de 400 mm con 25%:
  //   2 en pila → 300 + 400 = 700 · 3 en pila → 300 + 350 + 400 = 1050
  const hueco = { L: 600, W: 400, H: 1000, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const columna = (d, H = 1000) => optimizar([caja({ qty: 3, oris: [true, false, false, false, false, false], ...d })], { ...hueco, H }, { ...reglas, limitarPeso: false }, () => {}, []);

  it("una caja rígida no gana capas", () => {
    const r = columna({ compresion: 0 });
    expect(r.contenedores[0].cajas.length).toBe(2);
    expect(r.contenedores[0].cajas.map((c) => c.h)).toEqual([400, 400]);
  });

  it("la caja comprimida cede altura en escalón y la de hasta arriba se dibuja completa", () => {
    const r = columna({ compresion: 25 }, 1050);
    const cajas = r.contenedores[0].cajas.sort((a, b) => a.z - b.z);
    expect(cajas.map((c) => [c.z, c.h])).toEqual([[0, 300], [300, 350], [650, 400]]);
    expect(r.sinCargar).toBe(0);
  });

  it("es más prudente que aplastar todas por igual: en 1000 mm la tercera caja ya no entra", () => {
    const r = columna({ compresion: 25 });
    expect(r.contenedores[0].cajas.sort((a, b) => a.z - b.z).map((c) => [c.z, c.h])).toEqual([[0, 300], [300, 400]]);
  });

  it("también cuenta al armar pallets", () => {
    const tarima = { nombre: "T", L: 600, W: 400, esp: 150, peso: 20, altMax: 1150, maxKg: 0, ovL: 0, ovW: 0 };
    const veh = { L: 5898, W: 2352, H: 2393, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
    const porPallet = (compresion) => optimizar([caja({ qty: 6, paletizar: true, palletId: 0, compresion })], veh, { ...reglas, limitarPeso: false }, () => {}, [tarima]).pallets[0].n;
    expect(porPallet(0)).toBe(2);
    expect(porPallet(25)).toBe(2); // 3 capas escalonadas piden 1050 mm y la tarima deja 1000
    expect(porPallet(40)).toBe(3); // 240 + 320 + 400 = 960 mm
  });
});

describe("formas anidables", () => {
  const base = {
    oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
    piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0, porPallet: 0,
    porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, compresion: 0, anidado: 0, maxAnidado: 0, forma: "caja", peso: 5,
  };
  const veh = { L: 12032, W: 2352, H: 2698, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const reglas = { nivel: 1, limitarPeso: false, soporteMin: 0.75, usarOrden: false, agrupar: false, juntos: true, apilamiento: "ninguna" };
  const columna = (c) => c.cajas.filter((k) => Math.abs(k.x - c.cajas[0].x) < 1 && Math.abs(k.y - c.cajas[0].y) < 1).length;

  it("una pila anidada sube el incremento, no la altura completa", () => {
    const sin = optimizar([{ ...base, nombre: "B", L: 580, W: 580, H: 880, qty: 2000 }], veh, reglas, null, []);
    const con = optimizar([{ ...base, nombre: "B", L: 580, W: 580, H: 880, qty: 2000, anidado: 150 }], veh, reglas, null, []);
    expect(columna(sin.contenedores[0])).toBe(3);                    // 880 × 3 = 2640 ≤ 2698
    expect(columna(con.contenedores[0])).toBe(13);                   // 880 + 12 × 150 = 2680
    const alto = Math.max(...con.contenedores[0].cajas.map((k) => k.z + k.h));
    expect(alto).toBeLessThanOrEqual(veh.H);
  });

  it("respeta el tope de piezas anidadas por torre", () => {
    const r = optimizar([{ ...base, nombre: "B", L: 580, W: 580, H: 880, qty: 2000, anidado: 150, maxAnidado: 5 }], veh, reglas, null, []);
    const zs = r.contenedores[0].cajas.filter((k) => Math.abs(k.x - r.contenedores[0].cajas[0].x) < 1 && Math.abs(k.y - r.contenedores[0].cajas[0].y) < 1).map((k) => k.z).sort((a, b) => a - b);
    // La torre arranca de nuevo cada 5 piezas: el salto entre la 5.ª y la 6.ª es la altura completa
    expect(zs[1] - zs[0]).toBeCloseTo(150, 1);
    expect(zs[5] - zs[4]).toBeCloseTo(880, 1);
  });

  it("no cuenta dos veces el volumen de las piezas anidadas", () => {
    const r = optimizar([{ ...base, nombre: "T", L: 420, W: 330, H: 38, qty: 5000, anidado: 14 }], veh, reglas, null, []);
    const volV = veh.L * veh.W * veh.H;
    expect(r.contenedores[0].vol).toBeLessThanOrEqual(volV);
  });
});

describe("apilamiento por categoría", () => {
  const base = {
    oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
    piso: "libre", soportaEncima: true, grupo: "", orden: 0, piezas: 1, paletizar: false, palletId: 0, porPallet: 0,
    porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, compresion: 0, anidado: 0,
    maxAnidado: 0, forma: "caja", categoria: "", peso: 10,
  };
  const veh = { L: 6000, W: 2400, H: 2600, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const reglas = { nivel: 1, limitarPeso: false, soporteMin: 0.75, usarOrden: false, agrupar: false, juntos: true, apilamiento: "mismaCategoria" };

  it("deja apilar tejas sobre tejas aunque sean SKUs distintos de la misma categoría", () => {
    const items = [
      { ...base, nombre: "Teja modelo A", L: 1000, W: 800, H: 100, qty: 20, categoria: "Tejas" },
      { ...base, nombre: "Teja modelo B", L: 1000, W: 800, H: 100, qty: 20, categoria: "Tejas" },
    ];
    const r = optimizar(items, veh, reglas, null, []);
    const apiladas = r.contenedores[0].cajas.filter((c) => c.z > 0);
    expect(apiladas.length).toBeGreaterThan(0);
    expect(r.sinCargar).toBe(0);
  });

  it("no deja que algo de otra categoría se apile encima, aunque soporte carga", () => {
    const items = [
      { ...base, nombre: "Teja", L: 1000, W: 800, H: 100, qty: 4, categoria: "Tejas" },
      { ...base, nombre: "Vidrio", L: 1000, W: 800, H: 100, qty: 4, categoria: "Frágiles" },
    ];
    const r = optimizar(items, veh, reglas, null, []);
    r.contenedores.forEach((c) => c.cajas.forEach((a, i) => {
      if (a.z === 0) return;
      const debajo = c.cajas.find((b, j) => j !== i && Math.abs(b.z + b.h - a.z) < 0.5 && a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.w && b.y < a.y + a.w);
      if (debajo) expect(items[a.idx].categoria).toBe(items[debajo.idx].categoria);
    }));
  });

  it("una pieza siempre se apila sobre sí misma, aunque no tenga categoría", () => {
    const items = [{ ...base, nombre: "Sin clasificar", L: 1000, W: 800, H: 300, qty: 8, categoria: "" }];
    const r = optimizar(items, veh, reglas, null, []);
    expect(r.contenedores[0].cajas.some((c) => c.z > 0)).toBe(true);
  });

  it("dos SKUs distintos sin categoría no se apilan entre sí", () => {
    const items = [
      { ...base, nombre: "A", L: 1000, W: 800, H: 300, qty: 4, categoria: "" },
      { ...base, nombre: "B", L: 1000, W: 800, H: 300, qty: 4, categoria: "" },
    ];
    const r = optimizar(items, veh, reglas, null, []);
    r.contenedores[0].cajas.forEach((a, i) => {
      if (a.z === 0) return;
      const debajo = r.contenedores[0].cajas.find((b, j) => j !== i && Math.abs(b.z + b.h - a.z) < 0.5 && a.x < b.x + b.l && b.x < a.x + a.l && a.y < b.y + b.w && b.y < a.y + a.w);
      if (debajo) expect(a.idx).toBe(debajo.idx);
    });
  });
});

describe("capacidadSuelta", () => {
  it("da la misma cantidad que optimizar con una cantidad enorme del mismo SKU", () => {
    const r1 = capacidadSuelta(caja(), veh20, reglas);
    const r2 = optimizar([caja({ qty: 999999 })], veh20, reglas, () => {}, []).contenedores[0];
    expect(r1.cajas).toBe(r2.cajas.length);
    expect(r1.cajas).toBeGreaterThanOrEqual(20); // el mismo SKU con qty:20 ya llenaba el contenedor sin sobrar espacio
    expect(r1.peso).toBe(r2.peso);
  });

  it("sin nada que quepa (ni una orientación entra en el vehículo), da 0 en vez de tronar", () => {
    const r = capacidadSuelta(caja({ nombre: "Enorme", L: 7000, W: 400, H: 400 }), veh20, reglas);
    expect(r.cajas).toBe(0);
  });
});

describe("configuracionPallet y capacidadPalletCompleto", () => {
  const tarima = { nombre: "T", L: 600, W: 400, esp: 150, peso: 20, altMax: 1150, maxKg: 0, ovL: 0, ovW: 0 };
  const veh = { L: 5898, W: 2352, H: 2393, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };

  it("arma la mejor configuración de cajas por pallet: 1 por nivel, 2 niveles (rígida, altura 1000/400)", () => {
    const def = configuracionPallet(caja(), tarima, reglas);
    expect(def.porCapa).toBe(1);
    expect(def.capas).toBe(2);
    expect(def.n).toBe(2);
    expect(def.peso).toBe(tarima.peso + 2 * 10); // tarima + 2 cajas de 10 kg
  });

  it("cajas por nivel mejora con más piezas por capa cuando el SKU es más chico que la tarima", () => {
    const def = configuracionPallet(caja({ L: 300, W: 400, H: 400 }), tarima, reglas);
    expect(def.porCapa).toBe(2); // dos cajas de 300 caben a lo largo de la tarima de 600
    expect(def.n).toBe(4);
  });

  it("respeta máx. cajas apiladas al armar el pallet", () => {
    const def = configuracionPallet(caja({ maxNiveles: 1 }), tarima, reglas);
    expect(def.capas).toBe(1);
    expect(def.n).toBe(1);
  });

  it("calcula cuántos pallets completos caben en el vehículo, sin pallets parciales", () => {
    const r = capacidadPalletCompleto(caja(), tarima, veh, reglas);
    // Cada pallet: 600×400×950 mm (150 tarima + 2×400), 40 kg. En el vehículo de 5898×2352×2393:
    // 9 a lo largo (5898/600), 5 a lo ancho (2352/400) = 45 por nivel; solo 1 nivel de alto (950×2=1900 ≤ 2393 pero sin apilar por default)
    expect(r.cajasPorPallet).toBe(2);
    expect(r.pallets).toBeGreaterThan(0);
    expect(r.pallets % 1).toBe(0); // siempre entero: nunca un pallet parcial
    expect(r.cajasTotales).toBe(r.pallets * 2);
  });

  it("sin pallet válido (SKU no cabe en la tarima), no truena y da null o 0", () => {
    const r = capacidadPalletCompleto(caja({ L: 5000, W: 5000, H: 5000 }), tarima, veh, reglas);
    expect(r).toBeNull();
  });

  it("la configuración óptima ignora el estándar capturado; la capacidad en pallets usa el estándar", () => {
    const conEstandar = caja({ L: 300, W: 400, H: 400, porCapa: 1, capasPallet: 1 }); // estándar: 1 caja por pallet
    expect(configuracionPallet(conEstandar, tarima, reglas).n).toBe(4); // lo mejor posible, no el estándar
    const r = capacidadPalletCompleto(conEstandar, tarima, veh, reglas);
    expect(r.def.estandar).toBe(true);
    expect(r.cajasPorPallet).toBe(1);
    expect(capacidadPalletCompleto(caja({ L: 300, W: 400, H: 400 }), tarima, veh, reglas).def.estandar).toBe(false);
  });
});

describe("capacidadSuelta con la entrada como la prepara una corrida", () => {
  it("apila (más de una capa) y responde rápido, en un solo vehículo", async () => {
    const { prepararEntrada } = await import("./corrida.js");
    const e = prepararEntrada({ items: [caja({ qty: 1 })], vehiculo: veh20, tarimas: [], reglas: { ...reglas, soporteMin: 75, nivel: 4 } });
    const t0 = Date.now(), r = capacidadSuelta(e.items[0], veh20, e.reglas);
    const porCapa = Math.floor(5898 / 400) * Math.floor(2352 / 600);
    expect(r.cajas).toBeGreaterThan(porCapa); // con soporteMin sin normalizar (75 en vez de 0.75) daba 0
    expect(Date.now() - t0).toBeLessThan(10000);
  });
});

describe("relleno opcional (completar espacios vacíos)", () => {
  it("no toca nada si no se marca esRelleno", () => {
    const r = optimizar([caja({ qty: 20 })], veh20, reglas, () => {}, []);
    expect(r.contenedores[0].cajas.every((c) => !c.relleno)).toBe(true);
  });

  it("el relleno solo entra después de que la demanda real ya no puede colocar más, y se marca", () => {
    // Una caja grande de verdad (qty 5, deja hueco) + la misma caja como relleno con qty enorme:
    // el relleno debe aprovechar lo que sobró sin desplazar a la demanda real.
    const real = caja({ nombre: "Real", L: 2000, W: 2000, H: 2000, peso: 50, qty: 1 });
    const relleno = { ...caja({ nombre: "Relleno", L: 300, W: 300, H: 300, peso: 2, qty: 999999 }), esRelleno: true };
    const r = optimizar([real, relleno], veh20, reglas, () => {}, []);
    const c = r.contenedores[0];
    expect(c.cajas.filter((k) => k.idx === 0).length).toBe(1); // toda la demanda real entró
    expect(c.cajas.filter((k) => k.relleno).length).toBeGreaterThan(0); // y se rellenó el resto
    expect(r.noCaben).toEqual([]); // el relleno nunca genera "no caben"
  });

  it("si el relleno de plano no cabe en el vehículo, se descarta en silencio", () => {
    const relleno = { ...caja({ nombre: "Enorme", L: 7000, W: 400, H: 400, qty: 5 }), esRelleno: true };
    const r = optimizar([relleno], veh20, reglas, () => {}, []);
    expect(r.contenedores.length).toBe(0);
    expect(r.noCaben).toEqual([]);
    expect(r.avisos).toEqual([]);
  });

  it("con una cantidad enorme de relleno, NUNCA abre un vehículo extra solo para el relleno", () => {
    const real = caja({ nombre: "Real", L: 1700, W: 1200, H: 1200, peso: 300, qty: 3 }); // deja huecos irregulares
    const relleno = { ...caja({ nombre: "Relleno", L: 300, W: 300, H: 300, peso: 5, qty: 999999 }), esRelleno: true };
    const r = optimizar([real, relleno], veh20, reglas, () => {}, []);
    const sinRelleno = optimizar([real], veh20, reglas, () => {}, []);
    expect(r.contenedores.length).toBe(sinRelleno.contenedores.length); // mismo número de vehículos que sin relleno
    const totalReal = r.contenedores.reduce((a, c) => a + c.cajas.filter((k) => k.idx === 0).length, 0);
    expect(totalReal).toBe(3); // toda la demanda real entró
    expect(r.sinCargar).toBe(0); // el relleno que no cupo no cuenta como "sin cargar"
    const agregado = r.contenedores.reduce((a, c) => a + c.cajas.filter((k) => k.relleno).length, 0);
    expect(agregado).toBeGreaterThan(0); // y sí aprovechó algo del hueco
  });
});

describe("herramientas de capacidad con SKU diminutos o sin medidas (no deben congelar la página)", () => {
  const tarima = { nombre: "U", L: 1200, W: 1000, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 };
  const veh53 = { L: 16000, W: 2500, H: 2700, tara: 6500, maxKg: 36500, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  it("10 × 10 × 10 mm responde al instante con un estimado en rejilla, topado por peso", () => {
    const t = Date.now(), it = caja({ L: 10, W: 10, H: 10, peso: 0.01 });
    const s = capacidadSuelta(it, veh53, reglas), c = configuracionPallet(it, tarima, reglas), p = capacidadPalletCompleto(it, tarima, veh53, reglas);
    expect(Date.now() - t).toBeLessThan(2000);
    expect(s.estimado).toBe(true);
    expect(s.cajas).toBe(Math.min(1600 * 250 * 270, Math.floor(30000 / 0.01)));
    expect(c.estimado).toBe(true);
    expect(c.n).toBe(Math.floor(1200 / 0.01)); // la rejilla daría 1,980,000; manda el peso máximo de la tarima
    expect(p.pallets).toBeGreaterThan(0);
  });
  it("respeta el peso máximo de la tarima en el estimado", () => {
    const c = configuracionPallet(caja({ L: 10, W: 10, H: 10, peso: 0.5 }), tarima, reglas);
    expect(c.n).toBe(2400);
    expect(c.peso).toBe(25 + 2400 * 0.5);
  });
  it("una medida en cero da 'no cabe' en vez de quedarse pensando para siempre", () => {
    for (const d of [{ L: 0 }, { W: 0 }, { H: 0 }]) {
      expect(capacidadSuelta(caja(d), veh53, reglas).cajas).toBe(0);
      expect(configuracionPallet(caja(d), tarima, reglas)).toBeNull();
      expect(capacidadPalletCompleto(caja(d), tarima, veh53, reglas)).toBeNull();
    }
  });
});

describe("«Acepta otro pallet encima» explica cuando no se puede", () => {
  const tarima = { nombre: "U", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 };
  const veh53 = { L: 16000, W: 2500, H: 2700, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
  const vaso = (d) => caja({ nombre: "Vaso", L: 400, W: 300, H: 400, peso: 8, paletizar: true, aceptaPallet: true, ...d });
  const apilados = (r) => r.contenedores[0].cajas.filter((k) => k.pal >= 0 && k.z > 1).length;
  it("con el último nivel incompleto no apila y dice con cuántas cajas sí", () => {
    const r = optimizar([vaso({ qty: 75, porPallet: 25 })], veh53, reglas, () => {}, [tarima]);   // 10 por nivel: 10 + 10 + 5
    expect(apilados(r)).toBe(0);
    expect(r.avisos.join(" ")).toMatch(/nivel incompleto.*Con 20 o 30 cajas por pallet sí se puede apilar/);
  });
  it("con niveles completos sí apila, sin aviso", () => {
    const r = optimizar([vaso({ qty: 80, porPallet: 20 })], veh53, reglas, () => {}, [tarima]);
    expect(apilados(r)).toBeGreaterThan(0);
    expect(r.avisos.some((a) => /otro pallet encima/.test(a))).toBe(false);
  });
  it("si dos pallets no caben en la altura, lo dice", () => {
    const r = optimizar([vaso({ qty: 80, porPallet: 40 })], { ...veh53, H: 2400 }, reglas, () => {}, [tarima]);   // 4 niveles: 1,750 mm; dos no caben en 2,400
    expect(r.avisos.join(" ")).toMatch(/altura del vehículo/);
  });
});

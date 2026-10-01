import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { libroResultados, etapasDe, htmlInstructivo, htmlInstructivoCompleto, nombreArchivo } from "./resultados.js";
import { armarReporte } from "../motor/reporte.js";
import { NOMBRE_VERSION } from "../version.js";
import { correr, ejecutorEnProceso } from "../motor/corrida.js";
import { optimizar } from "../motor/motor.js";

const caja = (d = {}) => ({
  id: 0, color: "#000", desc: "", nombre: "SKU", L: 600, W: 400, H: 400, peso: 10, qty: 20, piezas: 1,
  oris: [true, true, false, false, false, false], volteoPiso: false, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
  piso: "libre", soportaEncima: true, grupo: "", orden: 0, paletizar: false, palletId: 0, porPallet: 0,
  resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d,
});
const vehiculo = { L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 };
const tarimas = [{ nombre: "Universal", L: 1200, W: 1000, esp: 150, peso: 25, altMax: 1800, maxKg: 1200, ovL: 0, ovW: 0 }];
const reglas = { nivel: 1, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, apilamiento: "ninguna" };
const reporteReal = async (items) => armarReporte(await correr({ items, vehiculo, tarimas, reglas }, { ejecutor: ejecutorEnProceso(optimizar) }));
const filas = (wb, n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false });
const referencia = XLSX.read(new Uint8Array(readFileSync("referencia/ejemplo_resultados.xlsx")), { type: "array" });

describe("libroResultados", () => {
  it("tiene las mismas hojas y encabezados que el ejemplo de referencia, más Pallets cuando hay", async () => {
    const R = await reporteReal([caja({ nombre: "Enorme <b>", L: 7000, qty: 1 }), caja({ nombre: "Pal", qty: 12, paletizar: true }), caja({ nombre: "Suelta", desc: "d", qty: 5, orden: 1 })]);
    const wb = XLSX.read(libroResultados({ reporte: R, proyecto: "Prueba", nombreVeh: "V", nivel: 1, fecha: "hoy" }), { type: "array" });
    expect(wb.SheetNames).toEqual(["Resumen", "Lista de carga", "Pallets", "Entregas", "Pasos de carga"]);
    for (const [hoja, fila] of [["Resumen", 5], ["Pasos de carga", 0]]) expect(filas(wb, hoja)[fila]).toEqual(filas(referencia, hoja)[fila]);
    // La lista dice "Entrega" donde el ejemplo viejo decía "Orden"; el resto del encabezado es igual
    expect(filas(wb, "Lista de carga")[0]).toEqual(filas(referencia, "Lista de carga")[0].map((h) => (h === "Orden" ? "Entrega" : h)));
    expect(filas(wb, "Entregas")).toEqual([["Vehículo", "Entrega", "Pedidos", "Bultos", "Volumen (m³)", "Desde las puertas (m)", "Hasta (m)", "Bultos que estorban"], [1, 1, "", 5, +(R.contenedores[0].entregas[0].vol / 1e9).toFixed(2), +(R.contenedores[0].entregas[0].desdePuertas / 1e3).toFixed(2), +(R.contenedores[0].entregas[0].hastaPuertas / 1e3).toFixed(2), 0]]);
    const resumen = filas(wb, "Resumen");
    expect(resumen.slice(0, 5)).toEqual([[`${NOMBRE_VERSION} · Resultados`], ["Carga", "Prueba"], ["Fecha", "hoy"], ["Vehículo", "V"], ["Nivel de optimización", 1]]);
    expect(resumen.at(-1)).toEqual(["No caben", "Enorme <b>"]);
    const t = R.contenedores[0], total = resumen.find((f) => f[0] === "Total");
    expect(resumen[6]).toEqual([1, t.nBultos, t.nCajas, t.nPallets, Math.round(t.peso), Math.round(t.pesoBruto), +t.utilPeso.toFixed(1), +t.m3.toFixed(2), +t.m3Cap.toFixed(2), +t.ocupacion.toFixed(1), +t.cgLargo.toFixed(0)]);
    expect(total[2]).toBe(17);
    expect(filas(wb, "Lista de carga").slice(1).map((f) => [f[1], f[2], f[6]])).toEqual([[1, "Suelta", 5], ["Libre", "Pal", 12]]);
    expect(filas(wb, "Pallets")[1][0]).toBe("Pal");
    expect(filas(wb, "Pasos de carga").length - 1).toBe(t.pasos.length);
  });

  it("sin pallets ni entregas no agrega esas hojas", async () => {
    const wb = XLSX.read(libroResultados({ reporte: await reporteReal([caja()]), proyecto: "P", nombreVeh: "V", nivel: 1 }), { type: "array" });
    expect(wb.SheetNames).toEqual(["Resumen", "Lista de carga", "Pasos de carga"]);
  });
});

describe("etapasDe", () => {
  const pasos = (n, porPaso) => Array.from({ length: n }, (_, i) => ({ num: i + 1, ini: i * porPaso, fin: (i + 1) * porPaso, texto: `p${i + 1}` }));
  it("cubre todos los pasos en orden, en cuando mucho 8 etapas", () => {
    const e = etapasDe(pasos(30, 2), 60);
    expect(e.length).toBe(8);
    expect(e.flat().map((p) => p.num)).toEqual(pasos(30, 2).map((p) => p.num));
  });
  it("con pocos pasos, una etapa por paso", () => {
    expect(etapasDe(pasos(3, 5), 15).map((e) => e.length)).toEqual([1, 1, 1]);
  });
});

describe("htmlInstructivo", () => {
  it("arma el documento con las secciones del ejemplo de referencia y escapa el texto", async () => {
    const R = await reporteReal([caja({ nombre: "A & B", qty: 12, paletizar: true }), caja({ nombre: "C", qty: 4, orden: 1, grupo: "PED-7 <x>" })]);
    const t = R.contenedores[0], etapas = etapasDe(t.pasos, t.nBultos);
    const html = htmlInstructivo({ reporte: R, sel: 0, modoPallet: false, proyecto: "Semana <37>", nombreVeh: "Contenedor", etapas, imagenes: etapas.map((_, i) => `data:img${i}`), fecha: "hoy" });
    const ref = readFileSync("referencia/ejemplo_instructivo_carga.html", "utf8");
    const h2 = (s) => [...s.matchAll(/<h2>(.*?)<\/h2>/g)].map((m) => m[1]);
    const ths = (s) => [...s.matchAll(/<tr>((?:<th>.*?<\/th>)+)<\/tr>/g)].map((m) => [...m[1].matchAll(/<th>(.*?)<\/th>/g)].map((x) => x[1]));
    expect(h2(html)).toEqual(["Orden de descarga", "Qué se carga", "Armado de pallets (antes de cargar)", "Pasos de carga"]);
    expect(html).toContain("<td>PED-7 &lt;x&gt;</td>");
    expect(h2(ref)).toEqual(["Qué se carga", "Pasos de carga"]);
    expect(ths(html)[1]).toEqual(ths(ref)[0].map((h) => (h === "Orden" ? "Entrega" : h)));
    expect(html).toContain("<title>Instructivo de carga · Semana &lt;37&gt;</title>");
    expect(html).toContain("<b>A &amp; B</b>");
    expect(html).toContain(`Vehículo 1 de ${R.contenedores.length}</h1>`);
    expect(html).toContain(`${t.cgLargo.toFixed(0)}% del fondo`);
    expect(html).not.toContain("del frente");
    expect((html.match(/class="etapa"/g) || []).length).toBe(etapas.length);
    expect(html).toContain('src="data:img0"');
    expect((html.match(/<li>/g) || []).length).toBe(t.pasos.length);
  });
});

describe("htmlInstructivoCompleto", () => {
  it("arma una sección por vehículo con índice y saltos de página entre contenedores", async () => {
    const R = await reporteReal([caja({ nombre: "A", L: 400, W: 400, H: 400, peso: 3000, qty: 12 })]); // el peso obliga a usar 2 vehículos
    expect(R.contenedores.length).toBeGreaterThan(1);
    const secciones = R.contenedores.map((t, i) => {
      const etapas = etapasDe(t.pasos, t.nBultos);
      return { sel: i, etapas, imagenes: etapas.map((_, j) => `data:img${i}-${j}`) };
    });
    const html = htmlInstructivoCompleto({ reporte: R, secciones, modoPallet: false, proyecto: "Semana 37", nombreVeh: "Contenedor", fecha: "hoy" });
    const h1s = [...html.matchAll(/<h1>(.*?)<\/h1>/g)].map((m) => m[1]);
    expect(h1s.length).toBe(R.contenedores.length);
    expect(h1s[0]).toContain(`Vehículo 1 de ${R.contenedores.length}`);
    expect(h1s[1]).toContain(`Vehículo 2 de ${R.contenedores.length}`);
    expect(html).toContain(`Vehículos incluidos (${R.contenedores.length})`);
    expect(html).toContain("<section class=\"contenedor\">");
    expect((html.match(/<section class="contenedor">/g) || []).length).toBe(R.contenedores.length);
    expect(html).toContain('src="data:img0-0"');
    expect(html).toContain('src="data:img1-0"');
  });

  it("con un solo contenedor no muestra el índice", async () => {
    const R = await reporteReal([caja({ nombre: "A", qty: 1 })]);
    const t = R.contenedores[0], etapas = etapasDe(t.pasos, t.nBultos);
    const html = htmlInstructivoCompleto({ reporte: R, secciones: [{ sel: 0, etapas, imagenes: etapas.map(() => "data:img") }], modoPallet: false, proyecto: "P", nombreVeh: "V" });
    expect(html).not.toContain("incluidos");
  });
});

describe("nombreArchivo", () => {
  it("deja solo letras y números, corto, con respaldo", () => {
    expect(nombreArchivo("Reparto semana 37 · Ñandú")).toBe("repartosemana37nandu");
    expect(nombreArchivo("")).toBe("carga");
  });
});

describe("reportes en unidades americanas", async () => {
  const { unidadesDe } = await import("../unidades.js");
  const u = unidadesDe("americano");
  it("el paso a paso dice pies, y el Excel lleva libras y pies³ en encabezados y valores", async () => {
    const corrida = await correr({ items: [caja({ qty: 6 })], vehiculo, tarimas, reglas }, { ejecutor: ejecutorEnProceso(optimizar) });
    const R = armarReporte(corrida, u), Rm = armarReporte(corrida);
    expect(R.contenedores[0].pasos[0].texto).toMatch(/ ft del fondo/);
    expect(Rm.contenedores[0].pasos[0].texto).toMatch(/ m del fondo/);
    const wb = XLSX.read(libroResultados({ reporte: R, proyecto: "P", nombreVeh: "V", nivel: 1, u }), { type: "array" });
    const res = filas(wb, "Resumen");
    expect(res[5]).toContain("Peso carga (lb)");
    expect(res[5]).toContain("Volumen cargado (ft³)");
    const t = R.contenedores[0];
    expect(res[6][4]).toBe(+(t.peso / 0.45359237).toFixed(0));
    expect(filas(wb, "Pasos de carga")[0]).toContain("Desde el fondo (ft)");
  });
});

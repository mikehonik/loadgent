// ================= Reporte =================
// Convierte una sola vez el resultado crudo del motor más la carga en un reporte con nombres:
// por contenedor sus estadísticas, lista por SKU, pasos de carga, pallets usados y entregas; más los avisos tipificados.
// Pantalla, Excel e instructivo son renderers de este reporte. Nadie más debe leer resultado.contenedores[].cajas[].idx.

import { cargaPorEje } from "./ejes.js";
import { unidadesDe } from "../unidades.js";

export const ORIENTACIONES = ["De pie", "De pie girada", "Acostada", "Acostada girada", "De canto", "De canto girada"];

// Distancias del paso a paso en la unidad del usuario: metros con 2 decimales, o pies con 1.
const distancia = (u) => (v) => (v / u.mmPorD).toLocaleString("es-MX", { minimumFractionDigits: u.decD, maximumFractionDigits: u.decD });

const ordenDe = (f) => (f.orden > 0 ? f.orden : 1e9);

function estadisticas(cont, resultado, items, veh) {
  let mx = 0, my = 0, piezas = 0, nCajas = 0, nPallets = 0;
  const filas = {};
  const fila = (idx) => (filas[idx] = filas[idx] || { idx: Number(idx), sueltas: 0, enPallet: 0, oris: {} });
  const contar = (idx) => { nCajas++; piezas += items[idx]?.piezas || 1; };
  for (const c of cont.cajas) {
    mx += c.peso * (c.x + c.l / 2); my += c.peso * (c.y + c.w / 2);
    if (c.pal >= 0) { nPallets++; resultado.pallets[c.pal].cajas.forEach((k) => { const f = fila(k.idx); f.enPallet++; f.oris[k.ori] = (f.oris[k.ori] || 0) + 1; contar(k.idx); }); }
    else { const f = fila(c.idx); f.sueltas++; f.oris[c.ori] = (f.oris[c.ori] || 0) + 1; contar(c.idx); }
  }
  let largo = 0;
  cont.cajas.forEach((c) => { if (c.x + c.l > largo) largo = c.x + c.l; });
  const volV = veh.L * veh.W * veh.H, pesoT = cont.peso || 1, cargaMax = veh.maxKg > 0 ? veh.maxKg - (veh.tara || 0) : 0;
  const ejes = cargaPorEje(veh, cont.cajas);
  const lista = Object.values(filas).map((f) => {
    const it = items[f.idx] || {}, total = f.sueltas + f.enPallet;
    return { idx: f.idx, nombre: it.nombre ?? "", desc: it.desc || "", orden: it.orden || 0, ordenTxt: it.orden || "Libre",
      sueltas: f.sueltas, enPallet: f.enPallet, total, piezas: total * (it.piezas || 1), peso: total * (it.peso || 0), m3: (total * (it.L || 0) * (it.W || 0) * (it.H || 0)) / 1e9,
      L: it.L || 0, W: it.W || 0, H: it.H || 0, permitidas: it.oris ? it.oris.map((v, i) => (v ? i : -1)).filter((i) => i >= 0) : [],
      // Cómo quedó acomodada cada caja de este SKU, de la más usada a la menos
      orientaciones: Object.entries(f.oris).map(([ori, n]) => ({ ori: Number(ori), nombre: ORIENTACIONES[Number(ori) - 1] || "", n })).sort((a, b) => b.n - a.n) };
  }).sort((a, b) => ordenDe(a) - ordenDe(b));
  return {
    ocupacion: (cont.vol / volV) * 100, utilPeso: cargaMax ? (cont.peso / cargaMax) * 100 : null,
    m3: cont.vol / 1e9, m3Cap: volV / 1e9, cgLargo: (mx / pesoT / veh.L) * 100, cgLateral: my / pesoT - veh.W / 2,
    piezas, nCajas, nPallets, nBultos: cont.cajas.length, peso: cont.peso, pesoBruto: cont.peso + (veh.tara || 0), lista,
    mUsados: largo / 1000, mLibres: Math.max(0, veh.L - largo) / 1000, mTotal: veh.L / 1000, ejes,
  };
}

// Agrupa las cajas en pasos: bloques consecutivos del mismo SKU, forma y tipo de pallet
function pasosDe(cont, resultado, items, u) {
  const mts = distancia(u), ud = u.d;
  const pasos = [];
  cont.cajas.forEach((c, i) => {
    const ult = pasos[pasos.length - 1];
    if (ult && ult.idx === c.idx && ult.pal === c.pal && ult.ori === c.ori) {
      ult.n++; ult.fin = i + 1;
      ult.x0 = Math.min(ult.x0, c.x); ult.x1 = Math.max(ult.x1, c.x + c.l); ult.y0 = Math.min(ult.y0, c.y); ult.y1 = Math.max(ult.y1, c.y + c.w); ult.z0 = Math.min(ult.z0, c.z); ult.z1 = Math.max(ult.z1, c.z + c.h);
    } else pasos.push({ idx: c.idx, pal: c.pal, ori: c.ori, n: 1, ini: i, fin: i + 1, l: c.l, w: c.w, h: c.h, x0: c.x, x1: c.x + c.l, y0: c.y, y1: c.y + c.w, z0: c.z, z1: c.z + c.h });
  });
  return pasos.map((p, k) => {
    const it = items[p.idx] || {}, d = p.pal >= 0 ? resultado.pallets[p.pal] : null;
    const nx = Math.round((p.x1 - p.x0) / p.l), ny = Math.round((p.y1 - p.y0) / p.w), nz = Math.round((p.z1 - p.z0) / p.h);
    const bloque = nx * ny * nz === p.n ? ` en bloque de ${nx} a lo largo × ${ny} a lo ancho × ${nz} de alto` : "";
    const que = d ? `${p.n} ${p.n === 1 ? "pallet" : "pallets"} «${d.nombre}» (${d.n} cajas c/u, en ${d.tipoPallet})` : `${p.n} ${it.esBundle ? (p.n === 1 ? "Bundle" : "Bundles") : p.n === 1 ? "caja" : "cajas"} de ${it.nombre}${it.desc ? ` (${it.desc})` : ""}${it.deBundle && it.abiertos ? " (de Bundles abiertos)" : ""}, ${(ORIENTACIONES[(p.ori || 1) - 1] || "").toLowerCase()}`;
    const donde = `a ${mts(p.x0)}–${mts(p.x1)} ${ud} del fondo, ${mts(p.y0)}–${mts(p.y1)} ${ud} del lado derecho (visto desde las puertas), ${p.z0 < 1 ? "sobre el piso" : `a ${mts(p.z0)} ${ud} de altura`}`;
    return { num: k + 1, texto: `Coloca ${que}${bloque}, ${donde}.`, sku: d ? d.nombre : it.nombre, n: p.n, ini: p.ini, fin: p.fin, forma: d ? "Pallet" : ORIENTACIONES[(p.ori || 1) - 1], x0: p.x0, y0: p.y0, z0: p.z0 };
  });
}

// u: unidades del usuario (unidades.js). Solo cambia el texto del paso a paso; los números del reporte
// siguen en mm, kg y m³ y cada pantalla o archivo los convierte al mostrarlos.
export function armarReporte({ resultado, carga }, u = unidadesDe("metrico")) {
  const items = carga.items, veh = carga.vehiculo;
  const usos = resultado.pallets.map(() => 0);
  resultado.contenedores.forEach((c) => c.cajas.forEach((k) => { if (k.pal >= 0) usos[k.pal]++; }));
  const pallets = resultado.pallets.map((d, i) => ({ ...d, i, usos: usos[i], nSkus: new Set(d.cajas.map((k) => k.idx)).size })).filter((d) => d.usos > 0);

  const contenedores = resultado.contenedores.map((c, i) => {
    const idsPal = [...new Set(c.cajas.filter((k) => k.pal >= 0).map((k) => k.pal))];
    // Entregas: zona de cada parada medida desde las puertas (x = veh.L) y los bultos que estorban para descargarla
    const entregas = (c.entregas || []).map((e) => ({ ...e, pedidos: [...new Set(items.filter((it) => it.orden === e.orden && it.grupo).map((it) => it.grupo))], destinos: [...new Set(items.filter((it) => it.orden === e.orden && it.destino).map((it) => it.destino))], desdePuertas: veh.L - e.x1, hastaPuertas: veh.L - e.x0 }));
    return { num: i + 1, ...estadisticas(c, resultado, items, veh), pasos: pasosDe(c, resultado, items, u), pallets: idsPal.map((p) => pallets.find((d) => d.i === p)), entregas, estorban: c.estorban || 0 };
  });

  const totales = contenedores.reduce((a, t) => ({ cajas: a.cajas + t.nCajas, kg: a.kg + t.peso, m3: a.m3 + t.m3, m3Cap: a.m3Cap + t.m3Cap }), { cajas: 0, kg: 0, m3: 0, m3Cap: 0 });

  const avisos = [];
  if (resultado.sinCargar > 0) avisos.push({ tipo: "sinCargar", n: resultado.sinCargar, texto: `${resultado.sinCargar} bultos no se pudieron acomodar con las reglas actuales.` });
  if (resultado.noCaben.length) avisos.push({ tipo: "noCaben", nombres: resultado.noCaben, texto: `No caben por medidas, peso u orientación: ${resultado.noCaben.join(", ")}.` });
  resultado.avisos.forEach((a) => avisos.push({ tipo: "motor", texto: a }));
  // Edición a mano: se deja constancia en el reporte, el Excel y el instructivo
  if (resultado.editadoManual) {
    const { vehiculos, quitados } = resultado.editadoManual;
    avisos.push({ tipo: "manual", texto: `Se editó a mano ${vehiculos.length === 1 ? `el vehículo ${vehiculos[0]}` : `los vehículos ${vehiculos.join(", ")}`} después del cálculo.${quitados ? ` ${quitados} ${quitados === 1 ? "bulto se quitó" : "bultos se quitaron"} y no van en la carga.` : ""}` });
  }

  return { vehiculo: veh, estrategiasProbadas: resultado.estrategiasProbadas, conEntregas: items.some((it) => it.orden > 0), contenedores, totales, pallets, avisos };
}

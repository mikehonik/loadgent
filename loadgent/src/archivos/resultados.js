// ================= Resultados =================
// Salidas de una corrida para quien no está frente a la app: el Excel de resultados (todos los
// vehículos) y el instructivo de carga en HTML (un vehículo, con imágenes del visor).
// Ambos son renderers del reporte: no leen el resultado crudo del motor.
import { traducir, traducirFilas, traducirHtml } from "../i18n/index.js";
import * as XLSX from "xlsx";
import { escribirXlsx } from "./escribir.js";
import { clave } from "./celdas.js";
import { NOMBRE_VERSION, BUILD } from "../version.js";
import { unidadesDe, encabezadoEn } from "../unidades.js";

// Conversores numéricos para los archivos, en la unidad del usuario (u = unidadesDe(...)).
const conv = (u) => ({
  kg: (v, dec = 0) => +((+v || 0) / u.kgPorP).toFixed(dec),
  m3: (v, dec = 2) => +(((+v || 0) * 1e9) / u.mm3PorV).toFixed(dec),     // recibe m³
  mm3: (v, dec = 2) => +((+v || 0) / u.mm3PorV).toFixed(dec),            // recibe mm³
  d: (v, dec = 2) => +((+v || 0) / u.mmPorD).toFixed(dec),                // recibe mm, da m o ft
  l: (v, dec = 0) => +((+v || 0) / u.mmPorL).toFixed(u.id === "metrico" ? dec : Math.max(dec, 1)),  // recibe mm, da mm o in
});

// Libro de una sola hoja, para listados simples (revisión del pedido)
export function libroSimple(filas, hoja, anchos) {
  const wb = XLSX.utils.book_new(), ws = XLSX.utils.aoa_to_sheet(traducirFilas(filas));
  if (anchos) ws["!cols"] = anchos.map((w) => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, traducir(hoja).slice(0, 31));
  return escribirXlsx(wb);
}
export const MIME_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const nombreArchivo = (t) => clave(t).slice(0, 40) || "carga";
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// En inglés cada celda de texto y el nombre de la hoja salen traducidos
const hoja = (wb, nombre, filas, anchos) => { const ws = XLSX.utils.aoa_to_sheet(traducirFilas(filas)); ws["!cols"] = anchos.map((wch) => ({ wch })); XLSX.utils.book_append_sheet(wb, ws, traducir(nombre).slice(0, 31)); };

// Excel con Resumen, Lista de carga, Pallets (si hay) y Pasos de carga. Devuelve el archivo como bytes.
export function libroResultados({ reporte: R, proyecto, nombreVeh, nivel, fecha = new Date().toLocaleString("es-MX"), u = unidadesDe("metrico") }) {
  const wb = XLSX.utils.book_new();
  const c = conv(u), H = (fila) => fila.map((h) => encabezadoEn(h, u));
  const r1 = [[`${NOMBRE_VERSION} · Resultados`], ["Carga", proyecto], ["Fecha", fecha], ["Vehículo", nombreVeh], ["Nivel de optimización", nivel], [],
    H(["Vehículo", "Bultos", "Cajas", "Pallets", "Peso carga (kg)", "Peso bruto (kg)", "Utilización de peso (%)", "Volumen cargado (m³)", "Capacidad (m³)", "Utilización volumétrica (%)", "Centro de gravedad (% del fondo)"])];
  R.contenedores.forEach((t) => r1.push([t.num, t.nBultos, t.nCajas, t.nPallets, c.kg(t.peso), c.kg(t.pesoBruto), t.utilPeso == null ? "" : +t.utilPeso.toFixed(1), c.m3(t.m3), c.m3(t.m3Cap), +t.ocupacion.toFixed(1), +t.cgLargo.toFixed(0)]));
  const tot = R.totales;
  r1.push(["Total", "", tot.cajas, "", c.kg(tot.kg), "", "", c.m3(tot.m3), c.m3(tot.m3Cap), +((tot.m3 / tot.m3Cap) * 100).toFixed(1), ""]);
  R.avisos.forEach((a) => { if (a.tipo === "sinCargar") r1.push([], ["Bultos sin cargar", a.n]); if (a.tipo === "noCaben") r1.push(["No caben", a.nombres.join(", ")]); if (a.tipo === "manual") r1.push(["Edición a mano", a.texto]); });
  hoja(wb, "Resumen", r1, [22, 10, 10, 10, 16, 16, 22, 20, 16, 24, 28]);
  const r2 = [H(["Vehículo", "Entrega", "SKU", "Descripción", "Cajas sueltas", "Cajas en pallet", "Total cajas", "Piezas", "Peso (kg)", "Volumen (m³)"])];
  R.contenedores.forEach((t) => t.lista.forEach((f) => r2.push([t.num, f.ordenTxt, f.nombre, f.desc, f.sueltas, f.enPallet, f.total, f.piezas, c.kg(f.peso, 1), c.m3(f.m3, 3)])));
  hoja(wb, "Lista de carga", r2, [9, 7, 16, 34, 12, 14, 11, 9, 10, 12]);
  if (R.pallets.length) {
    const r3 = [H(["Pallet", "Tipo", "Tipo de pallet", "Cajas", "Capas × cajas por capa", "Alto total (mm)", "Peso total (kg)", "Huella (mm)", "Sobresale largo / ancho (mm)", "Utilización del pallet (%)", "Cantidad"])];
    R.pallets.forEach((d) => r3.push([d.nombre, d.mixto ? "Mixto" : "Un SKU", d.tipoPallet, d.n, d.capas ? `${d.capas} × ${d.porCapa}` : "Por bloques", c.l(d.alto), c.kg(d.peso), `${c.l(d.L)} × ${c.l(d.W)}`, `${c.l(d.sobraL)} / ${c.l(d.sobraW)}`, +(d.utilVol * 100).toFixed(1), d.usos]));
    hoja(wb, "Pallets", r3, [24, 8, 22, 7, 20, 14, 14, 14, 24, 22, 9]);
  }
  if (R.conEntregas) {
    const r5 = [H(["Vehículo", "Entrega", "Pedidos", "Bultos", "Volumen (m³)", "Desde las puertas (m)", "Hasta (m)", "Bultos que estorban"])];
    R.contenedores.forEach((t) => t.entregas.forEach((e) => r5.push([t.num, e.orden, e.pedidos.join(", "), e.n, c.mm3(e.vol), c.d(e.desdePuertas), c.d(e.hastaPuertas), e.estorban])));
    hoja(wb, "Entregas", r5, [9, 9, 26, 9, 13, 22, 12, 20]);
  }
  const r4 = [H(["Vehículo", "Paso", "Qué y dónde", "SKU / pallet", "Bultos", "Forma", "Desde el fondo (m)", "Desde el lado derecho (m)", "Altura (m)"])];
  R.contenedores.forEach((t) => t.pasos.forEach((p) => r4.push([t.num, p.num, p.texto, p.sku, p.n, p.forma, c.d(p.x0), c.d(p.y0), c.d(p.z0)])));
  hoja(wb, "Pasos de carga", r4, [9, 6, 110, 18, 8, 14, 16, 22, 10]);
  return escribirXlsx(wb);
}

// Reparte los pasos de un contenedor en hasta 8 etapas de tamaño parecido (por bultos). Cada etapa termina en un paso completo.
export function etapasDe(pasos, total) {
  const nEtapas = Math.min(8, Math.max(1, pasos.length));
  const etapas = []; let actual = [];
  pasos.forEach((p) => { actual.push(p); if (p.fin >= ((etapas.length + 1) * total) / nEtapas - 0.5 || p === pasos[pasos.length - 1]) { etapas.push(actual); actual = []; } });
  return etapas;
}

// Sección de un contenedor (título, datos, entregas, lista, pallets y pasos con imágenes). La usan tanto el
// instructivo de un solo vehículo como el instructivo completo (todos los vehículos en un solo documento).
function seccionInstructivo({ reporte, sel, modoPallet, proyecto, nombreVeh, fecha, etapas, imagenes, u = unidadesDe("metrico") }) {
  const t = reporte.contenedores[sel], palsAqui = t.pallets;
  const filasLista = t.lista.map((f) => `<tr><td>${esc(f.ordenTxt)}</td><td><b>${esc(f.nombre)}</b> ${esc(f.desc)}</td><td>${f.sueltas}</td><td>${f.enPallet}</td><td><b>${f.total}</b></td><td>${u.fP(f.peso)}</td></tr>`).join("");
  return `<section class="contenedor">
<h1>Instructivo de carga · ${esc(modoPallet ? "Pallet" : "Vehículo")} ${sel + 1} de ${reporte.contenedores.length}</h1>
<p class="sub">${esc(proyecto)} · ${esc(nombreVeh)} · ${fecha}</p>
<div class="datos"><div class="dato">Utilización volumétrica<b>${t.ocupacion.toFixed(1)}%</b></div><div class="dato">Volumen<b>${u.fV3(t.m3, 1).replace(` ${u.v}`, "")} de ${u.fV3(t.m3Cap, 1)}</b></div>
<div class="dato">Peso de la carga<b>${u.fP(t.peso)}${t.utilPeso != null ? ` (${t.utilPeso.toFixed(0)}%)` : ""}</b></div><div class="dato">Bultos<b>${t.nBultos}${t.nPallets ? ` (${t.nPallets} pallets)` : ""}</b></div>
<div class="dato">Cajas<b>${t.nCajas.toLocaleString("es-MX")}</b></div><div class="dato">Centro de gravedad<b>${t.cgLargo.toFixed(0)}% del fondo</b></div></div>
<p class="nota">Referencias: el fondo es el extremo de la cabina (se carga primero); «lado derecho» es visto desde las puertas; alturas desde el piso del vehículo.</p>
${reporte.avisos.filter((a) => a.tipo === "manual").map((a) => `<p class="nota"><b>${esc(a.texto)}</b></p>`).join("")}
${t.entregas.length ? `<h2>Orden de descarga</h2><p class="nota">Se descarga de las puertas hacia el fondo, empezando por la entrega 1.</p><table><tr><th>Entrega</th><th>Pedidos</th><th>Bultos</th><th>Volumen</th><th>Zona desde las puertas</th><th>Bultos que estorban</th></tr>${t.entregas.map((e) => `<tr><td><b>${e.orden}</b></td><td>${esc(e.pedidos.join(", ") || "—")}</td><td>${e.n}</td><td>${u.fV(e.vol, 1)}</td><td>${u.fD(e.desdePuertas, 1).replace(` ${u.d}`, "")} – ${u.fD(e.hastaPuertas, 1)}</td><td>${e.estorban || "ninguno"}</td></tr>`).join("")}</table>` : ""}
<h2>Qué se carga</h2><table><tr><th>Entrega</th><th>SKU</th><th>Sueltas</th><th>En pallet</th><th>Total cajas</th><th>Peso</th></tr>${filasLista}</table>
${palsAqui.length ? `<h2>Armado de pallets (antes de cargar)</h2><table><tr><th>Pallet</th><th>Tipo de pallet</th><th>Cómo se arma</th><th>Alto</th><th>Peso</th></tr>${palsAqui.map((d) => `<tr><td><b>${esc(d.nombre)}</b></td><td>${esc(d.tipoPallet)}</td><td>${d.capas ? `${d.capas} capas de ${d.porCapa} cajas${d.alternado ? "; alterna cada capa en espejo para amarrar" : ""}` : `${d.n} cajas de ${d.nSkus} SKUs, lo más pesado abajo`}${d.sobraL || d.sobraW ? `; sobresale hasta ${u.fL(d.sobraL, 1)} a lo largo y ${u.fL(d.sobraW, 1)} a lo ancho` : ""}</td><td>${u.fL(d.alto, 1)}</td><td>${u.fP(d.peso)}</td></tr>`).join("")}</table>` : ""}
<h2>Pasos de carga</h2>
${etapas.map((e, i) => `<div class="etapa"><img src="${imagenes[i]}" alt="Etapa ${i + 1}"><div><b>Etapa ${i + 1} de ${etapas.length}</b> · bultos ${e[0].ini + 1} a ${e[e.length - 1].fin}<ol start="${e[0].num}">${e.map((p) => `<li>${esc(p.texto)}</li>`).join("")}</ol></div></div>`).join("")}
</section>`;
}

const ESTILO_INSTRUCTIVO = `body{font-family:Arial,Helvetica,sans-serif;color:#16202C;margin:24px;font-size:12px}h1{font-size:20px;margin:0}h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #F2B705;padding-bottom:3px}
.sub{color:#5B6B7B;margin:2px 0 14px}.datos{display:flex;gap:10px;flex-wrap:wrap}.dato{background:#EEF1F5;border-radius:6px;padding:6px 10px}.dato b{display:block;font-size:15px}
table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #DCE2E8;padding:4px 6px;text-align:left;vertical-align:top}th{background:#14213D;color:#fff;font-weight:normal}
.etapa{display:flex;gap:14px;page-break-inside:avoid;margin-bottom:14px}.etapa img{width:46%;border:1px solid #DCE2E8;border-radius:6px}.etapa ol{margin:0;padding-left:18px}.etapa li{margin-bottom:5px}
.nota{color:#5B6B7B;font-size:11px}.contenedor+.contenedor{page-break-before:always;margin-top:28px}
@media print{body{margin:10mm}.noimp{display:none}}`;

const docInstructivo = (titulo, cuerpo) => traducirHtml(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><title>Instructivo de carga · ${esc(titulo)}</title>
<style>${ESTILO_INSTRUCTIVO}</style></head><body>
<p class="noimp nota">Para guardar en PDF: Imprimir → Guardar como PDF.</p>
${cuerpo}
<p class="nota">Generado con ${NOMBRE_VERSION}${BUILD ? ` (${BUILD})` : ""}.</p></body></html>`);

// Instructivo de un solo contenedor. `imagenes[i]` es la captura del visor al terminar la etapa i (data URL).
export function htmlInstructivo({ reporte, sel, modoPallet, proyecto, nombreVeh, etapas, imagenes, fecha = new Date().toLocaleString("es-MX"), u }) {
  return docInstructivo(proyecto, seccionInstructivo({ reporte, sel, modoPallet, proyecto, nombreVeh, fecha, etapas, imagenes, u }));
}

// Instructivo completo: todos los vehículos (o pallets) en un solo documento, cada uno en su propia página al
// imprimir. `secciones` es un arreglo de { sel, etapas, imagenes } en el orden en que se quieren ver.
export function htmlInstructivoCompleto({ reporte, secciones, modoPallet, proyecto, nombreVeh, fecha = new Date().toLocaleString("es-MX"), u }) {
  const indice = secciones.length > 1
    ? `<h2>${esc(modoPallet ? "Pallets" : "Vehículos")} incluidos (${secciones.length})</h2><ol>${secciones.map((s) => { const t = reporte.contenedores[s.sel]; return `<li>${esc(modoPallet ? "Pallet" : "Vehículo")} ${s.sel + 1}: ${t.ocupacion.toFixed(1)}% de ocupación, ${t.nBultos} bultos.</li>`; }).join("")}</ol>`
    : "";
  const cuerpo = indice + secciones.map((s) => seccionInstructivo({ reporte, sel: s.sel, modoPallet, proyecto, nombreVeh, fecha, etapas: s.etapas, imagenes: s.imagenes, u })).join("");
  return docInstructivo(proyecto, cuerpo);
}

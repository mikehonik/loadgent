// ================= Conversiones de unidad de medida =================
// Tabla por SKU y unidad: cuántas unidades base equivale 1 de esa unidad (el formato de PeopleSoft:
// SETID, INV_ITEM_ID, UNIT_OF_MEASURE, CONVERSION_RATE). La unidad base es la que tiene factor 1.
// Sirve para que un pedido capturado en otra unidad (millares, pallets, kilos) se convierta a cajas:
//   cajas = cantidad × factor(unidad del pedido) ÷ factor(unidad de la caja)
import * as XLSX from "xlsx";
import { clave, claveSku, numero, buscarHoja } from "./celdas.js";

export const UM_CAJA_DEF = "CJ";
export const HOJA_CONVERSIONES = "Conversiones";
// Unidades frecuentes, para las listas desplegables y la ayuda
export const UM_COMUNES = [["CJ", "Caja"], ["BL", "Bolsa"], ["UN", "Unidad o pieza"], ["ML", "Millar (1,000 unidades)"], ["PQ", "Paquete"], ["RL", "Rollo"], ["PL", "Pliego"], ["PLT", "Pallet"], ["KG", "Kilogramo"], ["TM", "Tonelada"], ["MT", "Metro"], ["LT", "Litro"]];
export const nombreUM = (um) => (UM_COMUNES.find(([u]) => u === normalizaUM(um))?.[1] ?? "");
export const normalizaUM = (um) => String(um ?? "").trim().toUpperCase();

// Lee una tabla de conversiones desde cualquier hoja con SKU, unidad y factor.
// Devuelve { porSku: { SKU normalizado: { UM: factor } }, filas, skus, ums, sinUsar }.
export function leerConversiones(buf, soloSkus = null) {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = buscarHoja(wb, [clave(HOJA_CONVERSIONES), "conversionesum", "um", "unidades"]) || wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const hi = filas.findIndex((f) => f.some((c) => ["sku", "invitemid", "codigo", "articulo", "item"].includes(clave(c))));
  if (hi < 0) throw new Error("No se encontró la columna del SKU (SKU o INV_ITEM_ID).");
  const heads = filas[hi].map(clave);
  const iSku = heads.findIndex((h) => ["sku", "invitemid", "codigo", "articulo", "item"].includes(h));
  const iUm = heads.findIndex((h) => ["um", "unitofmeasure", "unidad", "unidaddemedida", "unidadmedida"].includes(h));
  const iFac = heads.findIndex((h) => ["factor", "conversionrate", "tasa", "tasadeconversion", "equivalencia"].includes(h));
  if (iUm < 0 || iFac < 0) throw new Error("Faltan las columnas de unidad (UNIT_OF_MEASURE) o factor (CONVERSION_RATE).");
  const permitidos = soloSkus && soloSkus.size ? soloSkus : null;
  const porSku = {};
  let leidas = 0, sinUsar = 0;
  for (let i = hi + 1; i < filas.length; i++) {
    const f = filas[i], sku = String(f[iSku] ?? "").trim(), um = normalizaUM(f[iUm]), fac = numero(f[iFac]);
    if (!sku || !um || !(fac > 0)) continue;
    leidas++;
    const k = claveSku(sku);
    if (permitidos && !permitidos.has(k)) { sinUsar++; continue; }
    (porSku[k] = porSku[k] || {})[um] = fac;
  }
  const ums = new Set();
  Object.values(porSku).forEach((t) => Object.keys(t).forEach((u) => ums.add(u)));
  return { porSku, filas: leidas, skus: Object.keys(porSku).length, ums: [...ums].sort(), sinUsar };
}

// Convierte una cantidad de una unidad a cajas. Devuelve { cajas, exacto, motivo }.
// Sin unidad, o con la misma unidad de la caja, no convierte. Si no alcanza para una caja entera, redondea hacia arriba.
// Unidades que YA son un bulto que se estiba: si el pedido viene en una de éstas, no se convierte.
// PQ (paquete) queda fuera a propósito: es una unidad de origen que sí se convierte a caja o bolsa.
export const UM_BULTO = ["CJ", "BL", "RL", "CS", "CJM", "PAC", "BLT"];
export const esBulto = (um) => UM_BULTO.includes(normalizaUM(um));
const entero = (v) => Math.abs(v - Math.round(v)) < 1e-6;
// Qué hacer con una cantidad que no da un número entero de cajas. Es una decisión de operación, no del
// programa: se elige en Reglas y siempre se reporta la cantidad original junto a la que se cubicó.
export const REDONDEOS = [["arriba", "Hacia arriba (se despacha de más)"], ["abajo", "Hacia abajo (se despacha de menos)"], ["cercano", "Al más cercano"]];
export const redondear = (v, modo) => (modo === "abajo" ? Math.max(1, Math.floor(v)) : modo === "cercano" ? Math.max(1, Math.round(v)) : Math.ceil(v));

export function aCajas(cantidad, um, umCaja, tabla, piezasPorCaja, redondeo = "arriba") {
  const ceil = (v) => redondear(v, redondeo);
  const u = normalizaUM(um), c = normalizaUM(umCaja) || UM_CAJA_DEF;
  const porPiezas = piezasPorCaja > 0 ? piezasPorCaja : 0;
  // Sin unidad, o ya en la unidad de la caja: la cantidad son cajas. Solo se sube a entero si viene con decimales.
  const sinConvertir = (motivo) => entero(cantidad)
    ? { cajas: Math.round(cantidad), exacto: true, destino: u || c, ...(motivo ? { nota: motivo } : {}) }
    : { cajas: ceil(cantidad), exacto: false, exactas: cantidad, destino: u || c, ...(motivo ? { nota: motivo } : {}) };
  if (!u || u === c) return sinConvertir();
  // El pedido ya viene en una unidad logística (caja, bolsa, rollo): eso ya son bultos, no se toca.
  if (esBulto(u)) return sinConvertir(u === c ? undefined : `el pedido ya viene en ${u}, no se convirtió`);
  // Piezas por caja del propio maestro: cuenta cuántas piezas trae la caja o bolsa que de verdad se
  // estiba. Si el pedido ya viene en piezas (UN), esto basta y no depende de que el ERP tenga
  // registrado un factor de caja para ese SKU, algo muy común en tejas, resinas o materiales a granel.
  const porUnidades = (piezasTotales) => {
    const exactas = piezasTotales / porPiezas;
    return { cajas: entero(exactas) ? Math.round(exactas) : ceil(exactas), exacto: entero(exactas), exactas, destino: c, viaPiezas: true };
  };
  if (u === "UN" && porPiezas) return porUnidades(cantidad);
  if (!tabla) return { cajas: ceil(cantidad), exacto: false, motivo: `no hay tabla de conversiones para pasar de ${u} a ${c}` };
  const fu = tabla[u];
  if (!(fu > 0)) return { cajas: ceil(cantidad), exacto: false, motivo: `no tiene la equivalencia de ${u}` };
  // Manda el factor del ERP: si ese SKU tiene registrada la unidad de bulto (CJ, BL...), esa es la
  // verdad. Antes se prefería "piezas por caja" del maestro y eso daba números disparatados cuando
  // ese campo traía otro valor (por ejemplo 10 piezas cuando la caja real lleva 200).
  let destino = c, fc = tabla[c];
  if (!(fc > 0)) destino = UM_BULTO.find((x) => tabla[x] > 0);
  // Solo si el ERP no tiene ninguna unidad de bulto para este SKU se recurre a las piezas por caja
  // del maestro (el caso de tejas, resinas o materiales que el ERP solo maneja en UN, ML o KG).
  if (!destino) {
    if (porPiezas && tabla.UN > 0) return porUnidades((cantidad * fu) / tabla.UN);
    return { cajas: ceil(cantidad), exacto: false, motivo: `no tiene la equivalencia de ${c} ni de otra unidad de empaque` };
  }
  fc = tabla[destino];
  const exactas = (cantidad * fu) / fc;
  const cajas = entero(exactas) ? Math.round(exactas) : ceil(exactas);
  return { cajas, exacto: entero(exactas), exactas, destino, cambioDeUM: destino !== c ? destino : undefined };
}

// Hoja Conversiones para guardar dentro del maestro, limitada a los SKUs que existan en él.
export function filasConversiones(porSku, productos) {
  // Llaves nuevas (claveSku) y las guardadas antes (clave, sin guion) apuntan al mismo producto.
  const orden = new Map();
  productos.forEach((p, i) => { const r = { i, sku: p.sku }; orden.set(claveSku(p.sku), r); if (!orden.has(clave(p.sku))) orden.set(clave(p.sku), r); });
  const filas = [];
  Object.entries(porSku || {}).forEach(([k, tabla]) => {
    const ref = orden.get(k);
    if (!ref) return;
    Object.entries(tabla).forEach(([um, fac]) => filas.push([ref.i, ref.sku, um, fac]));
  });
  filas.sort((a, b) => a[0] - b[0] || (a[2] < b[2] ? -1 : 1));
  return filas.map((f) => f.slice(1));
}

// Lee la hoja Conversiones que escribe el propio maestro (SKU, UM, Factor).
export function conversionesDeHoja(ws) {
  if (!ws) return null;
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const porSku = {};
  filas.slice(1).forEach((f) => {
    const sku = String(f[0] ?? "").trim(), um = normalizaUM(f[1]), fac = numero(f[2]);
    if (sku && um && fac > 0) (porSku[claveSku(sku)] = porSku[claveSku(sku)] || {})[um] = fac;
  });
  return Object.keys(porSku).length ? porSku : null;
}

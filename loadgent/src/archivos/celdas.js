// ================= Celdas =================
// Lectura tolerante de hojas de Excel capturadas a mano: encabezados y valores se normalizan
// (sin acentos, sin paréntesis, sin espacios) para que "Largo (mm)" y "largo" sean la misma columna.
import * as XLSX from "xlsx";

// Normaliza un código (SKU o ID producto) para compararlo entre archivos distintos.
// Dos problemas reales de Excel que esto evita:
// - Si un código puramente numérico se guardó como texto en un archivo ("0500123") y como número
//   en otro (500123), Excel le quita los ceros a la izquierda al segundo. Sin esto, la herramienta
//   los trataría como productos distintos y reportaría "no encontrado" aunque sí esté en el maestro.
// - Un código con punto ("500123.0", que Excel produce solo con celdas numéricas) no debe fusionarse
//   en "5001230" al quitarle la puntuación; se normaliza como número antes de quitar símbolos.
export const clave = (t) => {
  let s = String(t ?? "").trim();
  if (s !== "" && /^-?\d+(\.\d+)?$/.test(s)) s = String(Number(s));
  s = s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9]/g, "");
  if (/^0+\d+$/.test(s)) s = s.replace(/^0+/, "");
  return s;
};
// Identidad de un SKU. Igual que clave (mayúsculas, espacios, acentos y ceros a la izquierda no cuentan),
// pero el guion SÍ cuenta: en Darnel "852-10" y "85210" son productos distintos. Con clave se fusionaban
// y el maestro reportaba uno de los dos como repetido, quedándose solo con el primero.
export const claveSku = (t) => {
  let s = String(t ?? "").trim();
  if (s !== "" && /^-?\d+(\.\d+)?$/.test(s)) s = String(Number(s));
  s = s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\(.*?\)/g, "").replace(/[^a-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-+|-+$/g, "");
  if (/^0+\d+$/.test(s)) s = s.replace(/^0+/, "");
  return s;
};
// Índice de productos para buscar por SKU o por ID producto. La llave exacta respeta el guion. Además, la
// forma sin guion (clave) apunta al producto solo si ningún otro la reclama: así un pedido que trae "85210"
// encuentra "852-10" cuando es el único parecido, pero si existen los dos, cada uno se encuentra a sí mismo.
export function indiceSku(productos) {
  const m = new Map(), sueltas = new Map();
  const suelta = (c, p) => { if (c) sueltas.set(c, sueltas.has(c) && sueltas.get(c) !== p ? null : p); };
  productos.forEach((p) => { if (p.sku) { const k = claveSku(p.sku); if (!m.has(k)) m.set(k, p); suelta(clave(p.sku), p); } });
  productos.forEach((p) => { if (p.idProducto) { const k = claveSku(p.idProducto); if (!m.has(k)) m.set(k, p); if (!sueltas.has(clave(p.idProducto))) suelta(clave(p.idProducto), p); } });
  sueltas.forEach((p, c) => { if (p && !m.has(c)) m.set(c, p); });
  return m;
}
export const buscarSku = (indice, texto) => indice.get(claveSku(texto)) ?? indice.get(clave(texto)) ?? null;
// SKU base: el mismo producto con un sufijo de lote o promoción al final ("-R006940"). Darnel los maneja como
// SKUs distintos en el maestro, pero comparten el Bundle del producto base; sin esto, un "…V-R006940" se
// cargaba suelto porque su código exacto no está en la hoja Bundles.
export const SUFIJO_VARIANTE = /-r\d+$/i;
export const skuBase = (texto) => { const s = String(texto ?? "").trim(); return SUFIJO_VARIANTE.test(s) ? s.replace(SUFIJO_VARIANTE, "") : ""; };
// Tabla de conversiones de un SKU. Las guardadas antes de claveSku quedaron con la llave sin guion.
export const conversionDe = (conversiones, sku) => conversiones?.[claveSku(sku)] ?? conversiones?.[clave(sku)];

export const siNo = (v, def) => (v === undefined || v === null || String(v).trim() === "" ? def : ["si", "s", "yes", "y", "1", "true", "x", "verdadero"].includes(clave(v)));
export const numero = (v, def = 0) => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : def; };

// Filas de una hoja como objetos con claves normalizadas. El encabezado es la primera fila que tenga SKU, Nombre o Código.
export function hojaAObjetos(ws) {
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const hi = filas.findIndex((f) => f.some((c) => ["sku", "nombre", "codigo"].includes(clave(c))));
  if (hi < 0) return [];
  const heads = filas[hi].map(clave);
  return filas.slice(hi + 1).filter((f) => f.some((c) => String(c).trim() !== "")).map((f) => { const o = {}; heads.forEach((h, i) => { if (h && o[h] === undefined) o[h] = f[i]; }); return o; });
}
export const buscarHoja = (wb, nombres) => { for (const n of wb.SheetNames) if (nombres.includes(clave(n))) return wb.Sheets[n]; return null; };

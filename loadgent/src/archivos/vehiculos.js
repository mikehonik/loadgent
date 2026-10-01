// ================= Catálogo de vehículos =================
// El catálogo de vehículos vive en su propio Excel (maestro_vehiculos.xlsx), igual que el de
// productos: lo administra el proveedor y el cliente solo elige de la lista. Cada vehículo trae
// placa, transportadora, medidas internas, peso máximo y, si se conoce, los límites por eje.
import * as XLSX from "xlsx";
import { escribirXlsx } from "./escribir.js";
import { clave, siNo, numero, hojaAObjetos, buscarHoja } from "./celdas.js";
import { VEHICULOS } from "../ui/referencia.js";
import { factorColumna, encabezadoEn, SISTEMAS } from "../unidades.js";

export const ARCHIVO_VEHICULOS = "maestro_vehiculos.xlsx";
export const COLS_VEHICULOS = ["Nombre", "Placa", "Transportadora", "Largo interior (mm)", "Ancho interior (mm)", "Alto interior (mm)", "Tara (kg)", "Peso bruto máx. (kg)",
  "Eje delantero máx. (kg)", "Eje trasero máx. (kg)", "Distancia entre ejes (mm)", "Eje delantero desde el frente de la caja (mm)", "Tara en eje delantero (kg)", "Tara en eje trasero (kg)"];

export const AYUDA_VEHICULOS = [
  ["Catálogo de vehículos", "Nombre", "Cómo se ve en la lista al elegir vehículo. Si hay varios con el mismo nombre (por ejemplo, la misma ruta con distintas placas), se distinguen por la placa.", "Tráiler 53'", "Obligatorio"],
  ["Catálogo de vehículos", "Placa y Transportadora", "Identifican la unidad real. Solo son datos de referencia; no afectan el cálculo.", "AB-1234 · Transportes del Norte", "Se deja en blanco"],
  ["Catálogo de vehículos", "Largo, Ancho, Alto interior (mm)", "El espacio real de carga, no las medidas exteriores del vehículo.", "16000 · 2500 · 2700", "Obligatorio"],
  ["Catálogo de vehículos", "Tara (kg)", "Peso del vehículo vacío.", "6500", "0"],
  ["Catálogo de vehículos", "Peso bruto máx. (kg)", "Lo que puede pesar el vehículo cargado, tara incluida.", "36500", "0 = sin límite"],
  ["Catálogo de vehículos", "Eje delantero / trasero máx. (kg)", "Lo que puede cargar cada eje según la tarjeta de circulación o la norma vial. Deja ambos en 0 si no vas a validar por eje: la herramienta no calcula nada y no estorba.", "5443 · 22662", "0 = no se calcula"],
  ["Catálogo de vehículos", "Distancia entre ejes (mm)", "De centro a centro del eje delantero al trasero (o al centro del grupo de ejes traseros).", "14900", "Obligatorio si vas a usar ejes"],
  ["Catálogo de vehículos", "Eje delantero desde el frente de la caja (mm)", "Dónde queda el eje delantero respecto al inicio del espacio de carga. Casi siempre es negativo, porque el eje queda antes de la caja (bajo la cabina).", "-1400", "0"],
  ["Catálogo de vehículos", "Tara en eje delantero / trasero (kg)", "Cómo se reparte el peso vacío entre los dos ejes. Si dejas ambos en 0, se asume mitad y mitad.", "6200 · 300", "0 = mitad y mitad"],
  ["Catálogo de vehículos", "El cálculo de eje es una estimación", "Reparte cada caja entre los dos ejes según qué tan cerca está de cada uno (el mismo principio que una báscula de reparto en patio). Sirve para avisar a tiempo, no sustituye pesar el vehículo.", "—", "—"],
];

export function vehiculoVacio(d = {}) {
  return { id: "V" + Math.random().toString(36).slice(2, 8), nombre: "", placa: "", transportadora: "", L: 0, W: 0, H: 0, tara: 0, maxKg: 0,
    ejeDelantero: 0, ejeTrasero: 0, xEjeDelantero: 0, xEjeTrasero: 0, taraDelantera: 0, taraTrasera: 0, propio: true, ...d };
}

// Lee maestro_vehiculos.xlsx. Devuelve { vehiculos, errores }, siempre en mm y kg: cada columna se
// convierte según la unidad de su encabezado ("Largo interior (in)", "Tara (lb)") o la elegida al subir.
export function leerVehiculos(buf, unidades = "auto") {
  const wb = XLSX.read(buf, { type: "array" });
  const hv = buscarHoja(wb, ["vehiculos", "flota", "maestrodevehiculos"]) || wb.Sheets[wb.SheetNames[0]];
  const vehiculos = [], errores = [], vistos = new Set();
  const cabeza = (XLSX.utils.sheet_to_json(hv, { header: 1, defval: "", blankrows: false }).find((f) => f.some((c) => ["sku", "nombre", "codigo"].includes(clave(c)))) || []).map(String);
  const fac = {}; cabeza.forEach((h) => { fac[clave(h)] = factorColumna(h, /\(\s*(kg|lb|lbs|libras|g|t|ton)\b/i.test(h) || /tara|peso|eje(delantero|trasero)max/.test(clave(h)) ? "peso" : "largo", unidades); });
  const num0 = (o, k) => Math.round(numero(o[k]) * (fac[k] ?? 1));
  hojaAObjetos(hv).forEach((o) => {
    const nombre = String(o.nombre ?? o.tipo ?? "").trim();
    if (!nombre) return;
    const placa = String(o.placa ?? "").trim();
    const llave = clave(nombre + "|" + placa);
    if (vistos.has(llave)) { errores.push(`${nombre}${placa ? " (" + placa + ")" : ""} está repetido; se usa la primera fila.`); return; }
    vistos.add(llave);
    const v = vehiculoVacio({
      nombre, placa, transportadora: String(o.transportadora ?? "").trim(),
      L: num0(o, "largointerior"), W: num0(o, "anchointerior"), H: num0(o, "altointerior"), tara: num0(o, "tara"), maxKg: num0(o, "pesobrutomax"),
      ejeDelantero: num0(o, "ejedelanteromax"), ejeTrasero: num0(o, "ejetraseromax"),
      xEjeDelantero: num0(o, "ejedelanterodesdeelfrentedelacaja"), xEjeTrasero: num0(o, "ejedelanterodesdeelfrentedelacaja") + num0(o, "distanciaentreejes"),
      taraDelantera: num0(o, "taraenejedelantero"), taraTrasera: num0(o, "taraenejetrasero"),
    });
    if (!(v.L > 0 && v.W > 0 && v.H > 0)) errores.push(`${nombre}: faltan medidas interiores (largo, ancho o alto).`);
    vehiculos.push(v);
  });
  return { vehiculos, errores };
}

export function libroVehiculos(vehiculos = [], sis = SISTEMAS.metrico) {
  const wb = XLSX.utils.book_new();
  const L = (v) => Math.round(((+v || 0) / sis.mmPorL) * 100) / 100, P = (v) => Math.round(((+v || 0) / sis.kgPorP) * 10) / 10;
  const filas = [COLS_VEHICULOS.map((h) => encabezadoEn(h, sis)), ...vehiculos.map((v) => [v.nombre, v.placa, v.transportadora, L(v.L), L(v.W), L(v.H), P(v.tara), P(v.maxKg),
    P(v.ejeDelantero), P(v.ejeTrasero), L(v.xEjeTrasero - v.xEjeDelantero), L(v.xEjeDelantero), P(v.taraDelantera), P(v.taraTrasera)])];
  const ws = XLSX.utils.aoa_to_sheet(filas);
  ws["!cols"] = COLS_VEHICULOS.map((h) => ({ wch: Math.max(12, h.length) }));
  ws["!autofilter"] = { ref: `A1:N${Math.max(2, vehiculos.length + 1)}` };
  XLSX.utils.book_append_sheet(wb, ws, "Vehículos");
  const wi = XLSX.utils.aoa_to_sheet([["Catálogo de vehículos · DarnelCube 3D"], [],
    ["Sección", "Campo", "Qué significa", "Ejemplo", "Si lo dejas vacío"], ...AYUDA_VEHICULOS]);
  wi["!cols"] = [{ wch: 24 }, { wch: 34 }, { wch: 80 }, { wch: 24 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wi, "Instrucciones");
  return escribirXlsx(wb);
}

// Catálogo de ejemplo: los vehículos que ya trae la herramienta por omisión.
export function plantillaVehiculos(sis = SISTEMAS.metrico) {
  return libroVehiculos(VEHICULOS.map((v) => vehiculoVacio(v)), sis);
}

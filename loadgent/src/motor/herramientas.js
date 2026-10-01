// ================= Herramientas de consulta =================
// Cálculos rápidos de un solo SKU o del maestro completo, para la pestaña Herramientas. Todo es puro y en
// mm y kg; la pantalla convierte al mostrar.
import { claveSku } from "../archivos/celdas.js";
import { tieneBundle } from "../archivos/bundle.js";
import { capacidadSuelta, configuracionPallet, capacidadPalletCompleto } from "./motor.js";
import { fleteTotal } from "../archivos/flete.js";

// ---------- Calidad del maestro ----------
// Revisa lo que suele estar mal capturado y hace que un cálculo salga mal sin que nadie lo note.
// Densidad en kg/m³: el plástico macizo anda en 900 a 2,000 (una lámina de PVC con carga, cerca de 2,000) y
// el acero en 7,850. Arriba de 2,500 o abajo de 10 casi siempre es un peso o una medida mal capturada.
export const LIMITES_DENSIDAD = { max: 2500, min: 10 };
// En Darnel, los SKUs de manufactura propia empiezan con DU y casi siempre se despachan en Bundle. Si uno de
// esos no tiene su Bundle capturado, se carga suelto sin que nadie lo note, y el cubicaje sale distinto al real.
export const PREFIJOS_BUNDLE = ["DU"];
export const esDeManufactura = (sku) => PREFIJOS_BUNDLE.some((x) => String(sku || "").trim().toUpperCase().startsWith(x));
export function auditarMaestro(productos, pallets = [], vehiculos = []) {
  const nombresPallet = new Set(pallets.map((p) => String(p.nombre).trim().toLowerCase()));
  const mayor = vehiculos.reduce((m, v) => [Math.max(m[0], v.L || 0), Math.max(m[1], v.W || 0), Math.max(m[2], v.H || 0)], [0, 0, 0]).sort((a, b) => b - a);
  const reglas = [
    { id: "cero", nombre: "Medidas en cero o vacías", descripcion: "Sin largo, ancho o alto el SKU no se puede acomodar.", prueba: (p) => !(p.L > 0 && p.W > 0 && p.H > 0) },
    { id: "relleno", nombre: "Medidas de relleno", descripcion: "Las tres medidas menores a 30 mm (por ejemplo 10 × 10 × 10): parece un dato «sin capturar».", prueba: (p) => p.L > 0 && Math.max(p.L, p.W, p.H) < 30 },
    { id: "peso", nombre: "Peso en cero o vacío", descripcion: "Sin peso no se revisa el máximo del vehículo ni la resistencia.", prueba: (p) => !(p.peso > 0) },
    { id: "pesado", nombre: "Demasiado pesado para su tamaño", descripcion: `Más de ${LIMITES_DENSIDAD.max.toLocaleString("es-MX")} kg por m³: revisa el peso o las unidades (¿gramos? ¿cm?).`, prueba: (p) => p.L > 0 && p.W > 0 && p.H > 0 && p.peso > 0 && Math.max(p.L, p.W, p.H) >= 30 && p.peso / ((p.L * p.W * p.H) / 1e9) > LIMITES_DENSIDAD.max },
    { id: "ligero", nombre: "Demasiado ligero para su tamaño", descripcion: `Menos de ${LIMITES_DENSIDAD.min} kg por m³: revisa las medidas (¿cm capturados como mm?).`, prueba: (p) => p.L > 0 && p.W > 0 && p.H > 0 && p.peso > 0 && Math.max(p.L, p.W, p.H) >= 30 && p.peso / ((p.L * p.W * p.H) / 1e9) < LIMITES_DENSIDAD.min },
    { id: "grande", nombre: "No cabe en ningún vehículo", descripcion: "Alguna medida es mayor que el vehículo más grande del catálogo.", prueba: (p) => mayor[0] > 0 && [p.L, p.W, p.H].sort((a, b) => b - a).some((d, i) => d > mayor[i]) },
    { id: "duSinBundle", nombre: `Empieza con ${PREFIJOS_BUNDLE.join(" o ")} y no tiene Bundle`, descripcion: "Por su código parece de manufactura propia, pero no está en la hoja Bundles: se cargará suelto. Captura sus cajas por Bundle y medidas, o confirma que de verdad va suelto.", prueba: (p) => esDeManufactura(p.sku) && !tieneBundle(p) },
    { id: "orientacion", nombre: "Sin orientación permitida", descripcion: "No tiene ninguna forma de acomodarse marcada.", prueba: (p) => Array.isArray(p.oris) && !p.oris.some(Boolean) },
    { id: "pallet", nombre: "Pallet que no existe", descripcion: "Se paletiza en un pallet que no está en el catálogo (se usará el primero).", prueba: (p) => p.paletizar && p.tarima && !nombresPallet.has(String(p.tarima).trim().toLowerCase()) },
  ];
  const vistos = new Map(), duplicados = [];
  productos.forEach((p) => { const k = claveSku(p.sku); if (vistos.has(k)) duplicados.push(p); else vistos.set(k, p); });
  const resultado = reglas.map(({ prueba, ...r }) => ({ ...r, skus: productos.filter(prueba) }));
  resultado.push({ id: "duplicado", nombre: "SKU repetido", descripcion: "El mismo código aparece más de una vez; se usa el primero.", skus: duplicados });
  const conProblema = new Set(resultado.flatMap((r) => r.skus.map((p) => p.pid ?? p.sku)));
  return { reglas: resultado, total: productos.length, conProblema: conProblema.size };
}

// ---------- Comparar pallets ----------
// Para un SKU ya preparado para el motor: cómo queda en cada pallet del catálogo y, si se da un vehículo,
// cuántas cajas lleva el vehículo con ese pallet. Gana el que más cajas mete al vehículo (o al pallet, sin vehículo).
export function compararPallets(it, pallets, reglas, veh) {
  const filas = pallets.map((pal, i) => {
    const def = configuracionPallet(it, pal, reglas);
    if (!def) return { i, pal, def: null };
    const enVeh = veh && veh.L > 0 ? capacidadPalletCompleto({ ...it, porPallet: 0, porCapa: 0, capasPallet: 0 }, pal, veh, reglas) : null;
    return { i, pal, def, superficie: (def.L * def.W) / (pal.L * pal.W), pallets: enVeh?.pallets ?? null, cajasVehiculo: enVeh?.cajasTotales ?? null };
  });
  const clave = (f) => (f.def ? (f.cajasVehiculo ?? f.def.n) : -1);
  const mejor = filas.reduce((m, f) => (clave(f) > clave(m) ? f : m), filas[0]);
  if (mejor?.def) mejor.mejor = true;
  return filas;
}

// ---------- Vehículos necesarios para una cantidad ----------
// Capacidad de cada vehículo para el SKU (suelto o en pallets completos) y cuántos hacen falta para la
// cantidad pedida; con tarifas, el flete total y por caja. Ordena por menos flete, luego menos vehículos.
export function vehiculosNecesarios(it, cantidad, vehiculos, reglas, { modo = "suelto", pallet = null, tarifas = [], destino = "" } = {}) {
  const filas = vehiculos.filter((v) => v.L > 0 && v.W > 0 && v.H > 0).map((v0) => {
    const v = { ...v0, maxVolPct: v0.maxVolPct || 0, maxSkus: v0.maxSkus || 0, maxPiezas: v0.maxPiezas || 0 };
    let cap = 0, detalle = null;
    if (modo === "pallets" && pallet) { const r = capacidadPalletCompleto(it, pallet, v, reglas); cap = r ? r.cajasTotales : 0; detalle = r ? { pallets: r.pallets, porPallet: r.cajasPorPallet } : null; }
    else { const r = capacidadSuelta(it, v, reglas); cap = r.cajas; }
    if (!(cap > 0)) return { v, cap: 0, vehiculos: null };
    const n = Math.ceil(cantidad / cap), resto = cantidad - cap * (n - 1);
    const volV = v.L * v.W * v.H, volCaja = it.L * it.W * it.H;
    const contenedores = Array.from({ length: n }, (_, i) => { const c = i === n - 1 ? resto : cap; return { ocupacion: (c * volCaja / volV) * 100, peso: c * (it.peso || 0), m3: (c * volCaja) / 1e9 }; });
    const f = tarifas.length ? fleteTotal(tarifas, v.id, destino, contenedores) : null;
    return { v, cap, detalle, vehiculos: n, ultimoPct: (resto / cap) * 100, flete: f?.total ?? null, moneda: f?.moneda ?? "MXN", porCaja: f ? f.total / cantidad : null };
  });
  filas.sort((a, b) => (a.vehiculos == null) - (b.vehiculos == null)
    || (a.flete != null && b.flete != null ? a.flete - b.flete : (a.flete != null ? -1 : 0) - (b.flete != null ? -1 : 0))
    || (a.vehiculos ?? 0) - (b.vehiculos ?? 0) || b.ultimoPct - a.ultimoPct);
  if (filas[0]?.vehiculos) filas[0].mejor = true;
  return filas;
}

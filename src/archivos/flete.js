// ================= Flete =================
// Tarifario simple: una fila por vehículo (y opcionalmente por destino), con el método de cobro
// que use ese proveedor. Cada proveedor cobra distinto, así que los cuatro métodos conviven.
export const METODOS_FLETE = [
  ["vehiculo", "Por vehículo completo", "Tarifa fija por viaje"],
  ["ocupacion", "Por % ocupado", "Tarifa × (ocupación del volumen ÷ 100)"],
  ["peso", "Por peso cargado", "Tarifa por kilo × peso de la carga"],
  ["volumen", "Por volumen cargado", "Tarifa por m³ × volumen cargado"],
];

export function tarifaVacia(d = {}) {
  return { id: "T" + Math.random().toString(36).slice(2, 8), vehiculo: "", destino: "", metodo: "vehiculo", tarifa: 0, moneda: "MXN", ...d };
}

// Busca la tarifa más específica para este vehículo y destino: primero vehículo+destino exactos,
// luego vehículo con destino en blanco (aplica a cualquier destino).
function buscarTarifa(tarifas, vehiculoId, destino) {
  const d = String(destino ?? "").trim().toLowerCase();
  const exacta = tarifas.find((t) => t.vehiculo === vehiculoId && String(t.destino ?? "").trim().toLowerCase() === d && d);
  if (exacta) return exacta;
  return tarifas.find((t) => t.vehiculo === vehiculoId && !String(t.destino ?? "").trim()) || null;
}

// contenedor: { ocupacion (0-100), peso (kg), m3 }. Devuelve null si no hay tarifa para ese vehículo/destino.
export function calcularFlete(tarifas, vehiculoId, destino, contenedor) {
  const t = buscarTarifa(tarifas, vehiculoId, destino);
  if (!t) return null;
  const monto = t.metodo === "ocupacion" ? t.tarifa * (contenedor.ocupacion / 100)
    : t.metodo === "peso" ? t.tarifa * contenedor.peso
    : t.metodo === "volumen" ? t.tarifa * contenedor.m3
    : t.tarifa;
  return { total: Math.round(monto * 100) / 100, metodo: t.metodo, tarifaUsada: t.tarifa, moneda: t.moneda || "MXN", destino: t.destino };
}

// Suma el flete de todos los vehículos de una corrida (mismo vehículo, mismo destino en cada uno).
export function fleteTotal(tarifas, vehiculoId, destino, contenedores) {
  const porVehiculo = contenedores.map((c) => calcularFlete(tarifas, vehiculoId, destino, c));
  if (porVehiculo.some((f) => f === null)) return null;
  const total = porVehiculo.reduce((a, f) => a + f.total, 0);
  return { total: Math.round(total * 100) / 100, porVehiculo, moneda: porVehiculo[0]?.moneda || "MXN" };
}

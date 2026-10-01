// ================= Datos de referencia =================
// Vehículos, tarimas y reglas de fábrica, más las cargas de ejemplo del menú Ejemplos.
// Ejes: xEjeDelantero/xEjeTrasero son la posición de cada eje en mm, medidos desde el frente de la
// caja de carga (pueden ser negativos si el eje queda antes del inicio de la caja). ejeDelantero/
// ejeTrasero son el máximo permitido en cada eje (kg); 0 = no se calcula. taraDelantera/taraTrasera
// reparten el peso vacío del vehículo; si ambas quedan en 0, se asume mitad y mitad.
export const VEHICULOS = [
  { id: "20DC", nombre: "Contenedor 20' DC", L: 5898, W: 2352, H: 2393, tara: 2200, maxKg: 30480, ejeDelantero: 0, ejeTrasero: 0, xEjeDelantero: 0, xEjeTrasero: 0, taraDelantera: 0, taraTrasera: 0, placa: "", transportadora: "" },
  { id: "40DC", nombre: "Contenedor 40' DC", L: 12032, W: 2352, H: 2393, tara: 3750, maxKg: 30480, ejeDelantero: 0, ejeTrasero: 0, xEjeDelantero: 0, xEjeTrasero: 0, taraDelantera: 0, taraTrasera: 0, placa: "", transportadora: "" },
  { id: "40HC", nombre: "Contenedor 40' HC", L: 12032, W: 2352, H: 2698, tara: 3900, maxKg: 30480, ejeDelantero: 0, ejeTrasero: 0, xEjeDelantero: 0, xEjeTrasero: 0, taraDelantera: 0, taraTrasera: 0, placa: "", transportadora: "" },
  { id: "53CS", nombre: "Tráiler caja seca 53'", L: 16000, W: 2500, H: 2700, tara: 6500, maxKg: 36500, ejeDelantero: 5443, ejeTrasero: 22662, xEjeDelantero: -1400, xEjeTrasero: 13500, taraDelantera: 0, taraTrasera: 0, placa: "", transportadora: "" },
  { id: "TOR", nombre: "Torton", L: 7300, W: 2450, H: 2450, tara: 1500, maxKg: 15500, ejeDelantero: 6000, ejeTrasero: 10000, xEjeDelantero: -900, xEjeTrasero: 6200, taraDelantera: 0, taraTrasera: 0, placa: "", transportadora: "" },
  { id: "RAB", nombre: "Rabón", L: 5500, W: 2400, H: 2300, tara: 1100, maxKg: 9100, ejeDelantero: 3300, ejeTrasero: 5800, xEjeDelantero: -700, xEjeTrasero: 4600, taraDelantera: 0, taraTrasera: 0, placa: "", transportadora: "" },
  // Cajas secas de EE.UU. (medidas interiores de Darnel: 1,615.40 / 1,447.80 × 248.90 × 279.40 cm). Tara y carga
  // útil son valores típicos de la industria (≈15,000 lb vacío, ≈45,000 lb de carga): ajústalos a la flota real.
  { id: "53DV", nombre: "53FT-DryVan", L: 16154, W: 2489, H: 2794, tara: 6800, maxKg: 27200, ejeDelantero: 0, ejeTrasero: 0, xEjeDelantero: 0, xEjeTrasero: 0, taraDelantera: 0, taraTrasera: 0, placa: "", transportadora: "" },
  { id: "48DV", nombre: "48FT-DryVan", L: 14478, W: 2489, H: 2794, tara: 6400, maxKg: 26800, ejeDelantero: 0, ejeTrasero: 0, xEjeDelantero: 0, xEjeTrasero: 0, taraDelantera: 0, taraTrasera: 0, placa: "", transportadora: "" },
];
// Carga máxima de 1,500 kg en los tres: con 1,200 kg el peso recortaba pallets que en planta sí se arman
// completos (un SKU de 22 kg se quedaba en 54 cajas en lugar de 60). Cada quien la ajusta en Paletizado.
// Sobresaliente de 15 mm por lado: en planta la caja nunca queda exactamente al ras de la tarima.
// autoAltura: si el estándar del maestro (cajas por pallet o niveles) no cabe en la altura del catálogo,
// se arma contra el techo del vehículo. La lógica: si en planta arman más alto que la altura de catálogo,
// la que está mal es la altura del catálogo, no el estándar. Si el estándar sí cabe, se respeta el tope.
export const PALLETS_INICIALES = [
  { nombre: "Americano 1219×1016", L: 1219, W: 1016, esp: 150, peso: 25, altMax: 1800, maxKg: 1500, ovL: 15, ovW: 15, autoAltura: true },
  { nombre: "Universal 1200×1000", L: 1200, W: 1000, esp: 150, peso: 25, altMax: 1800, maxKg: 1500, ovL: 15, ovW: 15, autoAltura: true },
  { nombre: "Europeo 1200×800", L: 1200, W: 800, esp: 144, peso: 25, altMax: 1800, maxKg: 1500, ovL: 15, ovW: 15, autoAltura: true },
];
// Versión del estado guardado (cuenta y escenarios). Sube cuando cambia un valor de fábrica que hay que
// llevarle a lo que la gente ya tiene guardado.
export const VERSION_ESTADO = 3;
// Un catálogo de pallets guardado antes de la v1.6.5 trae sobresaliente 0 porque ese era el valor de
// fábrica de entonces, no porque alguien lo haya elegido. Al abrirlo se le pone el estándar de 15 mm por
// lado, solo donde está en 0: si alguien capturó otro número, ese manda. Así todos quedan con el mismo
// pallet sin tener que tocarlo uno por uno. «Subir hasta el techo» no hace falta migrarla: los pallets
// guardados no traen la bandera y el motor la lee como encendida.
export const palletsAlDia = (pallets, v) => {
  if (!pallets?.length) return null;
  if ((v || 1) >= VERSION_ESTADO) return pallets;
  return pallets.map((t) => ({ ...t, ovL: t.ovL > 0 ? t.ovL : 15, ovW: t.ovW > 0 ? t.ovW : 15 }));
};

export const REGLAS_APILAR = [
  ["ninguna", "Sin regla adicional"], ["valorMayorAbajo", "Prioridad mayor va abajo"], ["mismoValor", "Solo sobre la misma prioridad"],
  ["masPesadoAbajo", "La caja más pesada va abajo"], ["mismaHuella", "Solo sobre una caja de la misma huella"],
  ["mismaCategoria", "Solo sobre la misma categoría"],
];
export const NIVELES = [[1, "1 · Rápido (≈2 s)"], [2, "2 · Balanceado (≈5 s)"], [3, "3 · Profundo (≈12 s)"], [4, "4 · Máximo (≈25 s)"]];
// Qué tanto se pueden abrir los Bundles al cubicar (ver motor/corrida.js)
export const ABRIR_BUNDLES = [
  ["llenar", "Para ahorrar vehículo y para llenar"],
  ["ahorrar", "Solo si ahorra un vehículo completo"],
  ["nunca", "Nunca: los Bundles viajan enteros"],
];
export const RESTOS = [["parcial", "Pallet incompleto"], ["sueltas", "Cargar sueltas"], ["mixto", "Pallet mixto con otros sobrantes"]];


let sig = 1;
export const nuevoItem = (d = {}) => ({
  id: sig++, nombre: "SKU", L: 600, W: 400, H: 400, peso: 10, qty: 50, oris: [true, true, false, false, false, false], volteoPiso: false, compresion: 0,
  maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0, piso: "libre", soportaEncima: true, umCaja: "CJ", grupo: "", orden: 0, piezas: 1, qtyPedido: 0, umPedido: "",
  forma: "caja", diametro: 0, anidado: 0, maxAnidado: 0, categoria: "", paletizar: false, palletId: 0, porPallet: 0, porCapa: 0, capasPallet: 0, destino: "", resto: "parcial", aceptaCajas: true, aceptaPallet: false, ...d,
});
export const EJEMPLOS = {
  whitepaper: {
    nombre: "Referencia: 3 SKUs en 20'", veh: "20DC", vehExtra: { L: 5890, W: 2350, H: 2370, tara: 0, maxKg: 0 },
    items: () => [nuevoItem({ nombre: "K", L: 552, W: 502, H: 324, peso: 1, qty: 250 }), nuevoItem({ nombre: "KL", L: 552, W: 251, H: 324, peso: 1, qty: 623 }), nuevoItem({ nombre: "KW", L: 502, W: 276, H: 324, peso: 1, qty: 450 })],
  },
  pallets: {
    nombre: "Pallets + cajas sueltas en 53'", veh: "53CS",
    items: () => [
      nuevoItem({ nombre: "Vaso 8oz", L: 400, W: 300, H: 350, peso: 7, qty: 130, categoria: "Vasos", paletizar: true, porPallet: 24, resto: "mixto" }),
      nuevoItem({ nombre: "Vaso 12oz", L: 400, W: 300, H: 400, peso: 8, qty: 75, categoria: "Vasos", paletizar: true, porPallet: 20, resto: "mixto", aceptaPallet: true }),
      nuevoItem({ nombre: "Plato hondo 18cm", L: 450, W: 350, H: 300, peso: 9, qty: 90, categoria: "Platos", paletizar: true, porPallet: 30 }),
      nuevoItem({ nombre: "Cubiertos (kit)", L: 350, W: 250, H: 200, peso: 5, qty: 60, umCaja: "BL", paletizar: "mixto" }),
      nuevoItem({ nombre: "Película", L: 500, W: 150, H: 150, peso: 3, qty: 30, umCaja: "RL" }),
      nuevoItem({ nombre: "Desechables varios", L: 500, W: 400, H: 250, peso: 6, qty: 25, paletizar: "mixto" }),
    ],
  },
  tiendas: {
    nombre: "Ruta de 3 entregas (pedidos)", veh: "53CS", reglas: { usarOrden: true, agrupar: true, apilamiento: "valorMayorAbajo" },
    items: () => {
      const cajas = [["Vaso 8oz", 400, 300, 350, 7, "Vasos"], ["Vaso 12oz", 400, 300, 400, 8, "Vasos"], ["Plato hondo 18cm", 450, 350, 300, 9, "Platos"], ["Cubiertos (kit)", 350, 250, 200, 5, ""], ["Desechables varios", 500, 400, 250, 6, ""]];
      const r = [];
      ["CD Norte", "CD Centro", "CD Sur"].forEach((t, ti) => cajas.forEach(([n, L, W, H, p, cat], ci) =>
        r.push(nuevoItem({ nombre: `${n} ${t}`, L, W, H, peso: p, categoria: cat, qty: 25 + ((ti * 7 + ci * 11) % 30), grupo: `PED-44${71 + ti} ${t}`, orden: ti + 1, valorApilar: p > 6 ? 2 : 1 }))));
      return r;
    },
  },
  ranking: {
    nombre: "Orden parcial: 1, 2, 3 y libres", veh: "53CS",
    items: () => [
      nuevoItem({ nombre: "Parada 1 · Vaso 12oz", L: 400, W: 300, H: 400, peso: 8, qty: 60, categoria: "Vasos", orden: 1 }),
      nuevoItem({ nombre: "Parada 1 · Cubiertos (kit)", L: 350, W: 250, H: 200, peso: 5, qty: 80, umCaja: "BL", orden: 1 }),
      nuevoItem({ nombre: "Parada 2 · Plato hondo 18cm", L: 450, W: 350, H: 300, peso: 9, qty: 90, categoria: "Platos", orden: 2 }),
      nuevoItem({ nombre: "Parada 3 · Desechables varios", L: 500, W: 400, H: 250, peso: 6, qty: 30, orden: 3 }),
      nuevoItem({ nombre: "Libre · Película", L: 500, W: 150, H: 150, peso: 3, qty: 70, umCaja: "RL" }),
      nuevoItem({ nombre: "Libre · Vaso 8oz", L: 400, W: 300, H: 350, peso: 7, qty: 50, categoria: "Vasos" }),
    ],
  },
  palletMixto: {
    nombre: "Diseñar un pallet mixto", veh: "PAL:0",
    items: () => [nuevoItem({ nombre: "Desechables varios", L: 500, W: 400, H: 250, peso: 6, qty: 6 }), nuevoItem({ nombre: "Plato hondo 18cm", L: 450, W: 350, H: 300, peso: 9, qty: 10, categoria: "Platos" }), nuevoItem({ nombre: "Vaso 8oz", L: 400, W: 300, H: 350, peso: 7, qty: 14, categoria: "Vasos" })],
  },
};

// ================= Unidades de medida =================
// Por dentro TODO se guarda y se calcula en milímetros y kilogramos: el motor, el maestro en la nube y
// los escenarios. Las unidades americanas solo existen en la orilla: al mostrar, al capturar, al leer un
// archivo y al escribirlo. Así cambiar de sistema nunca cambia un resultado, solo cómo se ve.

const MM_POR_IN = 25.4, KG_POR_LB = 0.45359237, MM3_POR_FT3 = 304.8 ** 3;

export const SISTEMAS = {
  metrico: { id: "metrico", nombre: "Métrico", corto: "mm · kg", l: "mm", p: "kg", v: "m³", d: "m", mmPorL: 1, kgPorP: 1, mm3PorV: 1e9, mmPorD: 1000, decL: 1, decD: 2 },
  americano: { id: "americano", nombre: "Americano", corto: "in · lb", l: "in", p: "lb", v: "ft³", d: "ft", mmPorL: MM_POR_IN, kgPorP: KG_POR_LB, mm3PorV: MM3_POR_FT3, mmPorD: 304.8, decL: 2, decD: 1 },
};

const red = (v, dec) => { const f = 10 ** dec; return Math.round(v * f) / f; };
const num = (v, dec) => v.toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: dec });

// Objeto de trabajo para un sistema. Convención de nombres:
//   L(mm) → número en la unidad de largo del sistema     aMm(x) → de vuelta a mm
//   P(kg) → número en la unidad de peso                   aKg(x) → de vuelta a kg
//   fL / fP / fV / fD → texto ya formateado con su unidad (fV recibe mm³; fV3 recibe m³; fD recibe mm)
export function unidadesDe(id) {
  const s = SISTEMAS[id] || SISTEMAS.metrico;
  return {
    ...s,
    // Tres decimales al mostrar en una captura: suficiente para pulgadas y estable al ir y volver.
    L: (mm) => red((+mm || 0) / s.mmPorL, 3), aMm: (x) => (+x || 0) * s.mmPorL,
    P: (kg) => red((+kg || 0) / s.kgPorP, 3), aKg: (x) => (+x || 0) * s.kgPorP,
    V: (mm3) => (+mm3 || 0) / s.mm3PorV,
    D: (mm) => (+mm || 0) / s.mmPorD,
    fL: (mm, dec = s.decL) => `${num((+mm || 0) / s.mmPorL, dec)} ${s.l}`,
    fP: (kg, dec = 0) => `${num((+kg || 0) / s.kgPorP, dec)} ${s.p}`,
    fV: (mm3, dec = 2) => `${num((+mm3 || 0) / s.mm3PorV, dec)} ${s.v}`,
    fV3: (m3, dec = 2) => `${num(((+m3 || 0) * 1e9) / s.mm3PorV, dec)} ${s.v}`,
    fD: (mm, dec = s.decD) => `${num((+mm || 0) / s.mmPorD, dec)} ${s.d}`,
    // Tres medidas juntas: "600 × 400 × 400 mm"
    fLLL: (a, b, c, dec = s.decL) => `${[a, b, c].map((v) => num((+v || 0) / s.mmPorL, dec)).join(" × ")} ${s.l}`,
    fLL: (a, b, dec = s.decL) => `${[a, b].map((v) => num((+v || 0) / s.mmPorL, dec)).join(" × ")} ${s.l}`,
  };
}

// ---------- Unidades de un archivo ----------
// Al leer un Excel, cada columna de medida puede traer su unidad en el encabezado: "Largo (in)",
// "Peso (lb)", "Alto (cm)". Si el usuario eligió una unidad al subirlo, esa manda sobre todo; si eligió
// "detectar", manda el encabezado, y sin unidad en el encabezado se asume mm y kg (el formato de siempre).
export const UNIDADES_ARCHIVO = [
  ["auto", "Detectar por encabezados (mm y kg si no dice)"],
  ["mm-kg", "Milímetros y kilogramos"],
  ["cm-kg", "Centímetros y kilogramos"],
  ["m-kg", "Metros y kilogramos"],
  ["in-lb", "Pulgadas y libras"],
];
const LARGO = { mm: 1, cm: 10, m: 1000, in: MM_POR_IN, pulg: MM_POR_IN, pulgadas: MM_POR_IN, inch: MM_POR_IN, inches: MM_POR_IN, '"': MM_POR_IN, ft: 304.8, pie: 304.8, pies: 304.8 };
const PESO = { kg: 1, g: 0.001, lb: KG_POR_LB, lbs: KG_POR_LB, libras: KG_POR_LB, t: 1000, ton: 1000 };
const ELEGIDA = { "mm-kg": [1, 1], "cm-kg": [10, 1], "m-kg": [1000, 1], "in-lb": [MM_POR_IN, KG_POR_LB] };

// Unidad escrita en un encabezado, en minúsculas: "Largo (in)" → "in"; "Peso [lb]" → "lb".
export function unidadDeEncabezado(h) {
  const m = String(h ?? "").match(/[([]\s*([^)\]]+?)\s*[)\]]/);
  return m ? m[1].trim().toLowerCase().split(/\s+/)[0] : "";   // "(mm por lado)" → "mm"
}

// Factor a mm (clase "largo") o a kg (clase "peso") para una columna, según su encabezado y la elección
// del usuario. Devuelve 1 si no hay nada que convertir.
export function factorColumna(encabezado, clase, elegida = "auto") {
  if (ELEGIDA[elegida]) return clase === "peso" ? ELEGIDA[elegida][1] : ELEGIDA[elegida][0];
  const u = unidadDeEncabezado(encabezado);
  if (clase === "peso") return PESO[u] ?? 1;
  return LARGO[u] ?? 1;
}

// Qué unidad se detectó en un conjunto de encabezados, para avisarle al usuario ("pulgadas y libras").
export function describirUnidades(encabezados, elegida = "auto") {
  if (ELEGIDA[elegida]) return UNIDADES_ARCHIVO.find((u) => u[0] === elegida)[1].toLowerCase();
  const us = new Set(encabezados.map(unidadDeEncabezado).filter(Boolean));
  const l = [...us].find((u) => LARGO[u] !== undefined && u !== "m3"), p = [...us].find((u) => PESO[u] !== undefined);
  const nomL = { mm: "milímetros", cm: "centímetros", m: "metros", in: "pulgadas", pulg: "pulgadas", ft: "pies" }[l] || "milímetros";
  const nomP = { kg: "kilogramos", lb: "libras", lbs: "libras", g: "gramos" }[p] || "kilogramos";
  return `${nomL} y ${nomP}`;
}

// Encabezado de un archivo que se descarga, en el sistema del usuario: "Largo (mm)" → "Largo (in)".
export function encabezadoEn(h, sis) {
  if (sis.id === "metrico") return h;
  return String(h).replace(/\(mm\)/g, `(${sis.l})`).replace(/\(kg\)/g, `(${sis.p})`).replace(/\(m³\)/g, `(${sis.v})`).replace(/\(m\)/g, `(${sis.d})`)
    .replace(/\bmm\b/g, sis.l).replace(/\bkg\b/g, sis.p);
}

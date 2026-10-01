// ================= Paletizado para fabricación =================
// La pregunta de fabricación no es «cuántas cajas caben» sino «qué patrón llega entero». Para un SKU, un
// pallet y una altura objetivo se arman varios patrones y cada uno se califica con semáforo:
//
//   · Columnas: todas las capas iguales. Aprovecha toda la resistencia de la caja (las esquinas cargan sobre
//     esquinas) pero las columnas no se amarran entre sí.
//   · Entrelazado: capas alternadas con otro acomodo, para que cada caja pise dos o más de abajo. Es más
//     estable, pero la esquina de la caja cae sobre el centro de la de abajo y la caja pierde resistencia.
//   · Híbrido: columnas abajo, donde se carga más peso, y las dos capas de arriba entrelazadas para amarrar.
//
// Indicadores (definiciones del NIST, «Metrics for Mixed Pallet Stacking», y de la literatura de pallet
// loading con entrelazado):
//   · Apoyo: qué parte de la base de cada caja descansa sobre algo. Se reporta el mínimo.
//   · Entrelazado: sobre cuántas cajas se apoya, en promedio, cada caja que no está en la primera capa
//     (1 = columnas; 2 o más = amarrado).
//   · Soporte lateral: % de cajas con vecinos (o el emplaye, en la orilla) en al menos 3 de sus 4 lados.
//   · Centro de gravedad: su altura contra la mitad del lado corto del pallet (con una aceleración lateral de
//     0.5 g, un pallet se vuelca si esa relación es menor que 0.5, que es una carga del doble de alto que su
//     lado corto) y su desviación del centro.
//   · Compresión: carga sobre la caja más cargada de la primera capa contra su resistencia (BCT del
//     laboratorio corregida por patrón, humedad, tiempo en almacén y sobresaliente, o el «peso máximo
//     encima» capturado en el maestro, que ya es un límite práctico).
import { patronCapa, orientacionesDe, definirPallet, alturasPila, cabenEnAlto, topeAnidado } from "./motor.js";

// Factores de referencia de la industria del cartón corrugado. Son punto de partida: cada planta debe
// ajustarlos con sus pruebas. El de entrelazado se aplica a la caja de abajo solo si la de encima no está
// alineada con ella (en columnas no aplica).
export const FACTORES = {
  patron: { columnas: 1, entrelazado: 0.55 },
  humedad: [["normal", "Normal (hasta 50% HR)", 1], ["media", "Húmeda (60 a 70% HR)", 0.8], ["alta", "Muy húmeda (80 a 90% HR)", 0.6]],
  tiempo: [["corto", "Menos de 10 días", 0.7], ["mes", "Hasta 1 mes", 0.6], ["trimestre", "Hasta 3 meses", 0.55], ["largo", "Más de 3 meses", 0.5]],
  sobresaliente: 0.75,
};
export const factorDe = (lista, id) => (FACTORES[lista].find((f) => f[0] === id) || FACTORES[lista][0])[2];

// Umbrales del semáforo
export const UMBRALES = {
  apoyoMin: 0.75,          // debajo: rojo (caja mal apoyada)
  entrelazado: 1.5,        // debajo: amarillo (columnas sueltas; depende del emplaye)
  lateral: 0.7,            // debajo: amarillo
  // relación (mitad del lado corto) / (altura del centro de gravedad). 0.5 equivale a una carga del doble de
  // alto que su lado corto, el límite práctico usual; con 0.5 g de aceleración lateral se vuelca justo ahí.
  vuelcoVerde: 0.5, vuelcoRojo: 0.4,
  desvVerde: 0.05, desvRojo: 0.10,
  margenVerde: 1.3, margenRojo: 1.0,          // con BCT corregido
  margenVerdePractico: 1.1,                   // con «peso máximo encima» (ya es un límite práctico)
};

const firma = (arr) => arr.map((p) => `${Math.round(p.x)},${Math.round(p.y)},${Math.round(p.l)}`).sort().join("|");
const extension = (pos) => { let bx = 0, by = 0; pos.forEach((p) => { bx = Math.max(bx, p.x + p.l); by = Math.max(by, p.y + p.w); }); return { bx, by }; };
const traslape = (a, b) => Math.max(0, Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y));
// Centra una capa dentro de la huella disponible
const centrar = (pos, CX, CY) => { const { bx, by } = extension(pos), ox = (CX - bx) / 2, oy = (CY - by) / 2; return pos.map((p) => ({ ...p, x: p.x + ox, y: p.y + oy })); };
// Apoyo mínimo de una capa sobre otra (ambas centradas)
const apoyoMin = (arriba, abajo) => arriba.reduce((m, e) => Math.min(m, abajo.reduce((s, p) => s + traslape(e, p), 0) / (e.l * e.w)), 1);
const apoyosProm = (arriba, abajo) => arriba.reduce((s, e) => s + abajo.filter((p) => traslape(e, p) > 1).length, 0) / Math.max(1, arriba.length);

// Capas candidatas para una altura de caja: patrón con giros mezclados y rejillas simples, más sus espejos.
function capasCandidatas(it, pal, a, b, rot, reglas) {
  const ovL = pal.ovL || 0, ovW = pal.ovW || 0, CX = pal.L + 2 * ovL, CY = pal.W + 2 * ovW;
  const gx = (X, Y, l, w, o) => { const r = []; for (let i = 0; i < Math.floor(X / l); i++) for (let j = 0; j < Math.floor(Y / w); j++) r.push({ x: i * l, y: j * w, l, w, o }); return r; };
  const crudas = [];
  [[CX, CY], [pal.L + ovL, pal.W + ovW], [pal.L, pal.W]].forEach(([X, Y]) => {
    crudas.push(patronCapa(X, Y, a, b, rot), gx(X, Y, a, b, 0));
    if (rot) crudas.push(gx(X, Y, b, a, 1));
  });
  const soporteMin = Math.max(reglas.soporteMin || 0.75, 0.5);
  const sobreTarima = (pos) => pos.every((p) => {
    const dx = Math.min(p.x + p.l, ovL + pal.L) - Math.max(p.x, ovL), dy = Math.min(p.y + p.w, ovW + pal.W) - Math.max(p.y, ovW);
    return dx > 0 && dy > 0 && (dx * dy) / (p.l * p.w) >= soporteMin - 1e-9;
  });
  const vistos = new Set(), capas = [];
  crudas.forEach((pos0) => {
    if (!pos0.length) return;
    const { bx, by } = extension(pos0);
    const variantes = [pos0, pos0.map((p) => ({ ...p, x: bx - p.x - p.l })), pos0.map((p) => ({ ...p, y: by - p.y - p.w })), pos0.map((p) => ({ ...p, x: bx - p.x - p.l, y: by - p.y - p.w }))];
    variantes.forEach((v) => {
      const c = centrar(v, CX, CY), f = firma(c);
      if (vistos.has(f) || !sobreTarima(c)) return;
      vistos.add(f); capas.push(c);
    });
  });
  return capas;
}

// Niveles que caben en la altura objetivo, con las restricciones propias del SKU
function nivelesPara(it, h, CZ) {
  let capas = cabenEnAlto(it, h, CZ);
  if (it.maxNiveles > 0) capas = Math.min(capas, it.maxNiveles);
  if (topeAnidado(it, h) > 0) capas = Math.min(capas, topeAnidado(it, h));
  if (!it.soportaEncima) capas = Math.min(capas, 1);
  if (it.pesoMaxEncima > 0 && it.peso > 0 && !it._evaluarCompresion) capas = Math.min(capas, 1 + Math.floor(it.pesoMaxEncima / it.peso));
  return capas;
}

// Arma las cajas de un patrón dado por la secuencia de capas (una capa por nivel)
function armar(it, pal, secuencia, h, capKg) {
  const altCapa = alturasPila(it, h, secuencia.length), cajas = [];
  let z = 0, quedan = capKg;
  for (let c = 0; c < secuencia.length && quedan > 0; c++) {
    const capa = secuencia[c];
    // capa incompleta por peso: primero las posiciones más cercanas al centro
    const orden = capa.map((_, i) => i);
    if (quedan < capa.length) {
      const { bx, by } = extension(capa);
      orden.sort((i, j) => (Math.abs(capa[i].x + capa[i].l / 2 - bx / 2) + Math.abs(capa[i].y + capa[i].w / 2 - by / 2)) - (Math.abs(capa[j].x + capa[j].l / 2 - bx / 2) + Math.abs(capa[j].y + capa[j].w / 2 - by / 2)));
    }
    for (let q = 0; q < orden.length && quedan > 0; q++, quedan--) {
      const p = capa[orden[q]];
      cajas.push({ x: p.x, y: p.y, z, l: p.l, w: p.w, h: altCapa[c], it, idx: it._idx ?? 0, ori: (p.o ? 2 : 1), capa: c });
    }
    z += altCapa[c];
  }
  return cajas;
}

// ---------- Indicadores de un pallet armado ----------
// cajas: con x, y, z, l, w, h (sobre la cubierta del pallet) y capa. opciones: { bct, humedad, tiempo, apilaEncima, pesoPalletEncima }
export function metricasPallet(cajas, pal, it, opciones = {}) {
  const ovL = pal.ovL || 0, ovW = pal.ovW || 0, n = cajas.length;
  if (!n) return null;
  const peso = it.peso || 0, cerca = (a, b) => Math.abs(a - b) < 1;
  // Apoyo y entrelazado (solo cajas arriba de la primera capa)
  let apoyoMinimo = 1, sumaApoyos = 0, nArriba = 0;
  const debajo = cajas.map(() => []);
  cajas.forEach((c, i) => {
    if (c.z < 0.5) return;
    let area = 0;
    cajas.forEach((s, j) => { if (cerca(s.z + s.h, c.z)) { const a = traslape(c, s); if (a > 1) { area += a; debajo[i].push({ j, a }); } } });
    apoyoMinimo = Math.min(apoyoMinimo, area / (c.l * c.w));
    sumaApoyos += debajo[i].length; nArriba++;
  });
  const entrelazado = nArriba ? sumaApoyos / nArriba : 1;
  // Soporte lateral: un lado cuenta si toca a un vecino de su misma capa o si está en la orilla de la carga (emplaye)
  let x0 = Infinity, y0 = Infinity, x1 = 0, y1 = 0;
  cajas.forEach((c) => { x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y); x1 = Math.max(x1, c.x + c.l); y1 = Math.max(y1, c.y + c.w); });
  const GAP = 5;
  let conTres = 0;
  cajas.forEach((c, i) => {
    const vecinos = cajas.filter((s, j) => j !== i && Math.min(c.z + c.h, s.z + s.h) - Math.max(c.z, s.z) > 1);
    const tocaX = (lado) => vecinos.some((s) => Math.abs(lado === 0 ? s.x + s.l - c.x : s.x - (c.x + c.l)) <= GAP && Math.min(c.y + c.w, s.y + s.w) - Math.max(c.y, s.y) > 1);
    const tocaY = (lado) => vecinos.some((s) => Math.abs(lado === 0 ? s.y + s.w - c.y : s.y - (c.y + c.w)) <= GAP && Math.min(c.x + c.l, s.x + s.l) - Math.max(c.x, s.x) > 1);
    const lados = [c.x - x0 <= GAP || tocaX(0), x1 - (c.x + c.l) <= GAP || tocaX(1), c.y - y0 <= GAP || tocaY(0), y1 - (c.y + c.w) <= GAP || tocaY(1)].filter(Boolean).length;
    if (lados >= 3) conTres++;
  });
  const lateral = conTres / n;
  // Centro de gravedad de la carga (cada caja pesa lo mismo), medido desde el piso
  let cx = 0, cy = 0, cz = 0;
  cajas.forEach((c) => { cx += c.x + c.l / 2; cy += c.y + c.w / 2; cz += c.z + c.h / 2; });
  cx /= n; cy /= n; cz = cz / n + pal.esp;
  const centroX = ovL + pal.L / 2, centroY = ovW + pal.W / 2;
  const desvX = Math.abs(cx - centroX) / (pal.L / 2), desvY = Math.abs(cy - centroY) / (pal.W / 2), desviacion = Math.max(desvX, desvY);
  const vuelco = (Math.min(pal.L, pal.W) / 2) / cz;   // < 0.5: se vuelca con 0.5 g de aceleración lateral
  // Compresión: la carga baja de capa en capa repartida según el área de apoyo
  const carga = cajas.map(() => 0);
  const encima = (opciones.apilaEncima || 0) * (opciones.pesoPalletEncima || 0);
  if (encima > 0) {
    const zTop = Math.max(...cajas.map((c) => c.z + c.h)), tope = cajas.filter((c) => cerca(c.z + c.h, zTop));
    const areaTop = tope.reduce((s, c) => s + c.l * c.w, 0);
    cajas.forEach((c, i) => { if (cerca(c.z + c.h, zTop)) carga[i] += encima * (c.l * c.w) / areaTop; });
  }
  const orden = cajas.map((_, i) => i).sort((a, b) => cajas[b].z - cajas[a].z);
  orden.forEach((i) => {
    const total = carga[i] + peso, area = debajo[i].reduce((s, d) => s + d.a, 0);
    debajo[i].forEach((d) => { carga[d.j] += total * d.a / area; });
  });
  let peor = -1;
  cajas.forEach((c, i) => { if (c.z < 0.5 && (peor < 0 || carga[i] > carga[peor])) peor = i; });
  const cargaMax = peor >= 0 ? carga[peor] : 0;
  // ¿La caja de arriba de la más cargada está alineada con ella (columna) o encima de varias (entrelazado)?
  const arribaDePeor = cajas.map((c, i) => ({ c, i })).filter(({ i }) => debajo[i].some((d) => d.j === peor));
  const alineada = arribaDePeor.length === 1 && arribaDePeor[0].c.x === cajas[peor].x && arribaDePeor[0].c.y === cajas[peor].y && arribaDePeor[0].c.l === cajas[peor].l;
  const fPatron = arribaDePeor.length === 0 || alineada ? FACTORES.patron.columnas : FACTORES.patron.entrelazado;
  const sobresale = cajas.some((c) => c.x < ovL - 1 || c.y < ovW - 1 || c.x + c.l > ovL + pal.L + 1 || c.y + c.w > ovW + pal.W + 1);
  let resistencia = null, tipoResistencia = null, factores = null;
  if (opciones.bct > 0) {
    factores = { patron: fPatron, humedad: factorDe("humedad", opciones.humedad), tiempo: factorDe("tiempo", opciones.tiempo), sobresaliente: sobresale ? FACTORES.sobresaliente : 1 };
    resistencia = opciones.bct * factores.patron * factores.humedad * factores.tiempo * factores.sobresaliente; tipoResistencia = "bct";
  } else if (it.pesoMaxEncima > 0) {
    factores = { patron: fPatron };
    resistencia = it.pesoMaxEncima * fPatron; tipoResistencia = "practico";
  }
  const margen = resistencia != null && cargaMax > 0 ? resistencia / cargaMax : resistencia != null ? Infinity : null;
  // Aprovechamiento (como el reporte de CubeMaster)
  const CZ = Math.max(1, pal.altMax - pal.esp), alto = Math.max(...cajas.map((c) => c.z + c.h));
  const areaPiso = cajas.filter((c) => c.z < 0.5).reduce((s, c) => s + c.l * c.w, 0);
  const vol = cajas.reduce((s, c) => s + c.l * c.w * c.h, 0);
  return {
    n, bct: opciones.bct || 0, apoyoMinimo, entrelazado, lateral, cg: { x: cx, y: cy, z: cz }, desviacion, vuelco, cargaMax, resistencia, tipoResistencia, factores, margen, sobresale,
    pctAltura: alto / CZ, pctPiso: areaPiso / (pal.L * pal.W), pctVolumen: vol / (pal.L * pal.W * CZ), pctPeso: pal.maxKg > 0 ? (n * peso) / pal.maxKg : null,
    alturaCarga: alto, medidaReal: { l: x1 - x0, w: y1 - y0, h: alto },
  };
}

// Semáforo de cada aspecto: "verde" | "amarillo" | "rojo" | "gris" (sin dato), con la razón en palabras.
export function semaforos(m, opciones = {}) {
  const pct = (v) => `${Math.round(v * 100)}%`;
  const est = m.apoyoMinimo < UMBRALES.apoyoMin - 1e-9
    ? { color: "rojo", texto: `Hay cajas apoyadas solo ${pct(m.apoyoMinimo)}` }
    : m.entrelazado < UMBRALES.entrelazado || m.lateral < UMBRALES.lateral
      ? { color: "amarillo", texto: m.entrelazado < UMBRALES.entrelazado ? `Columnas sin amarre (cada caja pisa ${m.entrelazado.toFixed(1)}); depende del emplaye` : `Solo ${pct(m.lateral)} de las cajas tienen 3 lados contenidos` }
      : { color: "verde", texto: `Cada caja pisa ${m.entrelazado.toFixed(1)} en promedio; ${pct(m.lateral)} con 3 lados contenidos` };
  const cg = m.vuelco < UMBRALES.vuelcoRojo || m.desviacion > UMBRALES.desvRojo
    ? { color: "rojo", texto: m.vuelco < UMBRALES.vuelcoRojo ? "Muy alto para su base: riesgo de volcadura" : `Descentrado ${pct(m.desviacion)}` }
    : m.vuelco < UMBRALES.vuelcoVerde || m.desviacion > UMBRALES.desvVerde
      ? { color: "amarillo", texto: m.vuelco < UMBRALES.vuelcoVerde ? "Alto para su base (más de 2 veces el lado corto): manejar con cuidado" : `Descentrado ${pct(m.desviacion)}` }
      : { color: "verde", texto: "Bajo y centrado" };
  let comp;
  if (m.margen == null) comp = { color: "gris", texto: opciones.esBolsa ? "Sin dato de resistencia: revisa que la bolsa de abajo aguante" : "Sin dato de resistencia (captura el BCT o el peso máximo encima)" };
  else {
    const verde = m.tipoResistencia === "bct" ? UMBRALES.margenVerde : UMBRALES.margenVerdePractico;
    const txt = m.margen === Infinity ? "Sin carga encima" : `Aguanta ${m.margen.toFixed(1)} veces la carga de la caja de abajo`;
    comp = m.margen < UMBRALES.margenRojo ? { color: "rojo", texto: `${txt}: se puede aplastar` } : m.margen < verde ? { color: "amarillo", texto: `${txt}: margen justo` } : { color: "verde", texto: txt };
  }
  return { estabilidad: est, cg, compresion: comp };
}

// Más cajas que esto en un pallet no se califican (ver patronesFabricacion).
export const TOPE_CAJAS = 3000;
const PESO_COLOR = { rojo: 2, amarillo: 1, verde: 0, gris: 0 };

// ---------- Patrones comparados ----------
// it: SKU ya preparado para el motor (prepararEntrada). opciones: { alturaMax (mm, total con el pallet),
// bct, humedad, tiempo, apilaEncima, soporteMin }
export function patronesFabricacion(it0, pal, reglas = {}, opciones = {}) {
  const it = { ...it0, _idx: it0._idx ?? 0, _evaluarCompresion: true };
  const ovL = pal.ovL || 0, ovW = pal.ovW || 0, CX = pal.L + 2 * ovL, CY = pal.W + 2 * ovW;
  const alturaMax = opciones.alturaMax > pal.esp ? opciones.alturaMax : pal.altMax;
  const CZ = Math.max(1, alturaMax - pal.esp);
  const palEval = { ...pal, altMax: alturaMax };
  const capKg = pal.maxKg > 0 && it.peso > 0 ? Math.floor(pal.maxKg / it.peso) : Infinity;
  const r = { ...reglas, soporteMin: reglas.soporteMin > 1 ? reglas.soporteMin / 100 : reglas.soporteMin || 0.75 };
  // Por altura de caja (orientaciones de pie primero), la mejor capa base
  const porAltura = {};
  orientacionesDe(it).forEach((o) => { const k = String(o.d[2]); (porAltura[k] = porAltura[k] || []).push(o); });
  let base = null;
  Object.keys(porAltura).forEach((k) => {
    const os = porAltura[k], h = Number(k), a = os[0].d[0], b = os[0].d[1], rot = os.length > 1 || a === b;
    const niveles = nivelesPara(it, h, CZ);
    if (niveles < 1) return;
    const capas = capasCandidatas(it, pal, a, b, rot, r);
    if (!capas.length) return;
    const mejorCapa = capas.reduce((m, c) => (!m || c.length > m.length ? c : m), null);
    const total = Math.min(mejorCapa.length * niveles, capKg);
    if (!base || total > base.total || (total === base.total && h < base.h)) base = { h, niveles, capas, capa: mejorCapa, total, a, b, rot };
  });
  if (!base) return [];
  const { h, niveles, capas, capa: P1 } = base;
  // Piezas diminutas (o medidas de relleno como 10 × 10 × 10 mm): miles de cajas por pallet. Los patrones y
  // los indicadores no dicen nada útil ahí y el cálculo sería pesado: se avisa en vez de calificar.
  if (P1.length * niveles > TOPE_CAJAS) { const r0 = []; r0.demasiadas = Math.min(P1.length * niveles, capKg); return r0; }
  // Capa alterna para entrelazar: misma cantidad de cajas, que no sea la misma, apoyada en ambos sentidos,
  // y que pise a la mayor cantidad posible de cajas de abajo.
  const fP1 = firma(P1);
  let P2 = null, mejorAmarre = 1.0001;
  capas.forEach((c) => {
    if (c.length !== P1.length || firma(c) === fP1) return;
    if (apoyoMin(c, P1) < UMBRALES.apoyoMin || apoyoMin(P1, c) < UMBRALES.apoyoMin) return;
    const amarre = Math.min(apoyosProm(c, P1), apoyosProm(P1, c));
    if (amarre > mejorAmarre) { mejorAmarre = amarre; P2 = c; }
  });
  // Espejo sencillo (lo que usa el motor): el primero distinto con buen apoyo
  let espejo = null;
  const minX = Math.min(...P1.map((p) => p.x)), minY = Math.min(...P1.map((p) => p.y)), maxX = Math.max(...P1.map((p) => p.x + p.l)), maxY = Math.max(...P1.map((p) => p.y + p.w));
  [P1.map((p) => ({ ...p, x: minX + maxX - p.x - p.l })), P1.map((p) => ({ ...p, y: minY + maxY - p.y - p.w })), P1.map((p) => ({ ...p, x: minX + maxX - p.x - p.l, y: minY + maxY - p.y - p.w }))]
    .forEach((v) => { if (!espejo && firma(v) !== fP1 && apoyoMin(v, P1) >= Math.max(r.soporteMin, 0.75)) espejo = v; });
  if (!P2 && espejo) P2 = espejo;
  const esBolsa = String(it.umCaja || "").toUpperCase() === "BL";
  const def = (nombre, nNiv, capaDe, clave, descripcion) => {
    const secuencia = Array.from({ length: nNiv }, (_, i) => capaDe(i, nNiv));
    const cajas = armar(it, pal, secuencia, h, capKg);
    if (!cajas.length) return null;
    const capasUsadas = Math.max(...cajas.map((k) => k.capa)) + 1;   // el peso máximo del pallet puede cortar niveles
    const d = definirPallet(cajas, palEval, { nombre: it.nombre, mixto: false, alternado: secuencia.slice(0, capasUsadas).some((c) => c !== secuencia[0]), capas: capasUsadas, porCapa: Math.min(P1.length, cajas.length) });
    d.cajas = d.cajas.map((k, i) => ({ ...k, capa: cajas[i].capa }));
    const m = metricasPallet(cajas, palEval, it, { ...opciones, pesoPalletEncima: d.peso });
    return { clave, nombre, descripcion, def: d, metricas: m, semaforos: semaforos(m, { esBolsa }), niveles: nNiv };
  };
  const ENT = (i) => (i % 2 ? P2 : P1), COL = () => P1, HIB = (i, n) => (i >= n - 2 ? (i % 2 ? P2 : P1) : P1);
  const TXT = {
    entrelazado: "Capas alternadas con otro acomodo: cada caja pisa dos o más de abajo. Más estable; la caja pierde algo de resistencia.",
    columnas: "Todas las capas iguales: toda la resistencia de la caja, pero las columnas no se amarran entre sí.",
    hibrido: "Columnas abajo, donde carga más peso, y las dos capas de arriba entrelazadas para amarrar.",
  };
  const lista = [
    P2 && def("Entrelazado", niveles, ENT, "entrelazado", TXT.entrelazado),
    def("Columnas", niveles, COL, "columnas", TXT.columnas),
    P2 && niveles >= 4 && def("Híbrido", niveles, HIB, "hibrido", TXT.hibrido),
  ].filter(Boolean);
  // Si ninguno aguanta la compresión con los niveles de la altura objetivo, se busca cuántos niveles sí aguanta
  // (con el patrón más estable que la aguante) y se ofrece como opción aparte.
  const aguanta = (p) => p.semaforos.compresion.color === "verde";
  if (lista.length && lista[0].metricas.margen != null && !lista.some(aguanta)) {
    const buscarNiveles = (capaDe) => { for (let nNiv = niveles - 1; nNiv >= 1; nNiv--) { const p = def("", nNiv, capaDe, "", ""); if (p && aguanta(p)) return p; } return null; };
    const opciones2 = [[COL, "columnas"], ...(P2 ? [[HIB, "híbrido"]] : [])].map(([capaDe, base]) => ({ p: buscarNiveles(capaDe), base })).filter((o) => o.p);
    // Gana el que permite más niveles; si empatan, el más amarrado
    opciones2.sort((a, b) => b.p.niveles - a.p.niveles || b.p.metricas.entrelazado - a.p.metricas.entrelazado);
    const o = opciones2[0];
    if (o) lista.push({ ...o.p, clave: "resistencia", nombre: `Por resistencia (${o.p.niveles} ${o.p.niveles === 1 ? "nivel" : "niveles"})`,
      descripcion: `El patrón ${o.base} con los niveles que la caja de abajo sí aguanta. Queda más bajo que la altura objetivo.` });
  }
  // Quitar repetidos (por ejemplo, un patrón que no permite alternar da lo mismo en entrelazado y columnas)
  const vistos = new Set(), unicos = [];
  lista.forEach((p) => { const f = p.def.cajas.map((k) => `${Math.round(k.x)},${Math.round(k.y)},${Math.round(k.z)},${Math.round(k.l)}`).join("|"); if (!vistos.has(f)) { vistos.add(f); unicos.push(p); } });
  // Sugerido: menos rojos, luego menos amarillos, luego más cajas, luego más amarre. Un amarillo en
  // compresión pesa un poco más que uno de estabilidad: una caja aplastada es producto dañado, y la
  // estabilidad todavía se puede reforzar con emplaye o esquineros.
  const puntos = (p) => Object.entries(p.semaforos).reduce((t, [k, x]) => t + PESO_COLOR[x.color] * (x.color === "rojo" ? 10 : k === "compresion" ? 1.5 : 1), 0);
  const ranking = [...unicos].sort((a, b) => puntos(a) - puntos(b) || b.def.n - a.def.n || b.metricas.entrelazado - a.metricas.entrelazado);
  if (ranking[0]) ranking[0].sugerido = true;
  return unicos;
}

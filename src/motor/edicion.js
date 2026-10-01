// ================= Edición manual de la carga =================
// Operaciones sobre las cajas de UN vehículo ya calculado: rotar, mover (con gravedad y ajuste contra las
// vecinas), quitar y volver a colocar. Todas son puras: reciben la lista de cajas y devuelven una nueva, así
// se puede deshacer guardando la anterior. validar() revisa en vivo las mismas reglas físicas que usa el motor,
// para que la edición a mano sirva para ajustar lo que el algoritmo no ve sin dejar pasar errores (a diferencia
// de otros programas, que apagan las reglas mientras se edita).
//
// Coordenadas en mm: x a lo largo (0 = fondo, veh.L = puertas), y a lo ancho, z hacia arriba. Una «caja» de
// aquí es un bulto del vehículo: una caja suelta o un pallet ya armado (pal >= 0).
import { marcarEntregas } from "./motor.js";

const TOL = 1;
const choca = (a, b) => Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x) > TOL && Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y) > TOL && Math.min(a.z + a.h, b.z + b.h) - Math.max(a.z, b.z) > TOL;
const traslape = (a, b) => Math.max(0, Math.min(a.x + a.l, b.x + b.l) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.w, b.y + b.w) - Math.max(a.y, b.y));
const dentroDe = (c, veh) => c.x >= -TOL && c.y >= -TOL && c.z >= -TOL && c.x + c.l <= veh.L + TOL && c.y + c.w <= veh.W + TOL && c.z + c.h <= veh.H + TOL;

// Orientación girada 90° sobre el piso: De pie ↔ De pie girada, Acostada ↔ Acostada girada, De canto ↔ De canto girada
const GIRADA = { 1: 2, 2: 1, 3: 4, 4: 3, 5: 6, 6: 5 };

// La z más baja donde la caja cabe sin encimarse con ninguna otra (gravedad). null si no cabe en esa columna.
export function zConGravedad(cajas, c, veh, ignorar = -1) {
  const encima = cajas.filter((k, j) => j !== ignorar && traslape(c, k) > TOL);
  const candidatas = [0, ...encima.map((k) => k.z + k.h)].sort((a, b) => a - b);
  for (const z of candidatas) {
    const p = { ...c, z };
    if (z + c.h > veh.H + TOL) return null;
    if (!encima.some((k) => choca(p, k))) return z;
  }
  return null;
}

const acomodar = (cajas, i, cambio, veh) => {
  const c = { ...cajas[i], ...cambio };
  c.x = Math.min(Math.max(0, c.x), Math.max(0, veh.L - c.l));
  c.y = Math.min(Math.max(0, c.y), Math.max(0, veh.W - c.w));
  const z = zConGravedad(cajas, c, veh, i);
  if (z == null) return null;
  c.z = z;
  return cajas.map((k, j) => (j === i ? c : k));
};

// Gira 90° sobre el piso (cambia largo por ancho). Devuelve null si ya no cabe ahí.
export function rotar(cajas, i, veh) {
  const c = cajas[i], ori = GIRADA[c.ori] || (c.ori === 2 ? 1 : 2);
  // Se gira sobre su centro para que no «brinque» de lugar
  const cx = c.x + c.l / 2, cy = c.y + c.w / 2;
  return acomodar(cajas, i, { l: c.w, w: c.l, ori, rot: c.pal >= 0 ? ori === 2 : c.rot, x: cx - c.w / 2, y: cy - c.l / 2 }, veh);
}

// Mueve dx, dy (mm) y la deja caer hasta donde tenga apoyo.
export function mover(cajas, i, dx, dy, veh) {
  const c = cajas[i];
  return acomodar(cajas, i, { x: c.x + dx, y: c.y + dy }, veh);
}

// Recorre la caja en una dirección hasta topar con una vecina de su misma altura o con la pared.
// dir: "fondo" (x−), "puertas" (x+), "derecha" (y−), "izquierda" (y+).
export function pegar(cajas, i, dir, veh) {
  const c = cajas[i];
  const mismaAltura = (k) => Math.min(c.z + c.h, k.z + k.h) - Math.max(c.z, k.z) > TOL;
  const otras = cajas.filter((k, j) => j !== i && mismaAltura(k));
  let dest;
  if (dir === "fondo" || dir === "puertas") {
    const enCarril = otras.filter((k) => Math.min(c.y + c.w, k.y + k.w) - Math.max(c.y, k.y) > TOL);
    dest = dir === "fondo" ? Math.max(0, ...enCarril.filter((k) => k.x + k.l <= c.x + TOL).map((k) => k.x + k.l))
      : Math.min(veh.L - c.l, ...enCarril.filter((k) => k.x >= c.x + c.l - TOL).map((k) => k.x - c.l));
    return acomodar(cajas, i, { x: dest }, veh);
  }
  const enCarril = otras.filter((k) => Math.min(c.x + c.l, k.x + k.l) - Math.max(c.x, k.x) > TOL);
  dest = dir === "derecha" ? Math.max(0, ...enCarril.filter((k) => k.y + k.w <= c.y + TOL).map((k) => k.y + k.w))
    : Math.min(veh.W - c.w, ...enCarril.filter((k) => k.y >= c.y + c.w - TOL).map((k) => k.y - c.w));
  return acomodar(cajas, i, { y: dest }, veh);
}

export function quitar(cajas, i) {
  return { cajas: cajas.filter((_, j) => j !== i), quitada: cajas[i] };
}

// Busca el primer lugar válido para una caja (del fondo hacia las puertas, de abajo hacia arriba), probando
// también girada. Devuelve la lista nueva con la caja al final, o null si no hay dónde.
export function colocar(cajas, caja, veh, contexto) {
  const variantes = [caja, { ...caja, l: caja.w, w: caja.l, ori: GIRADA[caja.ori] || caja.ori, rot: caja.pal >= 0 ? (GIRADA[caja.ori] || caja.ori) === 2 : caja.rot }];
  const xs = new Set([0]), ys = new Set([0]);
  cajas.forEach((k) => { xs.add(k.x + k.l); xs.add(k.x); ys.add(k.y + k.w); ys.add(k.y); });
  let mejor = null;
  for (const v of variantes) {
    if (contexto && !orientacionPermitida(v, contexto)) continue;
    ys.add(veh.W - v.w);
    for (const x of xs) for (const y of ys) {
      const c = { ...v, x, y, z: 0 };
      if (x < 0 || y < 0 || x + c.l > veh.L + TOL || y + c.w > veh.W + TOL) continue;
      const z = zConGravedad(cajas, c, veh);
      if (z == null) continue;
      c.z = z;
      if (contexto) {
        const prueba = [...cajas, c], probs = problemasDe(prueba, prueba.length - 1, veh, contexto);
        if (probs.length) continue;
      }
      if (!mejor || c.x < mejor.x - TOL || (Math.abs(c.x - mejor.x) <= TOL && (c.z < mejor.z - TOL || (Math.abs(c.z - mejor.z) <= TOL && c.y < mejor.y)))) mejor = c;
    }
  }
  return mejor ? [...cajas, mejor] : null;
}

// ---------- Validación ----------
// contexto: { items (las líneas de la carga, por idx), pallets (definiciones armadas), reglas, cargaMax }
function orientacionPermitida(c, { items }) {
  if (c.pal >= 0) return true;                 // un pallet siempre va de pie; girarlo 90° está permitido
  const it = items[c.idx];
  return !it?.oris || !!it.oris[(c.ori || 1) - 1];
}
function problemasDe(cajas, i, veh, ctx) {
  const c = cajas[i], out = [];
  const it = ctx.items[c.idx] || {};
  if (!dentroDe(c, veh)) out.push("se sale del vehículo");
  if (cajas.some((k, j) => j !== i && choca(c, k))) out.push("se encima con otro bulto");
  if (!orientacionPermitida(c, ctx)) out.push("va en una orientación que el producto no permite");
  if (c.pal < 0 && it.piso === "soloPiso" && c.z > TOL) out.push("solo puede ir en el piso");
  if (c.pal < 0 && it.piso === "noPiso" && c.z <= TOL) out.push("no puede ir en el piso");
  if (c.z > TOL) {
    let area = 0;
    cajas.forEach((k, j) => {
      if (j === i || Math.abs(k.z + k.h - c.z) > TOL) return;
      const a = traslape(c, k); if (a <= TOL) return;
      area += a;
      const itAbajo = ctx.items[k.idx] || {};
      if (k.pal >= 0) {
        const d = ctx.pallets[k.pal] || {}, plano = !!d.techoPlano;
        if (c.pal >= 0 && !(plano && itAbajo.aceptaPallet)) out.push("está sobre un pallet que no acepta otro pallet encima");
        else if (c.pal < 0 && !(plano && itAbajo.aceptaCajas !== false)) out.push("está sobre un pallet que no acepta cajas encima");
      } else {
        if (c.pal >= 0) out.push("es un pallet encima de cajas sueltas");
        else if (itAbajo.soportaEncima === false) out.push(`está sobre ${itAbajo.nombre || "una caja"}, que no soporta carga encima`);
      }
    });
    const minimo = c.pal >= 0 ? Math.max(ctx.reglas?.soporteMin ?? 0.75, 0.9) : (ctx.reglas?.soporteMin ?? 0.75);
    const frac = area / (c.l * c.w);
    if (frac < minimo - 1e-6) out.push(frac < 0.01 ? "está flotando" : `solo tiene ${Math.round(frac * 100)}% de apoyo (mínimo ${Math.round(minimo * 100)}%)`);
  }
  return [...new Set(out)];
}

export function validar(cajas, veh, ctx) {
  const porCaja = cajas.map((_, i) => problemasDe(cajas, i, veh, ctx));
  const peso = cajas.reduce((s, k) => s + (k.peso || 0), 0);
  const generales = [];
  if (ctx.cargaMax > 0 && peso > ctx.cargaMax + 1e-6) generales.push(`La carga pesa ${Math.round(peso).toLocaleString("es-MX")} kg y el máximo es ${Math.round(ctx.cargaMax).toLocaleString("es-MX")} kg.`);
  const conProblema = porCaja.filter((p) => p.length).length;
  return { porCaja, generales, peso, conProblema, color: conProblema || generales.length ? "rojo" : "verde" };
}

// Recalcula peso, volumen y zonas de entrega del vehículo editado, y ordena los bultos en el orden en que se
// cargarían (del fondo a las puertas, de abajo hacia arriba), para que el paso a paso y el instructivo sigan
// siendo realizables.
export function recalcularContenedor(cont, cajas, items) {
  // Del fondo a las puertas y de abajo hacia arriba, pero nunca antes de los bultos que la sostienen
  const base = [...cajas].sort((a, b) => a.x - b.x || a.z - b.z || a.y - b.y), puesto = new Set(), orden = [];
  const soportes = base.map((c) => base.filter((k) => k !== c && Math.abs(k.z + k.h - c.z) <= TOL && traslape(c, k) > TOL));
  while (orden.length < base.length) {
    const i = base.findIndex((c, j) => !puesto.has(j) && soportes[j].every((k) => puesto.has(base.indexOf(k))));
    const j = i >= 0 ? i : base.findIndex((_, q) => !puesto.has(q));   // por si acaso (apoyos cruzados): no se atora
    puesto.add(j); orden.push(base[j]);
  }
  const c = { ...cont, cajas: orden, peso: orden.reduce((s, k) => s + (k.peso || 0), 0), vol: orden.reduce((s, k) => s + k.l * k.w * k.h, 0) };
  const ordenDe = {};
  items.forEach((it, i) => { ordenDe[i] = it.entrega > 0 ? it.entrega : it.orden > 0 ? it.orden : 0; });
  return marcarEntregas(c, ordenDe);
}

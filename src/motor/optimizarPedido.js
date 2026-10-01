// ================= Optimizar el pedido =================
// Las dos preguntas que se hace el planeador al ver el resultado, contestadas sobre el mismo pedido:
//   · «Llenar con pedido sugerido»: sobra espacio, ¿cuánto más de estos mismos SKUs cabe sin sumar vehículos?
//   · «Sugerir disminución»: salió un vehículo casi vacío. Primero se prueba reacomodar (nivel máximo, abriendo
//     Bundles si hace falta) sin tocar cantidades; solo si no alcanza, se sugiere qué bajar para usar uno menos.
// Nunca se sugiere un SKU que no esté en el pedido, y las líneas marcadas como fijas no se tocan.
// Todo se comprueba con una corrida real antes de proponerlo: lo que se ve en la vista previa es lo que queda.
//
// Quien llama pasa cómo correr (así esto no sabe de Workers ni de React):
//   correrPedido(itemsDelPedido)  → corrida del pedido completo, en el nivel de la optimización. Durante la
//     búsqueda NO se rehace la apertura de Bundles: cada corrida cuesta segundos y la búsqueda hace decenas.
//   correrFinal(itemsDelPedido)   → la corrida que se le muestra al usuario, ya con la política de Bundles
//   correrCarga(itemsDelMotor)    → corrida de una lista ya lista para el motor (sin optimizar Bundles)

import { tieneBundle, cajasPorBundle } from "../archivos/bundle.js";

// Cajas por línea del pedido dentro de un vehículo (sueltas y el contenido de sus pallets; un Bundle cuenta sus cajas)
export function cajasPorLinea(corrida, iCont, soloRelleno = false) {
  const { resultado: r, carga } = corrida, cuenta = new Map(), cont = r.contenedores[iCont];
  if (!cont) return cuenta;
  const sumar = (k) => {
    if (soloRelleno !== !!k.relleno) return;
    const it = carga.items[k.idx]; if (!it) return;
    const id = it.lineaId ?? it.id;
    cuenta.set(id, (cuenta.get(id) || 0) + (it.esBundle ? it.cantidadPorBundle || 1 : 1));
  };
  cont.cajas.forEach((k) => { if (k.pal >= 0) (r.pallets[k.pal]?.cajas || []).forEach(sumar); else sumar(k); });
  return cuenta;
}

const resumen = (c) => {
  const v = c.carga.vehiculo, volV = v.L * v.W * v.H;
  return { n: c.resultado.contenedores.length, sinCargar: c.resultado.sinCargar, ocupaciones: c.resultado.contenedores.map((k) => (volV ? (k.vol / volV) * 100 : 0)) };
};
const cabeIgual = (c, ref) => c.resultado.contenedores.length <= ref.resultado.contenedores.length && c.resultado.sinCargar <= ref.resultado.sinCargar;

// Suma cantidades al pedido. Lo extra de una línea paletizada entra como línea suelta aparte (el relleno se
// calculó suelto: sumado a la línea paletizada, el motor lo armaría en pallets y ya no cabría igual).
export function sumarAlPedido(items, deltas) {
  let lista = items.map((it) => ({ ...it }));
  deltas.forEach((d, id) => {
    if (!(d > 0)) return;
    const it = lista.find((x) => x.id === id); if (!it) return;
    if (!it.paletizar) { it.qty += d; return; }
    const extra = lista.find((x) => x.extraDe === id);
    if (extra) extra.qty += d;
    else lista.push({ ...it, id: `${id}-extra`, extraDe: id, qty: d, paletizar: false, enBundle: false });
  });
  return lista;
}
export function restarAlPedido(items, deltas) {
  return items.map((it) => (deltas.has(it.id) ? { ...it, qty: Math.max(0, it.qty - deltas.get(it.id)) } : it)).filter((it) => it.qty > 0);
}
const cambiosEntre = (antes, despues) => {
  const porId = new Map(despues.map((it) => [it.id, it])), cambios = [];
  antes.forEach((it) => { const d = porId.get(it.id); const nuevo = (d?.qty || 0) + despues.filter((x) => x.extraDe === it.id).reduce((a, x) => a + x.qty, 0); if (nuevo !== it.qty) cambios.push({ id: it.id, nombre: it.nombre, umCaja: it.umCaja, actual: it.qty, nuevo, delta: nuevo - it.qty }); });
  return cambios;
};

// ---------- Llenar con pedido sugerido ----------
// Primero se agranda el pedido completo en la misma proporción (se conserva el mix que pidió el cliente) hasta
// donde quepa sin sumar vehículos; después, los huecos que queden se llenan con lo que mejor entre.
// correrRapido (opcional) se usa para esa búsqueda de proporción; el resultado siempre se comprueba con correrPedido.
export async function sugerirLlenado({ items, correrPedido, correrCarga, correrRapido = correrPedido, correrFinal = correrPedido, fijas = new Set(), onFase }) {
  onFase?.("Calculando el pedido actual en nivel máximo…");
  const ref = await correrPedido(items);
  const candidatos = items.filter((it) => it.qty > 0 && !fijas.has(it.id) && !it.fijo && !it.extraDe);
  if (!candidatos.length) return { tipo: "llenar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, motivo: "sinCandidatos" };
  const esCandidato = new Set(candidatos.map((it) => it.id));
  // Una línea en Bundle crece de Bundle en Bundle: media caja suelta de más no la pide nadie
  const paso = (it) => (it.enBundle && tieneBundle(it) ? cajasPorBundle(it) : 1);
  const aPaso = (it, n) => Math.floor(n / paso(it)) * paso(it);
  const escalar = (f) => items.map((it) => (esCandidato.has(it.id) ? { ...it, qty: Math.max(it.qty, aPaso(it, Math.floor(it.qty * f))) } : it));
  onFase?.("Agrandando el pedido en la misma proporción…");
  const ocup = resumen(ref).ocupaciones, ultima = ocup[ocup.length - 1] || 100;
  let lo = 1, hi = Math.min(20, Math.max(1.05, 100 / Math.max(1, ultima)) * (ocup.length > 1 ? 1 : 1.1));
  for (let i = 0; i < 5 && hi / lo > 1.02; i++) {
    const m = (lo + hi) / 2, c = await correrRapido(escalar(m));
    if (cabeIgual(c, ref)) lo = m; else hi = m;
  }
  let proporcional = lo > 1.005 ? escalar(lo) : items;
  let refProp = ref;
  if (proporcional !== items) {
    const c = await correrPedido(proporcional);
    if (cabeIgual(c, ref)) refProp = c; else proporcional = items;
  }
  onFase?.("Llenando los huecos que quedan…");
  const base = refProp.carga.items;
  // El relleno se ofrece "ilimitado", pero pedir 500,000 cajas hace que el motor las intente una por una:
  // basta con las que caben en el hueco que quedó, con holgura.
  const vb = refProp.carga.vehiculo, volV = vb.L * vb.W * vb.H;
  const libre = refProp.resultado.contenedores.reduce((a, k) => a + Math.max(0, volV - k.vol), 0);
  const cabenEnElHueco = (it) => Math.min(500000, Math.ceil((libre * 1.5) / Math.max(1, it.L * it.W * it.H)) + 10);
  const relleno = candidatos.map((it) => {
    const comun = { ...it, id: `rel-${it.id}`, lineaId: it.id, esRelleno: true, paletizar: false, enBundle: false };
    if (!(it.enBundle && tieneBundle(it))) return { ...comun, qty: cabenEnElHueco(it) };
    const c = cajasPorBundle(it);
    return { ...comun, qty: cabenEnElHueco({ L: it.bundleL, W: it.bundleW, H: it.bundleH }), L: it.bundleL, W: it.bundleW, H: it.bundleH,
      peso: it.bundlePeso > 0 ? it.bundlePeso : (it.peso || 0) * c, umCaja: "BDL", piezas: (it.piezas || 1) * c,
      porPallet: 0, porCapa: 0, capasPallet: 0, anidado: 0, maxAnidado: 0, forma: "caja", diametro: 0,
      esBundle: true, cantidadPorBundle: c };   // cajasPorLinea ya cuenta las cajas que trae cada Bundle
  });
  const conRelleno = await correrCarga([...base, ...relleno]);
  const deltas = new Map();
  conRelleno.resultado.contenedores.forEach((_, i) => cajasPorLinea(conRelleno, i, true).forEach((n, id) => deltas.set(id, (deltas.get(id) || 0) + n)));
  proporcional.forEach((it) => { const o = items.find((x) => x.id === it.id); if (o && it.qty > o.qty) deltas.set(it.id, (deltas.get(it.id) || 0) + it.qty - o.qty); });
  if (!deltas.size) return { tipo: "llenar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, motivo: "noCabeMas" };
  // Se comprueba con el pedido real; si el acomodo no reproduce el relleno, se baja un poco y se vuelve a probar.
  let factor = 1;
  for (let intento = 0; intento < 4; intento++) {
    onFase?.(intento ? "Ajustando la sugerencia para que quepa…" : "Comprobando la sugerencia…");
    const porId = new Map(items.map((it) => [it.id, it]));
    const escalado = new Map([...deltas].map(([id, n]) => [id, aPaso(porId.get(id) || {}, Math.floor(n * factor))]).filter(([, n]) => n > 0));
    if (!escalado.size) break;
    const nuevos = sumarAlPedido(items, escalado), c = await correrPedido(nuevos);
    if (cabeIgual(c, ref)) {
      onFase?.("Calculando el resultado final…");
      const f = await correrFinal(nuevos);
      return { tipo: "llenar", cambios: cambiosEntre(items, nuevos), antes: resumen(ref), despues: resumen(f), corrida: f, items: nuevos };
    }
    factor *= 0.8;
  }
  return { tipo: "llenar", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, motivo: "noSeComprobo" };
}

// ---------- Sugerir disminución del pedido ----------
export async function sugerirDisminucion({ items, nActual, correrPedido, correrFinal = correrPedido, fijas = new Set(), onFase }) {
  onFase?.("Probando reacomodar en nivel máximo, sin cambiar cantidades…");
  const ref = await correrPedido(items);
  if (ref.resultado.contenedores.length < nActual) return { tipo: "reacomodo", cambios: [], antes: { n: nActual }, despues: resumen(ref), corrida: ref, items, logrado: true };
  const objetivo = ref.resultado.contenedores.length - 1;
  if (objetivo < 1) return { tipo: "reducir", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, logrado: false };
  let actual = ref, lista = items;
  for (let intento = 0; intento < 4; intento++) {
    onFase?.(intento ? "Ajustando la disminución…" : "Calculando qué bajar para usar un vehículo menos…");
    const ultimo = actual.resultado.contenedores.length - 1;
    const quitar = new Map([...cajasPorLinea(actual, ultimo)].filter(([id]) => !fijas.has(id) && lista.some((it) => it.id === id && !it.fijo)));
    if (!quitar.size) break;
    lista = restarAlPedido(lista, quitar);
    if (!lista.length) break;
    actual = await correrPedido(lista);
    if (actual.resultado.contenedores.length <= objetivo && actual.resultado.sinCargar <= ref.resultado.sinCargar) {
      onFase?.("Calculando el resultado final…");
      const f = await correrFinal(lista);
      return { tipo: "reducir", cambios: cambiosEntre(items, lista), antes: resumen(ref), despues: resumen(f), corrida: f, items: lista, logrado: true };
    }
  }
  return { tipo: "reducir", cambios: [], antes: resumen(ref), despues: resumen(ref), corrida: ref, items, logrado: false };
}

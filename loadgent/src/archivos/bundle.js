// ================= Bundle (BDL) =================
// Un Bundle agrupa varias cajas del mismo SKU en un solo bulto más grande (cajas grandes una encima de
// otra, sin pallet), con sus propias medidas y peso. Se configura en la hoja «Bundles» del maestro:
//   bundleCantidadEstandar     Cuántas cajas del SKU forman UN Bundle
//   bundleL, bundleW, bundleH  Medidas del Bundle armado, en mm
//   bundlePeso                 Peso del Bundle armado, en kg (0 = peso de la caja × cajas por Bundle)
//
// Cómo se carga en el andén, que es lo que reproduce la herramienta:
//   1. Todo lo pedido de ese SKU se lleva en Bundles completos; lo que no completa un Bundle va suelto.
//   2. Si con eso la carga ocupa un vehículo más, se abren los Bundles necesarios (los menos posibles) y sus
//      cajas se acomodan sueltas en los huecos, para usar menos vehículos. Si abrirlos no ahorra un vehículo,
//      no se abre ninguno: abrir un Bundle cuesta mano de obra.
// El mix Bundle / suelto NO se define antes: es un resultado del cálculo (ver motor/corrida.js: correrConBundles).
//
// En el pedido, cada línea elige cómo se carga: suelta, pallet de un SKU, pallet mixto o Bundle (`enBundle`).
// La opción Bundle solo existe para los SKUs que están en la hoja Bundles.

// ¿El SKU (producto del maestro o línea del pedido) tiene su Bundle configurado?
export const tieneBundle = (p) => !!p && cajasPorBundle(p) > 0 && p.bundleL > 0 && p.bundleW > 0 && p.bundleH > 0;
// Cajas por Bundle siempre entera: del CS-BDL sale como Rel ÷ Factor (4.8 ÷ 0.2 = 23.999999…) y con eso las cajas
// sueltas quedaban en 0.0000001 y el cálculo rechazaba la línea («la cantidad debe ser un entero»).
export const cajasPorBundle = (p) => Math.round(Number(p?.bundleCantidadEstandar) || 0);

// Líneas del pedido que se cargan en Bundle y cuántos Bundles completos forman
export const lineasBundle = (items) => items
  .filter((it) => it.enBundle && tieneBundle(it) && it.qty >= cajasPorBundle(it))
  .map((it) => ({ id: it.id, nombre: it.nombre, bundles: Math.floor(it.qty / cajasPorBundle(it)), cajasPorBundle: cajasPorBundle(it) }));

// Reparte k Bundles abiertos entre las líneas, en proporción a cuántos Bundles tiene cada una (restos mayores).
export function repartirAbiertos(lineas, k) {
  const total = lineas.reduce((a, l) => a + l.bundles, 0), abiertos = {};
  if (!(k > 0) || !total) return abiertos;
  const n = Math.min(k, total);
  const base = lineas.map((l) => { const exacto = (n * l.bundles) / total; return { l, piso: Math.floor(exacto), resto: exacto - Math.floor(exacto) }; });
  let faltan = n - base.reduce((a, b) => a + b.piso, 0);
  base.sort((a, b) => b.resto - a.resto).forEach((b) => { if (faltan > 0 && b.piso < b.l.bundles) { b.piso++; faltan--; } });
  base.forEach((b) => { if (b.piso > 0) abiertos[b.l.id] = b.piso; });
  return abiertos;
}

// Convierte las líneas en Bundle en lo que carga el motor: un renglón de Bundles completos (con las medidas
// del Bundle) y uno de cajas sueltas (lo que no completa un Bundle más las cajas de los Bundles abiertos).
// El resto de las líneas pasa igual. `abiertos`: { idLínea: cuántos Bundles se abren }.
export function expandirBundles(items, abiertos = {}) {
  const salida = [];
  items.forEach((it) => {
    if (!(it.enBundle && tieneBundle(it))) { salida.push(it.enBundle ? { ...it, enBundle: false } : it); return; }
    const c = cajasPorBundle(it), completos = Math.floor(it.qty / c);
    const nAbiertos = Math.min(abiertos[it.id] || 0, completos), nBundles = completos - nAbiertos, sueltas = it.qty - nBundles * c;
    if (nBundles > 0) salida.push({
      ...it, L: it.bundleL, W: it.bundleW, H: it.bundleH,
      peso: it.bundlePeso > 0 ? it.bundlePeso : (it.peso || 0) * c,
      qty: nBundles, umCaja: "BDL", piezas: (it.piezas || 1) * c,
      // El Bundle ya es un bulto armado: no se paletiza, no anida y se trata como caja aunque la pieza sea un barril.
      paletizar: false, porPallet: 0, porCapa: 0, capasPallet: 0, anidado: 0, maxAnidado: 0, forma: "caja", diametro: 0,
      enBundle: false, esBundle: true, lineaId: it.id, cantidadPorBundle: c,
    });
    if (sueltas > 0) salida.push({ ...it, id: `${it.id}-suelto`, qty: sueltas, paletizar: false, enBundle: false, lineaId: it.id, deBundle: true, abiertos: nAbiertos });
  });
  return salida;
}

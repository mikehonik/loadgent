// ================= Carga por eje =================
// Estimación por reparto de palanca (viga simplemente apoyada entre los dos ejes): un peso puntual
// se reparte entre el eje delantero y el trasero según qué tan cerca está de cada uno. Es el mismo
// método que usan las básculas de reparto de ejes en patio; no sustituye una báscula real, pero
// alcanza para avisar a tiempo si una carga va a exceder el límite de un eje.
//
// veh necesita: xEjeDelantero, xEjeTrasero (mm, posición de cada eje medida desde el frente de la
// caja de carga; puede ser negativa si el eje queda antes del inicio de la caja), ejeDelantero,
// ejeTrasero (kg, máximo permitido en cada eje; 0 = no calcular), y opcionalmente taraDelantera,
// taraTrasera (kg, reparto del peso vacío; si ambas son 0 se asume mitad y mitad de veh.tara).

export function tieneEjesConfigurados(veh) {
  return veh.ejeDelantero > 0 && veh.ejeTrasero > 0 && Number.isFinite(veh.xEjeDelantero) && Number.isFinite(veh.xEjeTrasero) && veh.xEjeTrasero > veh.xEjeDelantero;
}

// cajas: [{ x, l, peso }] (posición y largo en mm, peso en kg). Devuelve null si el vehículo no
// trae la geometría de ejes, o { delantero, trasero } con { carga, maximo, pct, alerta } cada uno.
export function cargaPorEje(veh, cajas) {
  if (!tieneEjesConfigurados(veh)) return null;
  const xf = veh.xEjeDelantero, xr = veh.xEjeTrasero, dist = xr - xf;
  const tara = veh.tara || 0;
  let taraD = veh.taraDelantera > 0 || veh.taraTrasera > 0 ? veh.taraDelantera || 0 : tara / 2;
  let taraT = veh.taraDelantera > 0 || veh.taraTrasera > 0 ? veh.taraTrasera || 0 : tara / 2;
  let delantero = taraD, trasero = taraT;
  cajas.forEach((c) => {
    const centro = c.x + c.l / 2;
    const fracTrasero = (centro - xf) / dist;   // <0 o >1 si la caja queda antes/después de los ejes (se extrapola)
    trasero += c.peso * fracTrasero;
    delantero += c.peso * (1 - fracTrasero);
  });
  const conDato = (carga, maximo) => ({ carga: Math.round(carga), maximo, pct: maximo ? Math.round((carga / maximo) * 100) : null, alerta: maximo > 0 && carga > maximo });
  return { delantero: conDato(delantero, veh.ejeDelantero), trasero: conDato(trasero, veh.ejeTrasero) };
}

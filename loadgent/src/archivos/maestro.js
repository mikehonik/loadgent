// ================= Maestro =================
// El maestro es el catálogo de productos y tarimas guardado en Excel (maestro_productos.xlsx).
// Aquí vive todo lo que sabe leerlo y escribirlo: las columnas, sus textos, la lectura tolerante
// y la importación de la plantilla "Cargo Upload" de CubeMaster. No toca el DOM ni React.
import * as XLSX from "xlsx";
import { escribirXlsx } from "./escribir.js";
import { clave, claveSku, skuBase, indiceSku, buscarSku, siNo, numero, hojaAObjetos, buscarHoja } from "./celdas.js";
import { HOJA_CONVERSIONES, UM_CAJA_DEF, normalizaUM, filasConversiones, conversionesDeHoja } from "./conversiones.js";
import { factorColumna, describirUnidades, encabezadoEn, SISTEMAS } from "../unidades.js";

// ---------- Unidades al leer y escribir ----------
// Columnas de medida (se pasan a mm) y de peso (se pasan a kg), por su encabezado ya normalizado con clave().
const COL_LARGO = ["largo", "ancho", "alto", "anidadosubeporpieza", "largobundle", "anchobundle", "altobundle", "espesor", "alturamax", "sobresalealolargo", "sobresalealoancho", "sobresaliente", "diametro"];
const COL_PESO = ["peso", "pesomaxencima", "pesobundle", "cargamax"];
// Factor de cada columna de medida o peso de una hoja, según su encabezado y la unidad elegida al subir.
function factoresDeHoja(ws, elegida) {
  if (!ws) return { factores: {}, encabezados: [] };
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const hi = filas.findIndex((f) => f.some((c) => ["sku", "nombre", "codigo"].includes(clave(c))));
  const encabezados = hi < 0 ? [] : filas[hi].map((h) => String(h));
  const factores = {};
  encabezados.forEach((h) => {
    const k = clave(h);
    if (COL_LARGO.includes(k)) factores[k] = factorColumna(h, "largo", elegida);
    else if (COL_PESO.includes(k)) factores[k] = factorColumna(h, "peso", elegida);
  });
  return { factores, encabezados: encabezados.filter((h) => COL_LARGO.includes(clave(h)) || COL_PESO.includes(clave(h))) };
}
// Pasa a mm y kg las columnas de un renglón leído con hojaAObjetos (solo las que traen número).
function aMetrico(o, factores) {
  for (const k in factores) if (factores[k] !== 1 && String(o[k] ?? "").trim() !== "") o[k] = numero(o[k]) * factores[k];
  return o;
}


export const ARCHIVO_MAESTRO = "maestro_productos.xlsx";
export const ARCHIVO_RESPALDO = "maestro_productos_respaldo.xlsx";
// El maestro vive en DOS hojas, a propósito:
// - "Datos": lo que en el futuro podría venir directo del ERP (identidad, medidas, peso). Se puede
//   refrescar sin tocar los parámetros logísticos, con "Actualizar dimensiones".
// - "Parámetros": las reglas de estiba, paletizado y apilamiento, que arma y mantiene la operación
//   y que un refresco de medidas del ERP nunca debe borrar.
// Archivos viejos con una sola hoja "Productos" se siguen leyendo (ver leerMaestro).
export const COLS_DATOS = ["SKU", "ID producto", "Descripción", "Largo (mm)", "Ancho (mm)", "Alto (mm)", "Peso (kg)", "Volumen (m³)"];
export const COLS_PARAMETROS = ["SKU", "Categoría", "Forma", "Piezas por caja", "Orientaciones", "Volteo en piso", "Compresión bajo carga (%)", "Anidado: sube por pieza (mm)", "Máx. piezas anidadas", "Máx. cajas apiladas",
  "Prioridad de apilamiento", "Peso máx. encima (kg)", "Posición", "Soporta carga encima", "UM de la caja", "Paletizar", "Pallet", "Cajas por pallet", "Cajas por nivel", "Niveles", "Sobrantes", "Acepta cajas encima", "Acepta pallet encima", "Color"];
// Hoja «Bundles»: solo los SKUs que se pueden cargar en Bundle (ver archivos/bundle.js). Si un SKU está aquí,
// en el pedido aparece la opción Bundle. No lleva porcentaje: el mix Bundle / suelto es un resultado del cálculo.
export const COLS_BUNDLES = ["SKU", "Cajas por Bundle", "Largo Bundle (mm)", "Ancho Bundle (mm)", "Alto Bundle (mm)", "Peso Bundle (kg)"];
// Compatibilidad: los archivos de una sola hoja (anteriores a la separación) usan este orden.
export const COLS_MAESTRO = ["SKU", "ID producto", "Descripción", "Categoría", "Forma", "Largo (mm)", "Ancho (mm)", "Alto (mm)", "Peso (kg)", "Volumen (m³)", "Piezas por caja", "Orientaciones", "Volteo en piso", "Compresión bajo carga (%)", "Anidado: sube por pieza (mm)", "Máx. piezas anidadas", "Máx. cajas apiladas",
  "Prioridad de apilamiento", "Peso máx. encima (kg)", "Posición", "Soporta carga encima", "UM de la caja", "Paletizar", "Pallet", "Cajas por pallet", "Cajas por nivel", "Niveles", "Sobrantes", "Acepta cajas encima", "Acepta pallet encima", "Color"];
export const COLS_TARIMAS = [["Nombre", "nombre"], ["Largo (mm)", "L"], ["Ancho (mm)", "W"], ["Espesor (mm)", "esp"], ["Peso (kg)", "peso"], ["Altura máx. (mm)", "altMax"], ["Carga máx. (kg)", "maxKg"], ["Sobresale a lo largo (mm por lado)", "ovL"], ["Sobresale a lo ancho (mm por lado)", "ovW"]];
// Explicación de cada campo: se muestra en la sección Ayuda y en la hoja Instrucciones del maestro
export const AYUDA = [
  ["Maestro de productos", "Por qué dos hojas", "El maestro se guarda en dos hojas: Datos (SKU, ID producto, descripción, medidas, peso) y Parámetros (todo lo demás: orientaciones, apilamiento, paletizado). Datos es lo que en el futuro podría venir directo del ERP; con «Actualizar dimensiones» puedes refrescarlo sin perder los parámetros que ya configuraste. Un maestro viejo de una sola hoja se sigue leyendo igual.", "—", "—"],
  ["Maestro de productos", "SKU", "Código único del producto. Es lo que se busca al subir un pedido.", "JNS-010", "Obligatorio"],
  ["Maestro de productos", "Categoría", "Agrupa productos que comparten reglas logísticas, por ejemplo «Tejas» o «Tanques». Sirve para la regla de apilamiento «Solo sobre la misma categoría»: con ella activa, una caja solo puede recibir encima otra de su misma categoría (tejas sobre tejas, por ejemplo), aunque sean SKUs distintos. Déjala vacía si no la necesitas.", "Tejas", "Sin categoría; no participa en esa regla"],
  ["Maestro de productos", "ID producto", "Segundo código del mismo artículo: el de tu ERP o el que traen las transferencias. La herramienta busca en SKU y en ID producto, así que un pedido puede venir con cualquiera de los dos. Déjalo vacío si solo manejas un código.", "1002345", "Se usa solo el SKU"],
  ["Maestro de productos", "Descripción", "Texto de referencia para reconocer el producto.", "Jeans slim (caja 12 pzas)", "Se deja en blanco"],
  ["Maestro de productos", "Largo, Ancho, Alto (mm)", "Medidas exteriores de la caja cerrada, en milímetros. Alto es la medida con la caja de pie (flechas hacia arriba).", "600 · 400 · 400", "Obligatorio"],
  ["Maestro de productos", "Peso (kg)", "Peso de la caja completa: producto más empaque.", "14", "0 (no cuenta para el límite de peso)"],
  ["Maestro de productos", "Volumen (m³)", "Se calcula solo: largo × ancho × alto. No se captura.", "0.096", "Automático"],
  ["Maestro de productos", "Piezas por caja", "Unidades dentro de cada caja. Solo sirve para los reportes.", "12", "1"],
  ["Maestro de productos", "Orientaciones", "Cómo puede acomodarse la caja. Escribe Solo de pie, De pie y acostada o Todas. Avanzado: números del 1 al 6 (1 y 2 de pie, 3 y 4 acostada, 5 y 6 de canto). En la herramienta se ven con dibujos; la cara ámbar es la tapa.", "Solo de pie", "Solo de pie"],
  ["Maestro de productos", "Volteo en piso", "Sí permite que una caja acostada (orientaciones 3 a 6) vaya directamente en el piso.", "No", "No"],
  ["Maestro de productos", "Forma", "Caja o bulto (lo normal), Barril o cilindro (de pie), Tubo o rollo (acostado) o Teja o placa. La forma cambia el dibujo en el visor; para calcular, el cilindro ocupa la caja que lo envuelve, así que el resultado nunca promete más espacio del que hay.", "Barril", "Caja"],
  ["Maestro de productos", "Anidado: sube por pieza (mm)", "Para piezas que embonan una en otra: barriles que entran uno dentro de otro, tejas con cresta, cubetas. Es cuánto crece la torre por cada pieza extra, no la altura de la pieza. Ejemplo: barril de 880 mm que sube 150 por pieza; ocho barriles miden 1,930 mm, no 7,040.", "150", "0 (no se anidan)"],
  ["Maestro de productos", "Máx. piezas anidadas", "Cuántas piezas aguanta una torre antes de empezar otra encima. Sirve para que la torre no quede inestable.", "8", "0 = las que quepan"],
  ["Maestro de productos", "Compresión bajo carga (%)", "Cuánto se aplasta la caja o bolsa cuando lleva otra encima. Una caja rígida es 0. Una bolsa o un bulto de textil puede ser 10 a 20. La capa de hasta arriba conserva su altura completa, así que el cálculo queda del lado seguro.", "15", "0 (rígida)"],
  ["Maestro de productos", "Máx. cajas apiladas", "Cuántas cajas de este SKU pueden ir una encima de otra.", "4", "0 = sin límite"],
  ["Maestro de productos", "Prioridad de apilamiento", "Número que decide qué va abajo cuando activas la regla «Prioridad mayor va abajo». Una caja con 3 puede llevar encima cajas con 3, 2 o 1, nunca con 4. Úsalo para poner abajo lo pesado o resistente (3) y arriba lo ligero o frágil (1).", "3 pesado · 1 frágil", "0 = no se usa"],
  ["Maestro de productos", "Peso máx. encima (kg)", "Resistencia de la caja: cuánto peso aguanta encima.", "60", "0 = sin límite"],
  ["Maestro de productos", "Posición", "Libre, Solo piso (siempre abajo) o Nunca piso (siempre encima de otra caja).", "Solo piso", "Libre"],
  ["Maestro de productos", "Soporta carga encima", "No = nada puede ir encima de esta caja (frágil).", "Sí", "Sí"],
  ["Maestro de productos", "UM de la caja", "Unidad en la que el maestro guarda las medidas: la caja, bolsa o bulto que se estiba. Si el pedido llega en otra unidad (millares, pallets, kilos), la herramienta convierte a esta usando la tabla de conversiones.", "CJ", "CJ (caja)"],
  ["Conversiones de unidad", "Para qué sirve", "Cuando el pedido llega en una unidad distinta a la caja (por ejemplo millares), la tabla dice cuántas cajas son. En Maestro puedes importar el archivo de conversiones de tu ERP (SETID, INV_ITEM_ID, UNIT_OF_MEASURE, CONVERSION_RATE); solo se guardan los SKUs que estén en tu maestro.", "5 ML → 25 CJ", "—"],
  ["Conversiones de unidad", "Factor", "Cuántas unidades base equivale 1 de esa unidad. La unidad base es la que tiene factor 1. Ejemplo: ML = 1, UN = 0.001 y CJ = 0.2 significa que 1 millar son 1,000 unidades y una caja lleva 200.", "0.2", "Sin conversión"],
  ["Pedido (plantilla de carga)", "UM (opcional)", "Unidad en la que viene la cantidad. Vacío = ya son cajas. Si pones otra (ML, PLT, KG…), se convierte a cajas y la herramienta avisa si tuvo que redondear hacia arriba.", "ML", "Cajas"],
  ["Paletizado", "Paletizar", "No = se carga suelta. Un SKU = pallets solo de este producto. Mixto = pallets combinados con otros SKUs marcados como Mixto que usen el mismo pallet. Luego los pallets se suben al vehículo junto con lo suelto.", "Un SKU", "No"],
  ["Paletizado", "Pallet", "Nombre exacto de un pallet de la hoja Pallets.", "Americano 1219×1016", "El primer pallet"],
  ["Paletizado", "Cajas por pallet", "Estándar de cajas por pallet. Si no caben, la herramienta avisa y usa el máximo posible. Las cajas se giran dentro de cada capa para aprovechar el pallet.", "20", "0 = las que quepan"],
  ["Paletizado", "Cajas por nivel y Niveles", "Para armar el pallet a tu manera: cuántas cajas van en cada cama y cuántas camas. Vacío o 0 = la herramienta calcula el mejor acomodo con las medidas de la caja y la altura de la tarima. Si pones solo uno de los dos, el otro lo calcula ella.", "12 · 5", "0 = automático"],
  ["Paletizado", "Sobrantes", "Qué hacer con las cajas que no completan un pallet: Pallet incompleto, Sueltas o Pallet mixto (se juntan con sobrantes de otros SKUs).", "Pallet mixto", "Pallet incompleto"],
  ["Paletizado", "Acepta cajas / pallet encima", "Si sobre este pallet pueden ir cajas sueltas u otro pallet. Solo aplica si el pallet queda con tope plano.", "Sí / No", "Cajas Sí · Pallet No"],
  ["Pallets", "Largo, Ancho, Espesor (mm)", "Medidas del pallet vacío. Espesor = altura del pallet.", "1219 · 1016 · 150", "Obligatorio"],
  ["Pallets", "Altura máx. (mm)", "Altura total permitida del pallet armado, incluyendo la base.", "1800", "1800"],
  ["Pallets", "Carga máx. (kg)", "Peso máximo de mercancía sobre el pallet.", "1200", "0 = sin límite"],
  ["Pallets", "Sobresale a lo largo / a lo ancho (mm)", "Cuánto pueden salir las cajas del borde del pallet, por cada lado. En el visor se dibuja como línea roja punteada.", "30 · 0", "0 = sin sobresalir"],
  ["Pedido (plantilla de carga)", "SKU y Cantidad", "Qué se va a cargar y cuántas cajas. Las medidas y reglas salen del maestro.", "JNS-010 · 60", "Obligatorio"],
  ["Pedido (plantilla de carga)", "Entrega (parada)", "Número de parada de la ruta: la 1 se entrega primero, así que se carga al final y queda junto a las puertas. Las paradas altas van al fondo. Mismo número = se cargan juntos. Vacío = se acomoda donde convenga, al fondo.", "1", "Libre"],
  ["Pedido (plantilla de carga)", "Paletizar y Cajas por pallet (opcionales)", "Solo si en esta carga quieres algo distinto a lo que dice el maestro. Vacío = se usa el maestro.", "Mixto · 20", "Se usa el maestro"],
  ["Pedido (plantilla de carga)", "Pedido / destino", "Número de pedido, tienda o cliente. Con la regla «Mantener juntos los pedidos» los SKUs de un mismo pedido se cargan seguidos, dentro de su parada. Un pedido no queda en un solo bloque perfecto: queda agrupado dentro de su zona.", "PED-4471 Norte", "Sin pedido"],
  ["Categorías", "Qué sí hace", "La categoría solo controla apilamiento: con la regla «Solo sobre la misma categoría» activa, un producto solo recibe encima otro de su misma categoría, sin importar el SKU. Compresión, anidado y demás siguen siendo campos por SKU, no por categoría.", "Tejas sobre tejas", "—"],
  ["Bundle (BDL)", "Qué es", "Un Bundle agrupa varias cajas del mismo SKU en un bulto más grande, sin pallet, con sus propias medidas y peso. Se configura en la hoja Bundles del maestro: si un SKU está ahí, en cada línea del pedido se puede elegir cargarlo en Bundle.", "—", "El SKU no tiene la opción Bundle"],
  ["Bundle (BDL)", "Cómo se calcula", "Como en el andén: primero se cargan todos los Bundles completos (lo que no completa un Bundle va suelto). Solo si así la carga necesita un vehículo más, se abren los menos Bundles posibles y sus cajas se acomodan sueltas en los huecos. Si abrirlos no ahorra un vehículo, no se abre ninguno. El mix Bundle / suelto sale en el resultado; no se define antes.", "36 BDL + 4 abiertos", "—"],
  ["Bundle (BDL)", "Cajas por Bundle", "Cuántas cajas de este SKU forman un Bundle completo. Al importar un archivo CS-BDL sale de la columna CS / BDL, o de Rel ÷ Factor.", "24", "Sin Bundle"],
  ["Bundle (BDL)", "Largo, Ancho, Alto Bundle (mm)", "Medidas del Bundle ya armado, independientes de la caja suelta. El cubicaje usa estas medidas para los cargos tipo Bundle.", "1200 · 1000 · 1500", "Sin Bundle (inválido)"],
  ["Bundle (BDL)", "Peso Bundle (kg)", "Peso del Bundle completo. En 0, se calcula como el peso de la caja suelta × la cantidad estándar por Bundle.", "220", "Peso de caja × cantidad estándar"],
  ["Categorías", "Qué no hace todavía", "Dos limitaciones a propósito: (1) el anidado (una pieza dentro de otra) solo funciona entre piezas del mismo SKU, no entre SKUs distintos de la misma categoría — por ejemplo, tanques de tamaños diferentes que embonan uno en otro no se resuelve en esta versión. (2) No hay una matriz de compatibilidad entre categorías distintas (tejas sobre tanques, por ejemplo); solo «misma categoría sí» o la regla general. Para bolsas (BL) con compresión, sigue usando el campo Compresión de cada SKU: no se aplica sola por venir en BL.", "—", "—"],
  ["Dónde va cada parámetro", "Maestro vs. carga", "Las características de la caja (medidas, peso, orientaciones, resistencia, paletizado estándar) van en el maestro y son el valor normal. Si en una carga necesitas algo distinto, cámbialo en Mercancía: aplica solo a esa carga y la fila se marca como «ajustado». Si quieres que quede como nuevo estándar, usa «Guardar en el maestro».", "—", "—"],
  ["Dónde va cada parámetro", "Plantilla de CubeMaster", "En Maestro puedes importar la plantilla «Cargo Upload» de CubeMaster (cm y kg): se crean los productos, los pallets y el pedido con sus cantidades. La columna FloorStackType no se toma, porque CubeMaster solo la usa con su regla de piso activada; si la necesitas, ajusta Posición en el SKU.", "—", "—"],
  ["Reglas", "Nivel de optimización", "Cuántas combinaciones prueba. Más nivel = mejor acomodo, pero tarda más.", "2", "2"],
  ["Reglas", "Apoyo mínimo (%)", "Qué parte de la base de una caja debe estar apoyada. 75% es lo usual.", "75", "75"],
  ["Reglas", "Qué tan estricto es el orden de entrega", "Estricto: cada entrega ocupa su propia zona; la descarga sale limpia, pero a veces se necesita un vehículo más. Flexible: deja que una entrega se meta un poco en la zona anterior; se aprovecha mejor el espacio a cambio de mover algunos bultos al descargar.", "Estricto", "Estricto"],
  ["Reglas", "Cargar en el orden de la lista", "La primera fila del pedido entra primero y queda al fondo del vehículo. Con esta regla activa aparecen flechas para subir o bajar cada línea, y al moverla la carga se vuelve a acomodar sola en el visor. Sirve para ajustar a mano una solución que ya calculaste.", "Activado", "Desactivado"],
  ["Resultados", "Recomendar vehículo", "El botón de arriba corre el mismo pedido contra cada vehículo de la lista y los ordena: primero el que necesita menos unidades y, a igualdad, el que va más lleno. Se calcula en nivel 1 para que sea rápido; el que elijas se recalcula con tu nivel normal.", "—", "—"],
  ["Reglas", "Un vehículo por pedido", "No mezcla pedidos distintos en el mismo vehículo. Sirve cuando cada transferencia viaja por separado; a cambio se usan más vehículos.", "Activado", "Desactivado"],
  ["Reglas", "Cajas del mismo SKU", "Mantener juntas arma bloques del mismo SKU (más fácil de descargar). Permitir separar reparte cajas en huecos.", "Mantener juntas", "Mantener juntas"],
  ["Resultados", "Revisión del pedido", "Al subir un pedido aparece una tabla con cada línea: qué se capturó, en qué unidad llegó y cuántas cajas quedaron. Se marcan las que necesitan revisión (sin conversión, redondeadas, sin medidas) y se puede descargar en Excel. Las cantidades nunca se cambian en silencio.", "—", "—"],
  ["Resultados", "Bultos que estorban", "Bultos de una parada posterior que quedaron entre las puertas y algo que se entrega antes, en el mismo pasillo y a la misma altura o por debajo. Es lo que habría que mover al descargar. Con «Ordenar por entrega» activo suele ser cero.", "0", "—"],
];

// Textos de captura ↔ valores internos
const FORMA_TXT = { caja: "Caja", barril: "Barril", tubo: "Tubo", teja: "Teja" };
export const leerForma = (v) => { const k = clave(v); return k.includes("barril") || k.includes("cilindro") || k.includes("tambo") ? "barril" : k.includes("tubo") || k.includes("rollo") ? "tubo" : k.includes("teja") ? "teja" : "caja"; };
const PISO_TXT = { libre: "Libre", soloPiso: "Solo piso", noPiso: "Nunca piso" };
const RESTO_TXT = { parcial: "Pallet incompleto", sueltas: "Sueltas", mixto: "Pallet mixto" };
const leerPiso = (v) => { const k = clave(v); return k.includes("solo") ? "soloPiso" : k.includes("nunca") || k === "nopiso" ? "noPiso" : "libre"; };
const leerResto = (v) => { const k = clave(v); return k.includes("mixto") ? "mixto" : k.includes("suelta") ? "sueltas" : "parcial"; };
export const ORIS_STD = [true, true, false, false, false, false];
export const leerOris = (v) => {
  const k = clave(v);
  if (!k) return [...ORIS_STD];
  if (k.includes("toda")) return [true, true, true, true, true, true];
  if (k.includes("acost")) return [true, true, true, true, false, false];
  if (k.includes("singirar")) return [true, false, false, false, false, false];
  if (k.includes("pie")) return [...ORIS_STD];
  const a = [1, 2, 3, 4, 5, 6].map((n) => k.includes(String(n)));
  return a.some(Boolean) ? a : [...ORIS_STD];
};
export const orisTxt = (o) => {
  const f = o.map((v) => (v ? 1 : 0)).join("");
  return { "111111": "Todas", "111100": "De pie y acostada", "110000": "Solo de pie", "100000": "De pie sin girar" }[f] || o.map((v, i) => (v ? i + 1 : "")).join("");
};
export const leerPaletizar = (v) => { const k = clave(v); return k.includes("mixt") ? "mixto" : ["si", "s", "1", "true", "x", "unsku", "uno", "unosku"].includes(k) ? true : false; };
const paletizarTxt = (v) => (v === "mixto" ? "Mixto" : v ? "Un SKU" : "No");
const hexColor = (v) => { const t = String(v ?? "").trim().replace("#", ""); return /^[0-9a-f]{6}$/i.test(t) ? "#" + t.toUpperCase() : null; };

// pid identifica al producto dentro de la sesión (la UI lo usa como key); no se guarda en el Excel.
let sigPid = 1;
export const productoVacio = (d = {}) => ({
  pid: sigPid++, sku: "", idProducto: "", categoria: "", desc: "", L: 600, W: 400, H: 400, peso: 10, piezas: 1, oris: [...ORIS_STD], volteoPiso: false, compresion: 0, maxNiveles: 0, valorApilar: 0, pesoMaxEncima: 0,
  forma: "caja", diametro: 0, anidado: 0, maxAnidado: 0, piso: "libre", soportaEncima: true, umCaja: UM_CAJA_DEF, paletizar: false, tarima: "", porPallet: 0, porCapa: 0, capasPallet: 0, resto: "parcial", aceptaCajas: true, aceptaPallet: false, color: null,
  bundleCantidadEstandar: 0, bundleL: 0, bundleW: 0, bundleH: 0, bundlePeso: 0, ...d,
});

// Arma un producto a partir de la fila de Datos (identidad y medidas) y, si existe, la fila de
// Parámetros que le corresponde por SKU. Sin fila de parámetros, se usan los valores por omisión
// (igual que un producto nuevo): así un SKU que solo tiene medidas no se cae, solo llega "sin configurar".
// La fila de la hoja Bundles (bOne), si existe, manda sobre las columnas de Bundle de los maestros viejos.
function productoDeFilas(dOne, pOne, bOne) {
  const o = pOne || {};
  const viejo = siNo(o.bundleactivo, false);   // maestros anteriores: columnas de Bundle en Parámetros
  const b = bOne ? { c: Math.round(numero(bOne.cajasporbundle ?? bOne.cantidadestandarporbundle ?? bOne.csbdl)), L: numero(bOne.largobundle ?? bOne.largo), W: numero(bOne.anchobundle ?? bOne.ancho), H: numero(bOne.altobundle ?? bOne.alto), p: numero(bOne.pesobundle ?? bOne.peso) }
    : viejo ? { c: Math.round(numero(o.cantidadestandarporbundle)), L: numero(o.largobundle), W: numero(o.anchobundle), H: numero(o.altobundle), p: numero(o.pesobundle) } : { c: 0, L: 0, W: 0, H: 0, p: 0 };
  return productoVacio({
    sku: dOne.sku, idProducto: dOne.idProducto, desc: dOne.desc, L: dOne.L, W: dOne.W, H: dOne.H, peso: dOne.peso,
    categoria: String(o.categoria ?? "").trim(), piezas: numero(o.piezasporcaja, 1) || 1,
    forma: leerForma(o.forma), anidado: numero(o.anidadosubeporpieza), maxAnidado: Math.round(numero(o.maxpiezasanidadas)),
    oris: leerOris(o.orientaciones), volteoPiso: siNo(o.volteoenpiso, false), compresion: Math.min(40, numero(o.compresionbajocarga)), maxNiveles: numero(o.maxcajasapiladas ?? o.maxniveles), valorApilar: numero(o.prioridaddeapilamiento ?? o.valorapilamiento),
    pesoMaxEncima: numero(o.pesomaxencima), piso: leerPiso(o.posicion), soportaEncima: siNo(o.soportacargaencima, true), umCaja: normalizaUM(o.umdelacaja) || UM_CAJA_DEF, paletizar: leerPaletizar(o.paletizar),
    tarima: String(o.pallet ?? o.tarima ?? "").trim(), porPallet: numero(o.cajasporpallet), porCapa: numero(o.cajaspornivel), capasPallet: numero(o.niveles), resto: leerResto(o.sobrantes), aceptaCajas: siNo(o.aceptacajasencima, true),
    aceptaPallet: siNo(o.aceptapalletencima, false), color: hexColor(o.color),
    bundleCantidadEstandar: b.c, bundleL: b.L, bundleW: b.W, bundleH: b.H, bundlePeso: b.p,
  });
}

function leerHojaTarimas(wb, elegida = "auto") {
  const ht = buscarHoja(wb, ["tarimas", "pallets"]);
  const { factores } = factoresDeHoja(ht, elegida);
  return ht ? hojaAObjetos(ht).map((o) => aMetrico(o, factores)).filter((o) => String(o.nombre ?? "").trim()).map((o) => ({
    nombre: String(o.nombre).trim(), L: numero(o.largo, 1200), W: numero(o.ancho, 1000), esp: numero(o.espesor, 150), peso: numero(o.peso, 25),
    altMax: numero(o.alturamax, 1800), maxKg: numero(o.cargamax, 0), ovL: numero(o.sobresalealolargo ?? o.sobresaliente, 0), ovW: numero(o.sobresalealoancho ?? o.sobresaliente, 0),
  })) : null;
}

// Lee maestro_productos.xlsx. Devuelve { productos, tarimas (null si no hay hoja), errores: string[] }.
// Acepta el formato nuevo, en dos hojas (Datos + Parámetros), y por compatibilidad el formato viejo
// de una sola hoja (Productos), típico de archivos hechos antes de esta separación.
// unidades: la que eligió el usuario al subirlo ("auto" = según los encabezados; ver unidades.js).
// Todo se devuelve en mm y kg, y en `unidades` el texto de lo que se leyó ("pulgadas y libras").
export function leerMaestro(buf, unidades = "auto") {
  const wb = XLSX.read(buf, { type: "array" });
  const tarimas = leerHojaTarimas(wb, unidades);
  const conversiones = conversionesDeHoja(buscarHoja(wb, [clave(HOJA_CONVERSIONES)]));
  const hd = buscarHoja(wb, ["datos", "medidas", "dimensiones"]);
  const hpar = buscarHoja(wb, ["parametros", "parámetros", "reglas"]);
  const hb = buscarHoja(wb, ["bundles", "bundle"]), fb = factoresDeHoja(hb, unidades), porSkuBundle = new Map();
  if (hb) hojaAObjetos(hb).map((o) => aMetrico(o, fb.factores)).forEach((o) => { const sku = String(o.sku ?? o.idarticulo ?? "").trim(); if (sku && !porSkuBundle.has(claveSku(sku))) porSkuBundle.set(claveSku(sku), o); });
  // Un SKU con sufijo de variante ("…-R006940") toma el Bundle de su SKU base si él no tiene fila propia
  const bundleDe = (sku) => porSkuBundle.get(claveSku(sku)) ?? (skuBase(sku) ? porSkuBundle.get(claveSku(skuBase(sku))) : undefined);
  const productos = [], errores = [], vistos = new Set();

  if (hd) {
    // Formato nuevo: Datos trae la identidad y medidas; Parámetros (si existe) las reglas, por SKU.
    const fd = factoresDeHoja(hd, unidades), fp = factoresDeHoja(hpar, unidades);
    const porSku = new Map();
    if (hpar) hojaAObjetos(hpar).map((o) => aMetrico(o, fp.factores)).forEach((o) => { const sku = String(o.sku ?? "").trim(); if (sku && !porSku.has(claveSku(sku))) porSku.set(claveSku(sku), o); });
    hojaAObjetos(hd).map((o) => aMetrico(o, fd.factores)).forEach((o) => {
      const sku = String(o.sku ?? o.codigo ?? "").trim();
      if (!sku) return;
      if (vistos.has(claveSku(sku))) { errores.push(`${sku} está repetido; se usa la primera fila.`); return; }
      vistos.add(claveSku(sku));
      const dOne = { sku, idProducto: String(o.idproducto ?? o.id ?? o.idarticulo ?? o.codigodearticulo ?? "").trim(), desc: String(o.descripcion ?? ""), L: numero(o.largo), W: numero(o.ancho), H: numero(o.alto), peso: numero(o.peso) };
      const p = productoDeFilas(dOne, porSku.get(claveSku(sku)), bundleDe(sku));
      if (!(p.L > 0 && p.W > 0 && p.H > 0)) errores.push(`${sku}: faltan medidas (largo, ancho o alto).`);
      productos.push(p);
    });
    return { productos, tarimas, errores, conversiones, unidades: describirUnidades([...fd.encabezados, ...fp.encabezados], unidades) };
  }

  // Formato anterior: todo en una sola hoja (Productos, o la primera de la libreta).
  const hp = buscarHoja(wb, ["productos", "maestro", "maestrodeproductos"]) || wb.Sheets[wb.SheetNames[0]];
  const fv = factoresDeHoja(hp, unidades);
  hojaAObjetos(hp).map((o) => aMetrico(o, fv.factores)).forEach((o) => {
    const sku = String(o.sku ?? o.codigo ?? "").trim();
    if (!sku) return;
    if (vistos.has(claveSku(sku))) { errores.push(`${sku} está repetido; se usa la primera fila.`); return; }
    vistos.add(claveSku(sku));
    const dOne = { sku, idProducto: String(o.idproducto ?? o.id ?? o.idarticulo ?? o.codigodearticulo ?? "").trim(), desc: String(o.descripcion ?? ""), L: numero(o.largo), W: numero(o.ancho), H: numero(o.alto), peso: numero(o.peso) };
    const p = productoDeFilas(dOne, o, bundleDe(sku));
    if (!(p.L > 0 && p.W > 0 && p.H > 0)) errores.push(`${sku}: faltan medidas (largo, ancho o alto).`);
    productos.push(p);
  });
  return { productos, tarimas, errores, conversiones, unidades: describirUnidades(fv.encabezados, unidades) };
}

// Escribe maestro_productos.xlsx en dos hojas (Datos y Parámetros, ver COLS_DATOS/COLS_PARAMETROS
// arriba), más Tarimas e Instrucciones. Devuelve el archivo como bytes.
// sis: el sistema de unidades del usuario (SISTEMAS de unidades.js). Por omisión, mm y kg. Los encabezados
// dicen la unidad ("Largo (in)"), así que el archivo se vuelve a leer bien sin elegir nada al subirlo.
const enL = (v, sis) => Math.round(((+v || 0) / sis.mmPorL) * 1000) / 1000;
const enP = (v, sis) => Math.round(((+v || 0) / sis.kgPorP) * 10000) / 10000;
const volFormula = (r, sis) => (sis.id === "metrico" ? `ROUND(D${r}*E${r}*F${r}/1000000000,4)` : `ROUND(D${r}*E${r}*F${r}/1728,4)`);
function hojaDatos(productos, sis) {
  const filas = [COLS_DATOS.map((h) => encabezadoEn(h, sis)), ...productos.map((p) => [p.sku, p.idProducto, p.desc, enL(p.L, sis), enL(p.W, sis), enL(p.H, sis), enP(p.peso, sis), null])];
  const ws = XLSX.utils.aoa_to_sheet(filas);
  productos.forEach((p, i) => { const r = i + 2; ws["H" + r] = { t: "n", f: volFormula(r, sis), v: Math.round(((p.L * p.W * p.H) / sis.mm3PorV) * 1e4) / 1e4 }; });
  ws["!cols"] = COLS_DATOS.map((h, i) => ({ wch: i === 2 ? 32 : Math.max(10, h.length + 2) }));
  return ws;
}
export function libroMaestro(productos, tarimas, conversiones = null, sis = SISTEMAS.metrico) {
  const wb = XLSX.utils.book_new();

  const wd = hojaDatos(productos, sis);
  wd["!cols"] = COLS_DATOS.map((h, i) => ({ wch: i === 2 ? 32 : Math.max(10, h.length + 2) }));
  wd["!autofilter"] = { ref: `A1:H${Math.max(2, productos.length + 1)}` };
  XLSX.utils.book_append_sheet(wb, wd, "Datos");

  const filasParam = [COLS_PARAMETROS.map((h) => encabezadoEn(h, sis)), ...productos.map((p) => [p.sku, p.categoria, FORMA_TXT[p.forma] || "Caja", p.piezas, orisTxt(p.oris), p.volteoPiso ? "Sí" : "No", p.compresion, enL(p.anidado, sis), p.maxAnidado, p.maxNiveles,
    p.valorApilar, enP(p.pesoMaxEncima, sis), PISO_TXT[p.piso], p.soportaEncima ? "Sí" : "No", p.umCaja || UM_CAJA_DEF, paletizarTxt(p.paletizar), p.tarima, p.porPallet, p.porCapa, p.capasPallet, RESTO_TXT[p.resto],
    p.aceptaCajas ? "Sí" : "No", p.aceptaPallet ? "Sí" : "No", p.color ? p.color.replace("#", "") : ""])];
  const wp = XLSX.utils.aoa_to_sheet(filasParam);
  wp["!cols"] = COLS_PARAMETROS.map((h, i) => ({ wch: i === 4 ? 16 : Math.max(10, h.length + 2) }));
  wp["!autofilter"] = { ref: `A1:X${Math.max(2, productos.length + 1)}` };
  XLSX.utils.book_append_sheet(wb, wp, "Parámetros");

  const conBundle = productos.filter((p) => p.bundleCantidadEstandar > 0 && p.bundleL > 0 && p.bundleW > 0 && p.bundleH > 0);
  const wb2 = XLSX.utils.aoa_to_sheet([COLS_BUNDLES.map((h) => encabezadoEn(h, sis)), ...conBundle.map((p) => [p.sku, p.bundleCantidadEstandar, enL(p.bundleL, sis), enL(p.bundleW, sis), enL(p.bundleH, sis), enP(p.bundlePeso, sis)])]);
  wb2["!cols"] = COLS_BUNDLES.map((h, i) => ({ wch: i === 0 ? 18 : Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wb2, "Bundles");

  const TARIMA_PESO = ["peso", "maxKg"];
  const wt = XLSX.utils.aoa_to_sheet([COLS_TARIMAS.map((c) => encabezadoEn(c[0], sis)), ...tarimas.map((t) => COLS_TARIMAS.map(([, k]) => (k === "nombre" ? t[k] : TARIMA_PESO.includes(k) ? enP(t[k], sis) : enL(t[k], sis))))]);
  wt["!cols"] = COLS_TARIMAS.map(([h], i) => ({ wch: i === 0 ? 26 : Math.max(12, h.length + 2) }));
  XLSX.utils.book_append_sheet(wb, wt, "Pallets");
  const fc = filasConversiones(conversiones, productos);
  if (fc.length) {
    const wc = XLSX.utils.aoa_to_sheet([["SKU", "UM", "Factor"], ...fc]);
    wc["!cols"] = [{ wch: 18 }, { wch: 8 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wc, HOJA_CONVERSIONES);
  }
  const wi = XLSX.utils.aoa_to_sheet([["Maestro de productos de DarnelCube 3D"], ["Guarda este archivo como maestro_productos.xlsx en la carpeta de la herramienta. Al guardar desde DarnelCube 3D se reemplaza y queda una copia como maestro_productos_respaldo.xlsx."], [],
    ["Sección", "Campo", "Qué significa", "Ejemplo", "Si lo dejas vacío"], ...AYUDA]);
  wi["!cols"] = [{ wch: 24 }, { wch: 30 }, { wch: 80 }, { wch: 24 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, wi, "Instrucciones");
  return escribirXlsx(wb);
}

// ================= Plantilla de Bundles =================
// La hoja Bundles sola (con los SKUs que ya tienen Bundle, o dos filas de ejemplo) más instrucciones. Se llena y se
// sube con «Importar → Bundle»; al guardar el maestro queda en su hoja Bundles.
export function plantillaBundles(productos = [], sis = SISTEMAS.metrico) {
  const wb = XLSX.utils.book_new();
  const con = productos.filter((p) => p.bundleCantidadEstandar > 0 && p.bundleL > 0 && p.bundleW > 0 && p.bundleH > 0);
  const filas = con.length ? con.map((p) => [p.sku, p.desc, p.bundleCantidadEstandar, enL(p.bundleL, sis), enL(p.bundleW, sis), enL(p.bundleH, sis), enP(p.bundlePeso, sis)])
    : [["DU2014501", "Ejemplo: charola escolar", 20, enL(1085.85, sis), enL(882.65, sis), enL(2762.25, sis), 0], ["DU401101", "Ejemplo: contenedor G-1", 32, enL(1492.25, sis), enL(1282.7, sis), enL(2501.9, sis), 0]];
  const cols = ["SKU", "Descripción", "Cajas por Bundle", "Largo Bundle (mm)", "Ancho Bundle (mm)", "Alto Bundle (mm)", "Peso Bundle (kg)"];
  const ws = XLSX.utils.aoa_to_sheet([cols.map((h) => encabezadoEn(h, sis)), ...filas]);
  ws["!cols"] = [{ wch: 16 }, { wch: 40 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws, "Bundles");
  const wi = XLSX.utils.aoa_to_sheet([["Plantilla de Bundles · DarnelCube 3D"], [],
    ["Una fila por SKU que se carga en Bundle (cajas grandes una encima de otra, sin pallet)."],
    ["Cajas por Bundle: cuántas cajas del SKU forman un Bundle completo. Largo, Ancho y Alto: medidas del Bundle armado."],
    ["Peso Bundle: en 0 se calcula como el peso de la caja × cajas por Bundle. La descripción es solo de referencia."],
    [`La unidad va en el encabezado: si cambias (${sis.l}) por (mm), (cm) o (in), la herramienta convierte sola.`], [],
    ["Cómo subirla:"],
    ["1. En DarnelCube 3D, sección Maestro, usa «Importar ▾ → Bundle (BDL)» y elige este archivo."],
    ["2. Solo se actualizan los SKUs que ya están en el maestro. Presiona Guardar para dejarlo en tu cuenta."],
    ["3. En el pedido, esos SKUs aparecen en Bundle. No se captura porcentaje: el mix Bundle / suelto sale en el resultado."]]);
  wi["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(wb, wi, "Instrucciones");
  return escribirXlsx(wb);
}

// ================= Dimensiones (lo que en el futuro podría venir del ERP) =================
// Plantilla mínima: SKU, ID producto, Descripción, medidas y peso. Nada de reglas de estiba.
// Sirve tanto para dar de alta productos nuevos desde el ERP como para refrescar después las
// medidas de los que ya existen, sin tocar los parámetros logísticos que ya se configuraron.
export function plantillaDimensiones(productos = [], sis = SISTEMAS.metrico) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, hojaDatos(productos, sis), "Datos");
  const wi = XLSX.utils.aoa_to_sheet([["Plantilla de dimensiones · DarnelCube 3D"], [],
    [`Solo identidad y medidas: SKU, ID producto, Descripción, Largo, Ancho, Alto (${sis.l}) y Peso (${sis.p}). Volumen se calcula solo.`],
    ["La unidad va en el encabezado de cada columna: si cambias (mm) por (in), (cm) o (m), o (kg) por (lb), la herramienta convierte sola."],
    ["Es lo que en teoría podría entregar un ERP. No lleva ninguna regla de estiba, paletizado ni apilamiento:"],
    ["esas se configuran aparte, en DarnelCube 3D, y no se pierden cuando actualizas medidas con este archivo."], [],
    ["Cómo usarla:"],
    ["1. Llena una fila por SKU (o exporta esto mismo desde tu ERP con las mismas columnas)."],
    ["2. En DarnelCube 3D, sección Maestro, usa «Actualizar dimensiones» y elige este archivo."],
    ["3. Los SKUs que ya existen actualizan solo su descripción y medidas. Los que no existen se crean"],
    ["   nuevos, con los parámetros por omisión, listos para configurarse."]]);
  wi["!cols"] = [{ wch: 100 }];
  XLSX.utils.book_append_sheet(wb, wi, "Instrucciones");
  return escribirXlsx(wb);
}

// Lee un archivo de solo dimensiones (el mismo formato de plantillaDimensiones, o la hoja "Datos" de
// un maestro completo) y actualiza identidad y medidas sobre los productos actuales, por SKU o por ID
// producto. Nunca toca las reglas de estiba: un producto que ya existía conserva sus parámetros tal
// cual; uno nuevo se crea con los valores por omisión, para configurarse después.
export function actualizarDimensiones(productosActuales, buf, unidades = "auto") {
  const wb = XLSX.read(buf, { type: "array" });
  const hd = buscarHoja(wb, ["datos", "medidas", "dimensiones"]) || wb.Sheets[wb.SheetNames[0]];
  const fd = factoresDeHoja(hd, unidades);
  const porSku = new Map(), porId = new Map();
  productosActuales.forEach((p) => { if (p.sku) porSku.set(claveSku(p.sku), p); if (p.idProducto) porId.set(claveSku(p.idProducto), p); });
  const productos = [...productosActuales], errores = [], vistos = new Set();
  let actualizados = 0, creados = 0;
  hojaAObjetos(hd).map((o) => aMetrico(o, fd.factores)).forEach((o) => {
    const sku = String(o.sku ?? o.codigo ?? "").trim();
    if (!sku) return;
    if (vistos.has(claveSku(sku))) { errores.push(`${sku} está repetido en el archivo; se usa la primera fila.`); return; }
    vistos.add(claveSku(sku));
    const idProducto = String(o.idproducto ?? o.id ?? o.idarticulo ?? o.codigodearticulo ?? "").trim();
    const datos = { desc: String(o.descripcion ?? ""), L: numero(o.largo), W: numero(o.ancho), H: numero(o.alto), peso: numero(o.peso) };
    if (!(datos.L > 0 && datos.W > 0 && datos.H > 0)) { errores.push(`${sku}: faltan medidas (largo, ancho o alto); no se actualizó.`); return; }
    const existente = porSku.get(claveSku(sku)) || (idProducto && porId.get(claveSku(idProducto)));
    if (existente) {
      // Copia nueva (nunca mutar el producto que ya está en el estado de React)
      const pos = productos.indexOf(existente), nuevo = { ...existente, sku, idProducto: idProducto || existente.idProducto, ...datos };
      productos[pos] = nuevo; porSku.set(claveSku(sku), nuevo); if (nuevo.idProducto) porId.set(claveSku(nuevo.idProducto), nuevo);
      actualizados++;
    } else {
      const nuevo = productoVacio({ sku, idProducto, ...datos });
      productos.push(nuevo); porSku.set(claveSku(sku), nuevo); if (idProducto) porId.set(claveSku(idProducto), nuevo);
      creados++;
    }
  });
  return { productos, actualizados, creados, errores, unidades: describirUnidades(fd.encabezados, unidades) };
}

// Importa los parámetros de Bundle desde un Excel de referencia (formato "CS-BDL": ID Artículo, UM,
// Rel, Factor, CS/BDL, Alto/Largo/Ancho en mm). Solo actualiza SKUs que YA existen en el maestro: este
// archivo no da de alta productos nuevos, solo configura el Bundle de los que ya tienen
// sus medidas y reglas normales. La cantidad estándar por Bundle sale de la columna "CS / BDL" si
// viene en el archivo; si no, se calcula como Rel ÷ Factor (la misma fórmula del documento funcional,
// ya resuelta a cajas). Lo importado queda en la hoja Bundles del maestro al guardar.
export function leerBundleMaestro(productosActuales, buf, unidades = "auto") {
  const wb = XLSX.read(buf, { type: "array" });
  const ws = buscarHoja(wb, ["csbdl", "bundle", "maestrobundle"]) || wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", blankrows: false });
  const ID_SKU = ["idarticulo", "sku", "codigo", "item", "iditem"];
  const hi = filas.findIndex((f) => f.some((c) => ID_SKU.includes(clave(c))));
  if (hi < 0) throw new Error("No se encontró la columna del artículo (ID Artículo o SKU).");
  const heads = filas[hi].map(clave);
  const iSku = heads.findIndex((h) => ID_SKU.includes(h));
  const iCsBdl = heads.findIndex((h) => h === "csbdl" || h === "cajasporbundle" || h === "cantidadestandarporbundle");
  const iRel = heads.findIndex((h) => h === "rel" || h === "relacion");
  const iFactor = heads.findIndex((h) => h === "factor");
  const iAlto = heads.findIndex((h) => h === "alto" || h === "altobundle");
  const iLargo = heads.findIndex((h) => h === "largo" || h === "largobundle");
  const iAncho = heads.findIndex((h) => h === "ancho" || h === "anchobundle");
  const iPeso = heads.findIndex((h) => h === "pesobundle");
  if (iAlto < 0 || iLargo < 0 || iAncho < 0) throw new Error("Faltan las columnas de dimensiones del Bundle (Alto, Largo, Ancho).");
  // El archivo CS-BDL dice su unidad en el encabezado ("Alto (mm)"); si no dice nada, se asume mm.
  const fL = factorColumna(filas[hi][iLargo], "largo", unidades), fW = factorColumna(filas[hi][iAncho], "largo", unidades), fH = factorColumna(filas[hi][iAlto], "largo", unidades);

  const indice = indiceSku(productosActuales);
  const productos = [...productosActuales], errores = [], noEncontrados = [];
  // Primero se lee el archivo completo, porque una fila puede aplicar además a las variantes del SKU
  // ("DU4051199V-R006940" toma el Bundle de "DU4051199V" si el archivo no trae su código exacto).
  const delArchivo = new Map();
  for (let i = hi + 1; i < filas.length; i++) {
    const f = filas[i], sku = String(f[iSku] ?? "").trim();
    if (!sku) continue;
    const cantidadEstandar = Math.round(iCsBdl >= 0 && numero(f[iCsBdl]) > 0 ? numero(f[iCsBdl])
      : (iRel >= 0 && iFactor >= 0 && numero(f[iFactor]) > 0 ? numero(f[iRel]) / numero(f[iFactor]) : 0));
    const bundleL = numero(f[iLargo]) * fL, bundleW = numero(f[iAncho]) * fW, bundleH = numero(f[iAlto]) * fH;
    if (!(cantidadEstandar > 0) || !(bundleL > 0 && bundleW > 0 && bundleH > 0)) { errores.push(`${sku}: fila incompleta (cantidad estándar o dimensiones); no se importó.`); continue; }
    const cfg = { bundleCantidadEstandar: cantidadEstandar, bundleL, bundleW, bundleH, ...(iPeso >= 0 ? { bundlePeso: numero(f[iPeso]) * factorColumna(filas[hi][iPeso], "peso", unidades) } : {}) };
    if (!delArchivo.has(claveSku(sku))) delArchivo.set(claveSku(sku), cfg);
    if (!buscarSku(indice, sku)) noEncontrados.push(sku);
  }
  let actualizados = 0, porBase = 0;
  productos.forEach((p, pos) => {
    const propia = delArchivo.get(claveSku(p.sku)) ?? delArchivo.get(claveSku(p.idProducto));
    const base = !propia && skuBase(p.sku) ? delArchivo.get(claveSku(skuBase(p.sku))) : null;
    const cfg = propia || base;
    if (!cfg) return;
    productos[pos] = { ...p, ...cfg };   // copia nueva: nunca se muta el producto que está en el estado de React
    actualizados++; if (base) porBase++;
  });
  if (porBase) errores.push(`${porBase} SKU${porBase === 1 ? "" : "s"} con sufijo de variante (por ejemplo «-R006940») tomaron el Bundle de su SKU base.`);
  if (noEncontrados.length) errores.push(`${noEncontrados.length} SKU${noEncontrados.length === 1 ? "" : "s"} del archivo no ${noEncontrados.length === 1 ? "está" : "están"} en el maestro: ${noEncontrados.slice(0, 8).join(", ")}${noEncontrados.length > 8 ? "…" : ""}.`);
  return { productos, actualizados, errores };
}

// Plantilla "Cargo Upload" de CubeMaster (cm y kg): productos, tarimas y cantidades en una sola hoja "Cargoes"
export function leerCubeMaster(buf) {
  const wb = XLSX.read(buf, { type: "array" }), ws = buscarHoja(wb, ["cargoes"]) || wb.Sheets[wb.SheetNames[0]];
  const filas = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const bits = (m) => (m > 0 ? [1, 2, 4, 8, 16, 32].map((b) => !!(m & b)) : [...ORIS_STD]);
  const cm = (v) => Math.round(numero(v) * 10 * 10) / 10;
  const productos = [], tarimas = [], lineas = [], vistos = new Map();
  filas.forEach((r) => {
    const sku = String(r.Name ?? "").trim(); if (!sku) return;
    let tarima = "";
    if (numero(r.Palletized) === 1 && numero(r.PalletLength) > 0) {
      tarima = String(r.PalletName || `Pallet ${cm(r.PalletLength)}×${cm(r.PalletWidth)}`).trim();
      if (!tarimas.some((t) => t.nombre === tarima)) tarimas.push({ nombre: tarima, L: cm(r.PalletLength), W: cm(r.PalletWidth), esp: cm(r.PalletThickness) || 150, peso: numero(r.PalletWeight) || 25,
        altMax: cm(r.PalletMaxHeight) || 1800, maxKg: numero(r.PalletMaxWeight), ovL: numero(r.OverhangAllowed) === 1 ? cm(r.OverhangLength) : 0, ovW: numero(r.OverhangAllowed) === 1 ? cm(r.OverhangWidth) : 0 });
    }
    const capas = [1, 2, 3, 4, 5, 6].map((i) => numero(r["MaxLayer" + i])).filter((v) => v > 0);
    const color = numero(r.Color) > 0 ? "#" + [numero(r.Color) & 255, (numero(r.Color) >> 8) & 255, (numero(r.Color) >> 16) & 255].map((v) => v.toString(16).padStart(2, "0")).join("").toUpperCase() : null;
    const p = productoVacio({ sku, desc: String(r.Description || r.Alias1 || ""), L: cm(r.Length), W: cm(r.Width), H: cm(r.Height), peso: numero(r.Weight), piezas: numero(r.PieceInside) || 1,
      oris: bits(numero(r.Orientations)), volteoPiso: numero(r.TurnAllowedOnFloor) === 1, maxNiveles: capas.length ? Math.min(...capas) : 0, valorApilar: numero(r.StackValue),
      pesoMaxEncima: numero(r.MaxSupportingWeight), piso: "libre", soportaEncima: String(r.SupportsOthers).trim() === "" || numero(r.SupportsOthers) === 1,
      paletizar: numero(r.Palletized) === 1, tarima, resto: numero(r.RemainQtyToMixPallet) === 1 ? "mixto" : numero(r.RemainQtyToVehicle) === 1 ? "sueltas" : "parcial",
      aceptaCajas: true, aceptaPallet: numero(r.PalletMaxStacksOnVehicle) > 1, color });
    if (!vistos.has(claveSku(sku))) { vistos.set(claveSku(sku), p); productos.push(p); }
    if (numero(r.Qty) > 0) lineas.push({ sku, qty: Math.round(numero(r.Qty)), orden: Math.round(numero(r.Seq)), grupo: String(r.Group || "").trim() });
  });
  return { productos, tarimas, lineas };
}

// ================= Pedido =================
// El pedido es la plantilla de carga en Excel: qué SKUs y cuántas cajas, con entrega (parada) y pedido opcionales.
// Se aceptan también los nombres viejos de columna: Orden y Grupo / destino.
// La cantidad conserva sus decimales; quien convierte a cajas enteras es aCajas, que además informa el redondeo.
// Las medidas y reglas no vienen aquí: se resuelven contra el maestro. Si el archivo es una plantilla
// de CubeMaster, se delega a leerCubeMaster y se devuelve { cubemaster }.
import * as XLSX from "xlsx";
import { escribirXlsx } from "./escribir.js";
import { clave, numero, hojaAObjetos, buscarHoja } from "./celdas.js";
import { leerCubeMaster, leerPaletizar } from "./maestro.js";
import { normalizaUM } from "./conversiones.js";

export function leerPedido(buf) {
  const wb = XLSX.read(buf, { type: "array" });
  if (buscarHoja(wb, ["cargoes"])) return { cubemaster: leerCubeMaster(buf) };
  const hc = buscarHoja(wb, ["carga", "pedido", "plantilladecarga"]) || wb.Sheets[wb.SheetNames[0]];
  const lineas = hojaAObjetos(hc).map((o) => ({
    // La cantidad se lee tal cual, con decimales: 0.4 ML es una cantidad válida. Solo al convertir a cajas se redondea.
    sku: String(o.sku ?? o.codigo ?? "").trim(), qty: numero(o.cantidad ?? o.cajas ?? o.cantidadcajas), orden: Math.round(numero(o.entrega ?? o.entregaparada ?? o.parada ?? o.orden)),
    // Pedido y Destino son columnas separadas. Si el archivo trae la columna vieja combinada
    // ("Pedido / destino"), se usa como pedido y el destino queda vacío (no se puede separar sola).
    grupo: String(o.pedido ?? o.pedidodestino ?? o.grupo ?? "").trim(),
    destino: String(o.destino ?? "").trim(),
    crudo: o,
    um: normalizaUM(o.um ?? o.unidad ?? o.unidaddemedida),
    pal: o.paletizar !== undefined && String(o.paletizar).trim() !== "" ? leerPaletizar(o.paletizar) : undefined,
    porPallet: o.cajasporpallet !== undefined && String(o.cajasporpallet).trim() !== "" ? Math.round(numero(o.cajasporpallet)) : undefined,
  })).filter((l) => l.sku && l.qty > 0);
  const datos = {};
  const hd = buscarHoja(wb, ["datosdelacarga", "datos"]);
  if (hd) XLSX.utils.sheet_to_json(hd, { header: 1, defval: "" }).forEach(([k, v]) => {
    const c = clave(k), val = String(v ?? "").trim();
    if (!val) return;
    if (c === "nombredelacarga" || c === "nombre") datos.nombre = val;
    if (c === "vehiculo") datos.vehiculo = val;
  });
  return { lineas, datos };
}

// Plantilla de carga en blanco con hasta 3 SKUs de ejemplo, la hoja Medidas del maestro (para el volumen por línea)
// y los vehículos válidos. Devuelve el archivo como bytes.
export function libroPlantilla(productos, vehiculos) {
  const wb = XLSX.utils.book_new();
  const ejemplos = productos.slice(0, 3);
  const filas = [["SKU", "Cantidad", "UM (opcional)", "Entrega (parada)", "Pedido", "Destino", "Paletizar (opcional)", "Cajas por pallet (opcional)", "Descripción (referencia)", "Volumen de la línea (m³)"],
    ...(ejemplos.length ? ejemplos.map((p, i) => [p.sku, 10 * (i + 1), "", i < 2 ? i + 1 : "", i < 2 ? `PED-000${i + 1}` : "", i < 2 ? "Tienda Norte" : "", "", "", p.desc]) : [["SKU-001", 20, "", 1, "PED-0001", "Tienda 1", "", "", "Ejemplo"]])];
  const wc = XLSX.utils.aoa_to_sheet(filas);
  wc["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 14 }, { wch: 15 }, { wch: 16 }, { wch: 18 }, { wch: 18 }, { wch: 20 }, { wch: 34 }, { wch: 16 }];
  // Las celdas con fórmula llevan valor vacío (el escritor descarta las que no tienen) y el libro se recalcula al abrir.
  // El volumen de referencia solo se calcula si la cantidad ya viene en cajas (sin UM).
  for (let r = 2; r <= 500; r++) wc["J" + r] = { t: "s", v: "", f: `IF(C${r}<>"","",IFERROR(ROUND(B${r}*INDEX(Medidas!$B$2:$B$500,MATCH(A${r},Medidas!$A$2:$A$500,0))*INDEX(Medidas!$C$2:$C$500,MATCH(A${r},Medidas!$A$2:$A$500,0))*INDEX(Medidas!$D$2:$D$500,MATCH(A${r},Medidas!$A$2:$A$500,0))/1000000000,3),""))` };
  wc["!ref"] = "A1:J500";
  XLSX.utils.book_append_sheet(wb, wc, "Carga");
  const wm = XLSX.utils.aoa_to_sheet([["SKU", "Largo (mm)", "Ancho (mm)", "Alto (mm)", "Descripción"], ...productos.map((p) => [p.sku, p.L, p.W, p.H, p.desc])]);
  wm["!cols"] = [{ wch: 16 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, wm, "Medidas");
  const wd = XLSX.utils.aoa_to_sheet([["Nombre de la carga", "Carga ejemplo"], ["Vehículo", vehiculos[3].nombre], ["Total cajas", null], ["Total volumen (m³)", null], [], ["Vehículos válidos:"], ...vehiculos.map((v) => [v.nombre])]);
  wd.B3 = { t: "s", v: "", f: "SUM(Carga!B2:B500)" }; wd.B4 = { t: "s", v: "", f: "ROUND(SUM(Carga!I2:I500),2)" };
  wd["!cols"] = [{ wch: 22 }, { wch: 30 }];
  XLSX.utils.book_append_sheet(wb, wd, "Datos de la carga");
  wb.Workbook = { CalcPr: { fullCalcOnLoad: true } };
  return escribirXlsx(wb);
}

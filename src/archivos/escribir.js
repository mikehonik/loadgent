// ================= Escribir un Excel =================
// SheetJS arma bien el libro, pero comprime muy poco: un maestro de 26 mil SKU salía de 16 MB (y de 45 MB
// sin compresión), cuando el mismo archivo guardado desde Excel pesa unos 5 MB. Aquí se arma sin comprimir y
// se vuelve a empacar con fflate, que comprime como Excel. El contenido es exactamente el mismo.
import * as XLSX from "xlsx";
import { unzipSync, zipSync } from "fflate";

export function escribirXlsx(wb) {
  const partes = unzipSync(new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx", compression: false })));
  // [Content_Types].xml va primero, como lo deja Excel (algunos lectores lo esperan así).
  const nombres = Object.keys(partes).sort((a, b) => (b === "[Content_Types].xml") - (a === "[Content_Types].xml"));
  return zipSync(Object.fromEntries(nombres.map((n) => [n, [partes[n], { level: 6 }]])));
}

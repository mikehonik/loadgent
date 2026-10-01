import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { escribirXlsx } from "./escribir.js";

describe("escribirXlsx", () => {
  it("arma un Excel que se vuelve a leer igual y pesa mucho menos que el de SheetJS", () => {
    const filas = [["SKU", "UM", "Factor"], ...Array.from({ length: 20000 }, (_, i) => [8000 + (i >> 2), ["CJ", "UN", "PQ", "ML"][i % 4], (i % 7) + 0.5])];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), "Conversiones");
    const b = escribirXlsx(wb);
    expect(new TextDecoder().decode(b.slice(30, 49))).toBe("[Content_Types].xml");
    expect(XLSX.utils.sheet_to_json(XLSX.read(b, { type: "array" }).Sheets.Conversiones, { header: 1 })).toEqual(filas);
    const sheetjs = XLSX.write(wb, { type: "array", bookType: "xlsx", compression: true });
    expect(b.byteLength).toBeLessThan(sheetjs.byteLength * 0.6);
  });
});

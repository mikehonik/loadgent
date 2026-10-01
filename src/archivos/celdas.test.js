import { describe, it, expect } from "vitest";
import { clave, siNo, numero } from "./celdas.js";

describe("clave", () => {
  it("iguala mayúsculas, acentos, espacios y guiones", () => {
    expect(clave("Café  Sol")).toBe(clave("cafe-sol"));
    expect(clave("DC-0715-6400")).toBe(clave("dc07156400"));
  });

  it("iguala un código numérico guardado como texto y como número en archivos distintos", () => {
    // Caso real: el mismo SKU llega "0500123" (texto, con ceros) en un archivo y 500123
    // (número, sin ceros) en otro, porque Excel se los quita a las celdas numéricas.
    // Antes esto hacía que un SKU real se reportara como "no encontrado".
    expect(clave("0500123")).toBe(clave(500123));
    expect(clave("00085000")).toBe(clave(85000));
    expect(clave("0007156400")).toBe(clave(7156400));
  });

  it("no fusiona un código con punto decimal en dígitos de más", () => {
    // "500123.0" (típico de una celda numérica) no debe volverse "5001230" al quitar el punto.
    expect(clave("500123.0")).toBe(clave(500123));
    expect(clave("500123.0")).not.toBe("5001230");
  });

  it("no toca los ceros de un código alfanumérico", () => {
    // Aquí el 0 es parte del código, no un artefacto de Excel: A0057 no es lo mismo que A57.
    expect(clave("A0057")).toBe("a0057");
    expect(clave("A0057")).not.toBe(clave("A57"));
  });

  it("no rompe con vacío, null o undefined", () => {
    expect(clave("")).toBe("");
    expect(clave(null)).toBe("");
    expect(clave(undefined)).toBe("");
  });

  it("quita el contenido entre paréntesis, como en los nombres de hoja", () => {
    expect(clave("Productos (activos)")).toBe("productos");
  });
});

describe("siNo", () => {
  it("reconoce las formas comunes de sí y no, en cualquier acentuación", () => {
    expect(siNo("Sí", false)).toBe(true);
    expect(siNo("X", false)).toBe(true);
    expect(siNo("No", true)).toBe(false);
  });

  it("usa el valor por omisión cuando la celda viene vacía", () => {
    expect(siNo("", true)).toBe(true);
    expect(siNo(undefined, false)).toBe(false);
  });
});

describe("numero", () => {
  it("acepta coma decimal", () => {
    expect(numero("12,5")).toBe(12.5);
  });

  it("usa el valor por omisión cuando no es un número", () => {
    expect(numero("", 3)).toBe(3);
    expect(numero("abc")).toBe(0);
  });
});

describe("claveSku e indiceSku (el guion cuenta)", async () => {
  const { claveSku, indiceSku, buscarSku, conversionDe } = await import("./celdas.js");
  it("distingue 852-10 de 85210, pero ignora mayúsculas, espacios y ceros a la izquierda", () => {
    expect(claveSku("852-10")).not.toBe(claveSku("85210"));
    expect(claveSku(" b04115s110-G ")).toBe(claveSku("B04115S110-G"));
    expect(claveSku("00123")).toBe(claveSku("123"));
  });
  it("cada SKU se encuentra a sí mismo; sin guion encuentra al único parecido", () => {
    const a = { sku: "852-10" }, b = { sku: "85210" }, c = { sku: "999-1", idProducto: "ERP-77" };
    const i = indiceSku([a, b, c]);
    expect(buscarSku(i, "852-10")).toBe(a);
    expect(buscarSku(i, "85210")).toBe(b);
    expect(buscarSku(i, "9991")).toBe(c);   // pedido sin guion: solo hay un parecido
    expect(buscarSku(i, "ERP77")).toBe(c);  // también por ID producto
    expect(buscarSku(i, "nada")).toBeNull();
  });
  it("lee conversiones guardadas con la llave vieja", () => {
    expect(conversionDe({ a1: { CJ: 2 } }, "A-1")).toEqual({ CJ: 2 });
    expect(conversionDe({ "a-1": { CJ: 3 }, a1: { CJ: 2 } }, "A-1")).toEqual({ CJ: 3 });
  });
});

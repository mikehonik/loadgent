import { describe, it, expect } from "vitest";
import { calcularFlete, fleteTotal, tarifaVacia } from "./flete.js";

const tarifas = [
  tarifaVacia({ vehiculo: "TOR", destino: "CDMX", metodo: "vehiculo", tarifa: 18500 }),
  tarifaVacia({ vehiculo: "TOR", destino: "", metodo: "vehiculo", tarifa: 12000 }),
  tarifaVacia({ vehiculo: "53CS", destino: "", metodo: "ocupacion", tarifa: 30000 }),
  tarifaVacia({ vehiculo: "40HC", destino: "", metodo: "peso", tarifa: 5 }),
  tarifaVacia({ vehiculo: "20DC", destino: "", metodo: "volumen", tarifa: 900 }),
];

describe("calcularFlete", () => {
  it("usa la tarifa por vehículo completo", () => {
    expect(calcularFlete(tarifas, "TOR", "CDMX", { ocupacion: 80, peso: 4000, m3: 10 })).toMatchObject({ total: 18500, metodo: "vehiculo" });
  });

  it("si no hay tarifa exacta para el destino, usa la que aplica a cualquier destino", () => {
    expect(calcularFlete(tarifas, "TOR", "Guadalajara", { ocupacion: 80, peso: 4000, m3: 10 })).toMatchObject({ total: 12000 });
  });

  it("calcula por % ocupado", () => {
    expect(calcularFlete(tarifas, "53CS", "", { ocupacion: 77, peso: 1000, m3: 1 })).toMatchObject({ total: 23100 });
  });

  it("calcula por peso cargado", () => {
    expect(calcularFlete(tarifas, "40HC", "", { ocupacion: 50, peso: 4830, m3: 1 })).toMatchObject({ total: 24150 });
  });

  it("calcula por volumen cargado", () => {
    expect(calcularFlete(tarifas, "20DC", "", { ocupacion: 50, peso: 1, m3: 12.5 })).toMatchObject({ total: 11250 });
  });

  it("sin tarifa para ese vehículo, devuelve null (no inventa un costo)", () => {
    expect(calcularFlete(tarifas, "RAB", "CDMX", { ocupacion: 50, peso: 1, m3: 1 })).toBeNull();
  });
});

describe("fleteTotal", () => {
  it("suma el flete de cada vehículo de la corrida (mismo vehículo y destino en todos)", () => {
    const r = fleteTotal(tarifas, "TOR", "CDMX", [{ ocupacion: 80, peso: 4000, m3: 10 }, { ocupacion: 40, peso: 2000, m3: 5 }]);
    expect(r.total).toBe(37000); // dos viajes a CDMX, 18,500 cada uno
    expect(r.porVehiculo).toHaveLength(2);
  });

  it("si algún vehículo no tiene tarifa, no suma nada a medias: devuelve null", () => {
    expect(fleteTotal(tarifas, "RAB", "CDMX", [{ ocupacion: 50, peso: 1, m3: 1 }])).toBeNull();
  });
});

describe("criterio de recomendación: espacio primero, luego costo", () => {
  // Reproduce el orden que usa «Recomendar vehículo» en App.jsx.
  const ordenar = (filas) => [...filas].sort((a, b) =>
    (a.error ? 1 : 0) - (b.error ? 1 : 0)
    || a.sinCargar - b.sinCargar
    || (a.flete != null && b.flete != null ? a.flete - b.flete : 0)
    || (a.flete != null ? -1 : 0) - (b.flete != null ? -1 : 0)
    || a.vehiculos - b.vehiculos
    || b.ocupacion - a.ocupacion);

  it("con tarifas, gana el flete más barato aunque vaya menos lleno", () => {
    const filas = [
      { nombre: "Torton", sinCargar: 0, vehiculos: 2, ocupacion: 92, flete: 37000 },
      { nombre: "Contenedor 40' HC", sinCargar: 0, vehiculos: 1, ocupacion: 53, flete: 24000 },
    ];
    expect(ordenar(filas)[0].nombre).toBe("Contenedor 40' HC");
  });

  it("sin tarifas, se decide como antes: menos unidades y más lleno", () => {
    const filas = [
      { nombre: "Torton", sinCargar: 0, vehiculos: 2, ocupacion: 92, flete: null },
      { nombre: "Tráiler 53", sinCargar: 0, vehiculos: 1, ocupacion: 40, flete: null },
    ];
    expect(ordenar(filas)[0].nombre).toBe("Tráiler 53");
  });

  it("nunca recomienda uno que deje carga sin acomodar, por barato que sea", () => {
    const filas = [
      { nombre: "Rabón", sinCargar: 30, vehiculos: 1, ocupacion: 99, flete: 5000 },
      { nombre: "Tráiler 53", sinCargar: 0, vehiculos: 1, ocupacion: 60, flete: 26000 },
    ];
    expect(ordenar(filas)[0].nombre).toBe("Tráiler 53");
  });

  it("los que sí tienen tarifa van antes que los que no", () => {
    const filas = [
      { nombre: "Sin tarifa", sinCargar: 0, vehiculos: 1, ocupacion: 90, flete: null },
      { nombre: "Con tarifa", sinCargar: 0, vehiculos: 1, ocupacion: 50, flete: 20000 },
    ];
    expect(ordenar(filas)[0].nombre).toBe("Con tarifa");
  });
});

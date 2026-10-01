import { optimizar } from "./motor.js";

// Recibe { items, veh, reglas, pallets }, responde progreso / fin / error.
self.onmessage = function (e) {
  const d = e.data;
  try {
    const r = optimizar(d.items, d.veh, d.reglas, (i, n) => self.postMessage({ tipo: "progreso", i, n }), d.pallets);
    self.postMessage({ tipo: "fin", r });
  } catch (err) {
    self.postMessage({ tipo: "error", msg: String(err) });
  }
};

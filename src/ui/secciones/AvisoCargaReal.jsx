// ================= Cuánto cuesta simular la carga real =================
// «Simular la carga real» aplica compresión del producto, la holgura que queda entre bloques y acomoda
// los bultos de pie, como en el andén. Por eso cabe menos que en el óptimo geométrico, y está bien: es
// lo que va a pasar. Pero cuando la diferencia es grande (sobra un vehículo, o 2 puntos de ocupación)
// conviene que el usuario lo sepa y decida, en vez de que el motor decida callado por él.
// La corrida sin el flag no se hace siempre: solo cuando sobra un vehículo o cuando se pide una
// sugerencia, que es donde 2 puntos cambian una decisión (ver App.jsx: medirCostoReal).
// Va dentro de la tarjeta de sugerencias, no en una tarjeta aparte: las dos salen en el mismo momento.
import { Loader2, Info } from "lucide-react";
import { T } from "../tema.js";

export function NotaCargaReal({ costo, onQuitarSimulacion }) {
  if (!costo) return null;
  if (costo.midiendo) return (
    <p className="flex items-center gap-1.5 mt-2 pt-2" style={{ fontSize: 11, color: T.suave, borderTop: `1px solid ${T.linea}` }}>
      <Loader2 size={11} className="animate-spin flex-none" />Comparando contra el óptimo sin simulación…
    </p>
  );
  if (!costo.vale) return null;
  const { nSin, nCon, pp } = costo;
  return (
    <div className="mt-2 pt-2" style={{ borderTop: `1px solid ${T.linea}` }}>
      <p className="flex items-start gap-1.5" style={{ fontSize: 11 }}>
        <Info size={12} color={T.aviso} className="flex-none mt-px" />
        <span>
          <b>{nSin < nCon ? `Sin simular la carga real cabría en ${nSin} ${nSin === 1 ? "vehículo" : "vehículos"}.` : `Simular la carga real cuesta ${pp.toFixed(0)} puntos de ocupación.`}</b>{" "}
          El cálculo aplica compresión, la holgura que de verdad queda y acomoda los bultos como un operario, así que se parece más a lo que va a pasar.
        </span>
      </p>
      <button onClick={onQuitarSimulacion} className="mt-1.5 text-xs px-2.5 py-1 rounded-md font-medium" style={{ border: `1px solid ${T.linea}`, background: T.sup, color: T.tinta }}>
        Ver sin simular
      </button>
    </div>
  );
}

// ================= Optimizar el pedido (sobre el 3D) =================
// En cuanto termina el cálculo, si sobra espacio o salió un vehículo de más, aquí mismo están los botones:
// «Llenar con pedido sugerido» y «Sugerir disminución del pedido». Los dos calculan en nivel 4, muestran una
// vista previa (qué cambia y cómo queda la ocupación) y solo al aplicar cambian el pedido. Ver motor/optimizarPedido.js.
import { useEffect, useState } from "react";
import { PackagePlus, PackageMinus, Loader2, X, Lock, Unlock, Undo2, CheckCircle2, Info } from "lucide-react";
import { T } from "../tema.js";
import { NotaCargaReal } from "./AvisoCargaReal.jsx";

const nVeh = (n) => `${n} ${n === 1 ? "vehículo" : "vehículos"}`;
const pcts = (lista) => lista.map((p) => `${p.toFixed(0)}%`).join(" + ");

const Boton = ({ onClick, children, primario, titulo }) => (
  <button onClick={onClick} title={titulo} className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md font-medium whitespace-nowrap"
    style={primario ? { background: T.nav, color: "#fff" } : { border: `1px solid ${T.linea}`, background: T.sup, color: T.tinta }}>{children}</button>
);

export function OptimizarPedido({ reporte, items, optim, progreso, onCalcular, onAplicar, onDeshacer, onCerrar, onCancelar, onFijarLinea, costoReal, onQuitarSimulacion }) {
  const [oculto, setOculto] = useState(false);
  useEffect(() => { setOculto(false); }, [reporte]);
  // El candado es el mismo de la tabla del pedido (it.fijo): lo que se fija aquí queda fijo allá.
  const fijas = new Set(items.filter((it) => it.fijo).map((it) => it.id));
  if (!reporte) return null;
  const caja = (contenido) => (
    <div className="absolute left-3 z-10 rounded-lg shadow-lg text-sm pointer-events-auto" style={{ bottom: 64, width: 340, maxWidth: "calc(100% - 24px)", maxHeight: "calc(100% - 110px)", overflowY: "auto", background: "rgba(255,255,255,.97)", border: `1px solid ${T.linea}` }}>{contenido}</div>
  );

  if (optim?.aplicado) return caja(
    <div className="flex items-center gap-2 px-3 py-2">
      <CheckCircle2 size={15} color={T.ok} className="flex-none" />
      <span className="flex-1 text-xs">Pedido ajustado con la sugerencia.</span>
      <Boton onClick={onDeshacer}><Undo2 size={13} />Deshacer</Boton>
      <button onClick={onCerrar} aria-label="Cerrar"><X size={14} color={T.suave} /></button>
    </div>
  );

  if (optim?.calculando) return caja(
    <div className="px-3 py-2.5">
      <div className="flex items-center gap-2 font-semibold"><Loader2 size={15} className="animate-spin" />{optim.tipo === "llenar" ? "Buscando qué más cabe" : "Buscando cómo usar un vehículo menos"}</div>
      <p className="text-xs mt-1" style={{ color: T.suave }}>{progreso?.fase || "Calculando en nivel 4…"}{progreso?.n > 1 ? ` · intento ${Math.min(progreso.i + 1, progreso.n)} de ${progreso.n}` : ""}</p>
      <p className="text-xs mt-1" style={{ color: T.suave }}>En nivel 4 cada cálculo tarda hasta medio minuto.</p>
      <div className="mt-2"><Boton onClick={onCancelar}><X size={13} />Cancelar</Boton></div>
    </div>
  );

  const pr = optim?.propuesta;
  if (pr) {
    const cambiaron = [...fijas].sort().join() !== [...(optim.fijas || [])].sort().join();
    const alternarFija = (id) => onFijarLinea?.(id);
    const sinCambio = !pr.cambios.length && pr.tipo !== "reacomodo";
    const mensaje = pr.tipo === "reacomodo" ? `Sin cambiar cantidades, reacomodando la carga cabe en ${nVeh(pr.despues.n)} (${pcts(pr.despues.ocupaciones)}).`
      : sinCambio ? (pr.tipo === "llenar"
        ? (pr.motivo === "sinCandidatos" ? "No hay líneas que se puedan aumentar: todas están fijas con el candado."
          : pr.motivo === "noSeComprobo" ? "Se encontró espacio, pero al recalcular el pedido completo la carga ya no cupo igual. Prueba soltando algún candado o agregando tú la cantidad."
          : "No cabe ni una caja más de los SKUs del pedido sin sumar un vehículo.")
        : "No se encontró una disminución que quite un vehículo sin tocar las líneas fijas.")
      : pr.tipo === "llenar" ? `Con esto ${pr.despues.n === 1 ? "queda" : "quedan"} ${nVeh(pr.despues.n)} al ${pcts(pr.despues.ocupaciones)} (antes ${pcts(pr.antes.ocupaciones)}).`
      : `Con esto la carga queda en ${nVeh(pr.despues.n)} al ${pcts(pr.despues.ocupaciones)} (antes ${nVeh(pr.antes.n)}).`;
    return caja(
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 font-semibold">
          {pr.tipo === "llenar" ? <PackagePlus size={15} color={T.ok} /> : <PackageMinus size={15} color={T.aviso} />}
          <span className="flex-1">{pr.tipo === "llenar" ? "Pedido sugerido para llenar" : pr.tipo === "reacomodo" ? "Cabe reacomodando" : "Disminución sugerida"}</span>
          <button onClick={onCerrar} aria-label="Cerrar"><X size={14} color={T.suave} /></button>
        </div>
        <p className="text-xs mt-1" style={{ color: sinCambio ? T.suave : T.tinta }}>{mensaje}</p>
        {pr.cambios.length > 0 && (
          <table className="w-full text-xs mt-2">
            <thead><tr style={{ color: T.suave }}><th className="text-left font-normal">SKU</th><th className="text-right font-normal">Actual</th><th className="text-right font-normal">Cambio</th><th className="text-right font-normal">Nuevo</th><th /></tr></thead>
            <tbody>
              {pr.cambios.map((c) => (
                <tr key={c.id} style={{ borderTop: `1px solid ${T.linea}`, opacity: fijas.has(c.id) ? 0.5 : 1 }}>
                  <td className="py-1 pr-1 truncate" style={{ maxWidth: 110 }} title={c.nombre}>{c.nombre}</td>
                  <td className="text-right">{c.actual.toLocaleString("es-MX")}</td>
                  <td className="text-right font-semibold" style={{ color: c.delta > 0 ? T.ok : T.error }}>{c.delta > 0 ? "+" : ""}{c.delta.toLocaleString("es-MX")}</td>
                  <td className="text-right">{c.nuevo.toLocaleString("es-MX")}</td>
                  <td className="text-right pl-1">
                    <button onClick={() => alternarFija(c.id)} title={fijas.has(c.id) ? "Esta línea no se toca. Clic para permitir cambiarla" : "Fijar: no cambiar esta línea"} aria-label={fijas.has(c.id) ? "Soltar línea" : "Fijar línea"}>
                      {fijas.has(c.id) ? <Lock size={12} color={T.nav} /> : <Unlock size={12} color={T.suave} />}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {pr.cambios.length > 0 && !cambiaron && <p className="flex items-start gap-1 mt-1.5" style={{ fontSize: 10, color: T.suave }}><Info size={11} className="flex-none mt-px" />Comprobado en nivel 4. El candado deja una línea sin tocar.</p>}
        <div className="flex flex-wrap gap-1.5 mt-2">
          {cambiaron
            ? <Boton primario onClick={() => onCalcular(optim.tipo, fijas)}>Recalcular sin tocar las fijas</Boton>
            : !sinCambio && <Boton primario onClick={onAplicar}><CheckCircle2 size={13} />Aplicar</Boton>}
          <Boton onClick={onCerrar}>{sinCambio ? "Cerrar" : "Cancelar"}</Boton>
        </div>
        <NotaCargaReal costo={costoReal} onQuitarSimulacion={onQuitarSimulacion} />
      </div>
    );
  }

  // Ofrecimiento: aparece solo si hay algo que hacer
  if (oculto) return null;
  const n = reporte.contenedores.length, ult = reporte.contenedores[n - 1];
  const sinCargar = reporte.avisos.some((a) => a.tipo === "sinCargar" || a.tipo === "noCaben");
  // Siempre se ofrece llenar mientras quede algo de espacio: si al final no cabe ni una caja más, la
  // sugerencia lo dice en una línea. Un tope de ocupación dejaba fuera cargas al 91% donde sí cabía más.
  const hayQueAumentar = items.some((it) => it.qty > 0 && !it.fijo);
  const llenar = ult && !sinCargar && hayQueAumentar && ult.ocupacion < 99.5 && (ult.utilPeso == null || ult.utilPeso < 98);
  const reducir = n >= 2;
  if (!llenar && !reducir) return null;
  return caja(
    <div className="px-3 py-2.5">
      <div className="flex items-start gap-2">
        <span className="flex-1 text-xs">
          <b>{n === 1 ? `El vehículo va al ${ult.ocupacion.toFixed(0)}%.` : `El vehículo ${n} va al ${ult.ocupacion.toFixed(0)}%.`}</b>{" "}
          {reducir && llenar ? "Puedes bajar el pedido para usar un vehículo menos, o completar el último." : reducir ? "Puedes bajar el pedido para usar un vehículo menos." : "Hay espacio para más de los SKUs de este pedido."}
        </span>
        <button onClick={() => setOculto(true)} aria-label="Ocultar sugerencias"><X size={14} color={T.suave} /></button>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-2">
        {reducir && <Boton primario onClick={() => onCalcular("reducir", fijas)} titulo="Primero prueba reacomodar sin cambiar cantidades; si no alcanza, sugiere qué bajar. Calcula en nivel 4."><PackageMinus size={13} />Sugerir disminución del pedido</Boton>}
        {llenar && <Boton primario={!reducir} onClick={() => onCalcular("llenar", fijas)} titulo="Sugiere más cajas de los SKUs de este pedido sin sumar vehículos. Calcula en nivel 4."><PackagePlus size={13} />{n === 1 ? "Llenar con pedido sugerido" : `Llenar el vehículo ${n}`}</Boton>}
      </div>
      <NotaCargaReal costo={costoReal} onQuitarSimulacion={onQuitarSimulacion} />
    </div>
  );
}

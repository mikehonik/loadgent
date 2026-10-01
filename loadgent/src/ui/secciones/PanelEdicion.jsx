// ================= Panel de edición a mano =================
// Flota sobre el visor mientras se edita un vehículo: el semáforo de la carga, el bulto elegido con sus
// botones (girar, mover, pegar, quitar), los bultos que se sacaron para volver a colocarlos y deshacer.
import { useState } from "react";
import { RotateCw, Trash2, Undo2, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, ChevronsUp, ChevronsDown, ChevronsLeft, ChevronsRight, PackagePlus, CheckCircle2, AlertTriangle, X, ChevronDown, ChevronUp } from "lucide-react";
import { T } from "../tema.js";
import { ORIENTACIONES } from "../../motor/reporte.js";
import { useUnidades } from "../unidadesContexto.jsx";

const Btn = ({ onClick, titulo, children, peligro, disabled }) => (
  <button onClick={onClick} title={titulo} aria-label={titulo} disabled={disabled} className="flex items-center justify-center gap-1 text-xs px-2 py-1.5 rounded-md"
    style={{ border: `1px solid ${T.linea}`, background: T.sup, color: peligro ? T.error : T.tinta, opacity: disabled ? 0.4 : 1 }}>{children}</button>
);

export function PanelEdicion({ edicion, setEdicion, cont, validacion, items, pallets, vehNum, editar, deshacer, colocarFuera, terminar }) {
  const u = useUnidades();
  const [plegado, setPlegado] = useState(false);
  const c = edicion.elegida != null ? cont.cajas[edicion.elegida] : null;
  const nombre = (k) => (k.pal >= 0 ? `Pallet «${pallets[k.pal]?.nombre || ""}»` : items[k.idx]?.nombre || "Caja");
  const problemas = c ? validacion.porCaja[edicion.elegida] : [];
  const lista = validacion.porCaja.map((p, i) => ({ i, p })).filter((x) => x.p.length);
  const ok = validacion.color === "verde";
  return (
    <div className="absolute right-3 z-10 rounded-lg shadow-lg text-sm" style={{ top: 44, background: "rgba(255,255,255,.97)", border: `1px solid ${T.linea}`, width: 292, maxHeight: "calc(100% - 56px)", overflowY: "auto" }}>
      <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: plegado ? "none" : `1px solid ${T.linea}` }}>
        <span className="font-semibold flex-1">Edición a mano · Vehículo {vehNum}</span>
        <button onClick={() => setPlegado(!plegado)} aria-label={plegado ? "Mostrar panel" : "Plegar panel"}>{plegado ? <ChevronUp size={15} /> : <ChevronDown size={15} />}</button>
        <button onClick={terminar} aria-label="Terminar edición"><X size={15} /></button>
      </div>
      {!plegado && <div className="px-3 py-2 flex flex-col gap-2">
        <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs" style={{ background: ok ? "#EAF7EF" : "#FDECEC", color: ok ? T.ok : T.error }}>
          {ok ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
          <span className="flex-1">{ok ? "Todo válido: la carga cumple las reglas." : `${validacion.conProblema ? `${validacion.conProblema} ${validacion.conProblema === 1 ? "bulto con problemas" : "bultos con problemas"}` : ""}${validacion.generales.length ? ` ${validacion.generales.join(" ")}` : ""}`}</span>
          <Btn onClick={deshacer} titulo="Deshacer (Ctrl+Z)" disabled={!edicion.historial.length}><Undo2 size={13} /></Btn>
        </div>

        {edicion.mensaje && <p className="text-xs rounded-md px-2 py-1.5" style={{ background: "#FFF8E6", color: T.aviso }}>{edicion.mensaje}</p>}
        {!c && <p className="text-xs" style={{ color: T.suave }}>Haz clic en una caja o pallet del 3D para elegirla. La vista se sigue girando arrastrando.</p>}
        {c && (
          <div className="rounded-md p-2" style={{ border: `1.5px solid ${problemas.length ? T.error : T.acento}` }}>
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{nombre(c)}</p>
                <p className="text-xs" style={{ color: T.suave }}>{u.fLLL(c.l, c.w, c.h)} · {u.fP(c.peso || 0)}{c.pal < 0 ? ` · ${(ORIENTACIONES[(c.ori || 1) - 1] || "").toLowerCase()}` : ""}</p>
                <p className="text-xs" style={{ color: T.suave }}>A {u.fD(c.x)} del fondo · {u.fD(c.y)} del lado derecho · {c.z < 1 ? "en el piso" : `a ${u.fD(c.z)} de altura`}</p>
              </div>
              <button onClick={() => setEdicion((e) => ({ ...e, elegida: null }))} aria-label="Soltar"><X size={14} color={T.suave} /></button>
            </div>
            {problemas.length > 0 && <ul className="text-xs mt-1" style={{ color: T.error }}>{problemas.map((p) => <li key={p}>• {p[0].toUpperCase() + p.slice(1)}</li>)}</ul>}
            <div className="flex items-center gap-1 mt-2">
              <Btn onClick={() => editar({ tipo: "rotar" })} titulo="Girar 90° (R)"><RotateCw size={13} />Girar</Btn>
              <Btn onClick={() => editar({ tipo: "quitar" })} titulo="Quitar del vehículo (Supr)" peligro><Trash2 size={13} />Quitar</Btn>
              <span className="flex-1" />
              <select value={edicion.paso} onChange={(e) => setEdicion((x) => ({ ...x, paso: Number(e.target.value) }))} title="Cuánto se mueve con cada flecha" aria-label="Paso al mover" className="text-xs rounded border px-0.5 py-1" style={{ borderColor: T.linea }}>
                {[10, 50, 100, 250, 500].map((v) => <option key={v} value={v}>Paso {u.fL(v, 1)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-8 gap-1 mt-1.5" title="Al moverla cae sola hasta donde tenga apoyo">
              <Btn onClick={() => editar({ tipo: "mover", dx: -edicion.paso, dy: 0 })} titulo="Mover hacia el fondo (flecha abajo)"><ArrowDown size={14} /></Btn>
              <Btn onClick={() => editar({ tipo: "mover", dx: edicion.paso, dy: 0 })} titulo="Mover hacia las puertas (flecha arriba)"><ArrowUp size={14} /></Btn>
              <Btn onClick={() => editar({ tipo: "mover", dx: 0, dy: -edicion.paso })} titulo="Mover a la derecha, vista desde las puertas (flecha derecha)"><ArrowRight size={14} /></Btn>
              <Btn onClick={() => editar({ tipo: "mover", dx: 0, dy: edicion.paso })} titulo="Mover a la izquierda, vista desde las puertas (flecha izquierda)"><ArrowLeft size={14} /></Btn>
              <Btn onClick={() => editar({ tipo: "pegar", dir: "fondo" })} titulo="Recorrer hasta topar hacia el fondo"><ChevronsDown size={14} /></Btn>
              <Btn onClick={() => editar({ tipo: "pegar", dir: "puertas" })} titulo="Recorrer hasta topar hacia las puertas"><ChevronsUp size={14} /></Btn>
              <Btn onClick={() => editar({ tipo: "pegar", dir: "derecha" })} titulo="Recorrer hasta topar a la derecha"><ChevronsRight size={14} /></Btn>
              <Btn onClick={() => editar({ tipo: "pegar", dir: "izquierda" })} titulo="Recorrer hasta topar a la izquierda"><ChevronsLeft size={14} /></Btn>
            </div>
            <p className="mt-1" style={{ fontSize: 10, color: T.suave }}>Flechas: mover un paso · dobles: recorrer hasta topar. Cae sola hasta donde tenga apoyo.</p>
          </div>
        )}

        {edicion.fuera.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1">Fuera del vehículo ({edicion.fuera.length})</p>
            <ul className="flex flex-col gap-1" style={{ maxHeight: 120, overflowY: "auto" }}>
              {edicion.fuera.map((k, j) => (
                <li key={j} className="flex items-center gap-2 text-xs">
                  <span className="flex-1 truncate">{nombre(k)} · {u.fLLL(k.l, k.w, k.h)}</span>
                  <Btn onClick={() => colocarFuera(j)} titulo="Colocar en el primer lugar válido"><PackagePlus size={13} />Colocar</Btn>
                </li>
              ))}
            </ul>
          </div>
        )}

        {lista.length > 0 && (
          <div>
            <p className="text-xs font-semibold mb-1" style={{ color: T.error }}>Por corregir</p>
            <ul className="flex flex-col gap-0.5" style={{ maxHeight: 110, overflowY: "auto" }}>
              {lista.slice(0, 30).map(({ i, p }) => (
                <li key={i}><button onClick={() => setEdicion((e) => ({ ...e, elegida: i }))} className="text-left text-xs underline" style={{ color: T.error }}>{nombre(cont.cajas[i])}: {p[0]}</button></li>
              ))}
            </ul>
          </div>
        )}
        <p style={{ fontSize: 10, color: T.suave }} title="Flechas del teclado mueven, R gira, Supr quita, Ctrl+Z deshace, Esc suelta">Teclado: flechas, R, Supr, Ctrl+Z. Lo editado ya sale en el Excel y el instructivo.</p>
      </div>}
    </div>
  );
}

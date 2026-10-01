// Revisión del pedido: qué se capturó, en qué unidad llegó y cuántas cajas quedaron, línea por línea.
// Sustituye al aviso largo de texto: aquí se ve en tabla y se puede descargar.
import { useState } from "react";
import { AlertTriangle, CheckCircle2, Download, X } from "lucide-react";
import { T } from "../tema.js";

const COLOR = { ok: T.ok, redondeado: T.aviso, "otra unidad": T.aviso, "sin conversión": T.error, "medidas del pedido": T.aviso, "sin medidas": T.error };
const ORDEN = ["sin medidas", "sin conversión", "otra unidad", "redondeado", "medidas del pedido", "ok"];

export function RevisionPedido({ revision, onCerrar, descargar }) {
  const [todas, setTodas] = useState(false);
  if (!revision) return null;
  const conteo = {};
  revision.filas.forEach((f) => (conteo[f.estado] = (conteo[f.estado] || 0) + 1));
  const revisar = revision.filas.filter((f) => f.estado !== "ok");
  const ver = (todas ? revision.filas : revisar).slice().sort((a, b) => ORDEN.indexOf(a.estado) - ORDEN.indexOf(b.estado));
  const limpio = revisar.length === 0;
  return (
    <div className="rounded-lg mb-3" style={{ background: T.sup, border: `1px solid ${limpio ? T.linea : "#F3C4BE"}` }}>
      <div className="flex items-start gap-2 px-3 py-2" style={{ borderBottom: ver.length ? `1px solid ${T.linea}` : "none" }}>
        {limpio ? <CheckCircle2 size={16} className="flex-none mt-0.5" color={T.ok} /> : <AlertTriangle size={16} className="flex-none mt-0.5" color={T.error} />}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">Revisión del pedido{revision.archivo ? ` · ${revision.archivo}` : ""}</p>
          <p className="text-xs" style={{ color: T.suave }}>
            {revision.filas.length} líneas
            {ORDEN.filter((e) => conteo[e]).map((e) => ` · ${conteo[e]} ${e}`).join("")}
          </p>
        </div>
        <button onClick={descargar} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ border: `1px solid ${T.linea}` }} title="Descargar la revisión en Excel"><Download size={13} />Excel</button>
        <button onClick={onCerrar} aria-label="Cerrar la revisión"><X size={15} /></button>
      </div>
      {ver.length > 0 && (
        <div className="overflow-auto" style={{ maxHeight: 220 }}>
          <table className="w-full text-sm">
            <thead className="sticky top-0" style={{ background: "#F3F5F8" }}>
              <tr className="text-left text-xs" style={{ color: T.suave }}>
                {["SKU", "Capturado", "Cajas", "Qué pasó"].map((h) => <th key={h} className="font-medium px-2 py-1.5 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {ver.map((f, i) => (
                <tr key={f.sku + i} style={{ borderTop: `1px solid ${T.linea}` }}>
                  <td className="px-2 py-1.5"><b>{f.sku}</b>{f.desc && <span className="block text-xs" style={{ color: T.suave }}>{f.desc}</span>}</td>
                  <td className="px-2 whitespace-nowrap">{f.capturado.toLocaleString("es-MX", { maximumFractionDigits: 3 })} {f.um || f.umCaja}</td>
                  <td className="px-2 font-medium">{f.cajas.toLocaleString("es-MX")}</td>
                  <td className="px-2 text-xs">
                    <span style={{ color: COLOR[f.estado] || T.suave }}>{f.estado}</span>
                    {f.detalle && <span style={{ color: T.suave }}> · {f.detalle}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {revisar.length > 0 && (
        <button onClick={() => setTodas(!todas)} className="text-xs px-3 py-1.5 underline" style={{ color: T.suave }}>
          {todas ? "Ver solo las que necesitan revisión" : `Ver las ${revision.filas.length} líneas`}
        </button>
      )}
    </div>
  );
}

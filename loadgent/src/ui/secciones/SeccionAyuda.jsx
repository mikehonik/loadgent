// ================= Ayuda =================
// Primero cómo se usa y qué significa cada campo (plegado por tema, para que no sea un muro de texto);
// al final las novedades, con solo la última versión abierta.
import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { AYUDA } from "../../archivos/maestro.js";
import { T } from "../tema.js";
import { NOVEDADES, VERSION_COMPLETA } from "../../version.js";

function Plegado({ titulo, abiertoInicial = false, children }) {
  const [abierto, setAbierto] = useState(abiertoInicial);
  return (
    <div className="rounded-lg mb-2" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
      <button onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-semibold">
        <span className="flex-1">{titulo}</span>{abierto ? <ChevronDown size={15} /> : <ChevronRight size={15} color={T.suave} />}
      </button>
      {abierto && <div className="px-3 pb-3" style={{ borderTop: `1px solid ${T.linea}` }}>{children}</div>}
    </div>
  );
}

const PASOS = [
  ["Maestro", "Abre tu maestro de productos (medidas, peso y reglas de cada SKU). Se guarda en tu cuenta."],
  ["Pedido", "Carga el Excel del pedido (SKU y cantidad) o agrega SKUs a mano."],
  ["Vehículo", "Elige el camión o contenedor, o «Recomendar» para compararlos."],
  ["Calcular carga", "Revisa el 3D, las acciones sugeridas y descarga el Excel o el instructivo."],
];

export function SeccionAyuda() {
  const [todas, setTodas] = useState(false);
  return (
    <>
      <h2 className="text-lg font-semibold leading-tight mb-3">Ayuda</h2>
      <div className="rounded-lg p-3 mb-3" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
        <p className="text-sm font-semibold mb-2">Cómo se usa</p>
        <ol className="flex flex-col gap-2">
          {PASOS.map(([t, d], i) => (
            <li key={t} className="flex gap-2 text-sm">
              <span className="flex-none flex items-center justify-center rounded-full text-xs font-bold" style={{ width: 22, height: 22, background: T.acento, color: T.nav }}>{i + 1}</span>
              <span><b>{t}.</b> <span style={{ color: T.suave }}>{d}</span></span>
            </li>
          ))}
        </ol>
      </div>
      <p className="text-xs font-semibold mb-2 mt-4" style={{ color: T.suave }}>QUÉ SIGNIFICA CADA CAMPO</p>
      {[...new Set(AYUDA.map((a) => a[0]))].map((g) => (
        <Plegado key={g} titulo={g}>
          <dl className="text-sm">
            {AYUDA.filter((a) => a[0] === g).map(([, campo, que, ej, vacio]) => (
              <div key={campo} className="py-2" style={{ borderTop: `1px solid ${T.linea}` }}>
                <dt className="font-medium">{campo}</dt>
                <dd style={{ color: T.suave }}>{que}</dd>
                <dd className="text-xs mt-0.5" style={{ color: T.suave }}>Ejemplo: <span style={{ color: T.tinta }}>{ej}</span> · Vacío: <span style={{ color: T.tinta }}>{vacio}</span></dd>
              </div>
            ))}
          </dl>
        </Plegado>
      ))}
      <p className="text-xs font-semibold mb-2 mt-4" style={{ color: T.suave }}>NOVEDADES · {VERSION_COMPLETA}</p>
      <Plegado titulo={`Versión ${NOVEDADES[0].version} · ${NOVEDADES[0].fecha}`} abiertoInicial>
        <ul className="list-disc pl-5 mt-2 text-sm flex flex-col gap-1" style={{ color: T.suave }}>{NOVEDADES[0].cambios.map((c) => <li key={c}>{c}</li>)}</ul>
      </Plegado>
      {!todas && NOVEDADES.length > 1 && <button onClick={() => setTodas(true)} className="text-xs underline" style={{ color: T.suave }}>Ver versiones anteriores ({NOVEDADES.length - 1})</button>}
      {todas && NOVEDADES.slice(1).map((n) => (
        <Plegado key={n.version} titulo={`Versión ${n.version} · ${n.fecha}`}>
          <ul className="list-disc pl-5 mt-2 text-sm flex flex-col gap-1" style={{ color: T.suave }}>{n.cambios.map((c) => <li key={c}>{c}</li>)}</ul>
        </Plegado>
      ))}
    </>
  );
}

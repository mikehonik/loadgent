import { useState, useRef } from "react";
// ================= Controles =================
// Piezas chicas de formulario y tarjetas que usa toda la interfaz.
import { T } from "./tema.js";
import { IDIOMAS } from "../i18n/index.js";
import { useUnidades } from "./unidadesContexto.jsx";

export const inp = "w-full rounded-md px-2 py-1.5 text-sm border outline-none";
export const estInp = { borderColor: T.linea, background: T.sup, color: T.tinta };
// tipo "largo" o "peso": el valor llega y se devuelve en mm o kg, pero se muestra y se captura en la
// unidad del usuario (pulgadas o libras si trabaja en americano), con la unidad al final de la etiqueta.
// tipo "distancia" es igual que "largo" pero admite negativos (por ejemplo, la posición de un eje).
// Un campo numérico que ya trae un valor (casi siempre 0) se selecciona al enfocarlo, para que el
// primer número que se escriba lo reemplace. Sin esto, escribir 70 sobre el 0 dejaba 070.
export const seleccionar = (e) => e.target.select();

export function Num({ etiqueta, valor, onChange, ayuda, tipo }) {
  const u = useUnidades();
  const aVista = tipo === "peso" ? u.P : tipo ? u.L : (v) => v;
  const aBase = tipo === "peso" ? u.aKg : tipo ? u.aMm : (v) => v;
  const unidad = tipo === "peso" ? u.p : tipo ? u.l : "";
  const minimo = tipo === "distancia" ? -Infinity : 0;
  return (
    <label className="block text-xs" style={{ color: T.suave }} title={ayuda}>
      <span className="block mb-1">{etiqueta}{unidad ? ` ${unidad}` : ""}</span>
      {/* Al entrar se selecciona lo que hay: escribir reemplaza el valor en vez de pegarse al 0 y dejar "070" */}
      <input type="number" value={aVista(valor)} onFocus={seleccionar} onChange={(e) => onChange(Math.max(minimo, aBase(Number(e.target.value) || 0)))} className={inp} style={estInp} />
    </label>
  );
}
export function Sel({ etiqueta, detalle, valor, onChange, opciones }) {
  const [verDetalle, setVerDetalle] = useState(false);
  return (
    <label className="block text-xs" style={{ color: T.suave }}>
      <span className="flex items-center gap-1.5 mb-1">
        {etiqueta}
        {detalle && (
          <button type="button" onClick={(e) => { e.preventDefault(); setVerDetalle(!verDetalle); }} aria-label={`Qué hace: ${etiqueta}`} aria-expanded={verDetalle}
            className="flex-none rounded-full flex items-center justify-center"
            style={{ width: 15, height: 15, border: `1px solid ${verDetalle ? T.nav : T.linea}`, color: verDetalle ? T.nav : T.suave, fontSize: 10, lineHeight: 1 }}>?</button>
        )}
      </span>
      <select value={valor} onChange={(e) => onChange(e.target.value)} className={inp} style={estInp}>
        {opciones.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
      </select>
      {detalle && verDetalle && <span className="block mt-1" style={{ fontSize: 11 }}>{detalle}</span>}
    </label>
  );
}
// El detalle no se muestra de entrada: la pantalla se satura y nadie lo lee. Va detrás del signo
// de interrogación, y solo aparece si la persona lo pide.
export function Interruptor({ etiqueta, detalle, valor, onChange }) {
  const [verDetalle, setVerDetalle] = useState(false);
  return (
    <div className="py-2">
      <div className="w-full flex items-center justify-between gap-2">
        <button type="button" role="switch" aria-checked={valor} onClick={() => onChange(!valor)} className="flex-1 text-left text-sm" style={{ color: T.tinta }}>
          {etiqueta}
        </button>
        {detalle && (
          <button type="button" onClick={() => setVerDetalle(!verDetalle)} aria-label={`Qué hace: ${etiqueta}`} aria-expanded={verDetalle}
            className="flex-none rounded-full flex items-center justify-center"
            style={{ width: 17, height: 17, border: `1px solid ${verDetalle ? T.nav : T.linea}`, color: verDetalle ? T.nav : T.suave, fontSize: 11, lineHeight: 1 }}>?</button>
        )}
        <button type="button" role="switch" aria-checked={valor} aria-label={etiqueta} onClick={() => onChange(!valor)}
          className="relative flex-none rounded-full" style={{ width: 34, height: 20, background: valor ? T.nav : T.linea, transition: "background .15s" }}>
          <span className="absolute rounded-full" style={{ width: 16, height: 16, top: 2, left: valor ? 16 : 2, background: valor ? T.acento : "#fff", transition: "left .15s" }} />
        </button>
      </div>
      {detalle && verDetalle && <p className="text-xs mt-1 pr-12" style={{ color: T.suave }}>{detalle}</p>}
    </div>
  );
}
export function Tarjeta({ titulo, children, accion }) {
  return (
    <div className="rounded-lg p-4 mb-3" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">{titulo}</h3>
        {accion}
      </div>
      {children}
    </div>
  );
}
export function Dato({ t, v, s }) {
  return (
    <div className="rounded-lg px-3 py-2" style={{ background: T.shell }}>
      <div className="text-xs" style={{ color: T.suave }}>{t}</div>
      <div className="text-lg font-semibold leading-tight">{v}</div>
      {s && <div className="text-xs" style={{ color: T.suave }}>{s}</div>}
    </div>
  );
}

export function Confirmacion({ texto, accion, onSi, onNo }) {
  return (
    <div className="rounded-lg p-3 mb-3 text-sm" style={{ background: "#FDECEA", border: `1px solid #F3C4BE` }} role="alertdialog">
      <p className="mb-2">{texto}</p>
      <div className="flex gap-2">
        <button onClick={onSi} className="px-3 py-1 rounded-md font-medium" style={{ background: T.error, color: "#fff" }}>{accion}</button>
        <button onClick={onNo} className="px-3 py-1 rounded-md" style={{ border: `1px solid ${T.linea}`, background: "#fff" }}>Cancelar</button>
      </div>
    </div>
  );
}

// Nota que solo aparece si la persona la pide. Para explicaciones que ayudan una vez y después
// estorban: en vez de ocupar tres renglones siempre, se esconden tras el signo de interrogación.
export function Nota({ children, titulo = "Cómo funciona" }) {
  const [ver, setVer] = useState(false);
  return (
    <div className="mt-2">
      <button type="button" onClick={() => setVer(!ver)} aria-expanded={ver}
        className="flex items-center gap-1 text-xs" style={{ color: T.suave }}>
        <span className="rounded-full flex items-center justify-center"
          style={{ width: 15, height: 15, border: `1px solid ${ver ? T.nav : T.linea}`, color: ver ? T.nav : T.suave, fontSize: 10, lineHeight: 1 }}>?</span>
        {titulo}
      </button>
      {ver && <p className="text-xs mt-1" style={{ color: T.suave }}>{children}</p>}
    </div>
  );
}

// Botón con menú desplegable de acciones: junta varias acciones parecidas (importar, descargar) en un solo
// botón, en vez de una fila de enlaces subrayados.
// ES | EN. Cambia el idioma de toda la pantalla y de los archivos que se generan.
export function SelectorIdioma({ idioma, onCambiar, oscuro = true }) {
  return (
    <div className="flex flex-none rounded-md overflow-hidden text-xs whitespace-nowrap" role="group" aria-label="Idioma" style={{ border: `1px solid ${oscuro ? "rgba(255,255,255,.25)" : T.linea}` }}>
      {IDIOMAS.map(([id, corto, nombre]) => (
        <button key={id} onClick={() => onCambiar(id)} aria-pressed={idioma === id} title={nombre} lang={id} className="px-2 py-1"
          style={{ background: idioma === id ? T.acento : "transparent", color: idioma === id ? T.nav : oscuro ? "rgba(255,255,255,.8)" : T.suave, fontWeight: idioma === id ? 600 : 400 }}>{corto}</button>
      ))}
    </div>
  );
}

export function MenuBoton({ etiqueta, icono: Icono, acciones }) {
  const [abierto, setAbierto] = useState(false);
  // Abre hacia arriba si abajo no cabe (el botón suele quedar al final del panel y el menú se cortaba;
  // al querer bajar para verlo, el menú se cerraba)
  const [arriba, setArriba] = useState(false);
  const boton = useRef(null);
  const lista = acciones.filter(Boolean);
  const abrir = () => {
    if (!abierto && boton.current) {
      const r = boton.current.getBoundingClientRect(), alto = lista.length * 50 + 12;
      setArriba(window.innerHeight - r.bottom < alto && r.top > window.innerHeight - r.bottom);
    }
    setAbierto(!abierto);
  };
  return (
    <div className="relative inline-block">
      <button ref={boton} onClick={abrir} aria-expanded={abierto} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup }}>
        {Icono && <Icono size={15} />}{etiqueta}<span style={{ fontSize: 10, color: T.suave }}>{abierto && arriba ? "▴" : "▾"}</span>
      </button>
      {abierto && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setAbierto(false)} aria-hidden="true" />
          <div className={`absolute left-0 rounded-lg py-1 z-20 shadow-lg text-sm ${arriba ? "bottom-full mb-1" : "top-full mt-1"}`} style={{ background: T.sup, border: `1px solid ${T.linea}`, minWidth: 260 }}>
            {lista.map(([t, fn, ayuda, deshabilitado]) => (
              <button key={t} onClick={() => { setAbierto(false); fn(); }} disabled={deshabilitado} title={ayuda} className="block w-full text-left px-3 py-1.5 hover:bg-gray-100" style={{ opacity: deshabilitado ? 0.45 : 1 }}>
                {t}{ayuda && <span className="block text-xs" style={{ color: T.suave }}>{ayuda}</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

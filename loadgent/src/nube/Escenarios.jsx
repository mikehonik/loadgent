import { useEffect, useState } from "react";
import { X, Save, Trash2, FolderOpen, Loader2, Search } from "lucide-react";
import { T } from "../ui/tema.js";
import { listarEscenarios, guardarEscenario, abrirEscenario, borrarEscenario } from "./nube.js";

// Menú de escenarios: guardar el de ahora con un nombre, abrir uno anterior o borrarlo.
// Cada usuario solo ve los suyos (lo garantiza la regla de la base de datos, no esta pantalla).
export function Escenarios({ nombreActual, estadoParaGuardar, onAbrir, onCerrar, onAviso, onError }) {
  const [lista, setLista] = useState(null);
  const [nombre, setNombre] = useState(nombreActual || "");
  const [ocupado, setOcupado] = useState(false);
  const [confirmarBorrar, setConfirmarBorrar] = useState(null);
  const [filtro, setFiltro] = useState("");

  const refrescar = async () => {
    try { setLista(await listarEscenarios()); }
    catch (e) { onError("No se pudo leer la lista de escenarios: " + e.message); setLista([]); }
  };
  useEffect(() => { refrescar(); }, []);

  const guardar = async () => {
    setOcupado(true);
    try {
      const r = await guardarEscenario(nombre, estadoParaGuardar());
      onAviso(r.reemplazado ? `Se actualizó «${nombre.trim()}».` : `Escenario «${nombre.trim()}» guardado.`);
      await refrescar();
    } catch (e) { onError("No se pudo guardar: " + e.message); }
    setOcupado(false);
  };

  const abrir = async (esc) => {
    setOcupado(true);
    try {
      const r = await abrirEscenario(esc.id);
      onAbrir(r);
      onCerrar();
    } catch (e) { onError("No se pudo abrir: " + e.message); }
    setOcupado(false);
  };

  const borrar = async (esc) => {
    setOcupado(true);
    try { await borrarEscenario(esc.id); onAviso(`Se borró «${esc.nombre}».`); await refrescar(); }
    catch (e) { onError("No se pudo borrar: " + e.message); }
    setConfirmarBorrar(null); setOcupado(false);
  };

  const fecha = (t) => new Date(t).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  const norm = (t) => String(t ?? "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const visibles = (lista ?? []).filter((e) => !filtro.trim() || norm(e.nombre).includes(norm(filtro)));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(10,18,28,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }} onClick={onCerrar}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: T.sup, borderRadius: 12, width: 460, maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 8px 30px rgba(0,0,0,.25)" }}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${T.linea}` }}>
          <p className="flex-1 text-sm font-semibold">Mis escenarios</p>
          <button onClick={onCerrar} aria-label="Cerrar"><X size={16} /></button>
        </div>

        <div className="px-4 py-3" style={{ borderBottom: `1px solid ${T.linea}` }}>
          <label className="block text-xs mb-1" style={{ color: T.suave }}>Guardar el escenario de ahora como:</label>
          <div className="flex gap-2">
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Pedido Tienda Norte"
              onKeyDown={(e) => e.key === "Enter" && nombre.trim() && !ocupado && guardar()}
              className="flex-1 rounded-md px-2 py-1.5 text-sm border outline-none" style={{ borderColor: T.linea, background: T.sup, color: T.tinta }} />
            <button onClick={guardar} disabled={!nombre.trim() || ocupado}
              className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md font-medium"
              style={{ background: T.nav, color: "#fff", opacity: !nombre.trim() || ocupado ? .5 : 1 }}>
              {ocupado ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}Guardar
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: T.suave }}>Si usas un nombre que ya existe, se actualiza ese escenario.</p>
        </div>

        {lista?.length > 6 && (
          <div className="px-4 py-2 flex items-center gap-1.5" style={{ borderBottom: `1px solid ${T.linea}` }}>
            <Search size={14} color={T.suave} />
            <input value={filtro} onChange={(ev) => setFiltro(ev.target.value)} placeholder="Buscar por nombre…"
              className="flex-1 text-sm outline-none" style={{ background: "transparent", color: T.tinta }} />
          </div>
        )}
        <div className="overflow-auto flex-1">
          {lista === null && <p className="text-sm px-4 py-3" style={{ color: T.suave }}>Cargando…</p>}
          {lista?.length === 0 && <p className="text-sm px-4 py-3" style={{ color: T.suave }}>Todavía no has guardado ningún escenario.</p>}
          {lista?.length > 0 && visibles.length === 0 && <p className="text-sm px-4 py-3" style={{ color: T.suave }}>Ningún escenario coincide con «{filtro}».</p>}
          {visibles.map((e) => (
            <div key={e.id} className="flex items-center gap-2 px-4 py-2" style={{ borderBottom: `1px solid ${T.linea}` }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{e.nombre}</p>
                <p className="text-xs" style={{ color: T.suave }}>{fecha(e.actualizado)}</p>
              </div>
              {confirmarBorrar === e.id ? (
                <>
                  <button onClick={() => borrar(e)} disabled={ocupado} className="text-xs px-2 py-1 rounded" style={{ background: T.error, color: "#fff" }}>Sí, borrar</button>
                  <button onClick={() => setConfirmarBorrar(null)} className="text-xs px-2 py-1 rounded" style={{ border: `1px solid ${T.linea}` }}>No</button>
                </>
              ) : (
                <>
                  <button onClick={() => abrir(e)} disabled={ocupado} className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ border: `1px solid ${T.linea}` }}>
                    <FolderOpen size={13} />Abrir
                  </button>
                  <button onClick={() => setConfirmarBorrar(e.id)} aria-label={`Borrar ${e.nombre}`} style={{ color: T.suave }}><Trash2 size={14} /></button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

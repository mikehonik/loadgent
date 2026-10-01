import { T } from "../tema.js";
import { Num, Tarjeta, Nota } from "../controles.jsx";
import { Plus, Copy, Trash2 } from "lucide-react";
import { FormPallet } from "../filas.jsx";
import { useUnidades } from "../unidadesContexto.jsx";

export function SeccionVehiculo({ editarPallet, editarVeh, elegirVehiculo, modoPallet, palIdx, palSel, pallets, veh, vehId, vehiculos, agregarVehiculo, duplicarVehiculo, quitarVehiculo, onImportarCatalogo, onDescargarCatalogo, onDescargarPlantillaCatalogo }) {
  const u = useUnidades();
  return (
    <>
      <h2 className="text-lg font-semibold mb-3">{modoPallet ? "Pallet a diseñar" : "Vehículo"}</h2>
      <div className="grid grid-cols-2 gap-2 mb-3">
        {vehiculos.map((v) => (
          <div key={v.id} className="relative">
            <button onClick={() => elegirVehiculo(v.id)} className="text-left rounded-lg px-3 py-2 w-full"
              style={{ background: T.sup, border: `1.5px solid ${vehId === v.id ? T.nav : T.linea}` }}>
              <span className="block text-sm font-medium pr-5" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v.nombre}</span>
              <span className="block text-xs" style={{ color: T.suave }}>{u.id === "metrico" ? `${(v.L / 1000).toFixed(1)} × ${(v.W / 1000).toFixed(2)} × ${(v.H / 1000).toFixed(2)} m` : `${u.fD(v.L, 1).replace(" ft", "")} × ${u.fD(v.W, 1).replace(" ft", "")} × ${u.fD(v.H, 1)}`}</span>
            </button>
            {v.propio && <button onClick={() => quitarVehiculo(v.id)} aria-label={`Quitar ${v.nombre}`} title="Quitar este vehículo" className="absolute p-1" style={{ top: 4, right: 4, color: T.suave }}><Trash2 size={13} /></button>}
          </div>
        ))}
      </div>
      <div className="flex gap-3 mb-3 text-xs" style={{ color: T.suave }}>
        <button className="flex items-center gap-1 underline" onClick={agregarVehiculo}><Plus size={13} />Vehículo nuevo</button>
        {!modoPallet && <button className="flex items-center gap-1 underline" onClick={duplicarVehiculo}><Copy size={13} />Duplicar el actual</button>}
      </div>
      {!modoPallet && onImportarCatalogo && (
        <div className="flex gap-3 mb-3 text-xs flex-wrap" style={{ color: T.suave }}>
          <button className="underline" onClick={onImportarCatalogo}>Importar catálogo de vehículos</button>
          <button className="underline" onClick={onDescargarCatalogo}>Descargar catálogo actual</button>
          <button className="underline" onClick={onDescargarPlantillaCatalogo}>Descargar plantilla de vehículos</button>
        </div>
      )}
      <p className="text-xs mb-2" style={{ color: T.suave }}>O diseña un pallet, usando el pallet vacío como espacio de carga:</p>
      <div className="flex flex-wrap gap-2 mb-4">
        {pallets.map((p, i) => (
          <button key={i} onClick={() => elegirVehiculo(`PAL:${i}`)} className="text-sm rounded-lg px-3 py-1.5" style={{ background: T.sup, border: `1.5px solid ${vehId === `PAL:${i}` ? T.nav : T.linea}` }}>{p.nombre}</button>
        ))}
      </div>
      {modoPallet ? (
        <Tarjeta titulo={palSel.nombre}><FormPallet p={palSel} editar={(k, v) => editarPallet(palIdx, k, v)} /></Tarjeta>
      ) : (
        <>
          <Tarjeta titulo="Espacio y peso">
            <label className="block text-xs mb-2" style={{ color: T.suave }}>
              <span className="block mb-1">Nombre del vehículo</span>
              <input value={veh.nombre || ""} onChange={(e) => editarVeh("nombre", e.target.value)} className="w-full rounded-md px-2 py-1.5 text-sm border outline-none" style={{ borderColor: T.linea, background: T.sup, color: T.tinta }} />
            </label>
            <div className="grid grid-cols-3 gap-2">
              <Num etiqueta="Largo interior" tipo="largo" valor={veh.L} onChange={(v) => editarVeh("L", v)} />
              <Num etiqueta="Ancho interior" tipo="largo" valor={veh.W} onChange={(v) => editarVeh("W", v)} />
              <Num etiqueta="Alto interior" tipo="largo" valor={veh.H} onChange={(v) => editarVeh("H", v)} />
              <Num etiqueta="Tara" tipo="peso" valor={veh.tara} onChange={(v) => editarVeh("tara", v)} />
              <Num etiqueta="Peso bruto máx" tipo="peso" valor={veh.maxKg} onChange={(v) => editarVeh("maxKg", v)} ayuda="Incluye la tara. 0 = sin límite" />
            </div>
          </Tarjeta>
          <Tarjeta titulo="Límites opcionales">
            <div className="grid grid-cols-3 gap-2">
              <Num etiqueta="Ocupación máx %" valor={veh.maxVolPct} onChange={(v) => editarVeh("maxVolPct", Math.min(100, v))} />
              <Num etiqueta="Tipos de carga" valor={veh.maxSkus} onChange={(v) => editarVeh("maxSkus", v)} />
              <Num etiqueta="Bultos máx" valor={veh.maxPiezas} onChange={(v) => editarVeh("maxPiezas", v)} />
            </div>
            <Nota>0 = sin límite. Las medidas que trae son de referencia: ajústalas a tu unidad y a la normativa aplicable.</Nota>
          </Tarjeta>
          <Tarjeta titulo="Carga por eje (opcional)">
            <div className="grid grid-cols-2 gap-2 mb-2">
              <label className="block text-xs" style={{ color: T.suave }}>
                <span className="block mb-1">Placa</span>
                <input value={veh.placa || ""} onChange={(e) => editarVeh("placa", e.target.value)} className="w-full rounded-md px-2 py-1.5 text-sm border outline-none" style={{ borderColor: T.linea, background: T.sup, color: T.tinta }} />
              </label>
              <label className="block text-xs" style={{ color: T.suave }}>
                <span className="block mb-1">Transportadora</span>
                <input value={veh.transportadora || ""} onChange={(e) => editarVeh("transportadora", e.target.value)} className="w-full rounded-md px-2 py-1.5 text-sm border outline-none" style={{ borderColor: T.linea, background: T.sup, color: T.tinta }} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-2">
              <Num etiqueta="Eje delantero máx" tipo="peso" valor={veh.ejeDelantero} onChange={(v) => editarVeh("ejeDelantero", v)} ayuda="0 = no se calcula" />
              <Num etiqueta="Eje trasero máx" tipo="peso" valor={veh.ejeTrasero} onChange={(v) => editarVeh("ejeTrasero", v)} ayuda="0 = no se calcula" />
              <Num etiqueta="Eje delantero desde el frente," tipo="distancia" valor={veh.xEjeDelantero} onChange={(v) => editarVeh("xEjeDelantero", v)} ayuda="Casi siempre negativo, porque el eje queda antes del inicio de la caja" />
              <Num etiqueta="Eje trasero desde el frente," tipo="distancia" valor={veh.xEjeTrasero} onChange={(v) => editarVeh("xEjeTrasero", v)} />
              <Num etiqueta="Tara en eje delantero" tipo="peso" valor={veh.taraDelantera} onChange={(v) => editarVeh("taraDelantera", v)} ayuda="0 y 0 = mitad y mitad" />
              <Num etiqueta="Tara en eje trasero" tipo="peso" valor={veh.taraTrasera} onChange={(v) => editarVeh("taraTrasera", v)} />
            </div>
            <Nota>Es una estimación por reparto de palanca entre los dos ejes, igual que una báscula de reparto en patio. Avisa a tiempo, no sustituye pesar el vehículo. Déjalo en 0 si no lo necesitas: no calcula nada y no estorba.</Nota>
          </Tarjeta>
        </>
      )}
    </>
  );
}

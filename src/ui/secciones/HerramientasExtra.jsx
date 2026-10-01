// ================= Herramientas de consulta =================
// Comparar pallets, vehículos necesarios para una cantidad, convertidor de unidades y calidad del maestro.
// Los cálculos viven en motor/herramientas.js; aquí solo se captura y se muestra.
import { useMemo, useState } from "react";
import { Star, FileSpreadsheet } from "lucide-react";
import { compararPallets, vehiculosNecesarios, auditarMaestro } from "../../motor/herramientas.js";
import { conversionDe } from "../../archivos/celdas.js";
import { aCajas, nombreUM, UM_CAJA_DEF } from "../../archivos/conversiones.js";
import { libroSimple, MIME_XLSX } from "../../archivos/resultados.js";
import { descargarArchivo } from "../navegador.js";
import { T } from "../tema.js";
import { Sel, Num, inp, estInp } from "../controles.jsx";
import { useUnidades } from "../unidadesContexto.jsx";
import { paraMotor } from "./herramientasComun.js";

const n0 = (v) => (v ?? 0).toLocaleString("es-MX");
const pct = (v) => `${Math.round((v || 0) * 100)}%`;
const dinero = (v, moneda = "MXN") => v.toLocaleString("es-MX", { style: "currency", currency: moneda, maximumFractionDigits: 2 });
const th = "font-medium px-2 py-1.5 text-left whitespace-nowrap";

// ---------- Comparar pallets ----------
export function CompararPallets({ producto, pallets, vehiculos, reglas }) {
  const u = useUnidades();
  const [vehSel, setVehSel] = useState(vehiculos[0]?.id || "");
  const veh = vehiculos.find((v) => v.id === vehSel) || vehiculos[0];
  const filas = useMemo(() => { const m = paraMotor(producto, reglas); return compararPallets(m.it, pallets, m.reglas, veh ? { ...veh, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 } : null); }, [producto, pallets, reglas, veh]);
  return (
    <>
      <p className="text-xs mb-2" style={{ color: T.suave }}>¿En qué pallet del catálogo conviene este SKU? Gana el que mete más cajas al vehículo elegido.</p>
      <Sel etiqueta="Vehículo" valor={veh?.id} onChange={setVehSel} opciones={vehiculos.map((v) => [v.id, v.nombre])} />
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs">
          <thead><tr style={{ color: T.suave }}>{["Pallet", "Cajas/pallet", "Armado", "Alto", "Superficie", "Pallets", "Cajas en vehículo"].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.i} style={{ borderTop: `1px solid ${T.linea}`, background: f.mejor ? "#FFFBEA" : "transparent" }}>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{f.mejor && <Star size={12} fill={T.acento} color={T.acento} className="inline mr-1" />}{f.pal.nombre}</td>
                {f.def ? <>
                  <td className="px-2">{n0(f.def.n)}</td>
                  <td className="px-2 whitespace-nowrap">{f.def.capas ? `${f.def.capas} × ${f.def.porCapa}` : "—"}</td>
                  <td className="px-2 whitespace-nowrap">{u.fL(f.def.alto, 0)}</td>
                  <td className="px-2">{pct(f.superficie)}</td>
                  <td className="px-2">{f.pallets ?? "—"}</td>
                  <td className="px-2 font-semibold">{f.cajasVehiculo != null ? n0(f.cajasVehiculo) : "—"}</td>
                </> : <td colSpan={6} className="px-2" style={{ color: T.error }}>No arma en este pallet</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ---------- Vehículos necesarios ----------
export function VehiculosNecesarios({ producto, pallets, vehiculos, reglas, tarifas }) {
  const u = useUnidades();
  const [cantidad, setCantidad] = useState(1000);
  const [modo, setModo] = useState(producto.paletizar === true ? "pallets" : "suelto");
  const [palSel, setPalSel] = useState(() => Math.max(0, pallets.findIndex((t) => t.nombre === producto.tarima)));
  const [destino, setDestino] = useState("");
  const filas = useMemo(() => {
    if (!(cantidad > 0)) return [];
    const m = paraMotor(producto, reglas);
    return vehiculosNecesarios(m.it, cantidad, vehiculos, m.reglas, { modo, pallet: pallets[palSel], tarifas, destino });
  }, [producto, reglas, cantidad, vehiculos, modo, palSel, pallets, tarifas, destino]);
  const conFlete = filas.some((f) => f.flete != null);
  return (
    <>
      <p className="text-xs mb-2" style={{ color: T.suave }}>¿Cuántos vehículos hacen falta para mover una cantidad de este SKU? Con tarifas de flete (en Vehículo), también el costo total y por caja.</p>
      <div className="grid grid-cols-2 gap-2">
        <Num etiqueta="Cantidad (cajas)" valor={cantidad} onChange={setCantidad} />
        <Sel etiqueta="Cómo viaja" valor={modo} onChange={setModo} opciones={[["suelto", "Suelto"], ["pallets", "En pallets completos"]]} />
        {modo === "pallets" && <Sel etiqueta="Pallet" valor={palSel} onChange={(v) => setPalSel(Number(v))} opciones={pallets.map((p, i) => [i, p.nombre])} />}
        {tarifas.length > 0 && (
          <label className="block text-xs" style={{ color: T.suave }}>
            <span className="block mb-1">Destino (para la tarifa)</span>
            <input value={destino} onChange={(e) => setDestino(e.target.value)} placeholder="Cualquiera" className={inp} style={estInp} />
          </label>
        )}
      </div>
      <div className="overflow-x-auto mt-2">
        <table className="w-full text-xs">
          <thead><tr style={{ color: T.suave }}>{["Vehículo", "Caben", "Vehículos", "El último va al", ...(conFlete ? ["Flete", "Por caja"] : [])].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.v.id} style={{ borderTop: `1px solid ${T.linea}`, background: f.mejor ? "#FFFBEA" : "transparent" }}>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">{f.mejor && <Star size={12} fill={T.acento} color={T.acento} className="inline mr-1" />}{f.v.nombre}</td>
                {f.vehiculos ? <>
                  <td className="px-2 whitespace-nowrap">{n0(f.cap)} cajas{f.detalle ? <span style={{ color: T.suave }}> ({f.detalle.pallets} pallets)</span> : null}</td>
                  <td className="px-2 font-semibold">{f.vehiculos}</td>
                  <td className="px-2">{Math.round(f.ultimoPct)}%</td>
                  {conFlete && <td className="px-2 whitespace-nowrap">{f.flete != null ? dinero(f.flete, f.moneda) : <span style={{ color: T.suave }}>sin tarifa</span>}</td>}
                  {conFlete && <td className="px-2 whitespace-nowrap">{f.porCaja != null ? dinero(f.porCaja, f.moneda) : "—"}</td>}
                </> : <td colSpan={conFlete ? 5 : 3} className="px-2" style={{ color: T.error }}>No cabe</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs mt-1" style={{ color: T.suave }}>Estimado rápido con un solo SKU. Para una carga mezclada usa Pedido y «Recomendar».{u.id !== "metrico" ? "" : ""}</p>
    </>
  );
}

// ---------- Convertidor de unidades ----------
export function ConvertidorUnidades({ producto, conversiones }) {
  const tabla = conversionDe(conversiones, producto.sku);
  const unidades = tabla ? Object.keys(tabla) : [];
  const [cantidad, setCantidad] = useState(1);
  const [um, setUm] = useState(unidades.find((x) => x !== (producto.umCaja || UM_CAJA_DEF)) || unidades[0] || "UN");
  const r = useMemo(() => aCajas(cantidad, um, producto.umCaja || UM_CAJA_DEF, tabla, producto.piezas), [cantidad, um, producto, tabla]);
  const umCaja = producto.umCaja || UM_CAJA_DEF;
  return (
    <>
      <p className="text-xs mb-2" style={{ color: T.suave }}>Pasa una cantidad en otra unidad (millares, pallets, kilos…) a cajas de este SKU, con las conversiones del maestro.</p>
      {!tabla && <p className="text-xs mb-2" style={{ color: T.aviso }}>Este SKU no tiene conversiones en el maestro{producto.piezas > 1 ? `; solo se puede convertir desde piezas (${producto.piezas} por ${umCaja})` : ""}.</p>}
      <div className="grid grid-cols-2 gap-2">
        <Num etiqueta="Cantidad" valor={cantidad} onChange={setCantidad} />
        <Sel etiqueta="Unidad" valor={um} onChange={setUm} opciones={[...new Set([...unidades, "UN"])].map((x) => [x, `${x} · ${nombreUM(x)}`])} />
      </div>
      <div className="rounded-md p-2 mt-2 text-sm" style={{ background: "#EEF3F9" }}>
        <b>{n0(cantidad)} {um}</b> = <b>{n0(r.cajas)} {r.destino || umCaja}</b>
        {r.exacto === false && r.exactas != null && <span className="text-xs" style={{ color: T.suave }}> (exacto {r.exactas.toLocaleString("es-MX", { maximumFractionDigits: 3 })}, se redondea hacia arriba)</span>}
        {r.motivo && <p className="text-xs mt-1" style={{ color: T.aviso }}>No se pudo convertir: {r.motivo}.</p>}
        {r.nota && <p className="text-xs mt-1" style={{ color: T.suave }}>{r.nota}.</p>}
      </div>
      {tabla && (
        <p className="text-xs mt-2" style={{ color: T.suave }}>Equivalencias del maestro: {unidades.map((x) => `${x} ${tabla[x].toLocaleString("es-MX")}`).join(" · ")}</p>
      )}
    </>
  );
}

// ---------- Calidad del maestro ----------
export function CalidadMaestro({ productos, pallets, vehiculos, onVerSku }) {
  const u = useUnidades();
  const r = useMemo(() => auditarMaestro(productos, pallets, vehiculos), [productos, pallets, vehiculos]);
  const [abierta, setAbierta] = useState(null);
  const descargar = () => {
    const filas = [["Revisión", "SKU", "Descripción", `Largo (${u.l})`, `Ancho (${u.l})`, `Alto (${u.l})`, `Peso (${u.p})`, "Qué revisar"]];
    r.reglas.forEach((g) => g.skus.forEach((p) => filas.push([g.nombre, p.sku, p.desc || "", +u.L(p.L).toFixed(2), +u.L(p.W).toFixed(2), +u.L(p.H).toFixed(2), +u.P(p.peso).toFixed(3), g.descripcion])));
    descargarArchivo(libroSimple(filas, "Revisar", [28, 16, 36, 10, 10, 10, 10, 60]), "calidad_maestro.xlsx", MIME_XLSX);
  };
  const conHallazgos = r.reglas.filter((g) => g.skus.length);
  return (
    <>
      <p className="text-xs mb-2" style={{ color: T.suave }}>Revisa el maestro completo y encuentra lo que suele estar mal capturado: medidas vacías o de relleno, pesos que no cuadran con el tamaño, productos que no caben en ningún vehículo.</p>
      <div className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm" style={{ background: r.conProblema ? "#FFF8E6" : "#EAF7EF", color: r.conProblema ? T.aviso : T.ok }}>
        <span className="flex-1">{r.conProblema ? `${n0(r.conProblema)} de ${n0(r.total)} SKUs tienen algo que revisar.` : `Los ${n0(r.total)} SKUs pasan todas las revisiones.`}</span>
        {r.conProblema > 0 && <button onClick={descargar} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup, color: T.tinta }}><FileSpreadsheet size={13} />Excel</button>}
      </div>
      <ul className="mt-2 flex flex-col gap-1">
        {conHallazgos.map((g) => (
          <li key={g.id} className="rounded-md" style={{ border: `1px solid ${T.linea}` }}>
            <button onClick={() => setAbierta(abierta === g.id ? null : g.id)} className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm">
              <span className="flex-none text-xs font-semibold px-1.5 rounded" style={{ background: "#FDECEC", color: T.error }}>{n0(g.skus.length)}</span>
              <span className="flex-1"><b>{g.nombre}</b><span className="block text-xs" style={{ color: T.suave }}>{g.descripcion}</span></span>
            </button>
            {abierta === g.id && (
              <div className="px-2 pb-2 text-xs" style={{ maxHeight: 200, overflowY: "auto" }}>
                {g.skus.slice(0, 200).map((p) => (
                  <button key={(p.pid ?? p.sku) + g.id} onClick={() => onVerSku?.(p.sku)} className="flex gap-2 w-full text-left py-0.5 hover:underline" title="Ver en Herramientas">
                    <span className="font-medium" style={{ minWidth: 110 }}>{p.sku}</span>
                    <span className="flex-1 truncate" style={{ color: T.suave }}>{p.desc}</span>
                    <span style={{ color: T.suave }}>{u.fLLL(p.L, p.W, p.H)} · {u.fP(p.peso, 2)}</span>
                  </button>
                ))}
                {g.skus.length > 200 && <p className="mt-1" style={{ color: T.suave }}>Y {n0(g.skus.length - 200)} más en el Excel.</p>}
              </div>
            )}
          </li>
        ))}
      </ul>
    </>
  );
}

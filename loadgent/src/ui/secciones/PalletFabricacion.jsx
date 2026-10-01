// ================= Pallet óptimo y paletizado para fabricación =================
// Para un SKU (o un listado de SKUs), un pallet y una altura objetivo, compara patrones (entrelazado,
// columnas, híbrido y, si hace falta, uno con menos niveles por resistencia) con semáforo de estabilidad,
// centro de gravedad y compresión. Cada patrón se puede ver en el 3D, y el sugerido de cada SKU va al PDF.
// La lógica vive en motor/fabricacion.js; aquí solo se captura, se muestra y se exporta.
import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Play, Eye, Upload, FileDown, FileSpreadsheet, ChevronLeft, ChevronRight, Loader2, Star, X } from "lucide-react";
import { indiceSku, buscarSku, clave } from "../../archivos/celdas.js";
import { patronesFabricacion, FACTORES } from "../../motor/fabricacion.js";
import { libroSimple, MIME_XLSX } from "../../archivos/resultados.js";
import { descargarArchivo } from "../navegador.js";
import { fotoPallet } from "../../visor/foto.js";
import { VERSION_COMPLETA } from "../../version.js";
import { T } from "../tema.js";
import { Sel, Num, Nota } from "../controles.jsx";
import { useUnidades } from "../unidadesContexto.jsx";
import { paraMotor } from "./herramientasComun.js";

const COLOR = "#C8102E";
const COLORES_SEM = { verde: "#2F8C46", amarillo: "#E2A000", rojo: "#B3261E", gris: "#96A0AA" };
const NOMBRES = { estabilidad: "Estabilidad", cg: "Centro de gravedad", compresion: "Compresión" };
const pct = (v) => (v == null ? "—" : `${Math.round(v * 100)}%`);

// Cada color lleva además su símbolo, para quien no distingue bien rojo de verde
const SIMBOLO = { verde: "✓", amarillo: "!", rojo: "✕", gris: "?" };
function Punto({ color, titulo }) {
  return <span title={titulo} aria-label={titulo} className="inline-flex items-center justify-center" style={{ width: 15, height: 15, borderRadius: 99, background: COLORES_SEM[color], flex: "none", color: "#fff", fontSize: 9, fontWeight: 700, lineHeight: 1 }}>{SIMBOLO[color]}</span>;
}
function Semaforo({ s, compacto }) {
  if (compacto) return <span className="flex gap-1">{["estabilidad", "cg", "compresion"].map((k) => <Punto key={k} color={s[k].color} titulo={`${NOMBRES[k]}: ${s[k].texto}`} />)}</span>;
  return (
    <ul className="flex flex-col gap-1 mt-2">
      {["estabilidad", "cg", "compresion"].map((k) => (
        <li key={k} className="flex items-start gap-2 text-xs"><span className="mt-0.5"><Punto color={s[k].color} /></span><span><b>{NOMBRES[k]}:</b> <span style={{ color: T.suave }}>{s[k].texto}</span></span></li>
      ))}
    </ul>
  );
}

export function PalletFabricacion({ producto, productos, pallets, reglas, verPalletHerr }) {
  const u = useUnidades();
  const [palSel, setPalSel] = useState(() => Math.max(0, pallets.findIndex((t) => t.nombre === producto.tarima)));
  const pal = pallets[palSel] || pallets[0];
  const [alturaMax, setAlturaMax] = useState(pal.altMax);
  const [apilaEncima, setApilaEncima] = useState(0);
  const [humedad, setHumedad] = useState("normal");
  const [tiempo, setTiempo] = useState("mes");
  const [bct, setBct] = useState(0);
  const [resultado, setResultado] = useState(null);     // patrones del SKU elegido arriba
  const [listado, setListado] = useState(null);         // [{ producto, patrones }] del Excel
  const [vistaLista, setVistaLista] = useState(0);
  const [trabajando, setTrabajando] = useState("");
  const [aviso, setAviso] = useState("");
  const archivo = useRef(null);
  const indice = useMemo(() => indiceSku(productos), [productos]);
  const opciones = { alturaMax, apilaEncima, humedad, tiempo, bct,
    humedadTxt: FACTORES.humedad.find((f) => f[0] === humedad)[1], tiempoTxt: FACTORES.tiempo.find((f) => f[0] === tiempo)[1] };

  // El BCT capturado aquí es del SKU elegido arriba; en un listado, cada SKU trae el suyo en la columna «BCT» (si la hay).
  const evaluar = (p, bctSku) => { const m = paraMotor(p, reglas); return patronesFabricacion(m.it, pal, m.reglas, { ...opciones, bct: bctSku ?? (p === producto ? bct : 0) }); };
  const ver = (p, patron) => verPalletHerr({ def: patron.def, titulo: `${p.sku} · ${patron.nombre}${patron.sugerido ? " (sugerido)" : ""}`, color: COLOR, forma: p.forma });
  const calcular = () => {
    const ps = evaluar(producto);
    setResultado({ sku: producto.sku, patrones: ps });
    const sug = ps.find((x) => x.sugerido);
    if (sug) ver(producto, sug);
  };
  const cambio = (f) => (v) => { f(v); setResultado(null); };

  // ---------- Listado de SKUs desde Excel ----------
  const leerListado = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setAviso(""); setTrabajando("Leyendo el listado…");
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      const filas = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, blankrows: false });
      const enc = (filas[0] || []).map((h) => clave(h));
      let col = enc.findIndex((h) => h === "sku" || h === "articulo" || h === "idarticulo" || h === "codigo" || h === "producto");
      const conEncabezado = col >= 0; if (col < 0) col = 0;
      const colBct = enc.findIndex((h) => h.startsWith("bct") || h.startsWith("resistencia"));
      const bctDe = new Map(), codigos = [];
      filas.slice(conEncabezado ? 1 : 0).forEach((r) => {
        const c = String(r[col] ?? "").trim(); if (!c || bctDe.has(c)) return;
        codigos.push(c); bctDe.set(c, colBct >= 0 ? u.aKg(Number(r[colBct]) || 0) : 0);
      });
      const encontrados = [], faltan = [];
      codigos.forEach((c) => { const p = buscarSku(indice, c); if (p) encontrados.push({ p, bct: bctDe.get(c) }); else faltan.push(c); });
      const lista = [];
      for (let i = 0; i < encontrados.length; i++) {
        if (i % 20 === 0) { setTrabajando(`Calculando ${i + 1} de ${encontrados.length}…`); await new Promise((r) => setTimeout(r, 0)); }
        lista.push({ producto: encontrados[i].p, patrones: evaluar(encontrados[i].p, encontrados[i].bct) });
      }
      setListado(lista); setVistaLista(0);
      if (lista[0]) { const s = lista[0].patrones.find((x) => x.sugerido); if (s) ver(lista[0].producto, s); }
      setAviso(`${lista.length} SKUs calculados${faltan.length ? `. No están en el maestro: ${faltan.slice(0, 6).join(", ")}${faltan.length > 6 ? ` y ${faltan.length - 6} más` : ""}` : ""}.`);
    } catch (err) { setAviso("No se pudo leer el listado: " + err.message); }
    setTrabajando("");
  };
  const verDeLista = (i) => {
    const f = listado[i]; setVistaLista(i);
    const s = f?.patrones.find((x) => x.sugerido); if (s) ver(f.producto, s);
  };
  const excelListado = () => {
    const filas = [["SKU", "Descripción", "Patrón sugerido", "Cajas por pallet", "Niveles", "Cajas por nivel", `Alto total (${u.l})`, `Peso (${u.p})`, "Estabilidad", "Centro de gravedad", "Compresión", "Detalle"]];
    listado.forEach(({ producto: p, patrones }) => {
      const s = patrones.find((x) => x.sugerido);
      if (!s) { filas.push([p.sku, p.desc || "", "No arma"]); return; }
      filas.push([p.sku, p.desc || "", s.nombre, s.def.n, s.def.capas, s.def.porCapa, +u.L(s.def.alto).toFixed(1), +u.P(s.def.peso).toFixed(1),
        s.semaforos.estabilidad.color, s.semaforos.cg.color, s.semaforos.compresion.color, [s.semaforos.estabilidad.texto, s.semaforos.cg.texto, s.semaforos.compresion.texto].join(" · ")]);
    });
    descargarArchivo(libroSimple(filas, "Paletizado", [16, 36, 22, 10, 8, 10, 12, 10, 12, 16, 12, 80]), "paletizado_listado.xlsx", MIME_XLSX);
  };

  // ---------- PDF ----------
  const generarPdf = async () => {
    setTrabajando("Preparando el PDF…");
    try {
      const fuente = listado?.length ? listado : resultado ? [{ producto, patrones: resultado.patrones }] : [{ producto, patrones: evaluar(producto) }];
      const filas = [];
      for (let i = 0; i < fuente.length; i++) {
        if (i % 5 === 0) { setTrabajando(`Dibujando ${i + 1} de ${fuente.length}…`); await new Promise((r) => setTimeout(r, 0)); }
        const patron = fuente[i].patrones.find((x) => x.sugerido) || null;
        filas.push({ producto: fuente[i].producto, patron, imagen: patron ? fotoPallet(patron.def, { color: COLOR }) : null, motivo: fuente[i].patrones.demasiadas ? "Piezas diminutas" : null });
      }
      setTrabajando("Armando el PDF…");
      const { pdfPaletizado } = await import("../../archivos/reportePallets.js");
      const blob = await pdfPaletizado({ filas, pallet: pal, opciones, u, version: VERSION_COMPLETA, titulo: filas.length > 1 ? `Paletizado · ${filas.length} SKUs` : `Paletizado · ${producto.sku}` });
      descargarArchivo(blob, filas.length > 1 ? "paletizado_listado.pdf" : `paletizado_${clave(producto.sku)}.pdf`, "application/pdf");
    } catch (err) { setAviso("No se pudo generar el PDF: " + err.message); }
    setTrabajando("");
  };

  const plantilla = () => descargarArchivo(libroSimple([["SKU", `BCT (${u.p})`], ...productos.slice(0, 3).map((p) => [p.sku, ""])], "SKUs", [18, 12]), "plantilla_listado_skus.xlsx", MIME_XLSX);
  const ps = resultado?.sku === producto.sku ? resultado.patrones : null;
  const todosIgualCantidad = ps && ps.filter((p) => p.clave !== "resistencia").every((p, _, a) => p.def.n === a[0].def.n);

  return (
    <>
      <p className="text-xs mb-2" style={{ color: T.suave }}>Compara patrones de paletizado para fabricación: no solo cuántas cajas caben, sino cuál llega entero. Cada uno trae semáforo de estabilidad, centro de gravedad y compresión.</p>
      <div className="grid grid-cols-2 gap-2">
        <Sel etiqueta="Pallet" valor={palSel} onChange={cambio((v) => { setPalSel(Number(v)); setAlturaMax(pallets[Number(v)]?.altMax || alturaMax); })} opciones={pallets.map((p, i) => [i, p.nombre])} />
        <Num etiqueta="Altura objetivo (con el pallet)" tipo="largo" valor={alturaMax} onChange={cambio(setAlturaMax)} ayuda="Altura total del pallet armado, incluida la base" />
        <Sel etiqueta="Pallets encima en el transporte" valor={apilaEncima} onChange={cambio((v) => setApilaEncima(Number(v)))} opciones={[[0, "Ninguno"], [1, "1 pallet igual encima"], [2, "2 pallets iguales encima"]]} />
        <Num etiqueta="Resistencia de la caja (BCT)" tipo="peso" valor={bct} onChange={cambio(setBct)} ayuda="Prueba de compresión de la caja vacía (BCT). Si la dejas en 0 se usa el «peso máximo encima» del maestro, si lo tiene." />
        <Sel etiqueta="Humedad del almacén" valor={humedad} onChange={cambio(setHumedad)} opciones={FACTORES.humedad.map(([k, t]) => [k, t])} />
        <Sel etiqueta="Tiempo en almacén" valor={tiempo} onChange={cambio(setTiempo)} opciones={FACTORES.tiempo.map(([k, t]) => [k, t])} />
      </div>
      <p className="text-xs mt-1" style={{ color: T.suave }}>
        {bct > 0 ? "La compresión usa el BCT corregido por patrón, humedad y tiempo." : producto.pesoMaxEncima > 0 ? `Sin BCT: la compresión usa el peso máximo encima del maestro (${u.fP(producto.pesoMaxEncima)}).` : "Sin BCT ni peso máximo encima: la compresión queda en gris."}
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button onClick={calcular} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md" style={{ background: T.acento, color: T.nav }}><Play size={15} />Calcular</button>
        <button onClick={() => archivo.current?.click()} disabled={!!trabajando} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup }}><Upload size={15} />Cargar listado de SKUs</button>
        <button onClick={generarPdf} disabled={!!trabajando} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ background: T.nav, color: "#fff", opacity: trabajando ? 0.6 : 1 }}>
          {trabajando ? <Loader2 size={15} className="animate-spin" /> : <FileDown size={15} />}Generar PDF{listado?.length ? ` (${listado.length})` : ""}
        </button>
        <input ref={archivo} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={leerListado} />
      </div>
      {trabajando && <p className="text-xs mt-2" style={{ color: T.suave }}>{trabajando}</p>}
      {aviso && <p className="text-xs mt-2" style={{ color: T.ok }}>{aviso}</p>}

      {ps?.demasiadas && <p className="text-sm mt-3" style={{ color: T.aviso }}>Son unas {ps.demasiadas.toLocaleString("es-MX")} cajas por pallet: con piezas tan chicas los patrones de estiba no aplican. Revisa si las medidas del maestro son reales.</p>}
      {ps && !ps.demasiadas && (ps.length ? (
        <div className="mt-3 flex flex-col gap-2">
          {todosIgualCantidad && <p className="text-xs" style={{ color: T.suave }}>Todos llevan {ps[0].def.n} cajas ({ps[0].def.capas} niveles × {ps[0].def.porCapa}); cambia cómo se acomodan.</p>}
          {ps.map((p) => (
            <div key={p.clave} className="rounded-md p-2.5" style={{ border: `1.5px solid ${p.sugerido ? T.acento : T.linea}`, background: p.sugerido ? "#FFFBEA" : T.sup }}>
              <div className="flex items-center gap-2">
                {p.sugerido && <Star size={14} fill={T.acento} color={T.acento} />}
                <span className="text-sm font-semibold flex-1">{p.nombre}{p.sugerido ? " · sugerido" : ""}</span>
                <Semaforo s={p.semaforos} compacto />
                <button onClick={() => ver(producto, p)} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup }}><Eye size={13} />Ver en 3D</button>
              </div>
              <p className="text-xs mt-1" style={{ color: T.suave }}>{p.descripcion}</p>
              <p className="text-xs mt-1">
                <b>{p.def.n} cajas</b> · {p.def.capas} × {p.def.porCapa} · alto {u.fL(p.def.alto, 0)} · {u.fP(p.def.peso)} · uso del espacio {pct(p.metricas.pctVolumen)}
              </p>
              <Semaforo s={p.semaforos} />
              <p className="mt-1" style={{ fontSize: 11, color: T.suave }}>
                Apoyo mínimo {pct(p.metricas.apoyoMinimo)} · cada caja pisa {p.metricas.entrelazado.toFixed(1)} · {pct(p.metricas.lateral)} con 3 lados contenidos · carga sobre la caja de abajo {u.fP(p.metricas.cargaMax, 1)}{p.metricas.resistencia != null ? ` contra ${u.fP(p.metricas.resistencia, 1)} de resistencia` : ""}
              </p>
            </div>
          ))}
          <Nota titulo="Cómo se califica">
            Estabilidad: rojo si alguna caja queda apoyada menos del 75%; amarillo si las cajas pisan menos de 1.5 de abajo en promedio (columnas sin amarre) o si menos del 70% tiene 3 lados contenidos. Centro de gravedad: amarillo si la carga es más alta que el doble de su lado corto y rojo si llega a 2.5 veces, o si está descentrado más de 5% o 10%. Compresión: la carga sobre la caja de abajo contra su resistencia; entrelazar le quita cerca de 45% de resistencia a la caja (la esquina cae sobre el centro de la de abajo), la humedad y el tiempo en almacén también. Los factores son de referencia: ajústalos con las pruebas de tu planta.
          </Nota>
        </div>
      ) : <p className="text-sm mt-3" style={{ color: T.error }}>Este SKU no arma ni un pallet con estas condiciones (revisa medidas, orientaciones y la altura objetivo).</p>)}

      {listado && (
        <div className="mt-4 rounded-md" style={{ border: `1px solid ${T.linea}` }}>
          <div className="flex items-center gap-2 px-2.5 py-2" style={{ borderBottom: `1px solid ${T.linea}`, background: "#F3F5F8" }}>
            <span className="text-sm font-semibold flex-1">Listado ({listado.length} SKUs)</span>
            <button onClick={excelListado} className="flex items-center gap-1 text-xs px-2 py-1 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup }}><FileSpreadsheet size={13} />Excel</button>
            <button onClick={() => setListado(null)} aria-label="Cerrar el listado"><X size={15} /></button>
          </div>
          {listado.length > 0 && (
            <div className="flex items-center gap-1 px-2.5 py-2" style={{ borderBottom: `1px solid ${T.linea}` }}>
              <span className="text-xs mr-1" style={{ color: T.suave }}>En el 3D:</span>
              <button onClick={() => verDeLista(Math.max(0, vistaLista - 1))} disabled={vistaLista === 0} aria-label="SKU anterior" style={{ opacity: vistaLista === 0 ? 0.35 : 1 }}><ChevronLeft size={16} /></button>
              <select value={vistaLista} onChange={(e) => verDeLista(Number(e.target.value))} className="text-xs rounded-md px-1.5 py-1 border flex-1 min-w-0" style={{ borderColor: T.linea }} aria-label="SKU en el 3D">
                {listado.map((f, i) => <option key={f.producto.pid ?? f.producto.sku} value={i}>{f.producto.sku}{f.producto.desc ? ` · ${f.producto.desc}` : ""}</option>)}
              </select>
              <button onClick={() => verDeLista(Math.min(listado.length - 1, vistaLista + 1))} disabled={vistaLista === listado.length - 1} aria-label="SKU siguiente" style={{ opacity: vistaLista === listado.length - 1 ? 0.35 : 1 }}><ChevronRight size={16} /></button>
            </div>
          )}
          <div className="overflow-auto" style={{ maxHeight: 280 }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0" style={{ background: "#fff" }}>
                <tr className="text-left" style={{ color: T.suave }}>{["SKU", "Sugerido", "Cajas", "Armado", "Alto", "Semáforo"].map((h) => <th key={h} className="font-medium px-2 py-1.5">{h}</th>)}</tr>
              </thead>
              <tbody>
                {listado.map((f, i) => {
                  const s = f.patrones.find((x) => x.sugerido);
                  return (
                    <tr key={f.producto.pid ?? f.producto.sku} onClick={() => verDeLista(i)} className="cursor-pointer" style={{ borderTop: `1px solid ${T.linea}`, background: i === vistaLista ? "#EEF3F9" : "transparent" }}>
                      <td className="px-2 py-1.5 font-medium">{f.producto.sku}</td>
                      <td className="px-2">{s ? s.nombre.replace(/ \(.*/, "") : <span style={{ color: T.error }}>{f.patrones.demasiadas ? "Piezas diminutas" : "No arma"}</span>}</td>
                      <td className="px-2">{s?.def.n ?? "—"}</td>
                      <td className="px-2">{s ? `${s.def.capas} × ${s.def.porCapa}` : "—"}</td>
                      <td className="px-2">{s ? u.fL(s.def.alto, 0) : "—"}</td>
                      <td className="px-2">{s && <Semaforo s={s.semaforos} compacto />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="text-xs mt-2" style={{ color: T.suave }}>
        El listado es un Excel con una columna «SKU» (o los códigos en la primera columna) y, opcional, una columna «BCT» con la resistencia de cada caja en {u.p}. <button className="underline" onClick={plantilla}>Descargar plantilla</button>
      </p>
    </>
  );
}

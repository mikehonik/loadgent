// ================= Herramientas de capacidad =================
// Preguntas sobre un solo SKU que no necesitan un pedido completo. Cada herramienta es una sección plegable
// (se abre una a la vez, para que la pantalla no se sature) y tiene dos niveles de respuesta:
//   · un estimado inmediato, calculado aquí mismo con el motor en modo rápido;
//   · «Calcular carga», que corre el motor completo (el nivel y las reglas activas en la pestaña Reglas,
//     igual que una carga normal) y muestra el resultado en el visor 3D.
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Play, Loader2, Package, Layers, Boxes, Truck, Scale, Repeat, ShieldCheck } from "lucide-react";
import { CompararPallets, VehiculosNecesarios, ConvertidorUnidades, CalidadMaestro } from "./HerramientasExtra.jsx";
import { claveSku, indiceSku, buscarSku } from "../../archivos/celdas.js";
import { capacidadSuelta, capacidadPalletCompleto } from "../../motor/motor.js";
import { paraMotor } from "./herramientasComun.js";
import { T } from "../tema.js";
import { Sel, Num, inp, estInp } from "../controles.jsx";
import { SelectorOrientacion } from "../filas.jsx";
import { useUnidades } from "../unidadesContexto.jsx";
import { PalletFabricacion } from "./PalletFabricacion.jsx";

const vehParaCalculo = (v) => ({ ...v, maxVolPct: v.maxVolPct || 0, maxSkus: v.maxSkus || 0, maxPiezas: v.maxPiezas || 0 });
const n0 = (n) => (n ?? 0).toLocaleString("es-MX");
const pct = (n) => `${(n * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`;
const TODAS = [true, true, true, true, true, true];
// Con más piezas que esto, el cálculo completo tardaría demasiado y el 3D sería ilegible: se queda el estimado.
const TOPE_CALCULO = 20000;

// Por qué no caben las cajas que pidió el usuario: casi siempre es el peso máximo del pallet, no la altura,
// y decirlo con el número evita la pregunta «¿por qué 54 y no 60?».
function limita(pedidas, r, pal, producto, u) {
  const razones = [];
  if (pal.maxKg > 0 && producto.peso > 0 && pedidas * producto.peso > pal.maxKg)
    razones.push(`${pedidas} cajas pesarían ${u.fP(pedidas * producto.peso)} y el pallet aguanta ${u.fP(pal.maxKg)}`);
  if (r.def.capas && producto.H > 0 && pal.esp + (Math.ceil(pedidas / r.def.porCapa)) * producto.H > pal.altMax)
    razones.push(`no caben más niveles en la altura máxima de ${u.fL(pal.altMax, 0)}`);
  if (!razones.length) razones.push(`no caben más cajas en la huella de ${u.fLL(pal.L, pal.W)}`);
  return razones.join("; ");
}
const COLOR_HERR = "#C8102E";

function Resultado({ filas, estimado, nota }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mt-2">
        {filas.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2 col-span-2 sm:col-span-1">
            <dt style={{ color: T.suave }}>{k}</dt><dd className="font-medium text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {estimado && <p className="text-xs mt-2" style={{ color: T.suave }}>Aproximado: son tantas piezas que se calcula en rejilla en vez de acomodarlas una por una.</p>}
      {nota && <p className="text-xs mt-2" style={{ color: T.suave }}>{nota}</p>}
    </>
  );
}

// Con 26 mil SKU, una lista desplegable con todos tardaba en abrir y se sentía trabada. Aquí se escribe el
// SKU (o parte de la descripción) y solo se sugieren las primeras coincidencias.
const MAX_SUGERENCIAS = 30;
export function BuscadorSku({ productos, valor, onElegir, id = "herramientas-skus", etiqueta = "SKU (escribe el código o parte de la descripción)" }) {
  const [texto, setTexto] = useState(valor);
  const indice = useMemo(() => indiceSku(productos), [productos]);
  const sugerencias = useMemo(() => {
    const q = claveSku(texto), d = texto.trim().toLowerCase();
    if (!q) return productos.slice(0, MAX_SUGERENCIAS);
    const empiezan = [], contienen = [];
    for (const p of productos) {
      const k = claveSku(p.sku);
      if (k.startsWith(q)) empiezan.push(p);
      else if (contienen.length < MAX_SUGERENCIAS && (k.includes(q) || (d.length > 2 && String(p.desc || "").toLowerCase().includes(d)))) contienen.push(p);
      if (empiezan.length >= MAX_SUGERENCIAS) break;
    }
    return [...empiezan, ...contienen].slice(0, MAX_SUGERENCIAS);
  }, [texto, productos]);
  const cambiar = (t) => { setTexto(t); const p = buscarSku(indice, t); if (p) onElegir(p.sku); };
  return (
    <label className="block text-xs" style={{ color: T.suave }}>
      <span className="block mb-1">{etiqueta}</span>
      <input list={id} value={texto} onChange={(e) => cambiar(e.target.value)} className={inp} style={estInp} placeholder="Ej. 85210" autoComplete="off" />
      <datalist id={id}>
        {sugerencias.map((p) => <option key={p.pid ?? p.sku} value={p.sku}>{p.desc || ""}</option>)}
      </datalist>
    </label>
  );
}

// Sección plegable: solo el título a la vista; al abrirla se ve su contenido.
function Plegable({ id, abierta, setAbierta, icono: Icono, titulo, resumen, children }) {
  const act = abierta === id;
  return (
    <div className="rounded-lg mb-2" style={{ background: T.sup, border: `1px solid ${act ? T.nav : T.linea}` }}>
      <button onClick={() => setAbierta(act ? null : id)} aria-expanded={act} className="w-full flex items-center gap-2 px-3 py-2.5 text-left">
        <Icono size={16} color={act ? T.nav : T.suave} />
        <span className="flex-1">
          <span className="block text-sm font-semibold">{titulo}</span>
          <span className="block text-xs" style={{ color: T.suave }}>{resumen}</span>
        </span>
        {act ? <ChevronDown size={16} /> : <ChevronRight size={16} color={T.suave} />}
      </button>
      {act && <div className="px-3 pb-3 pt-1" style={{ borderTop: `1px solid ${T.linea}` }}>{children}</div>}
    </div>
  );
}

function BotonCalcular({ onClick, calculando, deshabilitado, texto = "Calcular carga", titulo }) {
  return (
    <button onClick={onClick} disabled={calculando || deshabilitado} title={titulo}
      className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-md mt-3"
      style={{ background: T.acento, color: T.nav, opacity: calculando || deshabilitado ? 0.55 : 1 }}>
      {calculando ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}{calculando ? "Calculando…" : texto}
    </button>
  );
}

export function SeccionHerramientas({ maestro, vehiculos, pallets, reglas, tarifas = [], calcularHerramienta, verPalletHerr, calculando, vistaHerr }) {
  const u = useUnidades();
  const [skuSel, setSkuSel] = useState(maestro.productos[0]?.sku || "");
  const [versionBuscador, setVersionBuscador] = useState(0);   // para reiniciar el buscador cuando otra herramienta elige un SKU
  const [abierta, setAbierta] = useState(null);
  const producto = useMemo(() => maestro.productos.find((p) => claveSku(p.sku) === claveSku(skuSel)) || null, [maestro.productos, skuSel]);
  const elegirDeFuera = (sku) => { setSkuSel(sku); setVersionBuscador((v) => v + 1); setAbierta("suelta"); window.scrollTo?.(0, 0); };

  if (!maestro.productos.length) return <p className="text-sm" style={{ color: T.suave }}>Necesitas productos en el maestro para usar estas herramientas.</p>;
  const P = (id, icono, titulo, resumen, hijo) => <Plegable id={id} abierta={abierta} setAbierta={setAbierta} icono={icono} titulo={titulo} resumen={resumen}>{hijo}</Plegable>;

  return (
    <>
      <h2 className="text-lg font-semibold mb-3">Herramientas</h2>
      <div className="rounded-lg p-3 mb-3" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
        <BuscadorSku key={versionBuscador} productos={maestro.productos} valor={producto ? producto.sku : ""} onElegir={setSkuSel} />
        {producto && (
          <p className="text-xs mt-2" style={{ color: T.suave }}>
            {producto.desc ? `${producto.desc} · ` : ""}{u.fLLL(producto.L, producto.W, producto.H)} · {u.fP(producto.peso, 2)}
          </p>
        )}
        {producto && Math.max(producto.L, producto.W, producto.H) < 30 && (
          <p className="text-xs mt-2 px-2 py-1.5 rounded" style={{ color: T.error, background: `${T.error}12` }}>
            Medidas muy pequeñas ({u.fLLL(producto.L, producto.W, producto.H)}). Puede ser un dato de relleno en el maestro: revisa las medidas reales antes de usar estos resultados.
          </p>
        )}
      </div>

      {producto && <>
        <p className="text-xs font-semibold mb-2" style={{ color: T.suave }}>CAPACIDAD</p>
        {P("suelta", Package, "Capacidad máxima suelta", "¿Cuántas cajas caben sueltas en un vehículo?",
          <CapacidadSuelta key={producto.sku} producto={producto} vehiculos={vehiculos} reglas={reglas} calcularHerramienta={calcularHerramienta} calculando={calculando} vistaHerr={vistaHerr} />)}
        {P("pallets", Layers, "Capacidad en pallets completos", "¿Cuántos pallets completos caben en un vehículo?",
          <CapacidadPallets key={producto.sku} producto={producto} vehiculos={vehiculos} pallets={pallets} reglas={reglas} calcularHerramienta={calcularHerramienta} calculando={calculando} vistaHerr={vistaHerr} />)}
        {P("necesarios", Truck, "Vehículos necesarios", "¿Cuántos vehículos para una cantidad, y cuánto cuesta por caja?",
          <VehiculosNecesarios key={producto.sku} producto={producto} pallets={pallets} vehiculos={vehiculos} reglas={reglas} tarifas={tarifas} />)}
        <p className="text-xs font-semibold mb-2 mt-4" style={{ color: T.suave }}>PALETIZADO</p>
        {P("optimo", Boxes, "Pallet óptimo y paletizado para fabricación", "Patrones con semáforo de estabilidad, centro de gravedad y compresión; listado y PDF.",
          <PalletFabricacion producto={producto} productos={maestro.productos} pallets={pallets} reglas={reglas} verPalletHerr={verPalletHerr} />)}
        {P("comparar", Scale, "Comparar pallets", "¿En qué pallet del catálogo conviene este SKU?",
          <CompararPallets key={producto.sku} producto={producto} pallets={pallets} vehiculos={vehiculos} reglas={reglas} />)}
        <p className="text-xs font-semibold mb-2 mt-4" style={{ color: T.suave }}>DATOS</p>
        {P("unidades", Repeat, "Convertidor de unidades", "Millares, pallets, kilos… a cajas de este SKU.",
          <ConvertidorUnidades key={producto.sku} producto={producto} conversiones={maestro.conversiones} />)}
      </>}
      {P("calidad", ShieldCheck, "Calidad del maestro", "Medidas vacías o de relleno, pesos que no cuadran, SKUs repetidos.",
        <CalidadMaestro productos={maestro.productos} pallets={pallets} vehiculos={vehiculos} onVerSku={elegirDeFuera} />)}
    </>
  );
}

function ResultadoCompleto({ r, u, tipo, nivel }) {
  if (!r) return null;
  return (
    <div className="mt-3 rounded-md p-2" style={{ background: "#EEF3F9", border: `1px solid ${T.linea}` }}>
      <p className="text-xs font-semibold">Resultado del cálculo completo (nivel {nivel}) · se ve en el 3D</p>
      <Resultado filas={[
        ...(tipo === "pallets" ? [["Pallets completos", n0(r.nPallets)], ["Cajas por pallet", n0(r.cajasPorPallet)]] : []),
        ["Cajas cargadas", n0(r.nCajas)],
        ["Piezas", n0(r.piezas)],
        ["Ocupación del vehículo", `${r.ocupacion.toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`],
        ["Peso", `${u.fP(r.peso)}${r.utilPeso != null ? ` (${r.utilPeso.toFixed(0)}% del máximo)` : ""}`],
      ]} />
      {/* Avisos de ESTA corrida. Los de la pestaña Avisos de abajo son los del pedido, que no cambian aquí. */}
      {(r.avisos?.length > 0 || r.sinCargar > 0) && (
        <ul className="text-xs mt-2 flex flex-col gap-1" style={{ color: T.aviso }}>
          {r.sinCargar > 0 && <li>No cupieron {n0(r.sinCargar)} bultos de este SKU en un solo vehículo.</li>}
          {(r.avisos || []).map((a) => <li key={a}>{a}</li>)}
        </ul>
      )}
    </div>
  );
}

function CapacidadSuelta({ producto, vehiculos, reglas, calcularHerramienta, calculando, vistaHerr }) {
  const u = useUnidades();
  const [vehSel, setVehSel] = useState(vehiculos[0]?.id || "");
  // Rotaciones propias de la herramienta: por omisión todas, para responder «cuánto cabe como sea»; se
  // pueden apagar para que respete las del producto o las de la operación.
  const [oris, setOris] = useState(TODAS);
  const [completo, setCompleto] = useState(null);
  const veh = useMemo(() => vehParaCalculo(vehiculos.find((v) => v.id === vehSel) || vehiculos[0] || {}), [vehiculos, vehSel]);
  const m = useMemo(() => paraMotor(producto, reglas, { oris, volteoPiso: oris.slice(2).some(Boolean) }), [producto, reglas, oris]);
  const r = useMemo(() => (veh.L > 0 && oris.some(Boolean) ? capacidadSuelta(m.it, veh, m.reglas) : null), [m, veh, oris]);
  const puedeCompleto = r && r.cajas > 0 && r.cajas <= TOPE_CALCULO;
  const calcular = async () => {
    setCompleto(null);
    const res = await calcularHerramienta({ tipo: "suelta", producto, oris, veh, qty: Math.ceil(r.cajas * 1.15) + 20, titulo: `${producto.sku} suelto en ${veh.nombre}`, color: COLOR_HERR });
    if (res) setCompleto(res);
  };
  return (
    <>
      <Sel etiqueta="Vehículo" valor={veh.id || vehiculos[0]?.id} onChange={(v) => { setVehSel(v); setCompleto(null); }} opciones={vehiculos.map((v) => [v.id, v.nombre])} />
      <div className="mt-3">
        <SelectorOrientacion it={{ ...producto, oris }} editar={(k, v) => { if (k === "oris") { setOris(v); setCompleto(null); } }} />
      </div>
      {r && (r.cajas > 0 ? (
        <>
          <p className="text-xs font-semibold mt-1">Estimado rápido</p>
          <Resultado estimado={r.estimado} filas={[
            ["Cantidad máxima (cajas)", n0(r.cajas)],
            ["Piezas totales", n0(r.piezas)],
            ["Volumen ocupado", u.fV(r.vol)],
            ["% de ocupación del vehículo", pct(r.vol / r.volV)],
            ["Peso total", u.fP(r.peso)],
          ]} />
        </>
      ) : <p className="text-sm mt-2" style={{ color: T.error }}>Este SKU no cabe suelto en este vehículo (o excede el peso máximo).</p>)}
      <BotonCalcular onClick={calcular} calculando={calculando} deshabilitado={!puedeCompleto}
        titulo={r?.cajas > TOPE_CALCULO ? `Son más de ${n0(TOPE_CALCULO)} cajas: el estimado ya es la respuesta y el 3D sería ilegible` : "Corre el motor completo con las reglas activas y lo muestra en el 3D"} />
      {r?.cajas > TOPE_CALCULO && <p className="text-xs mt-1" style={{ color: T.suave }}>Son más de {n0(TOPE_CALCULO)} cajas: el estimado ya es la respuesta y en 3D no se distinguiría nada.</p>}
      {vistaHerr && completo && <ResultadoCompleto r={completo} u={u} tipo="suelta" nivel={reglas.nivel} />}
    </>
  );
}

// Configuración del pallet para la herramienta: la estándar del SKU (si la tiene), la óptima que calcula la
// herramienta, o una a mano.
const CONFIGS = [["estandar", "Estándar del SKU"], ["optima", "Óptima (la calcula la herramienta)"], ["manual", "A mano"]];
function CapacidadPallets({ producto, vehiculos, pallets, reglas, calcularHerramienta, calculando, vistaHerr }) {
  const u = useUnidades();
  const tieneEstandar = producto.porPallet > 0 || producto.porCapa > 0 || producto.capasPallet > 0;
  const [vehSel, setVehSel] = useState(vehiculos[0]?.id || "");
  const [palSel, setPalSel] = useState(() => Math.max(0, pallets.findIndex((t) => t.nombre === producto.tarima)));
  const [modo, setModo] = useState(tieneEstandar ? "estandar" : "optima");
  const [manual, setManual] = useState({ porPallet: producto.porPallet || 0, porCapa: producto.porCapa || 0, capasPallet: producto.capasPallet || 0 });
  const [completo, setCompleto] = useState(null);
  const veh = useMemo(() => vehParaCalculo(vehiculos.find((v) => v.id === vehSel) || vehiculos[0] || {}), [vehiculos, vehSel]);
  const pal = pallets[palSel] || pallets[0];
  const config = modo === "estandar" ? { porPallet: producto.porPallet || 0, porCapa: producto.porCapa || 0, capasPallet: producto.capasPallet || 0 }
    : modo === "manual" ? manual : { porPallet: 0, porCapa: 0, capasPallet: 0 };
  const m = useMemo(() => paraMotor(producto, reglas, config), [producto, reglas, config.porPallet, config.porCapa, config.capasPallet]);
  const r = useMemo(() => (pal && veh.L > 0 ? capacidadPalletCompleto(m.it, pal, veh, m.reglas) : null), [m, pal, veh]);
  const calcular = async () => {
    setCompleto(null);
    const n = r.cajasPorPallet;
    const res = await calcularHerramienta({ tipo: "pallets", producto, veh, palletIdx: palSel, config: { ...config, porPallet: n }, qty: n * (r.pallets + 2), titulo: `${producto.sku} en pallets completos · ${veh.nombre}`, color: COLOR_HERR });
    if (res) setCompleto(res);
  };
  const cambio = (f) => (v) => { f(v); setCompleto(null); };
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Sel etiqueta="Vehículo" valor={veh.id || vehiculos[0]?.id} onChange={cambio(setVehSel)} opciones={vehiculos.map((v) => [v.id, v.nombre])} />
        <Sel etiqueta="Pallet" valor={palSel} onChange={cambio((v) => setPalSel(Number(v)))} opciones={pallets.map((p, i) => [i, p.nombre])} />
      </div>
      <div className="mt-2">
        <Sel etiqueta="Configuración del pallet" valor={modo} onChange={cambio(setModo)} opciones={CONFIGS.filter(([k]) => k !== "estandar" || tieneEstandar)} />
      </div>
      {modo === "manual" && (
        <div className="grid grid-cols-3 gap-2 mt-2">
          <Num etiqueta="Cajas por pallet" valor={manual.porPallet} onChange={cambio((v) => setManual((x) => ({ ...x, porPallet: v })))} ayuda="0 = las que quepan" />
          <Num etiqueta="Cajas por nivel" valor={manual.porCapa} onChange={cambio((v) => setManual((x) => ({ ...x, porCapa: v })))} ayuda="0 = las que quepan" />
          <Num etiqueta="Niveles" valor={manual.capasPallet} onChange={cambio((v) => setManual((x) => ({ ...x, capasPallet: v })))} ayuda="0 = los que permita la altura" />
        </div>
      )}
      {/* Cuál de los dos topes del pallet es el que manda, con el número que lo explica */}
      {modo === "estandar" && <p className="text-xs mt-1" style={{ color: T.suave }}>Del maestro: {producto.porPallet ? `${producto.porPallet} cajas por pallet` : "cajas por pallet libre"}{producto.porCapa ? ` · ${producto.porCapa} por nivel` : ""}{producto.capasPallet ? ` · ${producto.capasPallet} niveles` : ""}.</p>}
      {r && (r.pallets > 0 ? (
        <>
          <p className="text-xs font-semibold mt-3">Estimado rápido</p>
          <Resultado estimado={r.def.estimado} filas={[
            ["Armado del pallet", r.def.capas
              ? (r.def.capas * r.def.porCapa === r.cajasPorPallet
                ? `${r.def.capas} niveles × ${r.def.porCapa} por nivel`
                : `${Math.floor(r.cajasPorPallet / r.def.porCapa)} niveles de ${r.def.porCapa} + 1 de ${r.cajasPorPallet % r.def.porCapa}`)
              : `${r.cajasPorPallet} cajas`],
            ["Pallets completos", n0(r.pallets)],
            ["Cajas por pallet", n0(r.cajasPorPallet)],
            ["Total de cajas", n0(r.cajasTotales)],
            ["Unidades totales", n0(r.piezasTotales)],
            ["% de ocupación del vehículo", pct(r.vol / r.volV)],
            ["Peso total transportado", u.fP(r.peso)],
            ["Alto del pallet", u.fL(r.def.alto, 0)],
          ]} nota={[
            config.porPallet > r.cajasPorPallet ? `Pediste ${config.porPallet} cajas por pallet y solo caben ${r.cajasPorPallet}: ${limita(config.porPallet, r, pal, producto, u)}.` : null,
            r.def.techoPlano ? null : "El pallet no queda plano arriba (último nivel incompleto), así que no se le apila otro encima.",
          ].filter(Boolean).join(" ") || null} />
        </>
      ) : <p className="text-sm mt-2" style={{ color: T.error }}>Ni un pallet completo de este SKU cabe en este vehículo con esta configuración.</p>)}
      {!r && <p className="text-sm mt-2" style={{ color: T.error }}>Este SKU no arma ni un pallet en este pallet (revisa medidas y orientaciones).</p>}
      <BotonCalcular onClick={calcular} calculando={calculando} deshabilitado={!r || !r.pallets || r.cajasTotales > TOPE_CALCULO * 5} titulo="Corre el motor completo con las reglas activas y lo muestra en el 3D" />
      {vistaHerr && completo && <ResultadoCompleto r={completo} u={u} tipo="pallets" nivel={reglas.nivel} />}
    </>
  );
}

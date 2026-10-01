import { useState, useEffect, useRef, useMemo } from "react";
import { Package, Truck, Layers, SlidersHorizontal, HelpCircle, Play, FilePlus, ClipboardPaste, AlertTriangle, Loader2, Plus, Trash2, X, ChevronDown, ChevronLeft, ChevronRight, Database, FolderOpen, Save, Upload, FileSpreadsheet, Search, RefreshCw, CheckCircle2, Repeat, Calculator, PackagePlus, MoreHorizontal, LogOut, BookOpen, Hand, Download, Ruler } from "lucide-react";
import { correr, correrConBundles, ejecutorWorker, ErrorCorrida } from "./motor/corrida.js";
import { sugerirLlenado, sugerirDisminucion } from "./motor/optimizarPedido.js";
import MotorWorker from "./motor/motor.worker.js?worker&inline";
import { armarReporte } from "./motor/reporte.js";
import { rotar, mover, pegar as pegarBulto, quitar, colocar, validar, recalcularContenedor } from "./motor/edicion.js";
import { clave, claveSku, indiceSku, buscarSku, conversionDe, numero } from "./archivos/celdas.js";
import { ARCHIVO_MAESTRO, ARCHIVO_RESPALDO, productoVacio, leerMaestro, libroMaestro, leerCubeMaster, plantillaDimensiones, plantillaBundles, actualizarDimensiones, leerBundleMaestro } from "./archivos/maestro.js";
import { tieneBundle } from "./archivos/bundle.js";
import { esDeManufactura } from "./motor/herramientas.js";
import { leerVehiculos, libroVehiculos, plantillaVehiculos, vehiculoVacio } from "./archivos/vehiculos.js";
import { leerPedido, libroPlantilla } from "./archivos/pedido.js";
import { leerConversiones, aCajas, UM_CAJA_DEF, normalizaUM, nombreUM } from "./archivos/conversiones.js";
import { libroResultados, etapasDe, htmlInstructivo, htmlInstructivoCompleto, nombreArchivo, libroSimple, MIME_XLSX } from "./archivos/resultados.js";
import { EJEMPLOS, PALLETS_INICIALES, VEHICULOS, VERSION_ESTADO, nuevoItem, palletsAlDia } from "./ui/referencia.js";
import { PALETAS, generarColores } from "./ui/colores.js";
import { T } from "./ui/tema.js";
import { VERSION, VERSION_COMPLETA } from "./version.js";
import { FS_DISPONIBLE, descargarArchivo, idb } from "./ui/navegador.js";
import { idiomaActual, idiomaGuardado, guardarIdioma, fijarIdioma, traducirPantalla, tr } from "./i18n/index.js";
import { guardarProyectoNube, cargarProyectoNube, cerrarSesion, guardarMaestroNube, cargarMaestroNube, guardarPreferencias } from "./nube/nube.js";
import { unidadesDe, SISTEMAS, UNIDADES_ARCHIVO } from "./unidades.js";
import { ProveedorUnidades } from "./ui/unidadesContexto.jsx";
import { fleteTotal, tarifaVacia, METODOS_FLETE } from "./archivos/flete.js";
import { Escenarios } from "./nube/Escenarios.jsx";
import { Visor } from "./visor/Visor.jsx";
import { Confirmacion, Tarjeta, Nota, MenuBoton, SelectorIdioma, estInp, inp } from "./ui/controles.jsx";
import { SeccionVehiculo } from "./ui/secciones/SeccionVehiculo.jsx";
import { RevisionPedido } from "./ui/secciones/RevisionPedido.jsx";
import { SeccionPaletizado } from "./ui/secciones/SeccionPaletizado.jsx";
import { SeccionAyuda } from "./ui/secciones/SeccionAyuda.jsx";
import { SeccionReglas } from "./ui/secciones/SeccionReglas.jsx";
import { SeccionHerramientas } from "./ui/secciones/SeccionHerramientas.jsx";
import { PanelResultados } from "./ui/secciones/PanelResultados.jsx";
import { PanelEdicion } from "./ui/secciones/PanelEdicion.jsx";
import { OptimizarPedido } from "./ui/secciones/OptimizarPedido.jsx";
import { FilaItem, FilaMaestro } from "./ui/filas.jsx";

// Hasta cuántos vehículos se muestran como botones sobre el visor; con más, se cambia a un selector con flechas.
const MAX_BOTONES_VEH = 3;

// ================= Motor (Web Worker) =================
// Cada corrida crea un Worker nuevo. El worker va incrustado (?worker&inline) para que el build de un solo archivo HTML funcione sin servidor.
const ejecutor = ejecutorWorker(() => new MotorWorker());

// ================= Aplicación =================
export default function Estiba3D({ usuario }) {
  // Sistema de unidades del usuario: se guarda en su cuenta (lo sigue a cualquier computadora) y en este
  // navegador, por si no hay conexión. Solo cambia cómo se ven y capturan las medidas: el motor sigue en mm y kg.
  const [sistema, setSistema] = useState(() => {
    try { return usuario?.user_metadata?.unidades || localStorage.getItem("darnelcube.unidades") || "metrico"; } catch { return usuario?.user_metadata?.unidades || "metrico"; }
  });
  const u = useMemo(() => unidadesDe(sistema), [sistema]);
  const cambiarSistema = (id) => {
    setSistema(id);
    try { localStorage.setItem("darnelcube.unidades", id); } catch { /* sin almacenamiento local: no pasa nada */ }
    guardarPreferencias({ unidades: id }).catch(() => {});
  };
  // Idioma: lo último que se eligió en este navegador (también en la pantalla de entrada), si no el de la cuenta. El texto se traduce en pantalla (i18n/index.js).
  const [idioma, setIdioma] = useState(() => { const l = idiomaGuardado() || usuario?.user_metadata?.idioma || "es"; fijarIdioma(l); return idiomaActual(); });
  const cambiarIdioma = (l) => {
    guardarIdioma(l); setIdioma(idiomaActual()); traducirPantalla();
    guardarPreferencias({ idioma: idiomaActual() }).catch(() => {});
  };
  useEffect(() => { traducirPantalla(); }, [idioma]);
  // Al cambiar de pestaña, el panel empieza arriba (antes conservaba el desplazamiento de la anterior)
  const panelIzq = useRef(null);
  // Unidad de los archivos que se suben (maestro, dimensiones, Bundle, vehículos). "auto" = según el encabezado.
  const [unidadesArchivo, setUnidadesArchivo] = useState("auto");
  const conUnidades = (texto) => (texto && texto !== "milímetros y kilogramos" ? ` Medidas leídas en ${texto} y guardadas en mm y kg.` : "");
  const [proyecto, setProyecto] = useState(() => tr("Carga sin título"));
  const [seccion, setSeccion] = useState("mercancia");
  useEffect(() => { if (panelIzq.current) panelIzq.current.scrollTop = 0; }, [seccion]);
  const [verMedidas, setVerMedidas] = useState(true);
  // La descripción del maestro, opcional: ayuda a reconocer el SKU pero ensancha mucho la tabla
  const [verDesc, setVerDesc] = useState(false);
  const [verRutaManual, setVerRutaManual] = useState(false);   // columnas Entrega/Pedido/Destino aunque estén vacías // columnas Largo/Ancho/Alto/Kg; se ocultan cuando el pedido viene del maestro
  const [vehId, setVehId] = useState("53CS");
  const [veh, setVeh] = useState({ ...VEHICULOS[3], maxVolPct: 0, maxSkus: 0, maxPiezas: 0 });
  const [pallets, setPallets] = useState(PALLETS_INICIALES);
  const [reglas, setReglas] = useState({ nivel: 4, limitarPeso: true, soporteMin: 75, usarOrden: true, agrupar: false, juntos: true, rigor: "estricto", separarGrupos: false, usarLista: false, compresionAuto: true, apilamiento: "ninguna", abrirBundles: "llenar", redondeo: "arriba" });
  const [items, setItems] = useState(EJEMPLOS.pallets.items);
  const [abierto, setAbierto] = useState(null);
  const [pegar, setPegar] = useState(false);
  const [textoPegado, setTextoPegado] = useState("");
  const [menuEj, setMenuEj] = useState(false);   // menú "Más" del encabezado (nuevo, ejemplos, sesión)
  // Ancho del panel izquierdo (tabla) en pantallas anchas, en % del total. Cada quien lo arrastra a su gusto
  // y se recuerda en este navegador: unos prefieren ver más tabla, otros más 3D.
  const [anchoIzq, setAnchoIzq] = useState(() => { try { const v = +localStorage.getItem("darnelcube.anchoIzq"); return v >= 30 && v <= 70 ? v : 50; } catch { return 50; } });
  const arrastreDiv = useRef(null);
  const moverDivisor = (e) => {
    if (!arrastreDiv.current) return;
    const v = Math.min(70, Math.max(30, (e.clientX / window.innerWidth) * 100));
    setAnchoIzq(v);
  };
  const soltarDivisor = () => {
    if (!arrastreDiv.current) return;
    arrastreDiv.current = null;
    setAnchoIzq((v) => { try { localStorage.setItem("darnelcube.anchoIzq", String(Math.round(v))); } catch { /* sin almacenamiento local */ } return v; });
  };
  const [res, setRes] = useState(null);
  const [sel, setSel] = useState(0);
  const [vista, setVista] = useState(null);
  const [paso, setPaso] = useState(0);
  const [progreso, setProgreso] = useState(null);
  const [corrida, setCorrida] = useState(null); // { resultado, carga } de la última corrida
  // Llenar con pedido sugerido / sugerir disminución (ver motor/optimizarPedido.js y OptimizarPedido.jsx)
  const [optim, setOptim] = useState(null);
  const [error, setError] = useState("");
  const [resaltado, setResaltado] = useState(null);
  const [pestana, setPestana] = useState("resumen");
  const [camara, setCamara] = useState(null);
  // Cotas del espacio libre en el 3D: apagadas por omisión, se prenden con el botón «Medidas»
  const [verCotas, setVerCotas] = useState(false);
  const [costoReal, setCostoReal] = useState(null);
  const [paleta, setPaleta] = useState("vivos");
  const [maestro, setMaestro] = useState({ productos: [], origen: null, sucio: false, guardado: null, errores: [], conversiones: null });
  const [reconectar, setReconectar] = useState(null);
  const [aviso, setAviso] = useState("");
  // Los avisos se van solos; más tiempo mientras más largos, para alcanzar a leerlos. Solo se borra el mismo
  // aviso: si leer un archivo grande bloqueó la pantalla, el temporizador viejo no debe borrar el mensaje nuevo.
  useEffect(() => { if (!aviso) return; const t = setTimeout(() => setAviso((a) => (a === aviso ? "" : a)), Math.min(14000, 4000 + aviso.length * 45)); return () => clearTimeout(t); }, [aviso]);
  const [busqueda, setBusqueda] = useState("");
  const [abiertoP, setAbiertoP] = useState(null);
  const [skuNuevo, setSkuNuevo] = useState("");
  const dirRef = useRef(null);
  useEffect(() => {
    const ro = new ResizeObserver((ents) => ents.forEach((e) => e.target.style.setProperty("--anchoPanel", `${Math.max(280, e.target.clientWidth - 2)}px`)));
    const observar = () => document.querySelectorAll(".tabla-ancho").forEach((el) => ro.observe(el));
    observar(); const mo = new MutationObserver(observar); mo.observe(document.body, { childList: true, subtree: true });
    return () => { ro.disconnect(); mo.disconnect(); };
  }, []);
  const apiVisor = useRef(null);
  const inputCube = useRef(null);
  const inputConv = useRef(null);
  const inputDims = useRef(null);
  const inputBundle = useRef(null);
  const inputVehiculos = useRef(null);
  const [confirmar, setConfirmar] = useState(null);
  const [generando, setGenerando] = useState(false);
  const [leyendo, setLeyendo] = useState("");
  const [revision, setRevision] = useState(null);
  const [panelOculto, setPanelOculto] = useState(false);
  const [recomendacion, setRecomendacion] = useState(null);
  const calcularRef = useRef(null);   // resultado de la última carga de pedido, línea por línea
  const [vehiculos, setVehiculos] = useState(VEHICULOS);   // los de fábrica más los que cree el usuario en esta sesión
  const [guardandoNube, setGuardandoNube] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState(null);
  const [verEscenarios, setVerEscenarios] = useState(false);
  const [tarifas, setTarifas] = useState([]);   // tarifario de flete; vacío = la recomendación decide solo por espacio
  const [anchoSku, setAnchoSku] = useState(200); // la columna SKU se ensancha arrastrando su borde
  const inputMaestro = useRef(null);
  const inputPedido = useRef(null);
  const [menuColor, setMenuColor] = useState(false);
  // Vista de una herramienta en el visor 3D (capacidad suelta, pallets completos, pallet óptimo). Mientras
  // exista, el visor muestra eso en vez de la carga del pedido; «Volver a mi carga» la quita sin perder nada.
  const [vistaHerr, setVistaHerr] = useState(null);
  // Edición a mano del vehículo que se está viendo: bulto elegido, lo que se quitó y el historial para deshacer.
  const [edicion, setEdicion] = useState(null);

  const modoPallet = vehId.startsWith("PAL:");
  const palIdx = modoPallet ? Number(vehId.slice(4)) : -1;
  const palSel = modoPallet ? pallets[palIdx] : null;
  const vehCalc = useMemo(() => (!palSel ? veh : { L: palSel.L + 2 * palSel.ovL, W: palSel.W + 2 * palSel.ovW, H: Math.max(1, palSel.altMax - palSel.esp), tara: 0, maxKg: palSel.maxKg, maxVolPct: 0, maxSkus: 0, maxPiezas: 0, esPallet: true }), [veh, palSel]);
  const nombreVeh = modoPallet ? palSel?.nombre : vehiculos.find((v) => v.id === vehId)?.nombre || veh.nombre;
  // Entrega, pedido y destino solo se muestran si alguna línea los usa (o si se piden): para la mayoría de las
  // cargas son columnas vacías que obligaban a deslizar la tabla de lado.
  const rutaEnUso = items.some((it) => it.orden > 0 || it.grupo || it.destino);
  const verRuta = rutaEnUso || verRutaManual;
  const totales = useMemo(() => {
    let m3 = 0, kg = 0, cajas = 0;
    items.forEach((it) => { cajas += it.qty; m3 += (it.L * it.W * it.H * it.qty) / 1e9; kg += it.peso * it.qty; });
    return { m3, kg, cajas };
  }, [items]);
  const formas = useMemo(() => items.map((it) => it.forma || "caja"), [items]);
  const coloresBase = useMemo(() => generarColores(items.length, paleta), [items.length, paleta]);
  // Los pedidos y transferencias a veces traen el ID del ERP en vez del SKU: se busca por los dos.
  // El guion cuenta ("852-10" ≠ "85210"), pero si un pedido trae el código sin guion y solo hay un
  // producto parecido, también lo encuentra (ver indiceSku). Buscar siempre con buscarSku(mapaMaestro, texto).
  const mapaMaestro = useMemo(() => indiceSku(maestro.productos), [maestro.productos]);
  const colores = useMemo(() => items.map((it, i) => it.color || coloresBase[i]), [items, coloresBase]);
  const hayPersonalizados = items.some((i) => i.color);

  // Cualquier cambio a la carga deja viejas las sugerencias (completar espacios, consolidar): se borran,
  // y si alguna todavía está calculando, su resultado se descarta al llegar (ver intentoRef).
  const intentoRef = useRef(0);
  const invalidar = () => {
    setEdicion(null);
    setRecomendacion(null); setRes(null); setCorrida(null); setResaltado(null); setVista(null);
    setOptim(null); intentoRef.current++; };
  // La carga tal como la recibe el motor en una corrida normal. Con «orden de la lista», la posición de la
  // fila manda (la de arriba entra primero, al fondo); si además hay entregas, la parada sigue mandando y
  // la lista solo desempata dentro de cada parada.
  const cargaPara = (lista, r) => ({
    items: r.usarLista ? lista.map((it, i) => ({ ...it, entrega: it.orden, orden: (it.orden > 0 ? it.orden : 9999) * 10000 + (lista.length - i) })) : lista,
    vehiculo: vehCalc, tarimas: pallets, reglas: r.usarLista ? { ...r, usarOrden: true } : r,
  });

  // ---------- Guardar y cargar en la nube (un proyecto por usuario) ----------
  const estadoParaGuardar = () => ({
    v: VERSION_ESTADO, proyecto, items, vehId, veh, vehiculos, pallets, reglas, tarifas,
  });
  const guardarEnNube = async () => {
    setGuardandoNube(true); setError("");
    try {
      await guardarProyectoNube(estadoParaGuardar());
      setUltimoGuardado(new Date());
      setAviso("Guardado en tu cuenta.");
    } catch (err) { setError("No se pudo guardar: " + err.message); }
    setGuardandoNube(false);
  };
  // Un escenario guardado trae su propio catálogo de vehículos. Se le suman los de fábrica que no tenga
  // (por ejemplo, los que se agregaron en una versión posterior), sin tocar los que el usuario ya tenía.
  const conDeFabrica = (lista) => {
    if (!lista?.length) return VEHICULOS;
    const ids = new Set(lista.map((v) => v.id));
    return [...lista, ...VEHICULOS.filter((v) => !ids.has(v.id))];
  };
  // Vuelca en pantalla un escenario guardado (el mismo formato que estadoParaGuardar).
  const aplicarEstado = (e) => {
    setProyecto(e.proyecto ?? tr("Carga sin título"));
    setItems(e.items ?? []);
    setVehiculos(conDeFabrica(e.vehiculos));
    setVehId(e.vehId ?? "53CS");
    if (e.veh) setVeh(e.veh);
    const pal = palletsAlDia(e.pallets, e.v);
    if (pal) setPallets(pal);
    if (e.reglas) setReglas(e.reglas);
    setTarifas(e.tarifas ?? []);
    // Los escenarios viejos (v1) traían una copia del maestro adentro. Ya no se usa: el maestro
    // permanente del usuario manda siempre. Solo se toma esa copia si todavía no hay maestro
    // cargado, para no perder datos de alguien que solo tenga escenarios viejos.
    if (e.maestro) setMaestro((m) => (m.productos.length ? m : { ...m, ...e.maestro, sucio: false, origen: { tipo: "nube" } }));
    invalidar();
  };
  const cargarDeNube = async (silencioso = false) => {
    setGuardandoNube(true); setError("");
    try {
      const r = await cargarProyectoNube();
      if (!r) { if (!silencioso) setAviso("Todavía no tienes nada guardado en tu cuenta."); setGuardandoNube(false); return; }
      const e = r.estado;
      setProyecto(e.proyecto ?? tr("Carga sin título"));
      setItems(e.items ?? []);
      setVehiculos(conDeFabrica(e.vehiculos));
      setVehId(e.vehId ?? "53CS");
      if (e.veh) setVeh(e.veh);
      const pal = palletsAlDia(e.pallets, e.v);
      if (pal) setPallets(pal);
      if (e.reglas) setReglas(e.reglas);
      if (e.maestro) setMaestro((m) => (m.productos.length ? m : { ...m, ...e.maestro, sucio: false, origen: { tipo: "nube" } }));
      setUltimoGuardado(new Date(r.actualizado));
      invalidar();
      if (!silencioso) setAviso("Se cargó tu progreso guardado.");
    } catch (err) { if (!silencioso) setError("No se pudo cargar: " + err.message); }
    setGuardandoNube(false);
  };
  // Al entrar: primero el maestro permanente del usuario, luego lo último que estaba trabajando.
  useEffect(() => {
    (async () => {
      try {
        const r = await cargarMaestroNube();
        if (r?.maestro) setMaestro((m) => ({ ...m, ...r.maestro, sucio: false, origen: { tipo: "nube" } }));
      } catch { /* si falla, se sigue sin maestro; la persona lo puede cargar a mano */ }
      cargarDeNube(true);
    })();
  }, []);

  const elegirVehiculo = (id, extra = {}) => { setVehId(id); if (!id.startsWith("PAL:")) setVeh((p) => ({ ...p, ...vehiculos.find((v) => v.id === id), ...extra })); invalidar(); };
  const editarVeh = (k, v) => {
    setVeh((p) => ({ ...p, [k]: v }));
    setVehiculos((a) => a.map((x) => (x.id === vehId ? { ...x, [k]: v } : x)));
    invalidar();
  };
  let sigVeh = 1;
  const nuevoIdVeh = () => { let id; do { id = "PROP" + sigVeh++; } while (vehiculos.some((v) => v.id === id)); return id; };
  const altaVehiculo = (base, nombre) => {
    const v = { ...base, id: nuevoIdVeh(), nombre, propio: true };
    setVehiculos((a) => [...a, v]); setVehId(v.id); setVeh(v); invalidar();
    setAviso(`${nombre} agregado. Ajusta sus medidas abajo; se guarda mientras la herramienta esté abierta.`);
  };
  const agregarVehiculo = () => altaVehiculo({ L: 12000, W: 2400, H: 2600, tara: 0, maxKg: 0, maxVolPct: 0, maxSkus: 0, maxPiezas: 0 }, `Vehículo ${vehiculos.filter((v) => v.propio).length + 1}`);
  const duplicarVehiculo = () => altaVehiculo({ ...veh }, `${veh.nombre || nombreVeh} (copia)`);
  const quitarVehiculo = (id) => {
    setVehiculos((a) => a.filter((v) => v.id !== id));
    if (vehId === id) elegirVehiculo(vehiculos.find((v) => v.id !== id)?.id || VEHICULOS[0].id);
  };
  const editarPallet = (i, k, v) => { setPallets((a) => a.map((p, j) => (j === i ? { ...p, [k]: v } : p))); invalidar(); };
  // Las líneas del pedido guardan el pallet por su posición en el catálogo: al quitar uno, las que lo usaban
  // pasan al primero y las de después se recorren un lugar, para que cada una siga apuntando al mismo pallet.
  const quitarPallet = (i) => {
    if (pallets.length < 2) return;
    const nombre = pallets[i].nombre, afectadas = items.filter((it) => (it.palletId || 0) === i && it.paletizar).length;
    setPallets((a) => a.filter((_, j) => j !== i));
    setItems((a) => a.map((it) => { const p = it.palletId || 0; return p === i ? { ...it, palletId: 0 } : p > i ? { ...it, palletId: p - 1 } : it; }));
    if (modoPallet && palIdx === i) setVehId("53CS");
    else if (modoPallet && palIdx > i) setVehId(`PAL:${palIdx - 1}`);
    invalidar();
    setAviso(`Se quitó el pallet «${nombre}».${afectadas ? ` ${afectadas} ${afectadas === 1 ? "línea que lo usaba pasó" : "líneas que lo usaban pasaron"} a «${pallets[i === 0 ? 1 : 0].nombre}».` : ""}`);
  };
  const editarRegla = (k, v) => { setReglas((p) => ({ ...p, [k]: v })); invalidar(); };
  // Mover una línea en la lista: con la regla "Cargar en el orden de la lista" cambia el acomodo
  const moverItem = (id, paso) => {
    setItems((a) => {
      const i = a.findIndex((x) => x.id === id), j = i + paso;
      if (i < 0 || j < 0 || j >= a.length) return a;
      const b = a.slice(); [b[i], b[j]] = [b[j], b[i]]; return b;
    });
    invalidar();
    if (reglas.usarLista) setTimeout(() => calcularRef.current?.(), 40);   // recalcula solo para ver el cambio en el visor
  };
  // Desde la lista de carga: prender o apagar una orientación de ese SKU y recalcular
  const editarOrisDeLinea = (idx, k) => {
    const ic = (corrida?.carga.items || items)[idx]; if (!ic) return;
    const it = items.find((x) => x.id === (ic.lineaId ?? ic.id)); if (!it) return;
    const nuevas = it.oris.map((v, i) => (i === k ? !v : v));
    if (!nuevas.some(Boolean)) { setError(`${it.nombre} necesita al menos una orientación permitida.`); return; }
    setItems((a) => a.map((x) => (x.id === it.id ? { ...x, oris: nuevas } : x)));
    invalidar();
    setTimeout(() => calcularRef.current?.(), 40);
  };
  const editarItem = (id, k, v) => {
    setItems((a) => a.map((it) => {
      if (it.id !== id) return it;
      // Al escribir un SKU que existe en el maestro, se traen sus medidas y reglas (se conservan cantidad, entrega y pedido)
      if (k === "nombre") {
        const p = buscarSku(mapaMaestro, v);
        if (p && claveSku(v) !== claveSku(it.nombre)) return { ...itemDeProducto(p, { qty: it.qty, orden: it.orden, grupo: it.grupo, destino: it.destino }), id: it.id, color: it.color };
      }
      return { ...it, [k]: v };
    }));
    if (k !== "color" && k !== "fijo") invalidar();   // el candado y el color no cambian el acomodo
  };

  const cargarEjemplo = (k) => {
    const e = EJEMPLOS[k];
    setItems(e.items()); setProyecto(e.nombre);
    setReglas((r) => ({ ...r, usarOrden: true, agrupar: false, juntos: true, rigor: "estricto", separarGrupos: false, compresionAuto: true, apilamiento: "ninguna", ...(e.reglas || {}) }));
    elegirVehiculo(e.veh, e.vehExtra || {});
    setMenuEj(false); setVerMedidas(true); setSeccion("mercancia");
  };
  // Con el botón a la vista es fácil darle sin querer: si ya hay un pedido capturado, se pregunta antes de borrarlo.
  // Nueva carga: deja el pedido vacío (antes quedaba una línea «SKU 1» de 50 cajas que parecía un pedido).
  // La confirmación es propia de la página: el confirm() del navegador se puede bloquear y entonces no hacía nada.
  const [confirmarNueva, setConfirmarNueva] = useState(false);
  const empezarNueva = () => {
    setConfirmarNueva(false); setAviso(""); setError(""); setItems([]); setProyecto(tr("Carga sin título")); setRevision(null); invalidar(); setVistaHerr(null); setEdicion(null); setSeccion("mercancia");
  };
  const nuevo = () => { if (items.length) setConfirmarNueva(true); else empezarNueva(); };

  const importar = () => {
    const filas = textoPegado.split(/\r?\n/).map((l) => l.split(/\t|;|,/).map((c) => c.trim())).filter((f) => f.length >= 6 && f[0]);
    const nuevos = filas.filter((f) => !isNaN(parseFloat(f[1]))).map((f) =>
      nuevoItem({ nombre: f[0], L: u.aMm(+f[1] || 0), W: u.aMm(+f[2] || 0), H: u.aMm(+f[3] || 0), peso: u.aKg(+f[4] || 0), qty: Math.round(+f[5] || 0), grupo: f[6] || "", orden: Math.round(+f[7] || 0), porPallet: Math.round(+f[8] || 0), paletizar: +f[8] > 0 }));
    if (!nuevos.length) { setError("No se reconocieron filas. Columnas: Nombre, Largo, Ancho, Alto, Peso, Cantidad, Pedido, Entrega, Cajas por pallet."); return; }
    setItems(nuevos); setPegar(false); setTextoPegado(""); setError(""); setVerMedidas(true); invalidar();
  };

  // ----- Maestro -----
  const aplicarMaestro = ({ productos, tarimas, errores, conversiones, unidades }, origen) => {
    setMaestro((m) => ({ productos, origen, sucio: false, guardado: null, errores, conversiones: conversiones || m.conversiones }));
    if (tarimas && tarimas.length) setPallets(tarimas);
    const nConv = conversiones ? Object.keys(conversiones).length : 0;
    setAviso(`Maestro cargado: ${productos.length} productos${tarimas?.length ? `, ${tarimas.length} pallets` : ""}${nConv ? ` y conversiones de ${nConv} SKUs` : ""}.${conUnidades(unidades)}`);
  };
  const cargarDeCarpeta = async (dir) => {
    try {
      const fh = await dir.getFileHandle(ARCHIVO_MAESTRO);
      aplicarMaestro(leerMaestro(await (await fh.getFile()).arrayBuffer(), unidadesArchivo), { tipo: "carpeta", nombre: dir.name });
    } catch (e) {
      if (e.name === "NotFoundError") {
        setMaestro((m) => ({ ...m, origen: { tipo: "carpeta", nombre: dir.name }, sucio: m.productos.length > 0 }));
        setAviso(`La carpeta «${dir.name}» no tiene ${ARCHIVO_MAESTRO}. Se creará al guardar.`);
      } else setError("No se pudo leer el maestro: " + e.message);
    }
    setReconectar(null);
  };
  useEffect(() => {
    if (!FS_DISPONIBLE) return;
    idb.get("carpeta").then(async (dir) => {
      if (!dir) return;
      dirRef.current = dir;
      if ((await dir.queryPermission({ mode: "readwrite" })) === "granted") cargarDeCarpeta(dir);
      else setReconectar(dir.name);
    }).catch(() => {});
  }, []);
  const conectarCarpeta = async () => {
    setError("");
    try {
      const dir = await window.showDirectoryPicker({ id: "estiba3d", mode: "readwrite" });
      dirRef.current = dir;
      idb.set("carpeta", dir).catch(() => {});
      await cargarDeCarpeta(dir);
    } catch (e) {
      if (e.name === "AbortError") return;
      setError("Este navegador o esta vista no permiten conectar carpetas. Usa «Abrir archivo» y «Guardar» descargará el maestro.");
    }
  };
  const volverAConectar = async () => {
    const dir = dirRef.current;
    if (dir && (await dir.requestPermission({ mode: "readwrite" })) === "granted") cargarDeCarpeta(dir);
  };
  const abrirArchivoMaestro = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try { dirRef.current = null; aplicarMaestro(leerMaestro(await f.arrayBuffer(), unidadesArchivo), { tipo: "archivo", nombre: f.name }); }
    catch (err) { setError("No se pudo leer el archivo: " + err.message); }
  };
  // Guardar = a la cuenta del usuario, y nada más. Es lo que usa todo el mundo.
  // Guardar tarda unos segundos con un maestro grande: el botón lo dice mientras tanto (antes parecía no hacer nada)
  const [guardandoMaestro, setGuardandoMaestro] = useState(false);
  const guardarMaestro = async () => {
    if (guardandoMaestro) return;
    setError(""); setGuardandoMaestro(true);
    await new Promise((r) => setTimeout(r, 30));   // deja pintar «Guardando…» antes de comprimir
    try {
      await guardarMaestroNube({ productos: maestro.productos, tarimas: pallets, conversiones: maestro.conversiones });
      setMaestro((m) => ({ ...m, sucio: false, guardado: new Date() }));
      setAviso("Maestro guardado en tu cuenta. Está disponible cada vez que entres, en cualquier computadora.");
    } catch (e) { setError("No se pudo guardar el maestro en tu cuenta: " + e.message); }
    finally { setGuardandoMaestro(false); }
  };

  // Aparte y a propósito: bajar el maestro como Excel, o escribirlo en la carpeta conectada.
  // Es para quien quiera una copia fuera de la nube; no se dispara al guardar.
  const exportarMaestro = async () => {
    setError("");
    const buf = libroMaestro(maestro.productos, pallets, maestro.conversiones, SISTEMAS[sistema]);
    const dir = dirRef.current;
    if (dir && maestro.origen?.tipo === "carpeta") {
      try {
        if ((await dir.queryPermission({ mode: "readwrite" })) !== "granted" && (await dir.requestPermission({ mode: "readwrite" })) !== "granted") throw new Error("permiso denegado");
        try {
          const anterior = await (await dir.getFileHandle(ARCHIVO_MAESTRO)).getFile();
          const w0 = await (await dir.getFileHandle(ARCHIVO_RESPALDO, { create: true })).createWritable();
          await w0.write(await anterior.arrayBuffer()); await w0.close();
        } catch (e) { /* no había archivo anterior */ }
        const w = await (await dir.getFileHandle(ARCHIVO_MAESTRO, { create: true })).createWritable();
        await w.write(buf); await w.close();
        setAviso(`Copia escrita en «${dir.name}/${ARCHIVO_MAESTRO}».`);
      } catch (e) { setError("No se pudo escribir en la carpeta: " + e.message); }
    } else {
      descargarArchivo(buf, ARCHIVO_MAESTRO, MIME_XLSX);
      setAviso(`Se descargó ${ARCHIVO_MAESTRO} como copia. Tu maestro en la cuenta no cambia por esto.`);
    }
  };
  const editarProducto = (pid, k, v) => setMaestro((m) => ({ ...m, sucio: true, productos: m.productos.map((p) => (p.pid === pid ? { ...p, [k]: v } : p)) }));
  const agregarProducto = () => {
    const p = productoVacio({ sku: `NUEVO-${maestro.productos.length + 1}`, tarima: pallets[0]?.nombre || "" });
    setMaestro((m) => ({ ...m, sucio: true, productos: [p, ...m.productos] }));
    setAbiertoP(p.pid); setBusqueda("");
  };
  const quitarProducto = (pid) => setMaestro((m) => ({ ...m, sucio: true, productos: m.productos.filter((p) => p.pid !== pid) }));
  const itemDeProducto = (p, extra, lista = pallets) => {
    const pi = lista.findIndex((t) => clave(t.nombre) === clave(p.tarima));
    const { pid, sku, desc, tarima, ...reglasP } = p;
    // Un SKU con Bundle configurado se carga en Bundle por omisión (así lo hace el andén); se cambia en su línea.
    const bundle = tieneBundle(p) && extra.paletizar === undefined && extra.enBundle !== false;
    return nuevoItem({ ...reglasP, nombre: sku, desc, palletId: pi < 0 ? 0 : pi, ...(bundle ? { enBundle: true, paletizar: false } : {}), ...extra });
  };
  const agregarSkuDelMaestro = () => {
    const p = buscarSku(mapaMaestro, skuNuevo);
    if (!p) { setError(`${skuNuevo} no está en el maestro.`); return; }
    setItems((a) => [...a, itemDeProducto(p, { qty: 1 })]); setSkuNuevo(""); setError(""); invalidar();
  };
  const pasarCargaAlMaestro = () => {
    const existentes = new Set(maestro.productos.map((p) => claveSku(p.sku)));
    const nuevos = items.filter((it) => it.nombre && !existentes.has(claveSku(it.nombre))).map((it) => {
      const { id, nombre, qty, orden, grupo, palletId, desc, ...r } = it;
      return productoVacio({ ...r, sku: nombre, desc: desc || "", tarima: pallets[palletId]?.nombre || "" });
    });
    setMaestro((m) => ({ ...m, sucio: nuevos.length > 0 || m.sucio, productos: [...m.productos, ...nuevos] }));
    setAviso(nuevos.length ? `${nuevos.length} SKUs de la carga se agregaron al maestro. Falta guardar.` : "Todos los SKUs de la carga ya están en el maestro.");
  };
  const aplicarCubeMaster = ({ productos, tarimas, lineas }, nombre) => {
    const nuevasT = [...pallets];
    tarimas.forEach((t) => { if (!nuevasT.some((x) => clave(x.nombre) === clave(t.nombre))) nuevasT.push(t); });
    setPallets(nuevasT);
    // Mapa nuevo por SKU exacto (antes se escribía sobre mapaMaestro, que es del render y tiene llaves de respaldo)
    const porSku = new Map(maestro.productos.filter((p) => p.sku).map((p) => [claveSku(p.sku), p]));
    productos.forEach((p) => porSku.set(claveSku(p.sku), { ...p, pid: porSku.get(claveSku(p.sku))?.pid ?? p.pid }));
    const todos = [...porSku.values()], indice = indiceSku(todos);
    setMaestro((m) => ({ ...m, productos: todos, sucio: true, origen: m.origen || { tipo: "archivo", nombre: ARCHIVO_MAESTRO } }));
    if (lineas.length) {
      const nuevos = lineas.map((l) => itemDeProducto(buscarSku(indice, l.sku), { qty: l.qty, orden: l.orden, grupo: l.grupo, destino: l.destino }, nuevasT));
      setItems(nuevos); setProyecto(nombre.replace(/\.[^.]+$/, "")); invalidar();
    }
    setAviso(`Plantilla de CubeMaster importada: ${productos.length} productos al maestro${tarimas.length ? `, ${tarimas.length} pallets` : ""}${lineas.length ? ` y un pedido de ${lineas.reduce((a, l) => a + l.qty, 0).toLocaleString("es-MX")} cajas` : ""}. Presiona Guardar en Maestro para conservar los productos.`);
    if (lineas.length) setVerMedidas(false);
    setSeccion(lineas.length ? "mercancia" : "maestro");
  };
  const importarConversiones = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError(""); setLeyendo(`Leyendo ${f.name}… los archivos del ERP pueden tardar unos segundos.`);
    try {
      const buf = await f.arrayBuffer();
      await new Promise((r) => setTimeout(r, 30));  // deja pintar el aviso antes de bloquear con la lectura
      const skus = new Set(maestro.productos.map((p) => claveSku(p.sku)));
      const r = leerConversiones(buf, skus);
      if (!r.skus) { setError(`El archivo tiene ${r.filas.toLocaleString("es-MX")} equivalencias, pero ninguna es de un SKU del maestro. Carga primero el maestro.`); setLeyendo(""); return; }
      setMaestro((m) => ({ ...m, sucio: true, conversiones: { ...(m.conversiones || {}), ...r.porSku } }));
      setAviso(`Conversiones importadas: ${r.skus.toLocaleString("es-MX")} SKUs del maestro (${r.ums.join(", ")}). Se descartaron ${r.sinUsar.toLocaleString("es-MX")} equivalencias de SKUs que no están en el maestro. Falta presionar Guardar.`);
    } catch (err) { setError("No se pudo leer el archivo de conversiones: " + err.message); }
    setLeyendo("");
  };
  const importarCube = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    try { aplicarCubeMaster(leerCubeMaster(await f.arrayBuffer()), f.name); } catch (err) { setError("No se pudo leer la plantilla de CubeMaster: " + err.message); }
  };
  // Refresca identidad y medidas desde un archivo de solo dimensiones (lo que en el futuro podría
  // venir del ERP), sin tocar las reglas de estiba y paletizado que ya se configuraron por SKU.
  const importarDimensiones = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError("");
    try {
      const r = actualizarDimensiones(maestro.productos, await f.arrayBuffer(), unidadesArchivo);
      if (r.errores.length && !r.actualizados && !r.creados) { setError(r.errores.join(" ")); return; }
      setMaestro((m) => ({ ...m, productos: r.productos, sucio: true }));
      setAviso(`Dimensiones actualizadas: ${r.actualizados} producto${r.actualizados === 1 ? "" : "s"} existente${r.actualizados === 1 ? "" : "s"}`
        + (r.creados ? `, ${r.creados} nuevo${r.creados === 1 ? "" : "s"} (con parámetros por configurar)` : "") + "." + conUnidades(r.unidades) + " Falta presionar Guardar."
        + (r.errores.length ? ` ${r.errores.length} línea${r.errores.length === 1 ? "" : "s"} con problemas: ${r.errores.join(" ")}` : ""));
    } catch (err) { setError("No se pudo leer el archivo de dimensiones: " + err.message); }
  };
  // Enciende y configura el Bundle (BDL) de los SKUs que ya existen en el maestro, a partir del Excel
  // de referencia (ID Artículo, UM, Rel, Factor, CS/BDL, medidas). El % máximo de Bundle se ajusta
  // después, a mano, por SKU: es una decisión operativa y no viene en ese archivo.
  const importarBundle = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError("");
    try {
      const r = leerBundleMaestro(maestro.productos, await f.arrayBuffer(), unidadesArchivo);
      if (!r.actualizados) { setError(`No se importó ningún SKU. ${r.errores.join(" ")}`); return; }
      setMaestro((m) => ({ ...m, productos: r.productos, sucio: true }));
      setAviso(`Bundle importado: ${r.actualizados} SKU${r.actualizados === 1 ? "" : "s"} con Bundle configurado. Falta presionar Guardar.`
        + (r.errores.length ? ` ${r.errores.length} línea${r.errores.length === 1 ? "" : "s"} con problemas: ${r.errores.join(" ")}` : ""));
    } catch (err) { setError("No se pudo leer el archivo de Bundle: " + err.message); }
  };
  // Reemplaza el catálogo de vehículos con lo que traiga el archivo (conserva el vehículo elegido si sigue en la lista).
  const importarVehiculos = async (e) => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setError("");
    try {
      const r = leerVehiculos(await f.arrayBuffer(), unidadesArchivo);
      if (!r.vehiculos.length) { setError("El archivo no tiene ningún vehículo con medidas completas."); return; }
      setVehiculos(r.vehiculos);
      const actual = r.vehiculos.find((v) => v.nombre === veh.nombre) || r.vehiculos[0];
      elegirVehiculo(actual.id);
      setAviso(`Catálogo de vehículos importado: ${r.vehiculos.length} vehículo${r.vehiculos.length === 1 ? "" : "s"}.` + (r.errores.length ? ` ${r.errores.join(" ")}` : ""));
    } catch (err) { setError("No se pudo leer el catálogo de vehículos: " + err.message); }
  };
  const cargarPedido = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    try {
      const leido = leerPedido(await f.arrayBuffer());
      if (leido.cubemaster) { aplicarCubeMaster(leido.cubemaster, f.name); return; }
      const { lineas, datos } = leido;
      if (!lineas.length) { setError("El archivo no tiene líneas con SKU y cantidad. Usa la plantilla de carga."); return; }
      const porSku = mapaMaestro;
      const nuevos = [], filas = [];
      lineas.forEach((l) => {
        const p = buscarSku(porSku, l.sku), extra = { qty: l.qty, orden: l.orden, grupo: l.grupo, destino: l.destino };
        const umCaja = p?.umCaja || UM_CAJA_DEF;
        const fila = { sku: l.sku, desc: p?.desc || "", capturado: l.qty, um: l.um || "", umCaja, cajas: l.qty, estado: "ok", detalle: "" };
        const c = aCajas(l.qty, l.um, umCaja, conversionDe(maestro.conversiones, p?.sku ?? l.sku), p?.piezas, reglas.redondeo);
        extra.qty = fila.cajas = c.cajas;
        // La cantidad original se guarda siempre (aunque venga en la misma unidad): con decimales o
        // con Bundles, lo pedido y lo cubicado no son el mismo número y los dos tienen que estar a la vista.
        if ((l.um && normalizaUM(l.um) !== normalizaUM(umCaja)) || !c.exacto) { extra.qtyPedido = l.qty; extra.umPedido = l.um || umCaja; }
        if (c.motivo) { fila.estado = "sin conversión"; fila.detalle = c.motivo + "; se tomó la cantidad tal cual"; }
        else if (c.cambioDeUM) { fila.estado = "otra unidad"; fila.umCaja = c.destino; fila.detalle = `el maestro dice ${umCaja}, pero este SKU solo tiene ${c.destino}`; }
        if (!c.exacto && !c.motivo) {
          fila.estado = fila.estado === "ok" ? "redondeado" : fila.estado;
          fila.detalle = `${c.exactas.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${fila.umCaja} → ${c.cajas}` + (fila.detalle ? `; ${fila.detalle}` : "");
        }
        if (l.pal !== undefined) extra.paletizar = l.pal;
        if (l.porPallet !== undefined) extra.porPallet = l.porPallet;
        if (p) nuevos.push(itemDeProducto(p, extra));
        else if (numero(l.crudo.largo) > 0 && numero(l.crudo.ancho) > 0 && numero(l.crudo.alto) > 0) {
          nuevos.push(nuevoItem({ nombre: l.sku, L: numero(l.crudo.largo), W: numero(l.crudo.ancho), H: numero(l.crudo.alto), peso: numero(l.crudo.peso), ...extra }));
          fila.estado = "medidas del pedido"; fila.detalle = "no está en el maestro; se usaron las medidas capturadas en el archivo";
        } else { fila.estado = "sin medidas"; fila.detalle = "no está en el maestro y el archivo no trae medidas; la línea no se cargó"; fila.cajas = 0; }
        filas.push(fila);
      });
      if (!nuevos.length) { setError(`Ningún SKU del pedido está en el maestro${maestro.productos.length ? "" : " (conecta o abre el maestro primero)"}.`); setRevision({ filas, archivo: f.name }); return; }
      // Las líneas de SKUs con Bundle quedan en Bundle; cuántos se abren lo decide el cálculo (ver archivos/bundle.js)
      const bundlesFormados = nuevos.filter((it) => it.enBundle).length;
      // Un SKU de manufactura propia (DU) que no tiene Bundle capturado se cargaría suelto sin que nadie lo note
      const duSinBundle = nuevos.filter((it) => esDeManufactura(it.nombre) && !tieneBundle(it)).map((it) => it.nombre);
      // Si el maestro que está cargado no tiene NINGÚN Bundle, el problema no es el SKU: es que falta la hoja
      // Bundles o no se ha guardado el maestro. Decir «este SKU no tiene Bundle» ahí manda a buscar donde no es.
      const maestroSinBundles = duSinBundle.length > 0 && !maestro.productos.some((p) => tieneBundle(p));
      setItems(nuevos);
      setProyecto(datos.nombre || f.name.replace(/\.[^.]+$/, ""));
      const v = datos.vehiculo && vehiculos.find((x) => clave(x.nombre) === clave(datos.vehiculo) || clave(x.id) === clave(datos.vehiculo));
      if (v) elegirVehiculo(v.id); else invalidar();
      const revisar = filas.filter((x) => x.estado !== "ok").length;
      setRevision({ filas, archivo: f.name });
      setError("");
      setAviso(`Pedido cargado: ${nuevos.length} de ${filas.length} líneas, ${nuevos.reduce((a, x) => a + x.qty, 0).toLocaleString("es-MX")} cajas${v ? `, vehículo ${v.nombre}` : ""}.`
        + (bundlesFormados ? ` ${bundlesFormados} ${bundlesFormados === 1 ? "línea va" : "líneas van"} en Bundle.` : "")
        + (maestroSinBundles ? " " + tr("Ojo: el maestro que tienes cargado no trae ningún Bundle configurado, así que todo se carga suelto. Revisa que tu maestro tenga la hoja «Bundles» y que lo hayas guardado.")
          : duSinBundle.length ? " " + (duSinBundle.length === 1
          ? tr("Ojo: el SKU {0} empieza con DU y no tiene Bundle en el maestro, así que se carga suelto.", { 0: duSinBundle[0] })
          : tr("Ojo: {0} SKUs empiezan con DU y no tienen Bundle en el maestro, así que se cargan sueltos: {1}.", { 0: duSinBundle.length, 1: duSinBundle.slice(0, 6).join(", ") + (duSinBundle.length > 6 ? "…" : "") })) : "")
        + (revisar ? ` ${revisar} ${revisar === 1 ? "línea necesita" : "líneas necesitan"} revisión: abajo está el detalle.` : " Todas las cantidades cuadraron exactas."));
      setVerMedidas(false); setSeccion("mercancia");
    } catch (err) { setError("No se pudo leer el pedido: " + err.message); }
  };
  const CAMPOS_MAESTRO = ["L", "W", "H", "peso", "piezas", "umCaja", "volteoPiso", "compresion", "maxNiveles", "valorApilar", "pesoMaxEncima", "piso", "soportaEncima", "paletizar", "porPallet", "porCapa", "capasPallet", "resto", "aceptaCajas", "aceptaPallet"];

  const difiereDeMaestro = (it) => {
    const p = buscarSku(mapaMaestro, it.nombre); if (!p) return false;
    if (CAMPOS_MAESTRO.some((k) => it[k] !== p[k])) return true;
    if (it.oris.some((v, i) => v !== p.oris[i])) return true;
    return clave(pallets[it.palletId]?.nombre) !== clave(p.tarima) && (it.paletizar || p.paletizar);
  };
  const guardarEnMaestro = (it) => {
    setMaestro((m) => ({ ...m, sucio: true, productos: m.productos.map((p) => (claveSku(p.sku) === claveSku(it.nombre) ? { ...p, ...Object.fromEntries(CAMPOS_MAESTRO.map((k) => [k, it[k]])), oris: [...it.oris], tarima: pallets[it.palletId]?.nombre || p.tarima } : p)) }));
    setAviso(`${it.nombre} actualizado en el maestro. Falta presionar Guardar en Maestro.`);
  };
  const volverAlMaestro = (it) => {
    const p = buscarSku(mapaMaestro, it.nombre); if (!p) return;
    const base = itemDeProducto(p, { qty: it.qty, orden: it.orden, grupo: it.grupo, destino: it.destino });
    setItems((a) => a.map((x) => (x.id === it.id ? { ...base, id: it.id, color: it.color } : x))); invalidar();
  };
  const productosFiltrados = useMemo(() => {
    const q = clave(busqueda);
    return q ? maestro.productos.filter((p) => clave(p.sku).includes(q) || clave(p.idProducto).includes(q) || clave(p.desc).includes(q)) : maestro.productos;
  }, [maestro.productos, busqueda]);

  // Una corrida a la vez. El AbortController permite cancelarla desde el botón o al desmontar.
  const corridaRef = useRef(null);
  // Recomendación: corre el mismo pedido contra cada vehículo de la lista y compara
  const recomendar = async () => {
    setError(""); setRecomendacion(null); setResaltado(null); setVista(null);
    const candidatos = vehiculos.filter((v) => v.L > 0 && v.W > 0 && v.H > 0);
    setProgreso({ i: 0, n: candidatos.length });
    const ctrl = new AbortController(); corridaRef.current = ctrl;
    const filas = [];
    try {
      for (let i = 0; i < candidatos.length; i++) {
        const v = { ...candidatos[i], maxVolPct: veh.maxVolPct, maxSkus: veh.maxSkus, maxPiezas: veh.maxPiezas };
        setProgreso({ i, n: candidatos.length });
        try {
          const c = await correrConBundles({ items, vehiculo: v, tarimas: pallets, reglas: { ...reglas, nivel: 1 } }, { ejecutor, signal: ctrl.signal });
          const r = c.resultado, volV = v.L * v.W * v.H;
          const usados = r.contenedores.length, ocup = usados ? (r.contenedores.reduce((a, x) => a + x.vol, 0) / (volV * usados)) * 100 : 0;
          // Flete de toda la corrida con ese vehículo: es lo que de verdad decide cuando dos opciones caben.
          const destino = items.find((it) => it.destino)?.destino || "";
          const f = tarifas.length ? fleteTotal(tarifas, v.id, destino, r.contenedores.map((x) => ({
            ocupacion: (x.vol / volV) * 100, peso: x.peso, m3: x.vol / 1e9,
          }))) : null;
          filas.push({ id: v.id, nombre: v.nombre, vehiculos: usados, sinCargar: r.sinCargar, ocupacion: ocup, m3: volV / 1e9,
            pesoMax: v.maxKg ? v.maxKg - (v.tara || 0) : 0, peso: r.contenedores.reduce((a, x) => a + x.peso, 0),
            flete: f?.total ?? null, moneda: f?.moneda ?? "MXN" });
        } catch (e) {
          if (e instanceof ErrorCorrida && e.tipo === "cancelada") throw e;
          filas.push({ id: v.id, nombre: v.nombre, error: true });
        }
      }
      // Primero que quepa todo. Después, si hay tarifas configuradas, manda el flete más barato;
      // si no hay tarifas (o falta la de algún vehículo), se decide como antes: menos unidades y más lleno.
      filas.sort((a, b) =>
        (a.error ? 1 : 0) - (b.error ? 1 : 0)
        || a.sinCargar - b.sinCargar
        || (a.flete != null && b.flete != null ? a.flete - b.flete : 0)
        || (a.flete != null ? -1 : 0) - (b.flete != null ? -1 : 0)
        || a.vehiculos - b.vehiculos
        || b.ocupacion - a.ocupacion);
      setRecomendacion(filas);
      setSeccion("vehiculo");   // el cuadro comparativo vive en esa sección; sin esto el botón parecía no hacer nada
      const g = filas[0];
      setAviso(g && !g.error
        ? `Mejor opción: ${g.vehiculos} × ${g.nombre} al ${g.ocupacion.toFixed(0)}%` + (g.flete != null ? ` · flete ${g.flete.toLocaleString("es-MX", { style: "currency", currency: g.moneda, maximumFractionDigits: 0 })}` : "") + "."
        : "Ningún vehículo de la lista acomodó esta carga.");
    } catch (e) {
      if (!(e instanceof ErrorCorrida && e.tipo === "cancelada")) setError("La recomendación falló: " + (e.detalle?.original || e.message));
    }
    corridaRef.current = null; setProgreso(null);
  };

  const calcular = async () => {
    setVistaHerr(null); setEdicion(null); setError(""); setProgreso({ i: 0, n: 1 }); setResaltado(null); setVista(null); setOptim(null); intentoRef.current++;
    const ctrl = new AbortController(); corridaRef.current = ctrl;
    try {
      const c = await correrConBundles(cargaPara(items, reglas), { ejecutor, signal: ctrl.signal, onProgreso: (i, n) => setProgreso((x) => ({ ...x, i, n })), onFase: (fase) => setProgreso((x) => ({ ...x, fase })) });
      const r = c.resultado; setCorrida(c); setRes(r); setSel(0); setPaso(r.contenedores[0]?.cajas.length || 0);
      setPestana(r.avisos.length || r.sinCargar || r.noCaben.length ? "avisos" : "resumen");
      setCostoReal(null);
      // Solo si sobró un vehículo: ahí es donde saber qué cuesta la simulación cambia la decisión
      if (r.contenedores.length >= 2) medirCostoReal(r, items);
    } catch (e) {
      if (e instanceof ErrorCorrida && e.tipo === "cancelada") { /* el usuario canceló: sin mensaje */ }
      else if (e instanceof ErrorCorrida && e.tipo === "entrada_invalida") setError("Revisa estos datos: " + e.detalle.problemas.map((p) => p.mensaje).join(" "));
      else setError("El cálculo falló: " + (e.detalle?.original || e.message));
    }
    corridaRef.current = null; setProgreso(null);
  };
  calcularRef.current = calcular;

  // ---------- Cuánto cuesta simular la carga real ----------
  // La misma carga sin el flag, para poder decirle al usuario qué le está costando la simulación.
  // No se corre en cada cálculo (duplicaría el tiempo): solo cuando sobra un vehículo o cuando se pide
  // una sugerencia, que es donde 2 puntos cambian una decisión. Ver ui/secciones/AvisoCargaReal.jsx.
  const DIFERENCIA_QUE_IMPORTA = 2;   // puntos de ocupación del primer vehículo
  const costoRef = useRef(null);
  const medirCostoReal = async (rCon, lista) => {
    costoRef.current?.abort();
    if (reglas.compresionAuto === false || !rCon?.contenedores.length) { setCostoReal(null); return; }
    const ctrl = new AbortController(); costoRef.current = ctrl;
    setCostoReal({ midiendo: true });
    try {
      const c = await correrConBundles(cargaPara(lista, { ...reglas, compresionAuto: false }), { ejecutor, signal: ctrl.signal });
      const rSin = c.resultado;
      const volV = vehCalc.L * vehCalc.W * vehCalc.H;
      const ocup = (r) => (r.contenedores[0] ? (r.contenedores[0].vol / volV) * 100 : 0);
      const nCon = rCon.contenedores.length, nSin = rSin.contenedores.length;
      const pp = ocup(rSin) - ocup(rCon);
      // Si sin simular no cupo todo, la comparación no dice nada útil
      const valida = (rSin.sinCargar || 0) <= (rCon.sinCargar || 0);
      setCostoReal({ nCon, nSin, pp, corrida: c, vale: valida && (nSin < nCon || pp >= DIFERENCIA_QUE_IMPORTA) });
    } catch { setCostoReal(null); }
    finally { if (costoRef.current === ctrl) costoRef.current = null; }
  };
  const calcularSinSimular = () => {
    const c = costoReal?.corrida; if (!c) return;
    intentoRef.current++;
    // setReglas directo, no editarRegla: ese invalida el resultado y aquí justamente queremos dejar puesto
    // el que ya se calculó sin la simulación.
    setReglas((p) => ({ ...p, compresionAuto: false }));
    mostrarCorrida(c);
    setCostoReal(null);
    setAviso("Recalculado sin simular la carga real: es el óptimo geométrico, más optimista que el andén. Se prende otra vez en Reglas.");
  };
  // Ctrl+Enter (o Cmd+Enter) calcula desde cualquier parte
  useEffect(() => {
    const tecla = (e) => { if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); if (!corridaRef.current) calcularRef.current?.(); } };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  const cancelarCorrida = () => corridaRef.current?.abort();

  // ---------- Herramientas con cálculo completo ----------
  // Corre el motor de verdad (mismo nivel, reglas y «simular la carga real» que una carga normal) con un solo
  // SKU y un solo vehículo: lo que no cabe se queda fuera, así que lo cargado es la capacidad máxima. Devuelve
  // el resultado y deja la vista en el 3D.
  const calcularHerramienta = async ({ tipo, producto, oris, veh: vHerr, palletIdx = 0, config = {}, qty, titulo, color }) => {
    setError(""); setProgreso({ i: 0, n: 1 });
    const ctrl = new AbortController(); corridaRef.current = ctrl;
    const extra = tipo === "pallets"
      ? { qty, enBundle: false, paletizar: true, palletId: palletIdx, porPallet: config.porPallet || 0, porCapa: config.porCapa || 0, capasPallet: config.capasPallet || 0, resto: "sueltas" }
      : { qty, enBundle: false, paletizar: false, ...(oris ? { oris } : {}) };
    const it = { ...itemDeProducto(producto, extra), id: 0, color: null };
    const vehiculo = { ...vHerr, maxVolPct: vHerr.maxVolPct || 0, maxSkus: vHerr.maxSkus || 0, maxPiezas: vHerr.maxPiezas || 0 };
    try {
      // Nivel rápido: con miles de cajas de un solo SKU el nivel alto no cambia el resultado y tardaba hasta 40 s
      const c = await correr({ items: [it], vehiculo, tarimas: pallets, reglas: { ...reglas, nivel: Math.min(reglas.nivel, 2), usarLista: false, _maxContenedores: 1 } },
        { ejecutor, signal: ctrl.signal, onProgreso: (i, n) => setProgreso({ i, n }) });
      const r = c.resultado, k = r.contenedores[0] || { cajas: [], peso: 0, vol: 0 };
      const nPallets = k.cajas.filter((x) => x.pal >= 0).length;
      const nCajas = k.cajas.reduce((a, x) => a + (x.pal >= 0 ? r.pallets[x.pal]?.n || 0 : 1), 0);
      const volV = vehiculo.L * vehiculo.W * vehiculo.H, cargaMax = vehiculo.maxKg > 0 ? vehiculo.maxKg - (vehiculo.tara || 0) : 0;
      // Los avisos de esta corrida son los de la herramienta, no los del pedido: se muestran junto a su resultado
      const resumen = { nCajas, nPallets, piezas: nCajas * (it.piezas || 1), peso: k.peso, vol: k.vol, ocupacion: volV ? (k.vol / volV) * 100 : 0, utilPeso: cargaMax ? (k.peso / cargaMax) * 100 : null,
        cajasPorPallet: nPallets ? r.pallets[k.cajas.find((x) => x.pal >= 0).pal]?.n || 0 : 0, estrategia: r.estrategia,
        avisos: (r.avisos || []).slice(0, 6), sinCargar: r.sinCargar || 0, noCaben: (r.noCaben || []).length };
      const iPal = k.cajas.find((x) => x.pal >= 0)?.pal;
      setVistaHerr({ titulo, veh: vehiculo, base: null, cajas: k.cajas, pallets: r.pallets, colores: [color || colores[0] || "#C8102E"], formas: [it.forma || "caja"], resumen, palDef: iPal != null ? r.pallets[iPal] : null, verPallet: false });
      setPaso(k.cajas.length); setResaltado(null); setVista(null);
      return resumen;
    } catch (e) {
      if (!(e instanceof ErrorCorrida && e.tipo === "cancelada")) setError("El cálculo de la herramienta falló: " + (e.detalle?.original || e.message));
      return null;
    } finally { corridaRef.current = null; setProgreso(null); }
  };
  // Muestra en el 3D un pallet ya armado (pallet óptimo, patrones de fabricación): la base es el pallet vacío.
  const verPalletHerr = ({ def, titulo, color, forma }) => {
    setVistaHerr({ titulo, veh: { L: def.palL + 2 * def.ovL, W: def.palW + 2 * def.ovW, H: def.alto - def.esp + 50 },
      base: { esp: def.esp, x: def.ovL, y: def.ovW, l: def.palL, w: def.palW },
      // Capas en dos tonos alternados: así se ve a simple vista si el patrón va en columnas o entrelazado
      cajas: def.cajas.map((k) => ({ ...k, x: k.x + def.ovL - def.baseX, y: k.y + def.ovW - def.baseY, idx: (k.capa ?? 0) % 2, pal: -1 })), pallets: [],
      colores: [color || "#C8102E", "#E9A3AE"], formas: [forma || "caja", forma || "caja"], esPallet: true });
    setPaso(def.cajas.length); setResaltado(null); setVista(null);
  };
  useEffect(() => () => corridaRef.current?.abort(), []);

  // ---------- Optimizar el pedido (botones sobre el 3D) ----------
  // Ambas corren en nivel 4 y se comprueban antes de proponerse (ver motor/optimizarPedido.js). La vista
  // previa muestra qué cambia; «Aplicar» deja puesto el resultado ya calculado y «Deshacer» regresa al anterior.
  const NIVEL_OPTIMIZAR = 4;
  const optimizarPedido = async (tipo, fijas = new Set(items.filter((it) => it.fijo).map((it) => it.id))) => {
    if (!res || !corrida) return;
    const token = ++intentoRef.current;
    const ctrl = new AbortController(); corridaRef.current = ctrl;
    // Durante la búsqueda no se rehace la apertura de Bundles (cada corrida cuesta segundos y se hacen decenas);
    // la corrida que se muestra al final sí usa la política configurada.
    const reglas4 = { ...reglas, nivel: NIVEL_OPTIMIZAR, abrirBundles: "nunca" };
    const op = { ejecutor, signal: ctrl.signal, onProgreso: (i, n) => setProgreso((x) => ({ ...x, i, n })) };
    const correrPedido = (lista) => correrConBundles(cargaPara(lista, reglas4), op);
    const correrCarga = (lista) => correr({ ...corrida.carga, items: lista, reglas: { ...corrida.carga.reglas, nivel: NIVEL_OPTIMIZAR } }, op);
    const correrRapido = (lista) => correrConBundles(cargaPara(lista, { ...reglas, nivel: 1, abrirBundles: "nunca" }), op);   // solo para buscar la proporción
    const correrFinal = (lista) => correrConBundles(cargaPara(lista, { ...reglas, nivel: NIVEL_OPTIMIZAR }), op);
    const onFase = (fase) => setProgreso((x) => ({ ...(x || { i: 0, n: 1 }), fase }));
    setError(""); setOptim({ tipo, calculando: true, fijas }); setProgreso({ i: 0, n: 1 });
    try {
      const r = tipo === "llenar"
        ? await sugerirLlenado({ items, correrPedido, correrCarga, correrRapido, correrFinal, fijas, onFase })
        : await sugerirDisminucion({ items, nActual: res.contenedores.length, correrPedido, correrFinal, fijas, onFase });
      if (token !== intentoRef.current) return;
      setOptim({ tipo, propuesta: r, fijas });
      // En el llenado sugerido el acomodo es más delicado: unos milímetros deciden si entra otra caja
      medirCostoReal(res, items);
    } catch (e) {
      if (token !== intentoRef.current) return;
      setOptim(null);
      if (!(e instanceof ErrorCorrida && e.tipo === "cancelada")) setError("No se pudo calcular la sugerencia: " + (e.detalle?.original || e.message));
    } finally { corridaRef.current = null; setProgreso(null); }
  };
  const mostrarCorrida = (c) => {
    setCorrida(c); setRes(c.resultado); setSel(0); setPaso(c.resultado.contenedores[0]?.cajas.length || 0); setVista(null); setResaltado(null);
    setPestana(c.resultado.avisos.length || c.resultado.sinCargar ? "avisos" : "resumen");
  };
  const aplicarOptimizacion = () => {
    const pr = optim?.propuesta; if (!pr) return;
    intentoRef.current++;
    const anterior = { items, corrida };
    setItems(pr.items); mostrarCorrida(pr.corrida);
    setOptim({ tipo: optim.tipo, aplicado: true, anterior });
    const n = pr.despues.n;
    setAviso(pr.tipo === "llenar" ? `Pedido completado: ${pr.cambios.reduce((a, c) => a + c.delta, 0).toLocaleString("es-MX")} cajas más, en ${n} ${n === 1 ? "vehículo" : "vehículos"}.`
      : pr.tipo === "reacomodo" ? `Reacomodado sin cambiar cantidades: la carga queda en ${n} ${n === 1 ? "vehículo" : "vehículos"}.`
      : `Pedido ajustado: la carga queda en ${n} ${n === 1 ? "vehículo" : "vehículos"}.`);
  };
  const deshacerOptimizacion = () => {
    const a = optim?.anterior; if (!a) return;
    intentoRef.current++;
    setItems(a.items); mostrarCorrida(a.corrida); setOptim(null);
    setAviso("Se regresó al pedido anterior.");
  };

  const cont = res?.contenedores[sel];
  // El reporte se arma una sola vez por corrida, con la carga exacta que usó el motor.
  const reporte = useMemo(() => (corrida ? armarReporte(corrida, u) : null), [corrida, u]);
  // Con resultado, el motor numera los bultos según la carga que usó (una línea en Bundle se vuelve dos: Bundles
  // y sueltas). El 3D y las tablas siguen esa numeración, cada bulto con el color de su línea del pedido.
  const itemsCarga = corrida?.carga.items || items;
  const coloresCarga = useMemo(() => {
    if (!corrida) return colores;
    const porId = new Map(items.map((it, i) => [it.id, colores[i]]));
    return corrida.carga.items.map((it, i) => it.color || porId.get(it.lineaId ?? it.extraDe ?? it.id) || coloresBase[i % Math.max(1, coloresBase.length)] || "#8A96A3");
  }, [corrida, items, colores, coloresBase]);
  // Cuánto va en Bundle y cuánto suelto en el vehículo que se está viendo (el mix es un resultado, no un dato)
  const mixBundle = useMemo(() => {
    const k0 = res?.contenedores[sel];
    if (!res?.bundles || !k0) return null;
    let nB = 0, cajasB = 0, sueltas = 0;
    k0.cajas.forEach((k) => { const it = itemsCarga[k.idx]; if (!it || k.pal >= 0) return; if (it.esBundle) { nB++; cajasB += it.cantidadPorBundle || 1; } else if (it.deBundle) sueltas++; });
    return cajasB + sueltas ? { nB, sueltas, pct: (cajasB / (cajasB + sueltas)) * 100, abiertos: res.bundles.abiertos } : null;
  }, [res, sel, itemsCarga]);
  const formasCarga = useMemo(() => (corrida ? corrida.carga.items.map((it) => it.forma || "caja") : formas), [corrida, formas]);
  const stats = reporte?.contenedores[sel] ?? null;

  const descargarRevision = () => {
    const filas = [["SKU", "Descripción", "Capturado", "UM capturada", "UM de la caja", "Cajas", "Estado", "Detalle"],
      ...revision.filas.map((f) => [f.sku, f.desc, f.capturado, f.um || "", f.umCaja, f.cajas, f.estado, f.detalle])];
    descargarArchivo(libroSimple(filas, "Revisión", [18, 32, 12, 14, 14, 10, 18, 60]), `revision_pedido_${nombreArchivo(proyecto)}.xlsx`, MIME_XLSX);
  };

  const descargarResultados = () =>
    descargarArchivo(libroResultados({ reporte, proyecto, nombreVeh, nivel: reglas.nivel, u }), `resultados_${nombreArchivo(proyecto)}.xlsx`, MIME_XLSX);

  const descargarInstructivo = async () => {
    if (!cont || !apiVisor.current) return;
    setGenerando(true); setVista(null); setVistaHerr(null);
    await new Promise((r) => setTimeout(r, 60));
    const etapas = etapasDe(stats.pasos, stats.nBultos);
    const imagenes = apiVisor.current.capturar(etapas.map((e) => e[e.length - 1].fin));
    const html = htmlInstructivo({ reporte, sel, modoPallet, proyecto, nombreVeh, etapas, imagenes, u });
    descargarArchivo(html, `instructivo_carga_${nombreArchivo(proyecto)}_${modoPallet ? "pallet" : "vehiculo"}_${sel + 1}.html`, "text/html;charset=utf-8");
    setGenerando(false);
    setAviso("Instructivo descargado. Ábrelo en el navegador y usa Imprimir → Guardar como PDF si lo quieres en PDF.");
  };

  // Instructivo con el diagrama de pasos de TODOS los vehículos (o pallets) en un solo documento,
  // cada uno con su propia numeración de pasos e imágenes del visor.
  const descargarInstructivoCompleto = async () => {
    if (!res || !apiVisor.current || !reporte) return;
    setGenerando(true); setVista(null); setVistaHerr(null);
    const selOriginal = sel;
    try {
      const secciones = [];
      for (let i = 0; i < res.contenedores.length; i++) {
        setSel(i); setPaso(res.contenedores[i].cajas.length);
        // eslint-disable-next-line no-await-in-loop
        await new Promise((r) => setTimeout(r, 120)); // dejar que el visor redibuje este vehículo antes de capturarlo
        const statsI = reporte.contenedores[i];
        const etapas = etapasDe(statsI.pasos, statsI.nBultos);
        const imagenes = apiVisor.current.capturar(etapas.map((e) => e[e.length - 1].fin));
        secciones.push({ sel: i, etapas, imagenes });
      }
      const html = htmlInstructivoCompleto({ reporte, secciones, modoPallet, proyecto, nombreVeh, u });
      descargarArchivo(html, `instructivo_carga_${nombreArchivo(proyecto)}_completo.html`, "text/html;charset=utf-8");
      setAviso(`Instructivo completo descargado (${res.contenedores.length} ${modoPallet ? "pallets" : "vehículos"}, uno por página).`);
    } finally {
      setSel(selOriginal); setPaso(res.contenedores[selOriginal]?.cajas.length || 0);
      setGenerando(false);
    }
  };

  const verPallet = (i) => { setEdicion(null); setVista(i); setPaso(res.pallets[i].cajas.length); setResaltado(null); };
  const verVehiculo = (i) => { if (edicion && i !== sel) setEdicion((e) => ({ ...e, elegida: null })); setVista(null); setSel(i); setPaso(res.contenedores[i].cajas.length); };

  // ---------- Edición a mano ----------
  // Cada cambio arma una corrida nueva (la anterior queda en el historial para deshacer): así el reporte, el
  // Excel y el instructivo salen de lo editado sin ningún paso extra.
  const cargaMaxVeh = vehCalc.maxKg > 0 && reglas.limitarPeso ? vehCalc.maxKg - (vehCalc.tara || 0) : 0;
  const ctxEdicion = useMemo(() => (corrida ? { items: corrida.carga.items, pallets: res?.pallets || [], reglas: { soporteMin: reglas.soporteMin / 100 }, cargaMax: cargaMaxVeh } : null), [corrida, res, reglas.soporteMin, cargaMaxVeh]);
  const validacion = useMemo(() => (edicion && cont && ctxEdicion ? validar(cont.cajas, vehCalc, ctxEdicion) : null), [edicion, cont, ctxEdicion, vehCalc]);
  const problemasSet = useMemo(() => (validacion ? new Set(validacion.porCaja.map((p, i) => (p.length ? i : -1)).filter((i) => i >= 0)) : null), [validacion]);
  const iniciarEdicion = () => { if (!res || !cont) return; setVistaHerr(null); setVista(null); setResaltado(null); setEdicion({ elegida: null, historial: [], fuera: [], paso: 100 }); setPaso(cont.cajas.length); };
  const aplicarEdicion = (nuevas, editada, fuera) => {
    const c = recalcularContenedor(cont, nuevas, corrida.carga.items);
    const previo = res.editadoManual || { vehiculos: [], quitados: 0 };
    const vehiculos = [...new Set([...previo.vehiculos, sel + 1])].sort((a, b) => a - b);
    const nuevaFuera = fuera ?? edicion.fuera;
    const quitados = previo.quitados + (nuevaFuera.length - edicion.fuera.length);
    const resultado = { ...res, contenedores: res.contenedores.map((k, i) => (i === sel ? c : k)), editadoManual: { vehiculos, quitados } };
    setEdicion((e) => ({ ...e, mensaje: null, historial: [...e.historial, { corrida, fuera: e.fuera }].slice(-60), fuera: nuevaFuera, elegida: editada ? c.cajas.indexOf(editada) : null }));
    setCorrida({ ...corrida, resultado }); setRes(resultado); setPaso(c.cajas.length);
  };
  const editar = (op) => {
    if (!edicion || edicion.elegida == null || !cont) return;
    const i = edicion.elegida, v = vehCalc;
    let nuevas = null;
    if (op.tipo === "rotar") nuevas = rotar(cont.cajas, i, v);
    else if (op.tipo === "mover") nuevas = mover(cont.cajas, i, op.dx, op.dy, v);
    else if (op.tipo === "pegar") nuevas = pegarBulto(cont.cajas, i, op.dir, v);
    else if (op.tipo === "quitar") { const r = quitar(cont.cajas, i); aplicarEdicion(r.cajas, null, [...edicion.fuera, r.quitada]); return; }
    if (!nuevas) { setEdicion((e) => ({ ...e, mensaje: op.tipo === "rotar" ? "Girada ya no cabe en ese lugar: hazle espacio o muévela primero." : "No hay espacio para moverla ahí." })); return; }
    aplicarEdicion(nuevas, nuevas[i]);
  };
  const colocarFuera = (j) => {
    const caja = edicion.fuera[j];
    const nuevas = colocar(cont.cajas, caja, vehCalc, ctxEdicion);
    if (!nuevas) { setEdicion((e) => ({ ...e, mensaje: "No hay un lugar válido para ese bulto en este vehículo. Haz espacio o pruébalo en otro vehículo." })); return; }
    aplicarEdicion(nuevas, nuevas[nuevas.length - 1], edicion.fuera.filter((_, k) => k !== j));
  };
  const deshacerEdicion = () => {
    const h = edicion?.historial; if (!h?.length) return;
    const ultimo = h[h.length - 1];
    setCorrida(ultimo.corrida); setRes(ultimo.corrida.resultado); setPaso(ultimo.corrida.resultado.contenedores[sel]?.cajas.length || 0);
    setEdicion((e) => ({ ...e, historial: h.slice(0, -1), fuera: ultimo.fuera, elegida: null }));
  };
  // Atajos de teclado mientras se edita: flechas mueven, R gira, Supr quita, Ctrl+Z deshace
  const editarRef = useRef(null);
  editarRef.current = { editar, deshacerEdicion, edicion };
  useEffect(() => {
    if (!edicion) return;
    const tecla = (e) => {
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      const { editar: ed, deshacerEdicion: des, edicion: est } = editarRef.current, p = est?.paso || 100;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); des(); return; }
      if (est?.elegida == null) return;
      const m = { ArrowUp: [p, 0], ArrowDown: [-p, 0], ArrowLeft: [0, p], ArrowRight: [0, -p] }[e.key];
      if (m) { e.preventDefault(); ed({ tipo: "mover", dx: m[0], dy: m[1] }); }
      else if (e.key === "r" || e.key === "R") ed({ tipo: "rotar" });
      else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); ed({ tipo: "quitar" }); }
      else if (e.key === "Escape") setEdicion((x) => ({ ...x, elegida: null }));
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, [!!edicion]);
  const palVista = vista !== null && res ? res.pallets[vista] : null;
  const vistaDePallet = (pv) => ({ veh: { L: pv.palL + 2 * pv.ovL, W: pv.palW + 2 * pv.ovW, H: pv.alto - pv.esp + 50 },
    base: { esp: pv.esp, x: pv.ovL, y: pv.ovW, l: pv.palL, w: pv.palW },
    cajas: pv.cajas.map((k) => ({ ...k, x: k.x + pv.ovL - pv.baseX, y: k.y + pv.ovW - pv.baseY, pal: -1 })), total: pv.cajas.length });
  const visor = vistaHerr?.verPallet && vistaHerr.palDef ? vistaDePallet(vistaHerr.palDef)
    : vistaHerr
    ? { veh: vistaHerr.veh, base: vistaHerr.base, cajas: vistaHerr.cajas, total: vistaHerr.cajas.length }
    : palVista
    ? { veh: { L: palVista.palL + 2 * palVista.ovL, W: palVista.palW + 2 * palVista.ovW, H: palVista.alto - palVista.esp + 50 },
        base: { esp: palVista.esp, x: palVista.ovL, y: palVista.ovW, l: palVista.palL, w: palVista.palW },
        cajas: palVista.cajas.map((k) => ({ ...k, x: k.x + palVista.ovL - palVista.baseX, y: k.y + palVista.ovW - palVista.baseY, pal: -1 })), total: palVista.cajas.length }
    : { veh: vehCalc, base: palSel ? { esp: palSel.esp, x: palSel.ovL, y: palSel.ovW, l: palSel.L, w: palSel.W } : null, cajas: cont?.cajas || [], total: cont?.cajas.length || 0 };

  const etiquetaVeh = (i) => `${modoPallet ? "Pallet" : "Vehículo"} ${i + 1} · ${reporte.contenedores[i].ocupacion.toFixed(0)}% vol${reporte.contenedores[i].utilPeso != null ? ` · ${reporte.contenedores[i].utilPeso.toFixed(0)}% peso` : ""}`;
  const calculando = progreso !== null;
  const reglasActivas = [reglas.usarOrden && items.some((i) => i.orden > 0), reglas.agrupar, reglas.juntos, reglas.apilamiento !== "ninguna"].filter(Boolean).length;

  const NAV = [
    { id: "maestro", icono: Database, t: "Maestro", d: maestro.productos.length ? `${maestro.productos.length} productos${maestro.sucio ? " · sin guardar" : ""}` : "Vacío" },
    { id: "mercancia", icono: Package, t: "Pedido", d: `${items.length} SKUs` },
    { id: "vehiculo", icono: Truck, t: modoPallet ? "Pallet" : "Vehículo", d: nombreVeh },
    { id: "pallets", icono: Layers, t: "Paletizado", d: `${pallets.length} ${pallets.length === 1 ? "pallet" : "pallets"} en el catálogo` },
    { id: "reglas", icono: SlidersHorizontal, t: "Reglas", d: `Nivel ${reglas.nivel}${reglasActivas ? ` · ${reglasActivas} activas` : ""}` },
    { id: "herramientas", icono: Calculator, t: "Herramientas", d: "Capacidad, paletizado y datos" },
    { id: "ayuda", icono: HelpCircle, t: "Ayuda", d: "Qué significa cada campo" },
  ];

  return (
    <ProveedorUnidades value={u}>
    <div className="flex flex-col lg:h-screen" style={{ background: T.shell, color: T.tinta, fontFamily: "'Barlow', 'Segoe UI', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600;700&family=Barlow+Condensed:wght@600;700&display=swap');
        input:focus, select:focus, textarea:focus { border-color: ${T.nav} !important; box-shadow: 0 0 0 2px ${T.acento}55; }
        button:focus-visible { outline: 2px solid ${T.acento}; outline-offset: 2px; }
        .fila:hover td { background: #F7F9FB; }
        .celda { border: 1px solid transparent; background: transparent; }
        .celda:hover { border-color: ${T.linea}; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; animation: none !important; } }`}</style>

      {/* ============ Barra superior ============ */}
      <header className="flex items-center gap-2 lg:gap-3 px-3 lg:px-4 flex-none" style={{ height: 56, background: T.nav, color: "#fff" }}>
        <div className="flex items-center gap-2 mr-2">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true"><path d="M13 2 L24 8 L24 19 L13 25 L2 19 L2 8 Z" fill="none" stroke={T.acento} strokeWidth="2" /><path d="M2 8 L13 14 L24 8 M13 14 L13 25" fill="none" stroke={T.acento} strokeWidth="2" /></svg>
          <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 700, letterSpacing: "0.01em", whiteSpace: "nowrap" }}>DarnelCube 3D</span>
          <button onClick={() => setSeccion("ayuda")} className="text-xs px-1.5 py-0.5 rounded" style={{ color: T.acento, border: `1px solid ${T.acento}66` }} title={`Versión ${VERSION_COMPLETA}. Clic para ver las novedades.`}>v{VERSION}</button>
        </div>
        <input value={proyecto} onChange={(e) => setProyecto(e.target.value)} aria-label="Nombre del proyecto" title={proyecto}
          className="hidden lg:block bg-transparent text-sm px-2 py-1 rounded-md outline-none min-w-0" style={{ color: "#fff", border: "1px solid rgba(255,255,255,.15)", width: 220, flexShrink: 1 }} />
        <button onClick={nuevo} className="flex flex-none items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md whitespace-nowrap" style={{ color: T.navTexto, border: "1px solid rgba(255,255,255,.2)" }} title="Empezar una carga nueva desde cero" aria-label="Nueva carga">
          <FilePlus size={15} /><span className="hidden lg:inline">Nueva carga</span>
        </button>
        <div className="flex-1" />
        {/* Encabezado ligero: solo lo que se usa en cada carga. Lo demás vive en el menú «Más». */}
        <div className="hidden sm:flex flex-none rounded-md overflow-hidden text-xs whitespace-nowrap" role="group" aria-label="Sistema de unidades" style={{ border: "1px solid rgba(255,255,255,.25)" }}>
          {Object.values(SISTEMAS).map((x) => (
            <button key={x.id} onClick={() => cambiarSistema(x.id)} aria-pressed={sistema === x.id} title={`Ver y capturar en ${x.nombre.toLowerCase()} (${x.corto})`} className="px-2 py-1 whitespace-nowrap"
              style={{ background: sistema === x.id ? T.acento : "transparent", color: sistema === x.id ? T.nav : "rgba(255,255,255,.8)", fontWeight: sistema === x.id ? 600 : 400 }}>{x.corto}</button>
          ))}
        </div>
        <div className="hidden lg:flex flex-none"><SelectorIdioma idioma={idioma} onCambiar={cambiarIdioma} /></div>
        <button onClick={() => setVerEscenarios(true)} className="hidden sm:flex flex-none items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md whitespace-nowrap" style={{ color: T.navTexto }} title="Guardar este escenario con un nombre, o abrir uno anterior">
          <FolderOpen size={15} /><span className="hidden lg:inline">Escenarios</span>
        </button>
        <button onClick={recomendar} disabled={calculando || !items.length} className="hidden sm:flex flex-none items-center gap-1.5 text-sm px-3 py-2 rounded-md whitespace-nowrap" style={{ border: "1px solid rgba(255,255,255,.2)", color: T.navTexto }} title="Corre el pedido contra cada vehículo de la lista y compara">
          <Truck size={15} /><span className="hidden lg:inline">Recomendar</span>
        </button>
        <div className="relative flex-none">
          <button onClick={() => setMenuEj(!menuEj)} className="flex items-center gap-1 text-sm px-2.5 py-1.5 rounded-md whitespace-nowrap" style={{ color: T.navTexto }} aria-expanded={menuEj} aria-label="Más opciones" title="Ejemplos, escenarios y sesión">
            <MoreHorizontal size={18} /><span className="hidden xl:inline">Más</span>
          </button>
          {menuEj && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuEj(false)} aria-hidden="true" />
              <div className="absolute right-0 mt-1 rounded-lg py-1 z-20 shadow-lg text-sm" style={{ background: T.sup, border: `1px solid ${T.linea}`, width: 280, color: T.tinta }}>
                <div className="px-3 py-2 text-xs" style={{ color: T.suave, borderBottom: `1px solid ${T.linea}` }}>{usuario?.email}</div>
                <div className="flex lg:hidden items-center justify-between gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${T.linea}` }}><span className="text-xs" style={{ color: T.suave }}>Idioma</span><SelectorIdioma idioma={idioma} onCambiar={cambiarIdioma} oscuro={false} /></div>
                <button onClick={() => { setMenuEj(false); setVerEscenarios(true); }} className="flex sm:hidden items-center gap-2 w-full text-left px-3 py-2 hover:bg-gray-100"><FolderOpen size={15} />Escenarios</button>
                <div className="px-3 pt-2 pb-1 text-xs flex items-center gap-1.5" style={{ color: T.suave, borderTop: `1px solid ${T.linea}` }}><BookOpen size={13} />Ejemplos</div>
                {Object.entries(EJEMPLOS).map(([k, e]) => (
                  <button key={k} onClick={() => cargarEjemplo(k)} className="block w-full text-left px-3 py-1.5 pl-8 hover:bg-gray-100">{e.nombre}</button>
                ))}
                <button onClick={() => { setMenuEj(false); cerrarSesion(); }} className="flex items-center gap-2 w-full text-left px-3 py-2 hover:bg-gray-100" style={{ borderTop: `1px solid ${T.linea}`, color: T.suave }}><LogOut size={15} />Cerrar sesión</button>
              </div>
            </>
          )}
        </div>
          <button onClick={calcular} disabled={calculando || !items.length} className="flex flex-none items-center gap-2 text-sm font-semibold px-4 py-2 rounded-md whitespace-nowrap"
          style={{ background: T.acento, color: T.nav, opacity: calculando ? 0.8 : 1, minWidth: 150, justifyContent: "center" }}>
          {calculando ? <><Loader2 size={16} className="animate-spin" />Estrategia {progreso.i}/{progreso.n}</> : <><Play size={16} />{modoPallet ? "Armar pallet" : "Calcular carga"}</>}
        </button>
        {calculando && (
          <button onClick={cancelarCorrida} aria-label="Cancelar cálculo" title="Cancelar cálculo" className="flex items-center justify-center rounded-md"
            style={{ width: 36, height: 36, color: "#fff", border: "1px solid rgba(255,255,255,.3)", background: "transparent" }}><X size={16} /></button>
        )}
      </header>
      {confirmarNueva && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4" style={{ background: "rgba(20,33,61,.35)" }} onClick={() => setConfirmarNueva(false)} onKeyDown={(e) => { if (e.key === "Escape") setConfirmarNueva(false); }}>
          <div role="alertdialog" aria-label="Empezar una carga nueva" className="rounded-lg shadow-xl p-4 text-sm" style={{ background: T.sup, width: 380, maxWidth: "100%" }} onClick={(e) => e.stopPropagation()}>
            <p className="font-semibold mb-1">¿Empezar una carga nueva?</p>
            <p className="mb-3" style={{ color: T.suave }}>Se borra el pedido actual ({items.length} {items.length === 1 ? "línea" : "líneas"}) y su resultado. El maestro no cambia. Si lo quieres conservar, guárdalo antes en Escenarios.</p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmarNueva(false)} className="px-3 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}` }}>Cancelar</button>
              <button onClick={empezarNueva} autoFocus className="px-3 py-1.5 rounded-md font-medium" style={{ background: T.error, color: "#fff" }}>Borrar y empezar</button>
            </div>
          </div>
        </div>
      )}
      {verEscenarios && (
        <Escenarios
          nombreActual={proyecto}
          estadoParaGuardar={estadoParaGuardar}
          onAbrir={(r) => { aplicarEstado(r.estado); setProyecto(r.nombre); setUltimoGuardado(new Date(r.actualizado)); setAviso(`Se abrió «${r.nombre}».`); }}
          onCerrar={() => setVerEscenarios(false)}
          onAviso={setAviso}
          onError={setError}
        />
      )}

      {/* ============ Navegación: pestañas arriba, para dejarle todo el ancho al contenido ============ */}
      <nav className="flex-none flex items-stretch overflow-x-auto" style={{ background: T.nav, borderTop: "1px solid rgba(255,255,255,.08)" }} aria-label="Secciones">
        {NAV.map(({ id, icono: Icono, t, d }) => {
          const act = seccion === id;
          return (
            <button key={id} onClick={() => setSeccion(id)} aria-current={act ? "page" : undefined}
              className="flex items-center gap-2 px-3 2xl:px-4 py-2.5 relative flex-none whitespace-nowrap" title={d}
              style={{ color: act ? "#fff" : T.navTexto, background: act ? "rgba(255,255,255,.07)" : "transparent" }}>
              <span className="absolute left-0 right-0 bottom-0" style={{ height: 3, background: act ? T.acento : "transparent" }} />
              <Icono size={16} color={act ? T.acento : T.navTexto} />
              <span className="text-sm font-medium">{t}</span>
              <span className="hidden 2xl:inline text-xs" style={{ color: act ? "#C9D3E0" : "#7F8EA3" }}>{d}</span>
            </button>
          );
        })}
      </nav>

      <div className="flex flex-col lg:flex-row flex-1 min-h-0">
        {/* ============ Panel de edición ============ */}
        <section ref={panelIzq} className="flex-none lg:w-[var(--anchoIzq)] lg:overflow-y-auto p-4" style={{ "--anchoIzq": `${anchoIzq}%` }}>
          <datalist id="categorias-existentes">{[...new Set(maestro.productos.map((p) => p.categoria).filter(Boolean))].map((c) => <option key={c} value={c} />)}</datalist>
          <input ref={inputMaestro} type="file" accept=".xlsx,.xls" className="hidden" onChange={abrirArchivoMaestro} />
          <input ref={inputPedido} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={cargarPedido} />
          <input ref={inputCube} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarCube} />
          <input ref={inputDims} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarDimensiones} />
          <input ref={inputBundle} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarBundle} />
          <input ref={inputVehiculos} type="file" accept=".xlsx,.xls" className="hidden" onChange={importarVehiculos} />
          <input ref={inputConv} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={importarConversiones} />
          {/* Aviso flotante: ya no empuja el contenido hacia abajo y se va solo (ver useEffect de aviso) */}
          {aviso && (
            <div role="status" className="fixed z-40 flex items-start gap-2 text-sm rounded-lg px-3 py-2 shadow-lg" style={{ left: 16, bottom: 16, maxWidth: 460, background: "#EAF3EC", color: T.ok, border: "1px solid #CFE6D5" }}>
              <CheckCircle2 size={16} className="flex-none mt-0.5" /><span className="flex-1">{aviso}</span>
              <button onClick={() => setAviso("")} aria-label="Cerrar aviso"><X size={14} /></button>
            </div>
          )}

          {seccion === "maestro" && (
            <>
              <h2 className="text-lg font-semibold leading-tight">Maestro de productos</h2>
              <p className="text-xs mb-3" style={{ color: T.suave }}>Un solo archivo con las medidas y reglas de cada SKU. Las cargas se arman con pedidos que solo traen SKU y cantidad.</p>
              <Tarjeta titulo="Archivo maestro">
                <div className="flex items-start gap-2 mb-3 text-sm">
                  <FileSpreadsheet size={18} className="flex-none mt-0.5" color={maestro.origen ? T.ok : T.suave} />
                  <div className="flex-1 min-w-0">
                    {maestro.origen ? (
                      <>
                        <div className="font-medium truncate">{maestro.origen.tipo === "nube" ? "Tu maestro guardado" : maestro.origen.tipo === "carpeta" ? `${maestro.origen.nombre} / ${ARCHIVO_MAESTRO}` : maestro.origen.nombre}</div>
                        <div className="text-xs" style={{ color: maestro.sucio ? T.aviso : T.suave }}>
                          {maestro.sucio ? "Cambios sin guardar" : maestro.guardado ? `Guardado a las ${maestro.guardado.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}` : "Sin cambios"}
                        </div>
                      </>
                    ) : <div style={{ color: T.suave }}>Sin maestro todavía.</div>}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={() => inputMaestro.current?.click()} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup }}><Upload size={15} />Abrir archivo</button>
                  <button onClick={guardarMaestro} disabled={!maestro.productos.length || guardandoMaestro} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-semibold"
                    style={{ background: maestro.sucio ? T.acento : T.sup, color: T.nav, border: `1px solid ${maestro.sucio ? T.acento : T.linea}`, opacity: maestro.productos.length ? 1 : 0.5 }}>{guardandoMaestro ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}{guardandoMaestro ? "Guardando…" : "Guardar"}</button>
                </div>
                <Nota titulo="Cómo se guarda">Guardar deja tu maestro en tu cuenta (no descarga un archivo): lo tienes cada vez que entres, desde cualquier computadora. Para tener el Excel, con sus hojas Datos, Parámetros y Bundles, usa «Descargar ▾ → Copia del maestro en Excel».</Nota>
                {maestro.errores?.length > 0 && <p className="text-xs mt-2" style={{ color: T.aviso }}>Revisar: {maestro.errores.slice(0, 4).join(" ")}{maestro.errores.length > 4 ? ` y ${maestro.errores.length - 4} más.` : ""}</p>}
              </Tarjeta>

              {confirmar === "maestro" && (
                <Confirmacion texto={`¿Borrar los ${maestro.productos.length} productos del maestro? El archivo no cambia hasta que presiones Guardar; si no guardas, puedes volver a abrirlo.`} accion="Borrar maestro"
                  onSi={() => { setMaestro((m) => ({ ...m, productos: [], sucio: true })); setConfirmar(null); }} onNo={() => setConfirmar(null)} />
              )}
              <div className="flex items-center gap-2 mb-2">
                <div className="flex-1 flex items-center gap-1.5 rounded-md px-2" style={{ border: `1px solid ${T.linea}`, background: T.sup }}>
                  <Search size={15} color={T.suave} />
                  <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar SKU o descripción" className="flex-1 py-1.5 text-sm outline-none bg-transparent" />
                </div>
                <button onClick={agregarProducto} className="flex items-center gap-1 text-sm px-3 py-1.5 rounded-md" style={{ background: T.nav, color: "#fff" }}><Plus size={15} />Producto</button>
                <button onClick={() => setConfirmar("maestro")} disabled={!maestro.productos.length} className="p-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup, color: T.error, opacity: maestro.productos.length ? 1 : 0.4 }} aria-label="Borrar todo el maestro" title="Borrar todo el maestro"><Trash2 size={16} /></button>
              </div>
              <div className="rounded-lg overflow-hidden mb-2" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
                <div className="overflow-auto tabla-ancho" style={{ maxHeight: "calc(100vh - 430px)", minHeight: 160 }}>
                  <table className="w-full text-sm" style={{ minWidth: 640, borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead className="sticky top-0 z-10" style={{ background: "#F3F5F8" }}>
                      <tr className="text-left text-xs" style={{ color: T.suave }}>
                        {["SKU", "Descripción", `Largo ${u.l}`, `Ancho ${u.l}`, `Alto ${u.l}`, u.p, "Pallet", ""].map((h, i) => <th key={i} className="font-medium px-2 py-2" style={{ borderBottom: `1px solid ${T.linea}` }}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {productosFiltrados.slice(0, 300).map((p) => (
                        <FilaMaestro key={p.pid} p={p} pallets={pallets} abierto={abiertoP === p.pid} onToggle={() => setAbiertoP(abiertoP === p.pid ? null : p.pid)}
                          editar={(k, v) => editarProducto(p.pid, k, v)} quitar={() => quitarProducto(p.pid)} />
                      ))}
                    </tbody>
                  </table>
                  {maestro.productos.length === 0 && <p className="text-sm p-4" style={{ color: T.suave }}>Conecta la carpeta o abre un maestro existente. También puedes crear productos aquí y guardar para generar el archivo.</p>}
                  {productosFiltrados.length > 300 && <p className="text-xs p-2" style={{ color: T.suave }}>Mostrando 300 de {productosFiltrados.length}. Usa la búsqueda para encontrar el resto.</p>}
                </div>
              </div>
              <div className="rounded-lg px-3 py-2 mb-2 text-xs flex items-start gap-2" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
                {leyendo ? <Loader2 size={15} className="flex-none mt-0.5 animate-spin" color={T.suave} /> : <Repeat size={15} className="flex-none mt-0.5" color={maestro.conversiones ? T.ok : T.suave} />}
                <div className="flex-1">
                  <span className="block" style={{ color: T.tinta }}>
                    {leyendo ? leyendo : maestro.conversiones
                      ? `Conversiones de unidad: ${Object.keys(maestro.conversiones).length.toLocaleString("es-MX")} SKUs. Un pedido en otra unidad (ML, PLT, KG…) se convierte a cajas.`
                      : "Sin conversiones de unidad. Impórtalas si algún pedido llega en millares, pallets o kilos."}
                  </span>
                  <button className="underline" style={{ color: T.suave }} onClick={() => inputConv.current?.click()}>Importar archivo de conversiones</button>
                  {maestro.conversiones && <button className="underline ml-3" style={{ color: T.suave }} onClick={() => { setMaestro((m) => ({ ...m, conversiones: null, sucio: true })); setAviso("Conversiones borradas. Falta presionar Guardar."); }}>Borrar</button>}
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs mb-2" style={{ color: T.suave }} title="Aplica al abrir un maestro, actualizar dimensiones, importar Bundle o importar el catálogo de vehículos. Los archivos que descargas llevan la unidad en el encabezado y se reconocen solos.">
                Unidades de los archivos que subes:
                <select value={unidadesArchivo} onChange={(e) => setUnidadesArchivo(e.target.value)} className="rounded-md px-1.5 py-1 text-xs border" style={{ borderColor: T.linea, background: T.sup, color: T.tinta }}>
                  {UNIDADES_ARCHIVO.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <MenuBoton etiqueta="Importar" icono={Upload} acciones={[
                  ["Actualizar dimensiones", () => inputDims.current?.click(), "Cambia SKU, descripción y medidas sin tocar las reglas de estiba"],
                  ["Plantilla de CubeMaster", () => inputCube.current?.click(), "Crea productos, pallets y el pedido desde un «Cargo Upload»"],
                  ["Bundle (BDL)", () => inputBundle.current?.click(), "Enciende y configura el Bundle de los SKUs que ya existen"],
                  ["Conversiones de unidad", () => inputConv.current?.click(), "Millares, pallets, kilos… a cajas"],
                  ["SKUs de la carga actual", pasarCargaAlMaestro, "Agrega al maestro los SKUs del pedido que no estén"],
                ]} />
                <MenuBoton etiqueta="Descargar" icono={Download} acciones={[
                  ["Copia del maestro en Excel", exportarMaestro, "Tu maestro en la cuenta no cambia", !maestro.productos.length],
                  ["Plantilla de carga (pedido)", () => descargarArchivo(libroPlantilla(maestro.productos, vehiculos), "plantilla_carga.xlsx", MIME_XLSX), "SKU y cantidad; las medidas salen del maestro"],
                  ["Plantilla de dimensiones", () => descargarArchivo(plantillaDimensiones(maestro.productos, SISTEMAS[sistema]), "plantilla_dimensiones.xlsx", MIME_XLSX), "Solo SKU, descripción y medidas"],
                  ["Plantilla de Bundles", () => descargarArchivo(plantillaBundles(maestro.productos, SISTEMAS[sistema]), "plantilla_bundles.xlsx", MIME_XLSX), "SKU, cajas por Bundle y medidas; se sube con Importar ▾ → Bundle"],
                ]} />
              </div>
            </>
          )}

          {seccion === "mercancia" && (
            <>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-lg font-semibold leading-tight">Pedido</h2>
                  <p className="text-xs" style={{ color: T.suave }}>{items.length} SKUs · {totales.cajas.toLocaleString("es-MX")} cajas · <b style={{ color: T.tinta }}>{u.fV3(totales.m3, 1)}</b> · {u.fP(totales.kg)}</p>
                  {!modoPallet && vehCalc.L > 0 && <p className="text-xs" style={{ color: T.suave }}>Equivale a {(totales.m3 / (vehCalc.L * vehCalc.W * vehCalc.H / 1e9)).toLocaleString("es-MX", { maximumFractionDigits: 2 })} {nombreVeh} llenos al 100%</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => inputPedido.current?.click()} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md font-medium whitespace-nowrap" style={{ background: T.nav, color: "#fff" }} title="Excel con SKU y cantidad; las medidas salen del maestro"><Upload size={15} />Cargar pedido</button>
                  <button onClick={() => setPegar(!pegar)} className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup }} aria-label="Pegar de Excel" title="Pegar de Excel con medidas"><ClipboardPaste size={15} /></button>
                  <button onClick={() => setConfirmar("pedido")} disabled={!items.length} className="flex items-center text-sm px-2 py-1.5 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup, color: T.error, opacity: items.length ? 1 : 0.4 }} aria-label="Vaciar el pedido" title="Vaciar el pedido"><Trash2 size={15} /></button>
                </div>
              </div>
              {confirmar === "pedido" && (
                <Confirmacion texto={`¿Quitar los ${items.length} SKUs de esta carga? El maestro de productos no cambia.`} accion="Vaciar pedido"
                  onSi={() => { setItems([]); setRevision(null); invalidar(); setConfirmar(null); }} onNo={() => setConfirmar(null)} />
              )}
              <RevisionPedido revision={revision} onCerrar={() => setRevision(null)} descargar={descargarRevision} />
              {maestro.productos.length > 0 && (
                <div className="flex gap-2 mb-3">
                  <input list="skus-maestro" value={skuNuevo} onChange={(e) => setSkuNuevo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && skuNuevo && agregarSkuDelMaestro()}
                    placeholder="Agregar SKU del maestro…" className={inp} style={estInp} />
                  <datalist id="skus-maestro">{maestro.productos.slice(0, 2000).map((p) => <option key={p.pid} value={p.sku}>{p.desc}</option>)}</datalist>
                  <button onClick={agregarSkuDelMaestro} disabled={!skuNuevo} className="flex-none text-sm px-3 rounded-md" style={{ border: `1px solid ${T.linea}`, background: T.sup, opacity: skuNuevo ? 1 : 0.5 }}>Agregar</button>
                </div>
              )}
              {pegar && (
                <Tarjeta titulo="Pegar desde Excel" accion={<button onClick={() => setPegar(false)} aria-label="Cerrar"><X size={16} /></button>}>
                  <p className="text-xs mb-2" style={{ color: T.suave }}>Columnas: Nombre, Largo, Ancho, Alto ({u.l}), Peso ({u.p}), Cantidad y, opcionales, Pedido, Entrega y Cajas por pallet. Reemplaza la lista actual.</p>
                  <textarea value={textoPegado} onChange={(e) => setTextoPegado(e.target.value)} rows={5} className={inp} style={estInp} placeholder={"Jeans\t600\t400\t400\t14\t80\tTienda 1\t1\t16"} />
                  <button onClick={importar} className="text-sm mt-2 px-3 py-1.5 rounded-md font-medium" style={{ background: T.nav, color: "#fff" }}>Importar filas</button>
                </Tarjeta>
              )}
              <div className="rounded-lg overflow-hidden" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
                <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs" style={{ color: T.suave, borderBottom: `1px solid ${T.linea}` }}>
                  <span>Toca el nombre de una fila para ver sus reglas de estiba y paletizado.</span>
                  <span className="flex gap-3 flex-none">
                    {!rutaEnUso && <button onClick={() => setVerRutaManual(!verRutaManual)} aria-pressed={verRuta} className="underline">{verRuta ? "Ocultar entrega y pedido" : "Entrega y pedido"}</button>}
                    <button onClick={() => setVerDesc(!verDesc)} aria-pressed={verDesc} className="underline">{verDesc ? "Ocultar descripción" : "Ver descripción"}</button>
                    <button onClick={() => setVerMedidas(!verMedidas)} aria-pressed={verMedidas} className="underline">{verMedidas ? "Ocultar medidas" : "Ver medidas"}</button>
                  </span>
                </div>
                <div className="overflow-auto tabla-ancho" style={{ maxHeight: "calc(100vh - 260px)", minHeight: 200 }}>
                  <table className="w-full text-sm" style={{ minWidth: (verMedidas ? 420 : 180) + (verDesc ? 180 : 0) + (verRuta ? 220 : 0) + (reglas.usarLista ? 60 : 0), borderCollapse: "separate", borderSpacing: 0 }}>
                    <thead className="sticky top-0 z-10" style={{ background: "#F3F5F8" }}>
                      <tr className="text-left text-xs" style={{ color: T.suave }}>
                        {["SKU", ...(verDesc ? ["Descripción"] : []), ...(verMedidas ? [`Largo ${u.l}`, `Ancho ${u.l}`, `Alto ${u.l}`, u.p] : []), "Cajas", u.v, ...(verRuta ? ["Entrega", "Pedido", "Destino"] : []), ...(reglas.usarLista ? ["Orden"] : []), "", ""].map((h, i) => (
                          <th key={(h || "x") + i} className="font-medium px-2 py-2 whitespace-nowrap" style={{ borderBottom: `1px solid ${T.linea}`, textAlign: h === u.v ? "center" : "left", position: "relative", ...(i === 0 ? { position: "sticky", left: 0, background: "#F3F5F8", zIndex: 2, width: anchoSku, minWidth: anchoSku } : {}) }}>
                            {h}
                            {i === 0 && (
                              <span onMouseDown={(e) => {
                                e.preventDefault();
                                const x0 = e.clientX, w0 = anchoSku;
                                const mover = (ev) => setAnchoSku(Math.max(120, Math.min(480, w0 + ev.clientX - x0)));
                                const soltar = () => { window.removeEventListener("mousemove", mover); window.removeEventListener("mouseup", soltar); };
                                window.addEventListener("mousemove", mover); window.addEventListener("mouseup", soltar);
                              }} title="Arrastra para ensanchar la columna"
                                style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 6, cursor: "col-resize" }} />
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((it, i) => (
                        <FilaItem key={it.id} it={it} color={colores[i]} abierto={abierto === it.id} pallets={pallets} modoPallet={modoPallet} verMedidas={verMedidas} verDesc={verDesc} verRuta={verRuta}
                          anchoSku={anchoSku}
                          difiere={!it.esBundle && difiereDeMaestro(it)} enMaestro={!it.esBundle && !!buscarSku(mapaMaestro, it.nombre)} aMaestro={() => guardarEnMaestro(it)} deMaestro={() => volverAlMaestro(it)}
                          mover={reglas.usarLista ? (paso) => moverItem(it.id, paso) : null} primera={i === 0} ultima={i === items.length - 1}
                          onToggle={() => setAbierto(abierto === it.id ? null : it.id)} editar={(k, v) => editarItem(it.id, k, v)}
                          quitar={() => { setItems((a) => a.filter((x) => x.id !== it.id)); invalidar(); }} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <button onClick={() => { setItems((a) => [...a, nuevoItem({ nombre: `SKU ${a.length + 1}` })]); invalidar(); }} className="flex items-center gap-1.5 w-full text-sm px-3 py-2" style={{ color: T.suave, borderTop: `1px solid ${T.linea}` }}><Plus size={15} />Agregar SKU</button>
              </div>
            </>
          )}

          {seccion === "vehiculo" && recomendacion && (
            <div className="rounded-lg mb-3" style={{ background: T.sup, border: `1px solid ${T.linea}` }}>
              <div className="flex items-center gap-2 px-3 py-2" style={{ borderBottom: `1px solid ${T.linea}` }}>
                <p className="flex-1 text-sm font-medium">Qué vehículo conviene</p>
                <button onClick={() => setRecomendacion(null)} aria-label="Cerrar la recomendación"><X size={15} /></button>
              </div>
              <div className="overflow-auto" style={{ maxHeight: 240 }}>
                <table className="w-full text-sm">
                  <thead className="sticky top-0" style={{ background: "#F3F5F8" }}>
                    <tr className="text-left text-xs" style={{ color: T.suave }}>
                      {["Vehículo", "Cuántos", "Ocupación", ...(recomendacion.some((f) => f.flete != null) ? ["Flete"] : []), "Capacidad", ""].map((h) => <th key={h} className="font-medium px-2 py-1.5 whitespace-nowrap">{h}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {recomendacion.map((f, i) => (
                      <tr key={f.id} style={{ borderTop: `1px solid ${T.linea}`, background: vehId === f.id ? T.shell : "transparent" }}>
                        <td className="px-2 py-1.5">{i === 0 && !f.error && <span className="mr-1" style={{ color: T.ok }}>★</span>}{f.nombre}</td>
                        <td className="px-2">{f.error ? "—" : f.vehiculos}{f.sinCargar > 0 && <span style={{ color: T.error }}> +{f.sinCargar} sin acomodar</span>}</td>
                        <td className="px-2">{f.error ? "—" : `${f.ocupacion.toFixed(0)}%`}</td>
                        {recomendacion.some((x) => x.flete != null) && (
                          <td className="px-2 whitespace-nowrap" style={{ fontWeight: i === 0 && f.flete != null ? 600 : 400 }}>
                            {f.flete != null ? f.flete.toLocaleString("es-MX", { style: "currency", currency: f.moneda, maximumFractionDigits: 0 }) : <span style={{ color: T.suave }}>sin tarifa</span>}
                          </td>
                        )}
                        <td className="px-2 text-xs" style={{ color: T.suave }}>{f.error ? "no se pudo calcular" : `${u.fV3(f.m3, 1)}${f.pesoMax ? ` · ${u.id === "metrico" ? `${(f.pesoMax / 1000).toFixed(1)} t` : u.fP(f.pesoMax)}` : ""}`}</td>
                        <td className="px-2 text-right">{!f.error && <button onClick={() => elegirVehiculo(f.id)} className="text-xs px-2 py-0.5 rounded" style={{ border: `1px solid ${T.linea}` }}>Usar</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-3 pb-2">
                <Nota titulo="Cómo se ordena">
                  {recomendacion.some((f) => f.flete != null)
                    ? "Por el flete más barato entre los que acomodan toda la carga. Se calcula en nivel 1 para que sea rápido; el que elijas se recalcula con tu nivel."
                    : "Por menos unidades y mejor aprovechamiento. Si cargas tarifas de flete abajo, se ordena por costo. Se calcula en nivel 1 para que sea rápido."}
                </Nota>
              </div>
            </div>
          )}
          {seccion === "vehiculo" && <SeccionVehiculo vehiculos={vehiculos} agregarVehiculo={agregarVehiculo} duplicarVehiculo={duplicarVehiculo} quitarVehiculo={quitarVehiculo} editarPallet={editarPallet} editarVeh={editarVeh} elegirVehiculo={elegirVehiculo} modoPallet={modoPallet} palIdx={palIdx} palSel={palSel} pallets={pallets} veh={veh} vehId={vehId}
            onImportarCatalogo={() => inputVehiculos.current?.click()} onDescargarCatalogo={() => descargarArchivo(libroVehiculos(vehiculos, SISTEMAS[sistema]), "maestro_vehiculos.xlsx", MIME_XLSX)} onDescargarPlantillaCatalogo={() => descargarArchivo(plantillaVehiculos(SISTEMAS[sistema]), "plantilla_vehiculos.xlsx", MIME_XLSX)} />}

          {seccion === "vehiculo" && !modoPallet && (
            <Tarjeta titulo="Tarifas de flete (opcional)">
              <Nota titulo="Para qué sirven">Si las cargas, «Recomendar vehículo» elige el más barato entre los que acomodan toda la carga, en vez de solo el más lleno. Déjalo vacío y todo sigue igual. El destino se compara con el de las líneas del pedido; vacío = aplica a cualquiera.</Nota>
              {tarifas.map((t, i) => (
                <div key={t.id} className="flex flex-wrap items-end gap-2 mb-2 pb-2" style={{ borderBottom: `1px solid ${T.linea}` }}>
                  <label className="block text-xs" style={{ color: T.suave, width: 150 }}>
                    <span className="block mb-1">Vehículo</span>
                    <select value={t.vehiculo} onChange={(e) => setTarifas((a) => a.map((x, j) => (j === i ? { ...x, vehiculo: e.target.value } : x)))} className={inp} style={estInp}>
                      <option value="">Elige…</option>
                      {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs" style={{ color: T.suave, width: 120 }}>
                    <span className="block mb-1">Destino</span>
                    <input value={t.destino} onChange={(e) => setTarifas((a) => a.map((x, j) => (j === i ? { ...x, destino: e.target.value } : x)))} placeholder="Cualquiera" className={inp} style={estInp} />
                  </label>
                  <label className="block text-xs" style={{ color: T.suave, width: 160 }}>
                    <span className="block mb-1">Cómo se cobra</span>
                    <select value={t.metodo} onChange={(e) => setTarifas((a) => a.map((x, j) => (j === i ? { ...x, metodo: e.target.value } : x)))} className={inp} style={estInp}>
                      {METODOS_FLETE.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs" style={{ color: T.suave, width: 110 }}>
                    <span className="block mb-1">Tarifa</span>
                    <input type="number" value={t.tarifa} onChange={(e) => setTarifas((a) => a.map((x, j) => (j === i ? { ...x, tarifa: Number(e.target.value) || 0 } : x)))} className={inp} style={estInp} />
                  </label>
                  <button onClick={() => setTarifas((a) => a.filter((_, j) => j !== i))} aria-label="Quitar esta tarifa" style={{ color: T.suave, paddingBottom: 6 }}><Trash2 size={15} /></button>
                </div>
              ))}
              <button onClick={() => setTarifas((a) => [...a, tarifaVacia({ vehiculo: vehId })])} className="flex items-center gap-1 text-xs underline" style={{ color: T.suave }}>
                <Plus size={13} />Agregar tarifa
              </button>

            </Tarjeta>
          )}

          {seccion === "pallets" && <SeccionPaletizado editarPallet={editarPallet} pallets={pallets} setPallets={setPallets} quitarPallet={quitarPallet} usos={pallets.map((_, i) => items.filter((it) => it.paletizar && (it.palletId || 0) === i).length)} />}

          {seccion === "herramientas" && <SeccionHerramientas maestro={maestro} vehiculos={vehiculos} pallets={pallets} reglas={reglas} tarifas={tarifas} calcularHerramienta={calcularHerramienta} verPalletHerr={verPalletHerr} calculando={calculando} vistaHerr={vistaHerr} />}

          {seccion === "ayuda" && <SeccionAyuda />}

          {seccion === "reglas" && <SeccionReglas editarRegla={editarRegla} reglas={reglas} />}

          {error && <p className="text-sm mt-2 flex gap-1" style={{ color: T.error }}><AlertTriangle size={16} className="flex-none mt-0.5" />{error}</p>}
        </section>

        {/* Divisor arrastrable entre la tabla y el visor (doble clic = mitad y mitad) */}
        <div role="separator" aria-orientation="vertical" aria-label="Cambiar el ancho de la tabla y del visor" title="Arrastra para dar más espacio a la tabla o al 3D · doble clic: mitad y mitad"
          onPointerDown={(e) => { arrastreDiv.current = true; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={moverDivisor} onPointerUp={soltarDivisor}
          onDoubleClick={() => { setAnchoIzq(50); try { localStorage.setItem("darnelcube.anchoIzq", "50"); } catch { /* sin almacenamiento local */ } }}
          className="hidden lg:flex flex-none items-center justify-center group" style={{ width: 8, cursor: "col-resize", background: T.linea }}>
          <span className="rounded-full" style={{ width: 3, height: 36, background: T.suave, opacity: 0.6 }} />
        </div>

        {/* ============ Área de trabajo: visor + resultados ============ */}
        <main className="flex-1 flex flex-col min-w-0 min-h-0">
          <div className="relative flex-1" style={{ minHeight: 360, background: T.visor }}>
            <Visor veh={visor.veh} base={visor.base} cajas={visor.cajas} pallets={vistaHerr ? vistaHerr.pallets : res?.pallets || []} paso={vistaHerr || res ? paso : 0} colores={vistaHerr ? vistaHerr.colores : coloresCarga} formas={vistaHerr ? vistaHerr.formas : formasCarga} resaltado={vistaHerr ? null : resaltado} camara={camara} api={apiVisor} cotas={verCotas ? ((mm) => u.fL(mm, 0)) : null}
              seleccion={edicion ? edicion.elegida : null} problemas={edicion ? problemasSet : null} onElegir={edicion ? (i) => setEdicion((e) => ({ ...e, elegida: i, mensaje: null })) : null} />
            <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center gap-2 pointer-events-none">
              {vistaHerr && <>
                <button onClick={() => { setVistaHerr(null); setPaso(res ? (palVista ? palVista.cajas.length : cont?.cajas.length || 0) : 0); }} className="pointer-events-auto text-xs px-2.5 py-1 rounded-full font-medium shadow-sm" style={{ background: T.nav, color: "#fff" }}>← Volver a mi carga</button>
                <span className="text-xs px-2.5 py-1 rounded-full shadow-sm" style={{ background: "rgba(255,255,255,.95)" }}>Herramienta: <b>{vistaHerr.titulo}</b></span>
                {vistaHerr.palDef && (
                  <div className="pointer-events-auto flex rounded-full shadow-sm overflow-hidden text-xs" style={{ background: "rgba(255,255,255,.95)" }} role="group" aria-label="Qué ver">
                    {[[false, "Vehículo"], [true, "Pallet armado"]].map(([v, t]) => (
                      <button key={t} onClick={() => { setVistaHerr((x) => ({ ...x, verPallet: v })); setPaso(v ? vistaHerr.palDef.cajas.length : vistaHerr.cajas.length); }} aria-pressed={vistaHerr.verPallet === v}
                        className="px-2.5 py-1" style={{ background: vistaHerr.verPallet === v ? T.nav : "transparent", color: vistaHerr.verPallet === v ? "#fff" : T.tinta }}>{t}</button>
                    ))}
                  </div>
                )}
              </>}
              {!vistaHerr && res && !palVista && res.contenedores.length <= MAX_BOTONES_VEH && res.contenedores.map((c, i) => (
                <button key={i} onClick={() => verVehiculo(i)} className="pointer-events-auto text-xs px-2.5 py-1 rounded-full font-medium shadow-sm"
                  style={{ background: i === sel ? T.nav : "rgba(255,255,255,.92)", color: i === sel ? "#fff" : T.tinta }}>
                  {etiquetaVeh(i)}
                </button>
              ))}
              {/* Con muchos vehículos los botones se amontonaban en varias filas: se cambia a un selector con flechas */}
              {!vistaHerr && res && !palVista && res.contenedores.length > MAX_BOTONES_VEH && (
                <div className="pointer-events-auto flex items-center rounded-full shadow-sm overflow-hidden" style={{ background: "rgba(255,255,255,.95)" }} role="group" aria-label="Elegir vehículo">
                  <button onClick={() => verVehiculo(Math.max(0, sel - 1))} disabled={sel === 0} className="px-2 py-1" style={{ opacity: sel === 0 ? 0.35 : 1 }} aria-label="Vehículo anterior"><ChevronLeft size={16} /></button>
                  <select value={sel} onChange={(e) => verVehiculo(Number(e.target.value))} className="text-xs font-medium bg-transparent outline-none py-1 max-w-[260px]" aria-label="Vehículo">
                    {res.contenedores.map((_, i) => <option key={i} value={i}>{etiquetaVeh(i)}</option>)}
                  </select>
                  <span className="text-xs px-1.5" style={{ color: T.suave }}>de {res.contenedores.length}</span>
                  <button onClick={() => verVehiculo(Math.min(res.contenedores.length - 1, sel + 1))} disabled={sel === res.contenedores.length - 1} className="px-2 py-1" style={{ opacity: sel === res.contenedores.length - 1 ? 0.35 : 1 }} aria-label="Vehículo siguiente"><ChevronRight size={16} /></button>
                </div>
              )}
              {!vistaHerr && palVista && <>
                <button onClick={() => verVehiculo(sel)} className="pointer-events-auto text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: T.nav, color: "#fff" }}>← Vehículo {sel + 1}</button>
                <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: "rgba(255,255,255,.92)" }}>Armado de: {palVista.nombre}</span>
              </>}
              <div className="flex-1" />
              <div className="relative pointer-events-auto">
                <button onClick={() => setMenuColor(!menuColor)} aria-expanded={menuColor} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full shadow-sm" style={{ background: "rgba(255,255,255,.92)" }}>
                  <span className="flex">{colores.slice(0, 5).map((c, i) => <span key={i} style={{ width: 8, height: 8, background: c, borderRadius: 99, marginLeft: i ? -2 : 0, border: "1px solid #fff" }} />)}</span>
                  Colores<ChevronDown size={12} />
                </button>
                {menuColor && (
                  <div className="absolute right-0 mt-1 rounded-lg p-2 z-20 shadow-lg" style={{ background: T.sup, border: `1px solid ${T.linea}`, width: 270 }}>
                    {Object.entries(PALETAS).map(([k, p]) => {
                      const muestra = generarColores(10, k);
                      return (
                        <button key={k} onClick={() => { setPaleta(k); setMenuColor(false); }} aria-pressed={paleta === k} className="w-full text-left rounded-md px-2 py-1.5 mb-0.5"
                          style={{ background: paleta === k ? T.shell : "transparent", border: `1px solid ${paleta === k ? T.linea : "transparent"}` }}>
                          <span className="block text-xs font-medium mb-1" style={{ color: T.tinta }}>{p.nombre}</span>
                          <span className="flex gap-0.5">{muestra.map((c, i) => <span key={i} style={{ flex: 1, height: 10, background: c, borderRadius: 2 }} />)}</span>
                        </button>
                      );
                    })}
                    <div className="flex items-center gap-2 px-2 pt-2 mt-1 text-xs" style={{ borderTop: `1px solid ${T.linea}`, color: T.suave }}>
                      <span style={{ width: 14, height: 10, background: "#8B5A2B", borderRadius: 2 }} />Los pallets vacíos siempre son café
                    </div>
                    {hayPersonalizados && (
                      <button onClick={() => { setItems((a) => a.map((it) => ({ ...it, color: null }))); setMenuColor(false); }} className="w-full text-left text-xs px-2 py-1.5 mt-1 underline" style={{ color: T.suave }}>
                        Quitar colores personalizados
                      </button>
                    )}
                  </div>
                )}
              </div>
              {res && !vistaHerr && !palVista && !modoPallet && cont && (
                <button onClick={edicion ? () => setEdicion(null) : iniciarEdicion} aria-pressed={!!edicion} className="pointer-events-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full shadow-sm font-medium"
                  style={{ background: edicion ? T.acento : "rgba(255,255,255,.92)", color: T.nav }} title="Elegir cajas en el 3D para girarlas, moverlas, quitarlas o volverlas a colocar">
                  <Hand size={13} />{edicion ? "Terminar edición" : "Editar a mano"}
                </button>
              )}
              {(res || vistaHerr) && (
                <button onClick={() => setVerCotas(!verCotas)} aria-pressed={verCotas} className="pointer-events-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full shadow-sm font-medium"
                  style={{ background: verCotas ? T.acento : "rgba(255,255,255,.92)", color: T.nav }} title="Acotar en el dibujo el fondo, ancho y alto que quedaron libres en la puerta">
                  <Ruler size={13} />Medidas
                </button>
              )}
              <div className="pointer-events-auto flex rounded-full overflow-hidden shadow-sm" style={{ background: "rgba(255,255,255,.92)" }}>
                {[["iso", "3D"], ["frente", "Puerta"], ["lado", "Lado"], ["arriba", "Planta"]].map(([k, t]) => (
                  <button key={k} onClick={() => setCamara({ tipo: k, n: Date.now() })} className="text-xs px-2.5 py-1">{t}</button>
                ))}
              </div>
            </div>
            {/* Con el pedido listo (por ejemplo, mientras se ajusta después de calcular) basta un botón chico abajo, para no tapar el 3D */}
            {!res && !vistaHerr && !calculando && items.some((it) => it.qty > 0) && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none px-3">
                <div className="pointer-events-auto flex items-center gap-3 rounded-full pl-4 pr-1.5 py-1.5 shadow-sm text-xs" style={{ background: "rgba(255,255,255,.95)" }}>
                  <span style={{ color: T.suave }}>{items.length} SKUs · {totales.cajas.toLocaleString("es-MX")} cajas · {nombreVeh}</span>
                  <button onClick={calcular} className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1 rounded-full" style={{ background: T.acento, color: T.nav }}>
                    <Play size={14} />{modoPallet ? "Armar pallet" : "Calcular carga"}<span className="text-xs font-normal opacity-70">Ctrl+Enter</span>
                  </button>
                </div>
              </div>
            )}
            {!res && !vistaHerr && !calculando && !items.some((it) => it.qty > 0) && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                {/* Primeros pasos: qué falta para calcular, y cada paso lleva a su sección */}
                <div className="pointer-events-auto rounded-xl px-4 py-3 shadow-sm" style={{ background: "rgba(255,255,255,.95)", minWidth: 280 }}>
                  <p className="text-sm font-semibold mb-2">{modoPallet ? "Para armar el pallet" : "Para calcular la carga"}</p>
                  {[
                    ["maestro", "Maestro de productos", maestro.productos.length ? `${maestro.productos.length.toLocaleString("es-MX")} productos` : "Ábrelo una vez; queda en tu cuenta", maestro.productos.length > 0, true],
                    ["mercancia", "Pedido", items.length ? `${items.length} SKUs · ${totales.cajas.toLocaleString("es-MX")} cajas` : "Carga el Excel o agrega SKUs", items.some((it) => it.qty > 0), false],
                    ["vehiculo", modoPallet ? "Pallet" : "Vehículo", nombreVeh, true, false],
                  ].map(([sec, t, d, listo, opcional]) => (
                    <button key={sec} onClick={() => setSeccion(sec)} className="flex items-center gap-2 w-full text-left py-1">
                      <span className="flex-none flex items-center justify-center rounded-full" style={{ width: 20, height: 20, background: listo ? T.ok : T.shell, color: listo ? "#fff" : T.suave, border: listo ? "none" : `1px solid ${T.linea}` }}>{listo ? <CheckCircle2 size={13} /> : null}</span>
                      <span className="flex-1"><span className="text-sm">{t}</span>{opcional && !listo ? <span className="text-xs" style={{ color: T.suave }}> (opcional)</span> : null}<span className="block text-xs" style={{ color: T.suave }}>{d}</span></span>
                    </button>
                  ))}
                  <button onClick={calcular} disabled={!items.length} className="flex items-center justify-center gap-1.5 w-full text-sm font-semibold px-3 py-1.5 rounded-md mt-2" style={{ background: T.acento, color: T.nav, opacity: items.length ? 1 : 0.5 }}>
                    <Play size={14} />{modoPallet ? "Armar pallet" : "Calcular carga"}<span className="text-xs font-normal opacity-70">Ctrl+Enter</span>
                  </button>
                </div>
              </div>
            )}
            {res && reporte && !vistaHerr && !palVista && !modoPallet && !edicion && (optim?.calculando || !calculando) && (
              <OptimizarPedido reporte={reporte} items={items} optim={optim} progreso={progreso} onCalcular={optimizarPedido} onAplicar={aplicarOptimizacion}
                onDeshacer={deshacerOptimizacion} onCerrar={() => setOptim(null)} onCancelar={() => { cancelarCorrida(); setOptim(null); }}
                onFijarLinea={(id) => editarItem(id, "fijo", !items.find((x) => x.id === id)?.fijo)}
                costoReal={costoReal} onQuitarSimulacion={calcularSinSimular} />
            )}
            {edicion && cont && validacion && (
              <PanelEdicion edicion={edicion} setEdicion={setEdicion} cont={cont} validacion={validacion} items={corrida.carga.items} pallets={res.pallets} vehNum={sel + 1}
                editar={editar} deshacer={deshacerEdicion} colocarFuera={colocarFuera} terminar={() => setEdicion(null)} />
            )}
            {(res || vistaHerr) && visor.total > 0 && !edicion && (
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,.92)" }}>
                <span className="text-xs whitespace-nowrap" style={{ color: T.suave }}>{palVista || vistaHerr?.esPallet || vistaHerr?.verPallet ? "Armado" : "Carga"} {paso}/{visor.total}</span>
                <input type="range" min={0} max={visor.total} value={paso} onChange={(e) => setPaso(Number(e.target.value))} className="flex-1" aria-label="Secuencia" style={{ accentColor: T.nav }} />
              </div>
            )}
          </div>

          <PanelResultados enHerramienta={!!vistaHerr} mixBundle={mixBundle} modoPalletRes={modoPallet} oculto={panelOculto} setOculto={setPanelOculto} editarOris={editarOrisDeLinea} colores={coloresCarga} descargarInstructivo={descargarInstructivo} descargarInstructivoCompleto={descargarInstructivoCompleto} descargarResultados={descargarResultados} generando={generando} modoPallet={modoPallet} palVista={palVista} pestana={pestana} reporte={reporte} res={res} resaltado={resaltado} sel={sel} setPestana={setPestana} setResaltado={setResaltado} stats={stats} verPallet={verPallet} vista={vista}
            />
        </main>
      </div>
    </div>
    </ProveedorUnidades>
  );
}

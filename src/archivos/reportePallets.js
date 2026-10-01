// ================= Reporte PDF de paletizado =================
// Una hoja por SKU con la imagen del pallet armado, su configuración, medidas, aprovechamiento y el semáforo
// de estabilidad, centro de gravedad y compresión. Toma como referencia el reporte «Pallet Load» de
// CubeMaster, con la identidad de DarnelCube. Si son varios SKUs, la primera hoja es un índice con todos.
// jsPDF se carga solo cuando se genera un reporte, para no hacer más pesada la herramienta al abrirla.
import { traducir } from "../i18n/index.js";

const COLOR = { nav: [20, 33, 61], acento: [242, 183, 5], tinta: [22, 32, 44], suave: [91, 107, 123], linea: [220, 226, 232], fondo: [246, 248, 251] };
const SEMAFORO = { verde: [47, 140, 70], amarillo: [226, 160, 0], rojo: [179, 38, 30], gris: [150, 160, 170] };
const NOMBRES_SEM = { estabilidad: "Estabilidad", cg: "Centro de gravedad", compresion: "Compresión" };

const n0 = (v) => Math.round(v || 0).toLocaleString("es-MX");
const pct = (v) => (v == null ? "—" : `${(v * 100).toLocaleString("es-MX", { maximumFractionDigits: 1 })}%`);

// filas: [{ producto, patron, imagen, color }] · patron = uno de patronesFabricacion()
export async function pdfPaletizado({ filas, pallet, opciones, u, version, fecha = new Date(), titulo = "Reporte de paletizado" }) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "letter" });
  // En inglés, todo lo que se escribe en el PDF pasa por el diccionario
  const escribirTexto = doc.text.bind(doc);
  doc.text = (t, ...resto) => escribirTexto(typeof t === "string" ? traducir(t) : t, ...resto);
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 12;
  const fechaTxt = fecha.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" });
  const set = (c) => doc.setTextColor(...c);
  const vTxt = u.v.replace("³", "3");   // la fuente del PDF no trae el superíndice
  const encabezado = (sub) => {
    doc.setFillColor(...COLOR.nav); doc.rect(0, 0, W, 20, "F");
    doc.setFillColor(...COLOR.acento); doc.rect(0, 20, W, 1.2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); set([255, 255, 255]); doc.text("DarnelCube 3D", M, 12.5);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10); set([200, 210, 225]); doc.text(sub, W - M, 12.5, { align: "right" });
  };
  const pie = () => {
    doc.setDrawColor(...COLOR.linea); doc.line(M, H - 12, W - M, H - 12);
    doc.setFontSize(7.5); set(COLOR.suave);
    doc.text(`Generado el ${fechaTxt} con DarnelCube 3D ${version}`, M, H - 7.5);
    doc.text(`Hoja ${doc.getNumberOfPages()}`, W - M, H - 7.5, { align: "right" });
  };
  const tarjeta = (x, y, w, h, tituloT, colorBorde = COLOR.linea) => {
    doc.setDrawColor(...colorBorde); doc.setFillColor(255, 255, 255); doc.roundedRect(x, y, w, h, 2, 2, "FD");
    if (tituloT) { doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); set(colorBorde === COLOR.linea ? COLOR.suave : colorBorde); doc.text(traducir(tituloT).toUpperCase(), x + 4, y + 6); }
  };
  const dato = (x, y, k, v) => { doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); set(COLOR.suave); doc.text(k, x, y); doc.setFontSize(11); set(COLOR.tinta); doc.text(String(v), x, y + 5); };
  const circulo = (x, y, color) => { doc.setFillColor(...SEMAFORO[color]); doc.circle(x, y, 2, "F"); };
  const condiciones = () => {
    const partes = [`Pallet ${pallet.nombre} (${u.fLL(pallet.L, pallet.W)})`, `altura objetivo ${u.fL(opciones.alturaMax || pallet.altMax, 0)}`];
    if (opciones.apilaEncima) partes.push(`${opciones.apilaEncima} pallet${opciones.apilaEncima > 1 ? "s" : ""} encima en el transporte`);
    if (opciones.humedadTxt) partes.push(`humedad ${traducir(opciones.humedadTxt).toLowerCase()}`);
    if (opciones.tiempoTxt) partes.push(`almacén ${traducir(opciones.tiempoTxt).toLowerCase()}`);
    return partes.join(" · ");
  };

  // ---------- Índice (si hay más de un SKU) ----------
  if (filas.length > 1) {
    encabezado(titulo);
    doc.setFont("helvetica", "bold"); doc.setFontSize(16); set(COLOR.tinta); doc.text(titulo, M, 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9); set(COLOR.suave);
    doc.text(`${filas.length} SKUs · ${condiciones()}`, M, 38, { maxWidth: W - 2 * M });
    const cols = [["SKU", 32], ["Descripción", 52], ["Patrón", 28], ["Cajas", 14], ["Armado", 16], ["Alto", 20], ["Estab.", 11], ["C. G.", 11], ["Comp.", 11]];
    let y = 48;
    const cabecera = () => {
      doc.setFillColor(...COLOR.fondo); doc.rect(M, y - 4.5, W - 2 * M, 7, "F");
      doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); set(COLOR.suave);
      let x = M + 2; cols.forEach(([t, w]) => { doc.text(t, x, y); x += w; }); y += 7;
    };
    cabecera();
    filas.forEach(({ producto, patron, motivo }) => {
      const sinPatron = motivo || "No arma";
      if (y > H - 20) { pie(); doc.addPage(); encabezado(titulo); y = 32; cabecera(); }
      doc.setFont("helvetica", "normal"); doc.setFontSize(8); set(COLOR.tinta);
      let x = M + 2;
      const d = patron?.def;
      const celdas = [producto.sku, (producto.desc || "").slice(0, 32), patron ? patron.nombre.replace(/ \(.*/, "") : sinPatron, d ? n0(d.n) : "—", d ? `${d.capas} × ${d.porCapa}` : "—", d ? u.fL(d.alto, 0) : "—"];
      celdas.forEach((t, i) => { doc.text(String(t), x, y); x += cols[i][1]; });
      ["estabilidad", "cg", "compresion"].forEach((k) => { if (patron) circulo(x + 3, y - 1.2, patron.semaforos[k].color); x += 11; });
      doc.setDrawColor(...COLOR.linea); doc.line(M, y + 2.5, W - M, y + 2.5);
      y += 7;
    });
    pie();
  }

  // ---------- Una hoja por SKU ----------
  filas.forEach(({ producto, patron, imagen, motivo }, i) => {
    if (filas.length > 1 || i > 0) doc.addPage();
    encabezado(titulo);
    doc.setFont("helvetica", "bold"); doc.setFontSize(15); set(COLOR.tinta); doc.text(producto.sku, M, 32);
    doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); set(COLOR.suave);
    doc.text(producto.desc || "", M, 38, { maxWidth: W - 2 * M - 40 });
    if (!patron) {
      doc.setFontSize(11); set(SEMAFORO.rojo); doc.text(motivo ? `${motivo}: con piezas tan chicas los patrones de estiba no aplican. Revisa si las medidas del maestro son reales.` : "Este SKU no arma ni un pallet con estas condiciones (revisa medidas, orientaciones y altura).", M, 52, { maxWidth: W - 2 * M });
      pie(); return;
    }
    const d = patron.def, m = patron.metricas;
    // Etiqueta del patrón
    doc.setFillColor(...(patron.sugerido ? COLOR.acento : COLOR.fondo)); doc.roundedRect(W - M - 52, 27, 52, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); set(COLOR.nav); doc.text(`${patron.sugerido ? "Sugerido: " : ""}${patron.nombre}`, W - M - 26, 32.3, { align: "center", maxWidth: 50 });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); set(COLOR.suave); doc.text(condiciones(), M, 43.5, { maxWidth: W - 2 * M });

    // Imagen y porcentajes
    const colI = M, anchoI = 92, yTop = 49;
    tarjeta(colI, yTop, anchoI, 96);
    if (imagen) doc.addImage(imagen, "PNG", colI + 4, yTop + 6, anchoI - 8, anchoI - 8);
    tarjeta(colI, yTop + 99, anchoI, 20);
    [["Altura", m.pctAltura], ["Piso", m.pctPiso], ["Volumen", m.pctVolumen], ["Peso", m.pctPeso]].forEach(([k, v], j) => dato(colI + 4 + j * 22, yTop + 107, `${k} %`, pct(v)));

    // Columna derecha
    const x2 = colI + anchoI + 4, w2 = W - M - x2;
    tarjeta(x2, yTop, w2, 30, "Resumen");
    dato(x2 + 4, yTop + 13, "Cajas", n0(d.n)); dato(x2 + w2 / 2, yTop + 13, "Piezas", n0(d.piezas));
    dato(x2 + 4, yTop + 23, `Volumen (${vTxt})`, u.fV(d.volCarga, 2).replace(` ${u.v}`, "")); dato(x2 + w2 / 2, yTop + 23, `Peso (${u.p})`, u.fP(d.peso, 1).replace(` ${u.p}`, ""));

    tarjeta(x2, yTop + 33, w2, 30, "Configuración", COLOR.acento);
    dato(x2 + 4, yTop + 46, "Patrón", patron.nombre.replace(/ \(.*/, "")); dato(x2 + w2 / 2, yTop + 46, "Niveles", d.capas);
    dato(x2 + 4, yTop + 56, "Cajas por nivel", d.porCapa); dato(x2 + w2 / 2, yTop + 56, "Tope", d.techoPlano ? "Plano" : "Irregular");

    tarjeta(x2, yTop + 66, w2, 30, "Especificaciones técnicas");
    dato(x2 + 4, yTop + 79, `Medida total (${u.l})`, `${u.fLLL(d.L, d.W, d.alto).replace(` ${u.l}`, "")}`);
    dato(x2 + w2 / 2, yTop + 79, `Medida real carga (${u.l})`, `${u.fLLL(m.medidaReal.l, m.medidaReal.w, m.medidaReal.h).replace(` ${u.l}`, "")}`);
    dato(x2 + 4, yTop + 89, `Pallet (${u.l})`, `${u.fLLL(d.palL, d.palW, d.esp).replace(` ${u.l}`, "")}`);
    dato(x2 + w2 / 2, yTop + 89, `Centro de gravedad (${u.l})`, `${[m.cg.x, m.cg.y, m.cg.z].map((v) => u.L(v).toLocaleString("es-MX", { maximumFractionDigits: 0 })).join(", ")}`);

    // Semáforo
    tarjeta(x2, yTop + 99, w2, 42, "Semáforo");
    ["estabilidad", "cg", "compresion"].forEach((k, j) => {
      const s = patron.semaforos[k], y = yTop + 110 + j * 10;
      circulo(x2 + 6, y - 1.2, s.color);
      doc.setFont("helvetica", "bold"); doc.setFontSize(8.5); set(COLOR.tinta); doc.text(NOMBRES_SEM[k], x2 + 10, y);
      doc.setFont("helvetica", "normal"); doc.setFontSize(7.5); set(COLOR.suave); doc.text(s.texto, x2 + 10, y + 3.8, { maxWidth: w2 - 14 });
    });

    // Indicadores y descripción
    const y3 = yTop + 145;
    tarjeta(M, y3, W - 2 * M, 30, "Indicadores");
    const ind = [["Apoyo mínimo", pct(m.apoyoMinimo)], ["Cajas que pisa c/u", m.entrelazado.toFixed(1)], ["Con 3 lados contenidos", pct(m.lateral)],
      ["Carga sobre la caja de abajo", u.fP(m.cargaMax, 1)], ["Resistencia considerada", m.resistencia != null ? u.fP(m.resistencia, 1) : "Sin dato"], ["Margen", m.margen == null ? "—" : m.margen === Infinity ? "Sin carga" : `${m.margen.toFixed(2)} ×`]];
    ind.forEach(([k, v], j) => dato(M + 4 + (j % 3) * ((W - 2 * M) / 3), y3 + 13 + Math.floor(j / 3) * 10, k, v));
    doc.setFont("helvetica", "italic"); doc.setFontSize(8); set(COLOR.suave);
    doc.text(patron.descripcion, M, y3 + 36, { maxWidth: W - 2 * M });
    if (m.factores && m.tipoResistencia === "bct") {
      doc.text(`BCT ${u.fP(m.bct, 0)} × patrón ${m.factores.patron} × humedad ${m.factores.humedad} × tiempo ${m.factores.tiempo}${m.factores.sobresaliente < 1 ? ` × sobresaliente ${m.factores.sobresaliente}` : ""} (factores de referencia; ajústalos con tus pruebas).`, M, y3 + 41, { maxWidth: W - 2 * M });
    }

    // Manifiesto del SKU
    const y4 = y3 + 48;
    const cols = [["SKU", 34], ["Descripción", 50], ["Cajas", 14], ["Piezas", 14], [`Medida caja (${u.l})`, 32], [`Peso neto (${u.p})`, 22], [`Peso bruto (${u.p})`, 22]];
    doc.setFillColor(...COLOR.fondo); doc.rect(M, y4, W - 2 * M, 7, "F");
    doc.setFont("helvetica", "bold"); doc.setFontSize(7.5); set(COLOR.suave);
    let x = M + 2; cols.forEach(([t, w]) => { doc.text(t, x, y4 + 4.8); x += w; });
    doc.setFont("helvetica", "normal"); doc.setFontSize(8); set(COLOR.tinta);
    x = M + 2;
    [producto.sku, (producto.desc || "").slice(0, 30), n0(d.n), n0(d.piezas), u.fLLL(producto.L, producto.W, producto.H).replace(` ${u.l}`, ""), u.fP(d.peso - (pallet.peso || 0), 1).replace(` ${u.p}`, ""), u.fP(d.peso, 1).replace(` ${u.p}`, "")]
      .forEach((t, j) => { doc.text(String(t), x, y4 + 12); x += cols[j][1]; });
    doc.setDrawColor(...COLOR.linea); doc.line(M, y4 + 15, W - M, y4 + 15);
    pie();
  });
  return doc.output("blob");
}

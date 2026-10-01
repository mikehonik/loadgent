// ================= Idioma =================
// La herramienta está escrita en español y el texto en español es la llave del diccionario (en.js). En inglés
// no se toca el código de cada pantalla: un observador recorre lo que React dibuja y cambia cada texto (y los
// title, placeholder y aria-label) por su traducción, como hace el traductor del navegador pero con un
// diccionario propio. Lo que no está en el diccionario se queda en español (nunca queda en blanco).
//
// Las frases con datos se escriben en el diccionario con marcadores: "Hay {0} avisos" reconoce «Hay 3 avisos».
// Los archivos que se generan (Excel de resultados, instructivo y PDF) pasan por traducir() al armarse.
// Las plantillas de intercambio (maestro, carga, vehículos) se quedan en español para que se sigan leyendo.
import { EN } from "./en.js";

const CLAVE = "darnelcube.idioma";
const guardado = () => { try { return localStorage.getItem(CLAVE); } catch { return null; } };
// Español salvo que la persona elija inglés (queda en su cuenta y en este navegador). No se toma el idioma
// del navegador: muchos equipos en México tienen Chrome en inglés y la herramienta es para ellos.
let idioma = (typeof window !== "undefined" && guardado() === "en") ? "en" : "es";

export const IDIOMAS = [["es", "ES", "Español"], ["en", "EN", "English"]];
export const idiomaActual = () => idioma;
export const idiomaGuardado = () => guardado(); // lo último que se eligió en este navegador (o null)
export const esIngles = () => idioma === "en";
export function fijarIdioma(l) { idioma = l === "en" ? "en" : "es"; }
export function guardarIdioma(l) { fijarIdioma(l); try { localStorage.setItem(CLAVE, idioma); } catch { /* sin almacenamiento local */ } }

// ---------- Diccionario ----------
const EXACTAS = new Map(), PATRONES = [];
const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
for (const [es, en] of Object.entries(EN)) {
  const k = es.replace(/\s+/g, " ").trim();
  if (!/\{\d+\}/.test(k)) { EXACTAS.set(k, en); continue; }
  const orden = [];
  const re = new RegExp("^" + k.split(/(\{\d+\})/).map((p) => { const m = p.match(/^\{(\d+)\}$/); if (m) { orden.push(Number(m[1])); return "([\\s\\S]*?)"; } return escapar(p); }).join("") + "$");
  if (!/[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(k.replace(/\{\d+\}/g, ""))) continue;
  // Frases cortas («{0} de {1}», «{0} cajas») solo si cada dato es un número, algo corto, una frase del
  // diccionario o un nombre entre «», para no traducir a medias una frase que no está en el diccionario
  PATRONES.push({ re, orden, en, largo: k.replace(/\{\d+\}/g, "").length, debil: k.replace(/\{\d+\}/g, "").length < 12, nombreAlFinal: orden.length === 1 && /\}$/.test(k) });
}
PATRONES.sort((a, b) => b.largo - a.largo); // primero el más específico
// Pedazos que se pegan a otra frase («, 3 pallets», « y conversiones de 4 SKUs»): se buscan dentro de un dato
// que no se pudo traducir entero
const FRAGMENTOS = Object.entries(EN).filter(([es]) => /^([,;·(]|(y|con|sin) )/.test(es)).map(([es, en]) => {
  const orden = [];
  const partes = es.split(/(\{\d+\})/);
  // Un dato al final del pedazo («, vehículo {0}») toma el resto del texto; en medio, solo un número con su unidad
  const re = new RegExp((/^\w/.test(es) ? "(?<=\\s)" : "") + partes.map((p, i) => { const m = p.match(/^\{(\d+)\}$/); if (m) { orden.push(Number(m[1])); return partes.slice(i + 1).join("") === "" ? "(.+?)(?=[.;] |$)" : "([\\d.,]+(?: [^\\s,;·]+)?)"; } return escapar(p); }).join(""), "g");
  return { re, orden, en };
}).sort((a, b) => b.re.source.length - a.re.source.length);
// Una oración suelta: completa (con o sin su punto final) o, si no, por pedazos
// (por pedazos solo dentro de un dato; una oración entera que no está en el diccionario se deja como está)
function unaOracion(x, conPedazos = true) {
  const t = x.trim(), sinPunto = !/[.!?]$/.test(t);
  return traducirNucleo(t) ?? (sinPunto ? traducirNucleo(t + ".")?.replace(/\.$/, "") : null) ?? (conPedazos ? traducirFragmentos(x) : x);
}
const traducirFragmentos = (s) => {
  // Si el dato trae varias oraciones, cada una se intenta completa antes de buscarle pedazos
  if (/[.!?] \S/.test(s)) return s.split(/(?<=[.!?])\s+/).map((x) => unaOracion(x)).join(" ");
  let r = s; for (const f of FRAGMENTOS) r = r.replace(f.re, (...m) => f.en.replace(/\{(\d+)\}/g, (x, n) => m[1 + f.orden.indexOf(Number(n))] ?? ""));
  return r.replace(/(\d) o (\d)/g, "$1 or $2").replace(/(\d) y (\d)/g, "$1 and $2");
};

const cache = new Map();
function traducirNucleo(s, leniente = false) {
  const exacta = EXACTAS.get(s);
  if (exacta !== undefined) return exacta;
  const ck = leniente ? "\u0001" + s : s;
  if (cache.has(ck)) return cache.get(ck);
  let r = null;
  for (const p of PATRONES) {
    const m = s.match(p.re); if (!m) continue;
    if (p.debil && !(leniente && p.nombreAlFinal) && m.slice(1).some((v) => !((/\d/.test(v) && v.trim().length <= 24) || v.trim().length <= 4 || traducirNucleo(v.trim()) != null || s.includes(`«${v.trim()}»`)))) continue;
    const vals = []; p.orden.forEach((n, i) => { const v = m[i + 1]; vals[n] = traducirNucleo(v.trim()) != null ? v.replace(v.trim(), traducirNucleo(v.trim())) : traducirFragmentos(v); });
    r = p.en.replace(/\{(\d+)\}/g, (x, n) => vals[n] ?? "");
    break;
  }
  // «No se pudo leer X: <error>»: si lo de antes de los dos puntos está en el diccionario, se traducen las dos partes
  if (r == null) { const i = s.indexOf(": "); if (i > 0) { const izq = EXACTAS.get(s.slice(0, i + 1)) ?? (EXACTAS.has(s.slice(0, i)) ? EXACTAS.get(s.slice(0, i)) + ":" : undefined); if (izq !== undefined) r = izq + " " + (traducirNucleo(s.slice(i + 2)) ?? s.slice(i + 2)); } }
  // Varias oraciones seguidas (un aviso armado con partes): cada oración por separado
  if (r == null && /[.!?] \S/.test(s)) { const partes = s.split(/(?<=[.!?])\s+/), t = partes.map((x) => unaOracion(x, false)); if (t.some((x, i) => x !== partes[i])) r = t.join(" "); }
  // Datos unidos con « · » (subtítulos, resúmenes): se traduce cada parte por separado
  if (r == null && s.includes(" · ")) { const partes = s.split(" · "), t = partes.map((x) => traducirNucleo(x.trim()) ?? x); if (t.some((x, i) => x !== partes[i])) r = t.join(" · "); }
  if (cache.size > 5000) cache.clear();
  cache.set(ck, r);
  return r;
}

// Devuelve el texto en el idioma actual; conserva los espacios de las orillas.
export function traducir(s, leniente = false) {
  if (idioma !== "en" || typeof s !== "string" || !/[A-Za-zÁÉÍÓÚáéíóúÑñ]{2}/.test(s)) return s;
  const m = s.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const n = traducirNucleo(m[2].replace(/\s+/g, " "), leniente);
  return n == null ? s : m[1] + n + m[3];
}
// Para textos armados en el código (confirmaciones, avisos): tr("Hay {n} avisos", { n: 3 })
export function tr(es, vars) {
  const base = idioma === "en" ? (EXACTAS.get(es) ?? es) : es;
  const s = vars ? base.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? "")) : base;
  return idioma === "en" && base === es ? traducir(s) : s;
}

// ---------- Traductor de la pantalla ----------
const ATRIBUTOS = ["title", "placeholder", "aria-label"];
const originalTexto = new WeakMap(); // nodo → [español, lo que pusimos]
const originalAtr = new WeakMap();   // elemento → { atributo: [español, lo que pusimos] }
const saltar = (el) => el && el.closest && el.closest("script,style,textarea,[data-notr]");

function traducirNodoTexto(n) {
  if (saltar(n.parentElement)) return;
  const prev = originalTexto.get(n), actual = n.nodeValue;
  const es = prev && prev[1] === actual ? prev[0] : actual; // si React lo cambió, lo nuevo es el español
  const nuevo = idioma === "en" ? traducir(es) : es;
  if (nuevo !== es || prev) originalTexto.set(n, [es, nuevo]);
  if (nuevo !== actual) n.nodeValue = nuevo;
}
function traducirAtributos(el) {
  if (saltar(el)) return;
  for (const a of ATRIBUTOS) {
    if (!el.hasAttribute(a)) continue;
    const mapa = originalAtr.get(el) || {}, prev = mapa[a], actual = el.getAttribute(a);
    const es = prev && prev[1] === actual ? prev[0] : actual;
    const nuevo = idioma === "en" ? traducir(es, true) : es; // en title y aria-label se acepta «Quitar <nombre>»
    if (nuevo !== es || prev) { mapa[a] = [es, nuevo]; originalAtr.set(el, mapa); }
    if (nuevo !== actual) el.setAttribute(a, nuevo);
  }
}
export function traducirArbol(raiz) {
  if (!raiz) return;
  if (raiz.nodeType === 3) { traducirNodoTexto(raiz); return; }
  if (raiz.nodeType !== 1 && raiz.nodeType !== 9 && raiz.nodeType !== 11) return;
  if (raiz.nodeType === 1) traducirAtributos(raiz);
  const w = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) traducirNodoTexto(n); else traducirAtributos(n); }
}

let observador = null;
// Se llama una vez al arrancar y cada vez que cambia el idioma
export function traducirPantalla() {
  if (typeof document === "undefined") return;
  document.documentElement.lang = idioma;
  if (!observador) {
    observador = new MutationObserver((cambios) => {
      if (idioma !== "en" && !cambios.length) return;
      for (const c of cambios) {
        if (c.type === "characterData") traducirNodoTexto(c.target);
        else if (c.type === "attributes") traducirAtributos(c.target);
        else c.addedNodes.forEach(traducirArbol);
      }
    });
    observador.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATRIBUTOS });
  }
  traducirArbol(document.body);
  observador.takeRecords(); // nuestros propios cambios no cuentan
}

// Un documento HTML generado (el instructivo): se traduce antes de descargarlo
export function traducirHtml(html) {
  if (idioma !== "en" || typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(html, "text/html");
  const w = doc.createTreeWalker(doc.documentElement, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (!n.parentElement?.closest("script,style")) n.nodeValue = traducir(n.nodeValue);
  doc.documentElement.lang = "en";
  return "<!DOCTYPE html>" + doc.documentElement.outerHTML;
}
// Filas de una hoja de Excel: cada celda de texto por su traducción
export const traducirFilas = (filas) => (idioma === "en" ? filas.map((f) => (Array.isArray(f) ? f.map((c) => (typeof c === "string" ? traducir(c) : c)) : f)) : filas);

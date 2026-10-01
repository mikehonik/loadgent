// ================= Nube =================
// Conexión con Supabase: configuración (URL + llave, una sola vez, en este navegador), sesión del
// usuario y guardar/cargar el proyecto completo como un solo JSON por usuario.
//
// No hay nada de esto que sea secreto: la "llave anon" de Supabase está pensada para ir en el
// navegador. Lo que protege los datos de cada usuario es la regla de la base de datos (RLS), no
// que la llave esté oculta. Ver INSTRUCCIONES_NUBE.md para cómo se configura esa regla.
import { createClient } from "@supabase/supabase-js";
import { empacarParaNube, abrirDeNube } from "./comprimir.js";

const CLAVE_CONFIG = "estiba3d_nube_config";

// Si el sitio se publicó con las variables de entorno VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
// (Netlify, Vercel...), se usan esas y la pantalla de configuración nunca aparece. Si no están,
// se le pide a la persona que las pegue una vez, y quedan guardadas en este navegador.
const configDeEntorno = () => {
  const url = import.meta.env.VITE_SUPABASE_URL, llave = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && llave ? { url, llave } : null;
};

export function configGuardada() {
  const deEntorno = configDeEntorno();
  if (deEntorno) return deEntorno;
  try { return JSON.parse(localStorage.getItem(CLAVE_CONFIG) || "null"); } catch { return null; }
}

export function usaConfigDeEntorno() {
  return !!configDeEntorno();
}

export function guardarConfig({ url, llave }) {
  localStorage.setItem(CLAVE_CONFIG, JSON.stringify({ url: url.trim(), llave: llave.trim() }));
}

export function borrarConfig() {
  localStorage.removeItem(CLAVE_CONFIG);
}

let cliente = null;
export function clienteNube() {
  if (cliente) return cliente;
  const c = configGuardada();
  if (!c) return null;
  cliente = createClient(c.url, c.llave);
  return cliente;
}

export async function iniciarSesion(correo, contrasena) {
  const sb = clienteNube();
  if (!sb) throw new Error("Falta configurar la conexión con Supabase.");
  const { data, error } = await sb.auth.signInWithPassword({ email: correo.trim(), password: contrasena });
  if (error) throw error;
  return data.user;
}

export async function cerrarSesion() {
  const sb = clienteNube();
  if (sb) await sb.auth.signOut();
}

export async function sesionActual() {
  const sb = clienteNube();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

// Preferencias del usuario (por ejemplo, el sistema de unidades) guardadas en su propia cuenta de
// Supabase, así lo siguen a cualquier computadora. Si falla (sin conexión), no pasa nada: queda la copia local.
export async function guardarPreferencias(datos) {
  const sb = clienteNube();
  if (!sb) return;
  await sb.auth.updateUser({ data: datos });
}

export function alCambiarSesion(cb) {
  const sb = clienteNube();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_evt, session) => cb(session?.user ?? null));
  return () => data.subscription.unsubscribe();
}

// Un solo renglón por usuario en la tabla "proyectos": todo el estado de la herramienta como JSON.
export async function guardarProyectoNube(estado) {
  const sb = clienteNube();
  const { data: sesion } = await sb.auth.getSession();
  const uid = sesion.session?.user?.id;
  if (!uid) throw new Error("No hay sesión activa.");
  const { error } = await sb.from("proyectos").upsert({ user_id: uid, datos: estado, actualizado: new Date().toISOString() });
  if (error) throw error;
}

export async function cargarProyectoNube() {
  const sb = clienteNube();
  const { data: sesion } = await sb.auth.getSession();
  const uid = sesion.session?.user?.id;
  if (!uid) throw new Error("No hay sesión activa.");
  const { data, error } = await sb.from("proyectos").select("datos, actualizado").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return data ? { estado: data.datos, actualizado: data.actualizado } : null;
}

// ---------- Escenarios con nombre (varios por usuario) ----------
async function uidActual(sb) {
  const { data: sesion } = await sb.auth.getSession();
  const uid = sesion.session?.user?.id;
  if (!uid) throw new Error("No hay sesión activa.");
  return uid;
}

// Lista para el menú: solo nombre y fecha, sin traer los datos completos de cada escenario.
export async function listarEscenarios() {
  const sb = clienteNube();
  const uid = await uidActual(sb);
  const { data, error } = await sb.from("escenarios").select("id, nombre, actualizado").eq("user_id", uid).order("actualizado", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Guarda con ese nombre: si ya existía uno igual, lo actualiza en vez de duplicarlo.
export async function guardarEscenario(nombre, estado) {
  const sb = clienteNube();
  const uid = await uidActual(sb);
  const limpio = nombre.trim();
  if (!limpio) throw new Error("Ponle un nombre al escenario.");
  const { data: previos, error: eBusca } = await sb.from("escenarios").select("id").eq("user_id", uid).ilike("nombre", limpio);
  if (eBusca) throw eBusca;
  const fila = { user_id: uid, nombre: limpio, datos: estado, actualizado: new Date().toISOString() };
  if (previos?.length) {
    const { error } = await sb.from("escenarios").update(fila).eq("id", previos[0].id);
    if (error) throw error;
    return { id: previos[0].id, reemplazado: true };
  }
  const { data, error } = await sb.from("escenarios").insert(fila).select("id").single();
  if (error) throw error;
  return { id: data.id, reemplazado: false };
}

export async function abrirEscenario(id) {
  const sb = clienteNube();
  const uid = await uidActual(sb);
  const { data, error } = await sb.from("escenarios").select("nombre, datos, actualizado").eq("user_id", uid).eq("id", id).single();
  if (error) throw error;
  return { nombre: data.nombre, estado: data.datos, actualizado: data.actualizado };
}

export async function borrarEscenario(id) {
  const sb = clienteNube();
  const uid = await uidActual(sb);
  const { error } = await sb.from("escenarios").delete().eq("user_id", uid).eq("id", id);
  if (error) throw error;
}

// ---------- Maestro permanente (uno por usuario, vive aparte de los escenarios) ----------
export async function guardarMaestroNube(maestro) {
  const sb = clienteNube();
  const uid = await uidActual(sb);
  // Se guarda comprimido (~20 veces menos): ver comprimir.js
  const { error } = await sb.from("maestro").upsert({ user_id: uid, datos: await empacarParaNube(maestro), actualizado: new Date().toISOString() });
  if (error) throw error;
}

export async function cargarMaestroNube() {
  const sb = clienteNube();
  const uid = await uidActual(sb);
  const { data, error } = await sb.from("maestro").select("datos, actualizado").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return data ? { maestro: await abrirDeNube(data.datos), actualizado: data.actualizado } : null;
}

// ================= Compresión para la nube =================
// El maestro de productos puede pesar 20 MB como JSON (26 mil SKUs con sus conversiones) y se baja cada
// vez que alguien entra. Comprimido con gzip queda en ~1 MB: 20 veces menos transferencia en Supabase
// (el plan gratis incluye 5 GB al mes). Se guarda como texto base64 dentro del mismo campo jsonb:
//   { formato: "gzip-base64", datos: "H4sI..." }
// Lo que ya estaba guardado sin comprimir se sigue leyendo igual (ver abrirDeNube).

export const FORMATO_GZIP = "gzip-base64";
const hayCompresion = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

const aBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const deBase64 = (b64) => { const s = atob(b64), bytes = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i); return bytes; };
const pasar = async (bytes, stream) => new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());

// Objeto → lo que se guarda en la nube. Si el navegador no sabe comprimir (muy viejo), se guarda tal cual.
export async function empacarParaNube(obj) {
  if (!hayCompresion()) return obj;
  const gz = await pasar(new TextEncoder().encode(JSON.stringify(obj)), new CompressionStream("gzip"));
  return { formato: FORMATO_GZIP, datos: aBase64(gz) };
}

// Lo que viene de la nube → objeto. Acepta lo comprimido y lo guardado antes sin comprimir.
export async function abrirDeNube(guardado) {
  if (!guardado || guardado.formato !== FORMATO_GZIP) return guardado;
  const json = await pasar(deBase64(guardado.datos), new DecompressionStream("gzip"));
  return JSON.parse(new TextDecoder().decode(json));
}

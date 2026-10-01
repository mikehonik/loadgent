// ================= Navegador =================
// Lo que solo existe en el navegador: carpeta conectada (IndexedDB), File System Access y descargas.
// Recuerda la carpeta conectada entre sesiones (IndexedDB guarda el permiso del navegador, no copia archivos)
export const idb = {
  abrir: () => new Promise((res, rej) => { const r = indexedDB.open("estiba3d", 1); r.onupgradeneeded = () => r.result.createObjectStore("kv"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }),
  async get(k) { const db = await this.abrir(); return new Promise((res) => { const q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = () => res(q.result); q.onerror = () => res(null); }); },
  async set(k, v) { const db = await this.abrir(); return new Promise((res) => { const t = db.transaction("kv", "readwrite"); t.objectStore("kv").put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); },
};
export const FS_DISPONIBLE = typeof window !== "undefined" && "showDirectoryPicker" in window;

// Descarga un archivo generado en memoria
export function descargarArchivo(contenido, nombre, tipo) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

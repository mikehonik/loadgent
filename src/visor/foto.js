// ================= Foto de un pallet =================
// Dibuja un pallet armado fuera de pantalla y devuelve la imagen (PNG en data URL). Lo usan el reporte PDF
// de paletizado y las miniaturas: no toca el visor principal, así se pueden generar decenas de imágenes
// seguidas sin que la pantalla parpadee.
import * as THREE from "three";

const GEO = new THREE.BoxGeometry(1, 1, 1);
const EDG = new THREE.EdgesGeometry(GEO);
const MADERA = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
const MADERA_BORDE = new THREE.LineBasicMaterial({ color: 0x4e3016 });
let render = null;

function motor(ancho, alto) {
  if (!render) {
    const canvas = document.createElement("canvas");
    render = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: true });
    render.setPixelRatio(1);
  }
  render.setSize(ancho, alto, false);
  return render;
}

// def: pallet armado (definirPallet): cajas con x, y, z sobre la cubierta; palL, palW, esp, ovL, ovW, baseX, baseY.
export function fotoPallet(def, { color = "#C8102E", color2 = "#E9A3AE", ancho = 520, alto = 520, fondo = null } = {}) {
  const r = motor(ancho, alto);
  r.setClearColor(fondo == null ? 0xffffff : fondo, fondo == null ? 0 : 1);
  const escena = new THREE.Scene();
  escena.add(new THREE.AmbientLight(0xffffff, 0.75));
  const luz = new THREE.DirectionalLight(0xffffff, 0.55); luz.position.set(-8, 20, 12); escena.add(luz);
  const s = (v) => v / 1000;
  const grupo = new THREE.Group(); escena.add(grupo);
  const bloque = (x, y, z, l, w, h, mat, lineas) => {
    const m = new THREE.Mesh(GEO, mat);
    m.scale.set(s(l) * 0.995, s(h) * 0.995, s(w) * 0.995);
    m.position.set(s(x + l / 2), s(z + h / 2), s(y + w / 2));
    grupo.add(m);
    if (lineas) { const e = new THREE.LineSegments(EDG, lineas); e.scale.copy(m.scale); e.position.copy(m.position); grupo.add(e); }
  };
  // Pallet vacío: tablas arriba y tres largueros
  const ovL = def.ovL || 0, ovW = def.ovW || 0, esp = def.esp, pl = def.palL, pw = def.palW;
  const tabla = Math.min(22, esp * 0.2), n = 7, anchoT = pw / (n + (n - 1) * 0.45), hueco = anchoT * 0.45;
  for (let i = 0; i < n; i++) bloque(ovL, ovW + i * (anchoT + hueco), esp - tabla, pl, anchoT, tabla, MADERA, MADERA_BORDE);
  const ap = Math.min(120, pw * 0.12);
  [0, (pw - ap) / 2, pw - ap].forEach((py) => bloque(ovL, ovW + py, 0, pl, ap, esp - tabla, MADERA, MADERA_BORDE));
  // Capas en dos tonos alternados, para que se note el entrelazado
  const mats = [new THREE.MeshLambertMaterial({ color: new THREE.Color(color) }), new THREE.MeshLambertMaterial({ color: new THREE.Color(color2) })];
  const borde = new THREE.LineBasicMaterial({ color: 0x16202c, transparent: true, opacity: 0.45 });
  def.cajas.forEach((k) => bloque(k.x + ovL - (def.baseX || 0), k.y + ovW - (def.baseY || 0), esp + k.z, k.l, k.w, k.h, mats[(k.capa ?? 0) % 2], borde));
  // Cámara isométrica que encuadra todo
  const caja = new THREE.Box3().setFromObject(grupo), centro = caja.getCenter(new THREE.Vector3()), tam = caja.getSize(new THREE.Vector3());
  const radio = tam.length() / 2;
  const cam = new THREE.PerspectiveCamera(30, ancho / alto, 0.01, 100);
  const dist = radio / Math.sin((30 * Math.PI) / 360) * 1.02;
  const theta = -0.85, phi = 1.1;
  cam.position.set(centro.x + dist * Math.sin(phi) * Math.cos(theta), centro.y + dist * Math.cos(phi), centro.z + dist * Math.sin(phi) * Math.sin(theta));
  cam.lookAt(centro);
  r.render(escena, cam);
  const url = r.domElement.toDataURL("image/png");
  // Liberar materiales de esta foto (las geometrías son compartidas)
  mats.forEach((m) => m.dispose()); borde.dispose();
  return url;
}

// ================= Visor 3D =================
// Dibuja el vehículo o la tarima con sus cajas y pallets en Three.js. Expone por `api` la captura de imágenes por paso.
import { useEffect, useRef } from "react";
import * as THREE from "three";

const GEO = new THREE.BoxGeometry(1, 1, 1);
const EDG = new THREE.EdgesGeometry(GEO);
// Cilindro de radio y alto 1, de pie (eje Y); se escala para barriles y, girado, para tubos
const CIL = new THREE.CylinderGeometry(0.5, 0.5, 1, 20);
const CIL_EDG = new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.5, 0.5, 1, 20, 1, false));
const MADERA = new THREE.MeshLambertMaterial({ color: 0x8b5a2b });
const MADERA_BORDE = new THREE.LineBasicMaterial({ color: 0x4e3016 });
const VISTAS = { iso: [-0.85, 1.05], frente: [0, 1.5], lado: [Math.PI / 2, 1.5], arriba: [Math.PI / 2, 0.08] };

// Edición a mano: con `onElegir`, un clic (sin arrastrar) sobre un bulto avisa su índice; `seleccion` lo
// marca en ámbar y `problemas` (índices) en rojo. Las marcas no salen en las imágenes del instructivo.
// Cotas: con `cotas` (una función mm → texto, la del sistema de unidades elegido) se acota el espacio
// que quedó libre en la puerta. Van apagadas por omisión y tampoco salen en el instructivo.
export function Visor({ veh, base, cajas, pallets, paso, colores, formas, resaltado, camara, api, seleccion = null, problemas = null, onElegir = null, cotas = null }) {
  const montaje = useRef(null);
  const ref3 = useRef({});
  const elegirRef = useRef(onElegir);
  elegirRef.current = onElegir;
  useEffect(() => {
    const el = montaje.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0xe7ecf1);
    el.appendChild(renderer.domElement);
    const escena = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(36, 1, 0.05, 500);
    escena.add(new THREE.AmbientLight(0xffffff, 0.72));
    const luz = new THREE.DirectionalLight(0xffffff, 0.5);
    luz.position.set(10, 25, 18);
    escena.add(luz);
    const grupo = new THREE.Group();
    escena.add(grupo);
    const orb = { theta: -0.85, phi: 1.05, r: 18, target: new THREE.Vector3() };
    const ajustar = () => { const w = el.clientWidth, h = el.clientHeight; if (!w || !h) return; renderer.setSize(w, h); cam.aspect = w / h; cam.updateProjectionMatrix(); };
    ajustar();
    const ro = new ResizeObserver(ajustar);
    ro.observe(el);
    let arrastre = null;
    const cv = renderer.domElement;
    cv.style.touchAction = "none";
    let inicio = null;
    cv.addEventListener("pointerdown", (e) => { arrastre = { x: e.clientX, y: e.clientY }; inicio = { x: e.clientX, y: e.clientY }; cv.setPointerCapture(e.pointerId); });
    // Clic sin arrastrar: qué bulto quedó bajo el puntero (para la edición a mano)
    const rayo = new THREE.Raycaster(), punto = new THREE.Vector2();
    cv.addEventListener("pointerup", (e) => {
      if (!inicio || !elegirRef.current) return;
      const mov = Math.abs(e.clientX - inicio.x) + Math.abs(e.clientY - inicio.y); inicio = null;
      if (mov > 5) return;
      const r = cv.getBoundingClientRect();
      punto.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rayo.setFromCamera(punto, cam);
      const hit = rayo.intersectObjects(grupo.children, false).find((h) => h.object.isMesh && h.object.userData.i != null);
      elegirRef.current(hit ? hit.object.userData.i : null);
    });
    cv.addEventListener("pointermove", (e) => {
      if (!arrastre) return;
      orb.theta += (e.clientX - arrastre.x) * 0.008;
      orb.phi = Math.min(1.55, Math.max(0.05, orb.phi - (e.clientY - arrastre.y) * 0.008));
      arrastre = { x: e.clientX, y: e.clientY };
    });
    cv.addEventListener("pointerup", () => { arrastre = null; });
    cv.addEventListener("wheel", (e) => { e.preventDefault(); orb.r = Math.min(90, Math.max(1, orb.r * (1 + Math.sign(e.deltaY) * 0.08))); }, { passive: false });
    let raf;
    const ciclo = () => {
      cam.position.set(orb.target.x + orb.r * Math.sin(orb.phi) * Math.cos(orb.theta), orb.target.y + orb.r * Math.cos(orb.phi), orb.target.z + orb.r * Math.sin(orb.phi) * Math.sin(orb.theta));
      cam.lookAt(orb.target);
      renderer.render(escena, cam);
      raf = requestAnimationFrame(ciclo);
    };
    ciclo();
    const fijarCamara = () => { cam.position.set(orb.target.x + orb.r * Math.sin(orb.phi) * Math.cos(orb.theta), orb.target.y + orb.r * Math.cos(orb.phi), orb.target.z + orb.r * Math.sin(orb.phi) * Math.sin(orb.theta)); cam.lookAt(orb.target); };
    ref3.current = { grupo, orb, renderer, escena, cam, fijarCamara };
    return () => { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); el.removeChild(cv); };
  }, []);

  useEffect(() => {
    const { orb } = ref3.current;
    if (!orb) return;
    orb.target.set(veh.L / 2000, veh.H / 2000, veh.W / 2000);
    orb.r = (Math.max(veh.L, veh.H * 1.4) / 1000) * 1.2 + (veh.L < 3000 ? 1.5 : 3.5);
  }, [veh.L, veh.W, veh.H]);

  useEffect(() => {
    const { orb } = ref3.current;
    if (!orb || !camara) return;
    const [t, p] = VISTAS[camara.tipo];
    orb.theta = t; orb.phi = p;
  }, [camara]);

  useEffect(() => {
    if (!api) return;
    api.current = {
      // Devuelve imágenes (JPEG) de la carga en los pasos indicados, en vista 3D
      capturar: (pasos) => {
        const r = ref3.current; if (!r.dibujar) return [];
        const guard = { theta: r.orb.theta, phi: r.orb.phi }, imgs = [];
        r.orb.theta = VISTAS.iso[0]; r.orb.phi = VISTAS.iso[1];
        pasos.forEach((p) => { r.dibujar(p, true); r.fijarCamara(); r.renderer.render(r.escena, r.cam); imgs.push(r.renderer.domElement.toDataURL("image/jpeg", 0.82)); });
        r.orb.theta = guard.theta; r.orb.phi = guard.phi; r.dibujar(r.pasoActual, false);
        return imgs;
      },
    };
  }, [api]);

  useEffect(() => {
    const { grupo } = ref3.current;
    if (!grupo) return;
    const dibujar = (pasoN, limpio) => {
    while (grupo.children.length) grupo.remove(grupo.children[0]);
    const s = (v) => v / 1000;
    const mats = {};
    const borde = new THREE.LineBasicMaterial({ color: 0x16202c, transparent: true, opacity: 0.32 });
    const tenue = new THREE.MeshLambertMaterial({ color: 0x9aa7b2, transparent: true, opacity: 0.12, depthWrite: false });
    let bultoActual = null;   // índice del bulto que se está dibujando (para elegirlo con clic)
    const bloque = (x, y, z, l, w, h, mat, lineas) => {
      const m = new THREE.Mesh(GEO, mat);
      m.scale.set(s(l) * 0.995, s(h) * 0.995, s(w) * 0.995);
      m.position.set(s(x + l / 2), s(z + h / 2), s(y + w / 2));
      if (bultoActual != null) m.userData.i = bultoActual;
      grupo.add(m);
      if (lineas) { const e = new THREE.LineSegments(EDG, lineas); e.scale.copy(m.scale); e.position.copy(m.position); grupo.add(e); }
    };
    const tarima = (x, y, z, l, w, esp) => {
      const tabla = Math.min(22, esp * 0.2), n = 7, ancho = w / (n + (n - 1) * 0.45), hueco = ancho * 0.45;
      for (let i = 0; i < n; i++) bloque(x, y + i * (ancho + hueco), z + esp - tabla, l, ancho, tabla, MADERA, MADERA_BORDE);
      const ap = Math.min(120, w * 0.12);
      [0, (w - ap) / 2, w - ap].forEach((py) => bloque(x, y + py, z, l, ap, esp - tabla, MADERA, MADERA_BORDE));
    };
    // Cilindro dentro de su caja envolvente: de pie (barril) o acostado a lo largo (tubo)
    const cilindro = (x, y, z, l, w, h, mat, lineas) => {
      const acostado = l > w && l > h;                 // el eje más largo manda: si es el largo, va acostado
      const d = acostado ? Math.min(w, h) : Math.min(l, w), alto = acostado ? l : h;
      const m = new THREE.Mesh(CIL, mat);
      m.scale.set(s(d) * 0.99, s(alto) * 0.99, s(d) * 0.99);
      m.position.set(s(x + l / 2), s(z + h / 2), s(y + w / 2));
      if (acostado) m.rotation.z = Math.PI / 2;
      if (bultoActual != null) m.userData.i = bultoActual;
      grupo.add(m);
      if (lineas) { const e = new THREE.LineSegments(CIL_EDG, lineas); e.scale.copy(m.scale); e.position.copy(m.position); e.rotation.copy(m.rotation); grupo.add(e); }
    };
    const caja = (x, y, z, l, w, h, idx, destacada) => {
      const redonda = formas && (formas[idx] === "barril" || formas[idx] === "tubo");
      const pinta = redonda ? cilindro : bloque;
      if (resaltado !== null && idx !== resaltado) { pinta(x, y, z, l, w, h, tenue, null); return; }
      const key = destacada ? "hl" : idx;
      if (!mats[key]) mats[key] = new THREE.MeshLambertMaterial({ color: destacada ? 0xffffff : new THREE.Color(colores[idx] || "#888") });
      pinta(x, y, z, l, w, h, mats[key], borde);
    };
    const marco = new THREE.LineSegments(EDG, new THREE.LineBasicMaterial({ color: 0x14213d }));
    marco.scale.set(s(veh.L), s(veh.H), s(veh.W));
    marco.position.set(s(veh.L) / 2, s(veh.H) / 2, s(veh.W) / 2);
    grupo.add(marco);
    if (base) {
      tarima(base.x, base.y, -base.esp, base.l, base.w, base.esp);
      if (base.x > 0 || base.y > 0) {
        // Límite de sobresaliente: rectángulo punteado rojo a nivel de la tarima
        const lim = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1, 1)), new THREE.LineDashedMaterial({ color: 0xb3261e, dashSize: 0.04, gapSize: 0.03 }));
        lim.rotation.x = -Math.PI / 2; lim.scale.set(s(veh.L), s(veh.W), 1); lim.position.set(s(veh.L) / 2, 0.002, s(veh.W) / 2); lim.computeLineDistances(); grupo.add(lim);
      }
    }
    else {
      const piso = new THREE.Mesh(GEO, new THREE.MeshLambertMaterial({ color: 0xc3ccd5 }));
      piso.scale.set(s(veh.L), 0.02, s(veh.W));
      piso.position.set(s(veh.L) / 2, -0.01, s(veh.W) / 2);
      grupo.add(piso);
    }
    // Marco alrededor de un bulto: ámbar si está elegido, rojo si tiene problemas
    const marcoBulto = (c, color, grueso) => {
      const g = 12 + grueso;
      const e = new THREE.LineSegments(EDG, new THREE.LineBasicMaterial({ color, depthTest: false, transparent: true, opacity: 0.95 }));
      e.scale.set(s(c.l + g), s(c.h + g), s(c.w + g)); e.position.set(s(c.x + c.l / 2), s(c.z + c.h / 2), s(c.y + c.w / 2)); e.renderOrder = 10; grupo.add(e);
      const velo = new THREE.Mesh(GEO, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false }));
      velo.scale.copy(e.scale); velo.position.copy(e.position); grupo.add(velo);
    };
    cajas.slice(0, pasoN).forEach((c, i) => {
      bultoActual = onElegir ? i : null;
      const ultima = !limpio && i === pasoN - 1 && pasoN < cajas.length;
      if (c.pal >= 0 && pallets[c.pal]) {
        const d = pallets[c.pal];
        if (c.rot) tarima(c.x + d.baseY, c.y + d.L - d.baseX - d.palL, c.z, d.palW, d.palL, d.esp);
        else tarima(c.x + d.baseX, c.y + d.baseY, c.z, d.palL, d.palW, d.esp);
        d.cajas.forEach((k) => {
          let x = k.x, y = k.y, l = k.l, w = k.w;
          if (c.rot) { x = k.y; y = d.L - (k.x + k.l); l = k.w; w = k.l; }
          caja(c.x + x, c.y + y, c.z + d.esp + k.z, l, w, k.h, k.idx, ultima);
        });
      } else caja(c.x, c.y, c.z, c.l, c.w, c.h, c.idx, ultima);
    });
    bultoActual = null;
    // ---- Cotas ----
    // Dos cosas distintas, con dos colores: en azul lo que MIDE la carga (largo, ancho, alto total y,
    // sobre un pallet, cuánto sobresale de la tarima) y en rojo lo que queda LIBRE al frente de la carga.
    // Es la información que da CubeMaster en su hoja de medidas, que es con la que se comparan en planta.
    if (!limpio && cotas && pasoN > 0) {
      const puestas = cajas.slice(0, pasoN);
      const ext = (f, g) => puestas.reduce((m, c) => g(m, f(c)), g === Math.max ? -Infinity : Infinity);
      const x0 = ext((c) => c.x, Math.min), x1 = ext((c) => c.x + c.l, Math.max);
      const y0 = ext((c) => c.y, Math.min), y1 = ext((c) => c.y + c.w, Math.max);
      const z1 = ext((c) => c.z + c.h, Math.max), piso = base ? -base.esp : 0;
      const AZUL = 0x14213d, ROJO = 0xb3261e, MIN = 10;   // menos de 1 cm no se acota: sería ruido
      // Todo lo de las cotas (letra, patitas, separación) se mide contra el tamaño de la escena: la misma
      // cota tiene que leerse igual en un contenedor de 12 m que en un pallet de 1.2 m.
      const k = s(Math.max(veh.L, veh.W, veh.H)) / 12;
      const mat = (col) => new THREE.LineBasicMaterial({ color: col, depthTest: false, transparent: true, opacity: 0.95 });
      const linea = (a, b, col) => { const o = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]), mat(col)); o.renderOrder = 11; grupo.add(o); };
      // Una cota: la línea entre los dos extremos y una patita perpendicular en cada punta
      const cota = (a, b, pata, col) => { linea(a, b, col); [a, b].forEach((q) => linea([q[0] - pata[0], q[1] - pata[1], q[2] - pata[2]], [q[0] + pata[0], q[1] + pata[1], q[2] + pata[2]], col)); };
      // La etiqueta se dibuja chica a propósito: es una acotación de plano, no un cartel. Va en un lienzo
      // grande y se reduce al montarla, para que se vea nítida sin ocupar espacio (como las de CubeMaster).
      const etiqueta = (mm, en, col) => {
        const txt = cotas(mm), F = "600 40px system-ui, sans-serif", hex = "#" + col.toString(16).padStart(6, "0");
        const cv = document.createElement("canvas"), ctx = cv.getContext("2d");
        ctx.font = F; cv.width = Math.ceil(ctx.measureText(txt).width) + 16; cv.height = 52;
        const c2 = cv.getContext("2d");
        c2.fillStyle = "rgba(255,255,255,.82)"; c2.fillRect(0, 0, cv.width, cv.height);
        c2.font = F; c2.fillStyle = hex; c2.textBaseline = "middle"; c2.fillText(txt, 8, cv.height / 2);
        const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), depthTest: false, transparent: true }));
        const alto = 0.26 * k;
        sp.scale.set((cv.width / cv.height) * alto, alto, 1);
        sp.position.set(...en); sp.renderOrder = 12; grupo.add(sp);
      };
      // Medida + etiqueta en un tiro. eje: 0 = largo (x), 1 = ancho (y), 2 = alto (z)
      const medir = (mm, a, b, eje, col, desvio) => {
        if (!(mm > MIN)) return;
        cota(a, b, (eje === 0 ? [0, 0.09, 0] : [0.07, 0, 0]).map((v) => v * k), col);
        etiqueta(mm, [(a[0] + b[0]) / 2 + desvio[0] * k, (a[1] + b[1]) / 2 + desvio[1] * k, (a[2] + b[2]) / 2 + desvio[2] * k], col);
      };

      // --- Lo que mide la carga ---
      const X0 = s(x0), X1 = s(x1), Y0 = s(y0), Y1 = s(y1), Z1 = s(z1), P = s(piso);
      medir(x1 - x0, [X0, Z1, Y0], [X1, Z1, Y0], 0, AZUL, [0, 0.2, 0]);
      medir(y1 - y0, [X1, Z1, Y0], [X1, Z1, Y1], 1, AZUL, [0.12, 0.2, 0]);
      medir(z1 - piso, [X1, P, Y1], [X1, Z1, Y1], 2, AZUL, [0.2, 0, 0.12]);

      // --- Sobre un pallet: cuánto sobresale la carga de la tarima, lado por lado ---
      // El sobresaliente son milímetros sobre una tarima de más de un metro: dibujarlo a escala da una
      // rayita de 1 mm en pantalla, invisible. Así que se marca el tramo, y de ahí sale una línea guía
      // hacia AFUERA con el número, como en un plano acotado. Igual que el 6.36 / 6.45 de CubeMaster.
      if (base) {
        const guia = (a, b, fuera) => {
          const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
          const e = [m[0] + fuera[0] * k, m[1] + fuera[1] * k, m[2] + fuera[2] * k];
          linea(a, b, ROJO);
          // Patitas verticales en las puntas del tramo, para que se vea dónde empieza y dónde acaba
          [a, b].forEach((q) => linea([q[0], q[1] - 0.05 * k, q[2]], [q[0], q[1] + 0.12 * k, q[2]], ROJO));
          linea(m, e, ROJO);
          return e;
        };
        const so = [[base.x - x0, [X0, P, Y0], [s(base.x), P, Y0], [-0.55, -0.35, -0.4]],
                    [x1 - (base.x + base.l), [s(base.x + base.l), P, Y1], [X1, P, Y1], [0.55, -0.35, 0.4]],
                    [base.y - y0, [X0, P, Y0], [X0, P, s(base.y)], [-0.55, -0.35, -0.4]],
                    [y1 - (base.y + base.w), [X1, P, s(base.y + base.w)], [X1, P, Y1], [0.55, -0.35, 0.4]]];
        so.forEach(([mm, a, b, fuera]) => { if (mm > 0.5) etiqueta(mm, guia(a, b, fuera), ROJO); });
      } else {
        // --- En un vehículo: lo que quedó libre al frente de la carga ---
        const L = s(veh.L), W = s(veh.W), H = s(veh.H);
        medir(veh.L - x1, [X1, 0, W], [L, 0, W], 0, ROJO, [0, 0.2, 0]);
        medir(veh.W - y1, [X1, 0, Y1], [X1, 0, W], 1, ROJO, [0, 0.2, 0]);
        medir(veh.H - z1, [X1, Z1, W], [X1, H, W], 2, ROJO, [0.12, 0, 0]);
      }
    }
    if (!limpio && problemas) cajas.slice(0, pasoN).forEach((c, i) => { if (problemas.has(i) && i !== seleccion) marcoBulto(c, 0xd11f1f, 0); });
    if (!limpio && seleccion != null && cajas[seleccion]) marcoBulto(cajas[seleccion], problemas?.has(seleccion) ? 0xd11f1f : 0xf2b705, 8);
    };
    ref3.current.dibujar = dibujar; ref3.current.pasoActual = paso;
    dibujar(paso, false);
  }, [veh, base, cajas, pallets, paso, colores, formas, resaltado, seleccion, problemas, !!onElegir, cotas]);

  return <div ref={montaje} className="absolute inset-0" style={{ cursor: onElegir ? "pointer" : "grab" }} />;
}

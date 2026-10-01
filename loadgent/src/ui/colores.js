// ================= Colores =================
// Paletas para SKUs. Ninguna usa cafés, para que la tarima (café) siempre se distinga.
export const PALETAS = {
  vivos: { nombre: "Vivos", base: ["#E6194B", "#3CB44B", "#FFE119", "#4363D8", "#F58231", "#911EB4", "#42D4F4", "#F032E6", "#BFEF45", "#469990", "#DCBEFF", "#FABED4"] },
  profesional: { nombre: "Profesional", base: ["#1F77B4", "#FF7F0E", "#2CA02C", "#D62728", "#9467BD", "#17BECF", "#E377C2", "#BCBD22", "#7F7F7F", "#AEC7E8", "#98DF8A", "#FF9896"] },
  pastel: { nombre: "Pastel", base: ["#8DD3C7", "#FFFFB3", "#BEBADA", "#FB8072", "#80B1D3", "#FDB462", "#B3DE69", "#FCCDE5", "#BC80BD", "#CCEBC5", "#FFED6F", "#D9D9D9"] },
  daltonicos: { nombre: "Apta para daltonismo", base: ["#E69F00", "#56B4E9", "#009E73", "#F0E442", "#0072B2", "#D55E00", "#CC79A7", "#999999"] },
  automatica: { nombre: "Automática (máxima distinción)", base: null },
};
const hexAHsl = (hex) => {
  const n = parseInt(hex.slice(1), 16), r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0, sat = 0;
  if (d) {
    sat = d / (1 - Math.abs(2 * l - 1));
    h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return [h, sat * 100, l * 100];
};
const hslAHex = (h, sat, l) => {
  sat /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = sat * Math.min(l, 1 - l);
  const f = (n) => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, "0");
  return `#${f(0)}${f(8)}${f(4)}`.toUpperCase();
};
const esCafe = (h, sat, l) => h >= 10 && h <= 50 && l < 48 && sat > 15 && sat < 90;
export function generarColores(n, paleta) {
  const usados = new Set(), res = [];
  const base = PALETAS[paleta]?.base;
  const ajustes = [0, -16, 14, -28, 24, -8, 8, -22, 20];
  for (let i = 0; i < n; i++) {
    let h, sat, l;
    if (!base) { h = (i * 137.508) % 360; if (h >= 15 && h <= 45) h = (h + 40) % 360; sat = 62 + (i % 3) * 12; l = 48 + ((i >> 1) % 3) * 9; }
    else {
      [h, sat, l] = hexAHsl(base[i % base.length]);
      const ronda = Math.floor(i / base.length);
      l = Math.max(28, Math.min(86, l + ajustes[ronda % ajustes.length]));
      h = (h + Math.floor(ronda / ajustes.length) * 11) % 360;
    }
    if (esCafe(h, sat, l)) l = 62;
    let hex = hslAHex(h, sat, l), intento = 0;
    while (usados.has(hex) && intento++ < 40) {
      const l2 = Math.max(30, Math.min(88, l + (intento % 2 ? 1 : -1) * 3 * intento)), h2 = (h + intento * 9) % 360, s2 = Math.max(sat, 30);
      hex = hslAHex(h2, s2, esCafe(h2, s2, l2) ? 62 : l2);
    }
    usados.add(hex); res.push(hex);
  }
  return res;
}

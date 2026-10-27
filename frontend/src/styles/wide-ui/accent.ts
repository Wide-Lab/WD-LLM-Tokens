// Cópia tipada de wide-ui/integrations/accent.js (pacote em
// ~/.claude/plugins/marketplaces/widelab/design-systems/wide-ui). A lógica é idêntica à do pacote:
// só ganhou tipos. Não mude conta nem valor aqui — muda no pacote e copia de novo.

// wide-ui accent: turns one brand or tenant color into the accent variables, keeping text at 4.5:1.

// Must match --wu-surface in tokens.css (light and dark); check.mjs asserts it.
export const SURFACE_LIGHT = "#FFFFFF";
export const SURFACE_DARK = "#17171A";

const hex2rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rgb2hex = (c: number[]) =>
  "#" +
  c
    .map((v) =>
      Math.round(Math.max(0, Math.min(255, v)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");

function lum(hex: string) {
  const [r, g, b] = hex2rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

function mix(a: string, b: string, t: number) {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return rgb2hex(A.map((v, i) => v + (B[i] - v) * t));
}

// Darkens (light theme) or lightens (dark theme) the accent until it reads at 4.5:1 on the surface.
export function ink(accent: string, surface: string, dark: boolean) {
  const target = dark ? "#ffffff" : "#000000";
  for (let t = 0; t <= 1; t += 0.04) {
    const c = mix(accent, target, t);
    if (contrast(c, surface) >= 4.5) return c;
  }
  return target;
}

// Text color on an accent fill (buttons, logo tile).
export function textOn(accent: string) {
  return contrast(accent, "#ffffff") >= 4.5 ? "#ffffff" : "#111111";
}

// Call at boot and whenever the tenant (or its color) changes.
export function applyAccent(accent: string, root: HTMLElement = document.documentElement) {
  const s = root.style;
  s.setProperty("--wu-brand", accent);
  s.setProperty("--wu-on-brand", textOn(accent));
  s.setProperty("--wu-brand-ink-light", ink(accent, SURFACE_LIGHT, false));
  s.setProperty("--wu-brand-ink-dark", ink(accent, SURFACE_DARK, true));
}

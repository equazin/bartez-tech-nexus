// Genera src/tema/variables.css desde src/tema/tokens.json (los tokens de Teqo, Prisma × Central).
// Tailwind en este repo usa `hsl(var(--x))`, así que cada color se escribe como "H S% L%".
// Correr con `npm run tema`. No editar variables.css a mano.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const tokens = JSON.parse(readFileSync(join(raiz, "src/tema/tokens.json"), "utf8"));

const semanticos = Object.fromEntries(tokens.color.semanticos.map((t) => [t.name, t]));
const familias = Object.fromEntries(tokens.type.familias.map((f) => [f.name, f]));
const pesos = Object.fromEntries(tokens.type.pesos.map((p) => [p.name, p]));

function hexARgb(hex) {
  const limpio = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(limpio.slice(i, i + 2), 16) / 255);
}

function rgbAHex([r, g, b]) {
  return "#" + [r, g, b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("");
}

function mezclar(hexA, hexB, proporcionDeB) {
  const a = hexARgb(hexA);
  const b = hexARgb(hexB);
  return rgbAHex(a.map((v, i) => v + (b[i] - v) * proporcionDeB));
}

function hexAHsl(hex) {
  const [r, g, b] = hexARgb(hex);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${(l * 100).toFixed(1)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return `${Math.round(h * 60)} ${(s * 100).toFixed(1)}% ${(l * 100).toFixed(1)}%`;
}

function paleta(tema) {
  const v = (nombre) => semanticos[nombre][tema];
  const oscuro = tokens.temas.lista.find((t) => t.id === tema).colorScheme === "dark";
  const sobreClaro = v("texto-placa");
  const sobreOscuro = "#FFFFFF";
  const acento = v("acento");
  return {
    background: v("fondo"),
    foreground: v("texto"),
    card: v("superficie"),
    "card-foreground": v("texto"),
    popover: v("superficie"),
    "popover-foreground": v("texto"),
    primary: acento,
    "primary-foreground": v("sobre-acento"),
    "primary-hover": v("acento-hover"),
    secondary: v("superficie-2"),
    "secondary-foreground": v("texto"),
    muted: v("superficie-2"),
    "muted-foreground": v("texto-secundario"),
    accent: v("superficie-3"),
    "accent-foreground": v("texto"),
    destructive: v("error"),
    "destructive-foreground": oscuro ? sobreClaro : sobreOscuro,
    border: v("borde"),
    input: v("borde-control"),
    ring: v("foco"),
    "sidebar-background": v("fondo"),
    "sidebar-foreground": v("texto-secundario"),
    "sidebar-primary": acento,
    "sidebar-primary-foreground": v("sobre-acento"),
    "sidebar-accent": v("superficie-2"),
    "sidebar-accent-foreground": v("texto"),
    "sidebar-border": v("borde"),
    "sidebar-ring": v("foco"),
    glow: v("superficie-3"),
    surface: v("superficie"),
    "surface-elevated": v("superficie-2"),
    "surface-1": v("superficie"),
    "surface-2": v("superficie-2"),
    "surface-3": v("superficie-3"),
    "gradient-start": acento,
    "gradient-end": v("acento-hover"),
    glass: v("superficie"),
    "glass-border": v("borde"),
    brand: acento,
    "brand-foreground": v("sobre-acento"),
    "brand-50": mezclar(acento, "#FFFFFF", 0.92),
    "brand-100": mezclar(acento, "#FFFFFF", 0.84),
    "brand-200": mezclar(acento, "#FFFFFF", 0.7),
    "brand-500": acento,
    "brand-600": v("acento-hover"),
    "brand-700": mezclar(acento, "#000000", 0.3),
    "brand-900": mezclar(acento, "#000000", 0.55),
    success: v("exito"),
    "success-foreground": oscuro ? sobreClaro : sobreOscuro,
    warning: v("aviso"),
    "warning-foreground": oscuro ? sobreClaro : sobreOscuro,
    danger: v("error"),
    "danger-foreground": oscuro ? sobreClaro : sobreOscuro,
    info: v("texto-secundario"),
    "info-foreground": v("fondo"),
    "placa-foto": v("placa-foto"),
    "placa-foto-2": v("placa-foto-2"),
    "texto-placa": v("texto-placa"),
    "foco-placa": v("foco-placa"),
    "exito-fondo": v("exito-fondo"),
    "error-fondo": v("error-fondo"),
  };
}

/** `tema` pone las fuentes y los pesos; `temaDeColores` (por defecto el mismo) pone los colores. */
function bloque(selector, tema, temaDeColores = tema) {
  const colores = paleta(temaDeColores);
  const oscuro = tokens.temas.lista.find((t) => t.id === temaDeColores).colorScheme === "dark";
  const lineas = [
    `${selector} {`,
    `  color-scheme: ${oscuro ? "dark" : "light"};`,
    ...Object.entries(colores).map(([nombre, hex]) => `  --${nombre}: ${hexAHsl(hex)};`),
    `  --fuente-texto: ${familias.texto[tema]};`,
    `  --fuente-titular: ${familias.titular[tema]};`,
    `  --peso-regular: ${pesos.regular[tema]};`,
    `  --peso-medio: ${pesos.medio[tema]};`,
    `  --peso-negrita: ${pesos.negrita[tema]};`,
    `  --peso-destacado: ${pesos.destacado[tema]};`,
    `  --peso-rotulo: ${pesos.rotulo[tema]};`,
    `}`,
  ];
  return lineas.join("\n");
}

const radios = Object.fromEntries(tokens.radius.tokens.map((r) => [r.name, r.value]));

const salida = [
  "/* Generado por scripts/generar-tema.mjs desde src/tema/tokens.json (tokens de Teqo). No editar a mano: correr `npm run tema`. */",
  "",
  "/* Claro: la identidad Prisma × Central sobre blanco. Es el tema de la tienda desde el 3/11/2026 (maqueta A),",
  "   vale con la clase .dark o .light que pone el tema del panel. */",
  bloque(':root, .light, .dark, [data-tema="claro"]', "claro"),
  "",
  "/* Nocturno × Prisma: el oscuro anterior. Queda para bloques sobre grafito (el pie) con data-tema=\"nocturno\". */",
  bloque('[data-tema="nocturno"]', "nocturno"),
  "",
  "/* Panel: los colores de la tienda (claro) con DM Sans en todo. Con el modo oscuro del panel, los de Nocturno. */",
  bloque('[data-tema="panel"]', "panel", "claro"),
  "",
  bloque('.dark[data-tema="panel"], .dark [data-tema="panel"]', "panel"),
  "",
  ":root {",
  `  --radius: ${radios["radius-md"]};`,
  `  --radius-chico: ${radios["radius-sm"]};`,
  `  --radius-tarjeta: ${radios["radius-lg"]};`,
  `  --radius-chip: ${radios["radius-full"]};`,
  ...tokens.spacing.tokens.map((s) => `  --${s.name}: ${s.value};`),
  "}",
  "",
].join("\n");

writeFileSync(join(raiz, "src/tema/variables.css"), salida);
console.log("src/tema/variables.css generado.");

/**
 * Genera los iconos PNG de la aplicación a partir de un dibujo vectorial.
 *
 * Chrome solo ofrece "Instalar" si el manifiesto trae iconos PNG reales de
 * 192 y 512 px; un icono SVG incrustado como data: no le sirve. iPhone, por su
 * parte, solo lee apple-touch-icon.png. Por eso los iconos se generan una vez
 * aquí y quedan versionados en el repositorio como archivos.
 *
 *   node iconos/generar.mjs iconos
 */
import fs from 'node:fs';
import path from 'node:path';

// Playwright no es dependencia de la aplicación: solo hace falta el día que se
// quiera rediseñar el icono. Si no está instalado: npm i -g playwright
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const destino = process.argv[2] ?? new URL('.', import.meta.url).pathname;
fs.mkdirSync(destino, { recursive: true });

const AZUL = '#1e5aa8', AZUL_OSCURO = '#15447f';

/** Camioneta: el mismo trazo que usa la cabecera de la aplicación. */
const GLIFO = `<path d="M14 17H6V5h11l4 6v6h-3"/>
  <circle cx="17.5" cy="17.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/>`;

/**
 * @param size   lado en píxeles
 * @param radio  radio de las esquinas, 0 = cuadrado a sangre
 * @param ocupa  fracción del lado que ocupa el dibujo (la zona segura de un
 *               icono con máscara es el 80 % central, de ahí el 0.5 de abajo)
 */
function svg(size, radio, ocupa) {
  const ancho = 19;                       // ancho del glifo dentro del lienzo de 24
  const k = (size * ocupa) / ancho;
  const tx = size / 2 - 12.5 * k, ty = size / 2 - 12.5 * k;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${AZUL}"/><stop offset="1" stop-color="${AZUL_OSCURO}"/>
    </linearGradient></defs>
    <rect width="${size}" height="${size}" rx="${radio}" fill="url(#g)"/>
    <g transform="translate(${tx} ${ty}) scale(${k})" fill="none" stroke="#fff"
       stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${GLIFO}</g>
  </svg>`;
}

const PIEZAS = [
  { archivo: 'icono-192.png',         size: 192, radio: 38,  ocupa: 0.60 },
  { archivo: 'icono-512.png',         size: 512, radio: 102, ocupa: 0.60 },
  { archivo: 'icono-mascara-192.png', size: 192, radio: 0,   ocupa: 0.50 },
  { archivo: 'icono-mascara-512.png', size: 512, radio: 0,   ocupa: 0.50 },
  { archivo: 'apple-touch-icon.png',  size: 180, radio: 0,   ocupa: 0.58 },
  { archivo: 'favicon-32.png',        size: 32,  radio: 6,   ocupa: 0.64 },
  { archivo: 'favicon-16.png',        size: 16,  radio: 3,   ocupa: 0.68 },
];

const navegador = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const pag = await navegador.newPage({ deviceScaleFactor: 1 });

for (const p of PIEZAS) {
  await pag.setViewportSize({ width: p.size, height: p.size });
  await pag.setContent(`<body style="margin:0">${svg(p.size, p.radio, p.ocupa)}</body>`);
  // Esquinas transparentes: sobre un fondo oscuro del teléfono, unas esquinas
  // blancas delatarían el recuadro del icono.
  const png = await pag.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: p.size, height: p.size } });
  fs.writeFileSync(path.join(destino, p.archivo), png);
  console.log(`  ${p.archivo.padEnd(24)} ${p.size}x${p.size}  ${png.length} bytes`);
}

await navegador.close();

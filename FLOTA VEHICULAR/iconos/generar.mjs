/**
 * Genera los iconos de la aplicación a partir del logotipo de la marca.
 *
 * La fuente es `logo-original.png`, el logotipo tal como lo entregó diseño:
 * cuadro azul con la marca de PascalIA —quien desarrolla— arriba, el emblema
 * en el centro y la palabra FLOTA abajo.
 *
 * De ahí salen tres recortes, y cada icono usa el que le sirve:
 *
 *   COMPLETO  el logotipo entero, con la marca de PascalIA. Es el que se usa
 *             en el icono normal, que es el que se ve en el cuadro de
 *             instalación, en la lista de aplicaciones abiertas y en el
 *             escritorio de iPhone.
 *   EMBLEMA   solo el emblema. Va en los iconos CON MÁSCARA y en los del
 *             navegador, y no es una preferencia: Android recorta el icono
 *             con máscara en un círculo, de modo que con el logotipo entero
 *             la banda de PascalIA y la palabra FLOTA quedarían cortadas por
 *             la mitad. En un favicon de 16 px no se leería ninguna letra.
 *   PASCALIA  la marca de PascalIA sola, sobre blanco, para el crédito que
 *             lleva la pantalla de ingreso, que es donde sí se lee.
 *
 * Chrome solo ofrece "Instalar" si el manifiesto trae iconos PNG reales de
 * 192 y 512 px; iPhone, por su parte, solo lee apple-touch-icon.png. Por eso
 * todo esto se genera una vez aquí y queda versionado como archivos.
 *
 *   node iconos/generar.mjs iconos
 *
 * Si cambia el logotipo se reemplaza `logo-original.png`, se revisan las
 * medidas de los recortes y se vuelve a ejecutar.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright no es dependencia de la aplicación: solo hace falta el día que se
// quiera rediseñar el icono. Si no está instalado: npm i -g playwright
const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

// fileURLToPath y no .pathname: la carpeta se llama "FLOTA VEHICULAR", con
// espacio, y en la URL viene como %20.
const AQUI = fileURLToPath(new URL('.', import.meta.url));
const destino = process.argv[2] ?? AQUI;
fs.mkdirSync(destino, { recursive: true });

const FUENTE = path.join(AQUI, 'logo-original.png');
const AZUL = '#0c2858';            // el azul exacto del logotipo
const LIENZO = 800;                // lado del logotipo original

/** Recortes medidos sobre el logotipo de 800 × 800. */
// El cuadro azul no llega a los bordes de arriba y de abajo: deja cinco
// píxeles blancos que, a sangre, se verían como una raya.
const COMPLETO = { x: 0, y: 5, ancho: 800, alto: 790 };
const EMBLEMA = { x: 189, y: 184, ancho: 458, alto: 403 };
const PASCALIA = { x: 174, y: 3, ancho: 454, alto: 120 };

const b64 = fs.readFileSync(FUENTE).toString('base64');

/**
 * Compone un icono cuadrado.
 *
 * @param size   lado en píxeles
 * @param radio  radio de las esquinas, 0 = cuadrado a sangre
 * @param corte  recorte del logotipo que se va a usar
 * @param ocupa  fracción del lado que ocupa el recorte; 1 = a sangre. La zona
 *               segura de un icono con máscara es el 80 % central, de ahí 0.58.
 */
function pagina(size, radio, corte, ocupa) {
  const aSangre = ocupa >= 1;
  // A sangre se estira el recorte al cuadrado (son 790 × 800: un 1 % que no se
  // nota); si no, se escala por el ancho y se centra sobre el azul.
  const k = aSangre ? size / corte.ancho : (size * ocupa) / corte.ancho;
  const w = aSangre ? size : corte.ancho * k;
  const h = aSangre ? size : corte.alto * k;
  const ky = aSangre ? size / corte.alto : k;
  return `<body style="margin:0">
    <div style="width:${size}px;height:${size}px;border-radius:${radio}px;
                background:${AZUL};overflow:hidden;position:relative">
      <div style="position:absolute;left:${(size - w) / 2}px;top:${(size - h) / 2}px;
                  width:${w}px;height:${h}px;overflow:hidden">
        <img src="data:image/png;base64,${b64}"
             style="position:absolute;width:${LIENZO * k}px;height:${LIENZO * ky}px;
                    left:${-corte.x * k}px;top:${-corte.y * ky}px">
      </div>
    </div>
  </body>`;
}

const PIEZAS = [
  // Icono normal: el logotipo entero, PascalIA incluido.
  { archivo: 'icono-192.png',         size: 192, radio: 38,  corte: COMPLETO, ocupa: 1 },
  { archivo: 'icono-512.png',         size: 512, radio: 102, corte: COMPLETO, ocupa: 1 },
  { archivo: 'apple-touch-icon.png',  size: 180, radio: 0,   corte: COMPLETO, ocupa: 1 },
  // Con máscara: Android lo recorta en círculo, así que solo el emblema.
  { archivo: 'icono-mascara-192.png', size: 192, radio: 0,   corte: EMBLEMA,  ocupa: 0.58 },
  { archivo: 'icono-mascara-512.png', size: 512, radio: 0,   corte: EMBLEMA,  ocupa: 0.58 },
  // Dentro de la aplicación el logotipo se ve a 28 px en la cabecera: ahí solo
  // cabe el emblema. La marca de PascalIA va completa, y legible, en el crédito
  // del pie de la pantalla de ingreso.
  { archivo: 'marca.png',             size: 192, radio: 38,  corte: EMBLEMA,  ocupa: 0.74 },
  // Navegador: a 16 px no cabe ni una letra.
  { archivo: 'favicon-32.png',        size: 32,  radio: 6,   corte: EMBLEMA,  ocupa: 0.80 },
  { archivo: 'favicon-16.png',        size: 16,  radio: 3,   corte: EMBLEMA,  ocupa: 0.86 },
];

const navegador = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const pag = await navegador.newPage({ deviceScaleFactor: 1 });

for (const p of PIEZAS) {
  await pag.setViewportSize({ width: p.size, height: p.size });
  await pag.setContent(pagina(p.size, p.radio, p.corte, p.ocupa));
  await pag.waitForLoadState('load');
  // Esquinas transparentes: sobre el fondo oscuro de un teléfono, unas esquinas
  // blancas delatarían el recuadro del icono.
  const png = await pag.screenshot({ omitBackground: true,
    clip: { x: 0, y: 0, width: p.size, height: p.size } });
  fs.writeFileSync(path.join(destino, p.archivo), png);
  console.log(`  ${p.archivo.padEnd(24)} ${p.size}x${p.size}  ${png.length} bytes`);
}

// ── La marca de PascalIA suelta, para el crédito de la pantalla de ingreso ──
{
  const ESCALA = 2;                 // al doble, para que se vea nítida en pantallas finas
  const w = PASCALIA.ancho * ESCALA, h = PASCALIA.alto * ESCALA;
  await pag.setViewportSize({ width: w, height: h });
  await pag.setContent(`<body style="margin:0">
    <div style="width:${w}px;height:${h}px;overflow:hidden;position:relative;background:#fff">
      <img src="data:image/png;base64,${b64}"
           style="position:absolute;width:${LIENZO * ESCALA}px;
                  left:${-PASCALIA.x * ESCALA}px;top:${-PASCALIA.y * ESCALA}px">
    </div></body>`);
  await pag.waitForLoadState('load');
  const png = await pag.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
  fs.writeFileSync(path.join(destino, 'pascalia.png'), png);
  console.log(`  ${'pascalia.png'.padEnd(24)} ${w}x${h}  ${png.length} bytes`);
}

await navegador.close();

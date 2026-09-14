/**
 * Genera los iconos de la aplicación a partir del logotipo de la marca.
 *
 * REGLA: el logotipo NO SE TOCA. `logo-original.png` es el que entregó diseño
 * —cuadro azul, la muesca de «By PascalIA» arriba a la derecha, el emblema en
 * el centro y la palabra FLOTA abajo— y todos los iconos son ese mismo dibujo,
 * entero, sin recortar nada. Lo único que cambia es el tamaño.
 *
 * Dos cosas que sí hace este generador, y que no son cambiar el logotipo:
 *
 *   1. Redondea las esquinas al mismo radio que ya tiene el cuadro azul, para
 *      quitar el blanco que queda fuera. Sin eso, en el escritorio del teléfono
 *      se verían cuatro esquinas blancas alrededor del icono.
 *   2. Para el icono CON MÁSCARA mete el logotipo entero dentro de un cuadro
 *      azul más grande. Android recorta ese icono en un círculo, y la zona
 *      segura es el 80 % central: un cuadrado que quepa entero ahí mide el
 *      56 % del lado. Así el círculo corta azul y NO corta el logotipo. Si se
 *      pusiera a tamaño completo, Android le comería la muesca de PascalIA y
 *      la palabra FLOTA.
 *
 * Aparte va `pascalia.png`, la firma del pie de cada pantalla. Esa no sale del
 * logotipo de FLOTA sino de `pascalia-fuente.png`, que es la marca de PascalIA
 * en horizontal, que es como se lee bien en una línea.
 *
 * Chrome solo ofrece "Instalar" si el manifiesto trae iconos PNG reales de
 * 192 y 512 px; iPhone, por su parte, solo lee apple-touch-icon.png. Por eso
 * todo esto se genera una vez aquí y queda versionado como archivos.
 *
 *   node iconos/generar.mjs iconos
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

const AZUL = '#0c2858';        // el azul exacto del logotipo
/**
 * Radio de las esquinas del cuadro azul, medido sobre el original: 100/800.
 * Se recorta un pelo por dentro (0.132) para que no sobreviva ni un píxel del
 * blanco que el original lleva por fuera de la curva.
 */
const RADIO = 0.132;
/** Lado del logotipo dentro del icono con máscara: 0.8 / √2, la zona segura. */
const EN_MASCARA = 0.56;

const logo = fs.readFileSync(path.join(AQUI, 'logo-original.png')).toString('base64');

/**
 * @param size    lado en píxeles
 * @param dentro  fracción del lado que ocupa el logotipo; 1 = a sangre
 * @param radio   radio de las esquinas del icono, en fracción del lado
 */
function pagina(size, dentro, radio) {
  const lado = size * dentro;
  return `<body style="margin:0">
    <div style="width:${size}px;height:${size}px;border-radius:${size * radio}px;
                background:${AZUL};overflow:hidden;display:flex;
                align-items:center;justify-content:center">
      <img src="data:image/png;base64,${logo}"
           style="width:${lado}px;height:${lado}px;display:block;
                  border-radius:${lado * RADIO}px">
    </div>
  </body>`;
}

const PIEZAS = [
  // El logotipo entero, a sangre. Es lo que se ve en el cuadro de instalación,
  // en la lista de aplicaciones abiertas y en el escritorio del iPhone.
  { archivo: 'icono-192.png',        size: 192, dentro: 1, radio: RADIO },
  { archivo: 'icono-512.png',        size: 512, dentro: 1, radio: RADIO },
  { archivo: 'apple-touch-icon.png', size: 180, dentro: 1, radio: 0 },
  // El que la aplicación muestra en el ingreso y en la cabecera.
  { archivo: 'marca.png',            size: 192, dentro: 1, radio: RADIO },
  // Los del navegador.
  { archivo: 'favicon-32.png',       size: 32,  dentro: 1, radio: RADIO },
  { archivo: 'favicon-16.png',       size: 16,  dentro: 1, radio: RADIO },
  // Con máscara: el logotipo entero, metido en la zona que Android no recorta.
  { archivo: 'icono-mascara-192.png', size: 192, dentro: EN_MASCARA, radio: 0 },
  { archivo: 'icono-mascara-512.png', size: 512, dentro: EN_MASCARA, radio: 0 },
];

const navegador = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const pag = await navegador.newPage({ deviceScaleFactor: 1 });

for (const p of PIEZAS) {
  await pag.setViewportSize({ width: p.size, height: p.size });
  await pag.setContent(pagina(p.size, p.dentro, p.radio));
  await pag.waitForLoadState('load');
  // Esquinas transparentes: sobre el fondo oscuro de un teléfono, unas esquinas
  // blancas delatarían el recuadro del icono.
  const png = await pag.screenshot({ omitBackground: true,
    clip: { x: 0, y: 0, width: p.size, height: p.size } });
  fs.writeFileSync(path.join(destino, p.archivo), png);
  console.log(`  ${p.archivo.padEnd(24)} ${p.size}x${p.size}  ${png.length} bytes`);
}

// ── La firma de PascalIA del pie, en horizontal ─────────────────────────────
{
  const FUENTE = { x: 174, y: 3, ancho: 454, alto: 120, lienzo: 800 };
  const ESCALA = 2;                 // al doble, para que se vea nítida
  const b64 = fs.readFileSync(path.join(AQUI, 'pascalia-fuente.png')).toString('base64');
  const w = FUENTE.ancho * ESCALA, h = FUENTE.alto * ESCALA;
  await pag.setViewportSize({ width: w, height: h });
  await pag.setContent(`<body style="margin:0">
    <div style="width:${w}px;height:${h}px;overflow:hidden;position:relative;background:#fff">
      <img src="data:image/png;base64,${b64}"
           style="position:absolute;width:${FUENTE.lienzo * ESCALA}px;
                  left:${-FUENTE.x * ESCALA}px;top:${-FUENTE.y * ESCALA}px">
    </div></body>`);
  await pag.waitForLoadState('load');
  const png = await pag.screenshot({ clip: { x: 0, y: 0, width: w, height: h } });
  fs.writeFileSync(path.join(destino, 'pascalia.png'), png);
  console.log(`  ${'pascalia.png'.padEnd(24)} ${w}x${h}  ${png.length} bytes`);
}

await navegador.close();

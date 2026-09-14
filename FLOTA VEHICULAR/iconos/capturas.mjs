/**
 * Genera las capturas que el manifiesto declara en `screenshots`.
 *
 * Son las que Android enseña en el cuadro grande de instalación: sin ellas
 * sale el cuadro pequeño y soso. Se toman contra el servidor de desarrollo,
 * con sus datos de ejemplo, nunca contra la base de producción.
 *
 *   node worker/pruebas/servidor_local.mjs &
 *   node iconos/capturas.mjs
 *
 * Las medidas deben coincidir con las que declara manifest.json; la prueba
 * worker/pruebas/prueba_pwa.mjs lo comprueba.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright');

const AQUI = fileURLToPath(new URL('.', import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8788/index.html';

// Hora de Colombia: el servidor siembra los datos del día operativo colombiano
// y el navegador pinta el día del reloj del equipo. Sin esto, de noche la
// captura sale con la programación del día siguiente, casi siempre vacía.
const COMUN = { locale: 'es-CO', timezoneId: 'America/Bogota', deviceScaleFactor: 1 };

const navegador = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

async function entrar(pag, usuario, clave) {
  await pag.goto(BASE, { waitUntil: 'networkidle' });
  await pag.fill('#in-usuario', usuario);
  await pag.fill('#in-clave', clave);
  await pag.click('#in-btn');
  await pag.waitForSelector('#app:not([hidden])');
  await pag.waitForTimeout(1500);
}

const TOMAS = [
  { archivo: 'pantalla-conductor.png', usuario: 'jnavarro', clave: 'Conductor2026',
    ctx: { ...COMUN, viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 ' +
                 '(KHTML, like Gecko) Chrome/126 Mobile Safari/537.36' } },
  { archivo: 'pantalla-itinerario.png', usuario: 'coordina', clave: 'Coordina2026',
    ctx: { ...COMUN, viewport: { width: 1280, height: 800 } } },
];

for (const t of TOMAS) {
  const ctx = await navegador.newContext(t.ctx);
  const pag = await ctx.newPage();
  await entrar(pag, t.usuario, t.clave);
  const destino = path.join(AQUI, t.archivo);
  await pag.screenshot({ path: destino });
  console.log(`  ${t.archivo.padEnd(26)} ${fs.statSync(destino).size} bytes`);
  await ctx.close();
}

await navegador.close();

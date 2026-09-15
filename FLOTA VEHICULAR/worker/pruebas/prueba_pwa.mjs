/**
 * Prueba de que la aplicación se puede INSTALAR en el teléfono y ABRIR SIN SEÑAL.
 *
 * Lo primero se revisa sobre los archivos: Chrome solo ofrece "Instalar" si el
 * manifiesto trae iconos PNG reales de 192 y 512 px, y iPhone solo entiende
 * apple-touch-icon.png. Un icono que falte, o cuyo tamaño no sea el declarado,
 * deja al conductor sin poder instalar y sin ningún mensaje de error.
 *
 * Lo segundo se revisa con un navegador de verdad: se abre la aplicación, se
 * espera a que el service worker quede activo, se corta la red y se recarga.
 * Si la pantalla de ingreso aparece igual, un conductor en una vereda sin
 * cobertura podrá abrirla.
 *
 *   node worker/pruebas/prueba_pwa.mjs
 *
 * Playwright no es dependencia de la aplicación. Si no está instalado la
 * prueba de navegador se salta y las de archivos se hacen igual.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(AQUI, '../..');            // carpeta FLOTA VEHICULAR
const PUERTO = 8791;
const BASE = `http://127.0.0.1:${PUERTO}`;

let fallos = 0, pruebas = 0;
function verificar(nombre, condicion, detalle) {
  pruebas++;
  if (condicion) return console.log(`  OK  ${nombre}`);
  fallos++;
  console.log(`  MAL ${nombre}${detalle ? ' — ' + detalle : ''}`);
}
const leer = rel => fs.readFileSync(path.join(APP, rel), 'utf8');
const existe = rel => fs.existsSync(path.join(APP, rel));

/** Lee ancho y alto de la cabecera IHDR de un PNG, sin librerías. */
function medidaPNG(rel) {
  const b = fs.readFileSync(path.join(APP, rel));
  const firma = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (!b.subarray(0, 8).equals(firma)) return null;         // no es PNG
  return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20), bytes: b.length };
}

console.log('\n══ Manifiesto e iconos ══');

const man = JSON.parse(leer('manifest.json'));

for (const campo of ['id', 'name', 'short_name', 'start_url', 'scope', 'display', 'icons']) {
  verificar(`el manifiesto declara ${campo}`, man[campo] != null);
}
verificar('se abre como aplicación, sin barra de direcciones', man.display === 'standalone');
verificar('el nombre corto cabe bajo el icono (≤ 12 caracteres)',
  man.short_name.length <= 12, man.short_name);
verificar('no remite a una aplicación de tienda', man.prefer_related_applications === false);

// Chrome exige PNG (o WebP/SVG servido como archivo): un icono incrustado como
// data: URI se acepta en el manifiesto pero deja la aplicación sin instalar.
verificar('ningún icono va incrustado como data:',
  !JSON.stringify(man).includes('data:image'));

const iconos = man.icons;
const dePropósito = p => iconos.filter(i => (i.purpose || 'any').split(' ').includes(p));
verificar('hay icono normal de 192 px', dePropósito('any').some(i => i.sizes === '192x192'));
verificar('hay icono normal de 512 px', dePropósito('any').some(i => i.sizes === '512x512'));
// A PROPÓSITO no hay icono con máscara. Android recorta esos iconos en un
// círculo, así que para que el círculo no se comiera la muesca de PascalIA ni
// la palabra FLOTA había que encoger el logotipo dentro de un cuadro azul: en
// el teléfono se veía pequeño en mitad del icono, y así se reportó. Sin icono
// con máscara, Android usa el normal y el logotipo sale entero y a su tamaño.
verificar('no se declara icono con máscara, que encogería el logotipo',
  dePropósito('maskable').length === 0);

// Todo lo que el manifiesto nombra —iconos, capturas y accesos directos— tiene
// que existir de verdad y medir lo que dice medir.
const referencias = [
  ...iconos.map(i => [i.src, i.sizes, 'icono']),
  ...(man.screenshots || []).map(c => [c.src, c.sizes, 'captura']),
  ...(man.shortcuts || []).flatMap(a => (a.icons || []).map(i => [i.src, i.sizes, 'acceso directo'])),
];
for (const [src, tam, que] of referencias) {
  if (!existe(src)) { verificar(`existe el ${que} ${src}`, false, 'no está en el repositorio'); continue; }
  const m = medidaPNG(src);
  if (!m) { verificar(`${src} es un PNG`, false, 'la cabecera no es de PNG'); continue; }
  const [a, l] = tam.split('x').map(Number);
  verificar(`${src} mide ${tam}`, m.ancho === a && m.alto === l, `mide ${m.ancho}x${m.alto}`);
}

// El QR del instructivo se imprime y se reparte: si apunta a otra parte, nadie
// lo nota hasta que un conductor no puede instalar nada.
verificar('el código QR del instructivo existe', existe('iconos/qr-instalacion.png'));
verificar('el instructivo enseña el QR',
  leer('INSTALAR_EN_EL_CELULAR.md').includes('iconos/qr-instalacion.png'));

verificar('los accesos directos apuntan a vistas que existen',
  (man.shortcuts || []).every(a => ['hoy', 'itinerario', 'dashboard', 'trayectos', 'eventos']
    .includes(new URL(a.url, 'http://x/').searchParams.get('ir'))));

console.log('\n══ Pantalla y service worker ══');

const html = leer('index.html');
verificar('la pantalla enlaza el manifiesto', /<link rel="manifest" href="manifest\.json">/.test(html));
verificar('iPhone encuentra su icono (apple-touch-icon)',
  /rel="apple-touch-icon" href="iconos\/apple-touch-icon\.png"/.test(html));
verificar('existe el archivo apple-touch-icon.png', medidaPNG('iconos/apple-touch-icon.png')?.ancho === 180);
verificar('iPhone la abre a pantalla completa',
  /name="apple-mobile-web-app-capable" content="yes"/.test(html));
verificar('el nombre bajo el icono en iPhone está definido',
  /name="apple-mobile-web-app-title"/.test(html));
verificar('el icono del navegador ya no es un dibujo incrustado',
  !/<link rel="icon" href="data:/.test(html));
verificar('la pantalla de ingreso muestra el logotipo',
  /<img class="marca-logo" src="iconos\/marca\.png"/.test(html));
// El crédito de quien desarrolla: en el icono la marca de PascalIA va, pero a
// 48 px no se lee; aquí sí. Si se cae, nadie lo echa en falta hasta que lo
// reclama quien lo hizo.
verificar('la pantalla de ingreso acredita a PascalIA',
  /<div class="credito">[\s\S]*?iconos\/pascalia\.png/.test(html));
verificar('existe la marca de PascalIA', existe('iconos/pascalia.png'));
// El pie va fuera de <main>, una sola vez: así sale en toda pantalla, incluidas
// las que se escriban mañana, sin que nadie tenga que acordarse de ponerlo.
verificar('la firma de PascalIA va en el pie de la aplicación',
  /<footer class="pie">[\s\S]*?iconos\/pascalia\.png/.test(html));
verificar('el pie está fuera de main, para que salga en todas las vistas',
  html.indexOf('<footer class="pie">') > html.indexOf('</main>'));
verificar('queda la marca de PascalIA en horizontal para la firma del pie',
  existe('iconos/pascalia-fuente.png'));
verificar('el logotipo sale dos veces: ingreso y cabecera',
  (html.match(/class="marca-logo"/g) || []).length === 2);
verificar('ya no queda el dibujo de la camioneta como logotipo',
  !/class="logo"[\s\S]{0,200}<svg/.test(html));
verificar('queda el logotipo original para poder regenerar los iconos',
  existe('iconos/logo-original.png'));
verificar('hay sitio para la franja de instalación', html.includes('id="barra-instalar"'));
verificar('hay sitio para el botón de instalar del ingreso', html.includes('id="instalar-ingreso"'));

const sw = leer('sw.js');
const CAJA = sw.match(/const CACHE = '([^']+)'/)[1];   // para no repetirla en la prueba
const enArmazon = sw.slice(sw.indexOf('const ARMAZON'), sw.indexOf('];', sw.indexOf('const ARMAZON')));
const listados = [...enArmazon.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
verificar('el service worker guarda algo para abrir sin señal', listados.length >= 8);
for (const rel of listados) {
  verificar(`el service worker guarda un archivo que existe: ${rel}`, existe(rel));
}
verificar('el service worker guarda los iconos del manifiesto',
  iconos.every(i => listados.includes(i.src)));
verificar('el service worker NUNCA cachea la API', sw.includes("url.pathname.startsWith('/api/')"));
verificar('el service worker atiende la petición de relevo', sw.includes("'saltar-espera'"));
verificar('solo una navegación cae en la pantalla guardada',
  sw.includes("e.request.mode === 'navigate'"));

const app = leer('app.js');
verificar('se intercepta el aviso de instalación de Android',
  app.includes("addEventListener('beforeinstallprompt'"));
verificar('se consulta el modo de presentación y el indicador de iOS',
  app.includes('display-mode:') && app.includes('navigator.standalone'));
verificar('hay instructivo a mano para iPhone', app.includes('Añadir a pantalla de inicio'));
verificar('se avisa cuando hay versión nueva', app.includes('ofrecerActualizacion'));
verificar('los accesos directos del icono llegan a su vista', app.includes('vistaPedida'));

// ── Prueba con navegador de verdad ──────────────────────────────────────────
let chromium = null;
try { ({ chromium } = await import(process.env.PLAYWRIGHT ?? 'playwright')); }
catch { console.log('\n(sin Playwright: se salta la prueba de navegador)'); }

if (chromium) {
  console.log('\n══ En un navegador de verdad ══');

  const servidor = spawn(process.execPath, [path.join(AQUI, 'servidor_local.mjs')],
    { cwd: APP, env: { ...process.env, PUERTO: String(PUERTO) }, stdio: 'ignore' });
  const esperar = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 40; i++) {
    try { await fetch(`${BASE}/api/salud`); break; } catch { await esperar(250); }
  }

  const nav = await chromium.launch(
    process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});

  const TEL_ANDROID = 'Mozilla/5.0 (Linux; Android 13; Pixel 6) AppleWebKit/537.36 ' +
    '(KHTML, like Gecko) Chrome/126 Mobile Safari/537.36';
  const TEL_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) ' +
    'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
  const movil = { viewport: { width: 412, height: 900 }, isMobile: true, hasTouch: true, locale: 'es-CO' };

  // 1 · El manifiesto y todo lo que nombra se sirven bien.
  {
    const ctx = await nav.newContext(movil);
    const pag = await ctx.newPage();
    const malas = [];
    pag.on('response', r => { if (!r.ok() && new URL(r.url()).origin === BASE) malas.push(`${r.status()} ${r.url()}`); });
    // Un error suelto al cargar aborta el resto del archivo: las funciones
    // sobreviven por izado, pero las constantes no, y la pantalla falla en
    // silencio. Ya pasó una vez con una constante usada antes de declararse.
    const errores = [];
    pag.on('pageerror', e => errores.push(e.message));
    await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    verificar('el código de la aplicación carga sin errores', errores.length === 0, errores[0]);

    const m = await pag.evaluate(async () => {
      const r = await fetch('manifest.json');
      return { estado: r.status, tipo: r.headers.get('content-type'), cuerpo: await r.json() };
    });
    verificar('el navegador descarga el manifiesto', m.estado === 200);
    verificar('el manifiesto que llega es el bueno', m.cuerpo.short_name === 'Flota HRNO');

    for (const i of m.cuerpo.icons) {
      const r = await pag.evaluate(async src => {
        const res = await fetch(src);
        return { estado: res.status, tipo: res.headers.get('content-type') };
      }, i.src);
      verificar(`se descarga ${i.src} como PNG`, r.estado === 200 && r.tipo === 'image/png', `${r.estado} ${r.tipo}`);
    }
    // Que la ruta esté escrita en el HTML no basta: una ruta mal puesta se ve
    // como un cuadrito roto y nadie lo nota hasta que lo ve un conductor.
    const logos = await pag.$$eval('.marca-logo',
      ns => ns.map(n => ({ src: n.getAttribute('src'), ancho: n.naturalWidth })));
    // Son dos: el del ingreso y el de la cabecera (este último aún oculto,
    // pero el navegador descarga igual las imágenes con display:none).
    verificar('los dos logotipos de la pantalla se descargan de verdad',
      logos.length === 2 && logos.every(l => l.ancho > 0), JSON.stringify(logos));

    // El logotipo va entero en el icono, y eso se mira en los píxeles. Se
    // comprueban las tres partes que un recorte se llevaría por delante: la
    // muesca blanca de «By PascalIA» arriba a la derecha, el emblema del centro
    // y la palabra FLOTA de abajo.
    const mirar = (src, puntos) => pag.evaluate(([ruta, pts]) => new Promise(listo => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const salida = {};
        for (const [nombre, fx, fy] of pts) {
          const d = g.getImageData(Math.round(im.width * fx), Math.round(im.height * fy), 1, 1).data;
          salida[nombre] = [d[0], d[1], d[2]];
        }
        listo(salida);
      };
      im.onerror = () => listo(null);
      im.src = ruta;
    }), [src, puntos]);

    const claro = c => c && c.every(v => v > 200);
    const azul = c => c && c[2] > c[0] + 30 && c[0] < 90;

    const t = await mirar('iconos/icono-512.png', [
      ['muesca', 0.88, 0.09], ['centro', 0.50, 0.42], ['fondo', 0.10, 0.09],
    ]);
    verificar('el icono conserva la muesca de By PascalIA', claro(t?.muesca), JSON.stringify(t));
    // La palabra FLOTA no se busca en un píxel suelto —caería entre dos letras—
    // sino contando cuánta tinta blanca hay en la franja donde va escrita.
    const tintaFlota = await pag.evaluate(() => new Promise(listo => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = im.width; c.height = im.height;
        const g = c.getContext('2d');
        g.drawImage(im, 0, 0);
        const x = Math.round(im.width * 0.15), an = Math.round(im.width * 0.70);
        const y = Math.round(im.height * 0.76), al = Math.round(im.height * 0.14);
        const d = g.getImageData(x, y, an, al).data;
        let claros = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 200 && d[i + 1] > 200 && d[i + 2] > 200) claros++;
        }
        listo(claros / (an * al));
      };
      im.onerror = () => listo(-1);
      im.src = 'iconos/icono-512.png';
    }));
    verificar('el icono conserva la palabra FLOTA',
      tintaFlota > 0.08, `blanco en la franja: ${(tintaFlota * 100).toFixed(1)} %`);
    verificar('el icono conserva el azul de la marca', azul(t?.fondo), JSON.stringify(t));

    // El logotipo llena el icono de borde a borde. Si algún día volviera a
    // encogerse dentro de un cuadro azul —que es lo que pasó con el icono con
    // máscara— la muesca dejaría de tocar la esquina y esto lo cazaría.
    // El punto se toma a media altura de la muesca y casi pegado al borde
    // derecho: por debajo de la curva de la esquina, donde el canto ya es recto.
    // Más arriba caería en la esquina redondeada, que es transparente.
    const esquina = await mirar('iconos/icono-512.png', [
      ['muescaBorde', 0.985, 0.16], ['bordeDerecho', 0.985, 0.50],
      ['centroAbajo', 0.50, 0.97], ['centroArriba', 0.50, 0.03],
    ]);
    verificar('la muesca de PascalIA llega hasta el borde, sin encoger el logotipo',
      claro(esquina?.muescaBorde), JSON.stringify(esquina));
    verificar('el logotipo llega al borde derecho, sin cuadro azul de relleno',
      azul(esquina?.bordeDerecho), JSON.stringify(esquina));
    verificar('el logotipo llena el icono de arriba abajo',
      azul(esquina?.centroArriba) && azul(esquina?.centroAbajo), JSON.stringify(esquina));

    verificar('ningún archivo de la aplicación falta', malas.length === 0, malas.join(', '));
    await ctx.close();
  }

  // 2 · Se instala el service worker y la aplicación abre SIN SEÑAL.
  {
    const ctx = await nav.newContext(movil);
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const activo = await pag.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    verificar('el service worker queda activo', activo);

    const guardados = await pag.evaluate(async caja => {
      const c = await caches.open(caja);
      return (await c.keys()).map(p => new URL(p.url).pathname);
    }, CAJA);
    verificar('quedó guardada la pantalla', guardados.some(p => p.endsWith('/index.html')));
    verificar('quedó guardado el código', guardados.some(p => p.endsWith('/app.js')));
    verificar('quedaron guardados los iconos', guardados.some(p => p.includes('/iconos/icono-512.png')));
    verificar('NO quedó guardado ningún dato de la API', !guardados.some(p => p.startsWith('/api/')));

    await ctx.setOffline(true);
    await pag.reload({ waitUntil: 'domcontentloaded' });
    await pag.waitForTimeout(600);
    verificar('sin señal la aplicación abre igual',
      await pag.locator('#in-usuario').isVisible());
    verificar('sin señal se ve el nombre de la aplicación',
      (await pag.title()).includes('Flota Vehicular'));
    await ctx.setOffline(false);
    await ctx.close();
  }

  // 2.1 · La firma de PascalIA se ve, y se ve en todas las pantallas.
  {
    const ctx = await nav.newContext(movil);
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const marcaCargada = async () => pag.evaluate(() => {
      const im = document.querySelector('.pie img, .credito img');
      return !!im && im.naturalWidth > 0;
    });
    verificar('el ingreso firma con la marca de PascalIA',
      await pag.locator('.credito img').isVisible() && await marcaCargada());

    await pag.fill('#in-usuario', 'jnavarro');
    await pag.fill('#in-clave', 'Conductor2026');
    await pag.click('#in-btn');
    await pag.waitForSelector('#app:not([hidden])');
    await pag.waitForTimeout(900);

    for (const vista of ['hoy', 'eventos']) {
      await pag.click(`#nav button[data-v="${vista}"]`);
      await pag.waitForTimeout(900);
      verificar(`la pantalla "${vista}" lleva la firma de PascalIA abajo`,
        await pag.locator('.pie img').isVisible() && await marcaCargada());
    }
    await ctx.close();
  }

  // 3 · El ofrecimiento de instalar y su instructivo, por sistema.
  for (const [sistema, agente, esperado] of [
    ['iPhone', TEL_IPHONE, 'Compartir'],
    ['Android', TEL_ANDROID, 'Instalar aplicación'],
  ]) {
    const ctx = await nav.newContext({ ...movil, userAgent: agente });
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const boton = pag.locator('#instalar-ingreso button');
    verificar(`en ${sistema} se ofrece instalar desde el ingreso`, await boton.isVisible());
    // El botón está dentro del formulario de ingreso: sin type="button" lo
    // enviaría y el navegador pediría el usuario en vez de explicar la instalación.
    verificar(`en ${sistema} el botón no envía el formulario de ingreso`,
      await boton.getAttribute('type') === 'button');
    // Si el botón enviara el formulario, el navegador marcaría el usuario
    // vacío como inválido y mostraría "rellene este campo" en vez de instalar.
    await pag.evaluate(() => {
      window.__pidioUsuario = false;
      document.querySelector('#in-usuario')
        .addEventListener('invalid', () => { window.__pidioUsuario = true; });
    });
    await boton.click();
    verificar(`en ${sistema} no se queda pidiendo el usuario`,
      await pag.evaluate(() => window.__pidioUsuario === false));
    const texto = await pag.locator('#modal-cpo').innerText();
    verificar(`en ${sistema} el instructivo es el suyo`, texto.includes(esperado), texto.slice(0, 60));
    await ctx.close();
  }

  // 3.1 · Ya instalada: no se vuelve a ofrecer la instalación.
  //
  // Chrome acepta el comando de emulación de display-mode pero no lo aplica
  // (matchMedia sigue diciendo que no), así que se simula lo que el sistema le
  // responde a una aplicación instalada: en Android, la consulta de modo de
  // presentación; en iPhone, navigator.standalone. Lo que se comprueba es
  // nuestra lógica, que es lo nuestro; lo que el navegador informe es suyo.
  for (const [caso, agente, simular] of [
    ['Android', TEL_ANDROID, () => {
      const real = window.matchMedia.bind(window);
      window.matchMedia = q => (q.includes('display-mode: standalone')
        ? { matches: true, media: q, addEventListener() {}, removeEventListener() {} }
        : real(q));
    }],
    ['iPhone', TEL_IPHONE, () => {
      Object.defineProperty(navigator, 'standalone', { value: true, configurable: true });
    }],
  ]) {
    const ctx = await nav.newContext({ ...movil, userAgent: agente });
    const pag = await ctx.newPage();
    await pag.addInitScript(simular);
    await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await pag.waitForTimeout(400);
    verificar(`en ${caso}, ya instalada, no insiste en instalarla`,
      await pag.locator('#instalar-ingreso button').count() === 0);
    await ctx.close();
  }

  // 3.2 · Un teléfono con «Sitio de escritorio» puesto sigue siendo un teléfono.
  //
  // Con esa opción Chrome quita la palabra Android del user agent. Pasó en un
  // teléfono de verdad: la marca de salida mostró el texto de computador en vez
  // de los dos pasos de Timemark, y el conductor se habría quedado sin saber
  // que la foto se toma en otra aplicación.
  {
    const ESCRITORIO = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    const ctx = await nav.newContext({ ...movil, userAgent: ESCRITORIO });
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await pag.fill('#in-usuario', 'jnavarro');
    await pag.fill('#in-clave', 'Conductor2026');
    await pag.click('#in-btn');
    await pag.waitForSelector('#app:not([hidden])');
    await pag.waitForTimeout(900);
    await pag.click('.btn-gigante');
    await pag.waitForSelector('#modal.on', { timeout: 8000 });
    await pag.waitForTimeout(600);
    const cuerpo = await pag.locator('#modal-cpo').innerText();
    verificar('con el user agent falseado sigue ofreciendo abrir Timemark',
      /1 · Abrir/.test(cuerpo), cuerpo.slice(0, 120).replace(/\n/g, ' | '));
    verificar('y no le habla al conductor del computador',
      !/Desde el computador/.test(cuerpo));
    await ctx.close();
  }

  // 3.3 · El permiso de ubicación: bloquearlo por error tiene salida.
  //
  // Una página web NO PUEDE volver a mostrar el cuadro del permiso cuando ya se
  // tocó "Bloquear": el navegador recuerda la respuesta. Lo que sí debe pasar es
  // que la aplicación lo detecte, lo explique, y que al arreglarlo en los
  // ajustes y volver a la aplicación la franja se quite sola.
  {
    const ORIGEN = BASE;
    const ctx = await nav.newContext(movil);
    await ctx.grantPermissions([], { origin: ORIGEN });        // bloqueado
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await pag.fill('#in-usuario', 'jnavarro');
    await pag.fill('#in-clave', 'Conductor2026');
    await pag.click('#in-btn');
    await pag.waitForSelector('#app:not([hidden])');
    await pag.waitForTimeout(1200);

    const franja = pag.locator('#gps-hoy');
    verificar('con la ubicación bloqueada se avisa en Mi día',
      /bloqueada/i.test(await franja.innerText()));
    verificar('y hay un botón para activarla',
      await franja.locator('button').count() === 1);

    await franja.locator('button').click();
    await pag.waitForSelector('#modal.on', { timeout: 8000 });
    await pag.waitForTimeout(400);
    const pasos = await pag.locator('#modal-cpo').innerText();
    verificar('el instructivo dice dónde tocar', /Permisos|Localización|Ubicación/i.test(pasos));
    verificar('y avisa que entre tanto la marca se guarda sin GPS',
      /sin GPS/i.test(pasos));

    // Dice "ya lo permití" sin haberlo hecho: no se le miente.
    await pag.locator('#modal-pie button:has-text("Ya lo permití")').click();
    await pag.waitForTimeout(700);
    verificar('si dice que ya lo permitió y sigue bloqueado, se le dice',
      /sigue bloqueada|Todavía figura/i.test(await pag.locator('#avisos').innerText()));

    // Ahora sí lo permite en los ajustes del teléfono y vuelve a la aplicación.
    await ctx.grantPermissions(['geolocation'], { origin: ORIGEN });
    await ctx.setGeolocation({ latitude: 8.0796, longitude: -73.2216 });
    await pag.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await pag.waitForTimeout(1200);
    verificar('al volver de los ajustes la franja roja se quita sola',
      (await franja.innerText()).trim() === '');
    await ctx.close();
  }

  // 3.4 · Con el permiso dado, la franja no estorba.
  {
    const ctx = await nav.newContext({ ...movil, permissions: ['geolocation'],
      geolocation: { latitude: 8.0796, longitude: -73.2216 } });
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await pag.fill('#in-usuario', 'jnavarro');
    await pag.fill('#in-clave', 'Conductor2026');
    await pag.click('#in-btn');
    await pag.waitForSelector('#app:not([hidden])');
    await pag.waitForTimeout(1200);
    verificar('con la ubicación permitida no se le recuerda nada en Mi día',
      (await pag.locator('#gps-hoy').innerText()).trim() === '');
    await pag.click('.btn-gigante');
    await pag.waitForSelector('#modal.on', { timeout: 8000 });
    await pag.waitForTimeout(500);
    verificar('pero en la marca sí se confirma que está permitida',
      /permitida/i.test(await pag.locator('#mk-gps').innerText()));
    await ctx.close();
  }

  // 4 · La versión nueva se avisa y NO entra sola.
  //
  // Es la parte más delicada: si una versión nueva se activara por su cuenta,
  // recargaría la pantalla en cualquier momento, y si el conductor estaba a
  // media marca de salida perdería el kilometraje y la foto. Y al revés, si no
  // se avisara, un teléfono podría quedarse meses con la versión vieja.
  {
    const ruta = path.join(APP, 'sw.js');
    const original = fs.readFileSync(ruta, 'utf8');
    try {
      const ctx = await nav.newContext(movil);
      const pag = await ctx.newPage();
      // Cuenta cuántas veces se ha cargado el documento en esta pestaña.
      await pag.addInitScript(() => {
        sessionStorage.setItem('__cargas',
          String(Number(sessionStorage.getItem('__cargas') || 0) + 1));
      });
      await pag.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
      await pag.evaluate(() => navigator.serviceWorker.ready);
      // Las franjas viven dentro de la aplicación, así que hay que entrar para
      // verlas; es donde el conductor pasa el día.
      await pag.fill('#in-usuario', 'jnavarro');
      await pag.fill('#in-clave', 'Conductor2026');
      await pag.click('#in-btn');
      await pag.waitForSelector('#app:not([hidden])');
      await pag.waitForTimeout(700);

      verificar('la primera visita NO se recarga sola',
        await pag.evaluate(() => sessionStorage.getItem('__cargas')) === '1');
      verificar('sin versión nueva no se avisa de nada',
        !(await pag.locator('#barra-nueva').isVisible()));

      // Sale una versión nueva: cambia el archivo del service worker.
      fs.writeFileSync(ruta, original + '\n// versión de prueba\n');
      await pag.evaluate(async () => (await navigator.serviceWorker.getRegistration()).update());
      await pag.waitForSelector('#barra-nueva.on', { timeout: 10000 });
      verificar('se avisa de la versión nueva', true);
      verificar('pero la pantalla sigue como estaba, sin recargarse',
        await pag.evaluate(() => sessionStorage.getItem('__cargas')) === '1');

      await pag.click('#btn-actualizar');
      await pag.waitForFunction(() => sessionStorage.getItem('__cargas') === '2', null, { timeout: 10000 })
        .then(() => verificar('al tocar Actualizar sí se recarga', true))
        .catch(() => verificar('al tocar Actualizar sí se recarga', false, 'no recargó'));
      await ctx.close();
    } finally {
      fs.writeFileSync(ruta, original);
    }
  }

  // 5 · Los accesos directos del icono llevan a su pantalla.
  {
    const ctx = await nav.newContext(movil);
    const pag = await ctx.newPage();
    await pag.goto(`${BASE}/index.html?ir=itinerario`, { waitUntil: 'networkidle' });
    await pag.fill('#in-usuario', 'jnavarro');
    await pag.fill('#in-clave', 'Conductor2026');
    await pag.click('#in-btn');
    await pag.waitForSelector('#app:not([hidden])');
    await pag.waitForTimeout(800);
    verificar('un acceso directo que el conductor no tiene no lo deja en blanco',
      await pag.locator('#nav button.on').innerText() === 'Mi día');

    await pag.goto(`${BASE}/index.html?ir=hoy`, { waitUntil: 'networkidle' });
    await pag.waitForSelector('#app:not([hidden])');
    await pag.waitForTimeout(800);
    verificar('el acceso directo "Mi día" abre en Mi día',
      await pag.locator('#nav button.on').innerText() === 'Mi día');
    await ctx.close();
  }

  await nav.close();
  servidor.kill();
}

console.log(`\n${pruebas - fallos}/${pruebas} comprobaciones correctas`);
if (fallos) { console.log(`${fallos} FALLO(S)`); process.exit(1); }

/**
 * Servidor de desarrollo: sirve la aplicación y corre el Worker real contra una
 * base SQLite en memoria con datos de ejemplo. Sirve para probar la interfaz sin
 * tocar Cloudflare.
 *
 *   node worker/pruebas/servidor_local.mjs        →  http://localhost:8788
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearD1 } from './d1_local.js';
import worker from '../src/index.js';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '../..');
const W = path.resolve(AQUI, '..');

const db = crearD1();
db.exec(fs.readFileSync(path.join(W, 'schema.sql'), 'utf8'));
db.exec(fs.readFileSync(path.join(W, 'seed_catalogos.sql'), 'utf8'));

const env = {
  DB: db,
  ORIGENES_PERMITIDOS: 'http://localhost:8788,http://127.0.0.1:8788',
  HORAS_SESION: '12',
  CLAVE_ADMIN_INICIAL: 'demo',
};

// ── Datos de ejemplo ────────────────────────────────────────────────────────
const hoy = new Date().toLocaleDateString('sv-SE');
const dia = n => new Date(Date.now() + n * 864e5).toLocaleDateString('sv-SE');
const ahora = () => new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

async function llamar(metodo, ruta, cuerpo, token) {
  const h = { 'Content-Type': 'application/json', Origin: 'http://localhost:8788' };
  if (token) h.Authorization = 'Bearer ' + token;
  const res = await worker.fetch(new Request('http://localhost:8788' + ruta, {
    method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  }), env);
  return res.json();
}

const CONDUCTORES = [
  ['RICHARD', 'MUÑOZ', 1, 'NSZ-387'], ['CARLOS ARLEY', 'ROCHA', 1, 'GET-197'],
  ['JEISON OMAR', 'NAVARRO', 1, 'GEU-665'], ['JEISON', 'MANDO', 3, 'THZ-855'],
  ['WENSESLAO', 'GUERRERO', 3, 'WDN-207'], ['ORANGEL', 'QUINTERO', 3, 'XPM-210'],
  ['EDGAR', 'REYES', 2, 'J0X-150'], ['JHONIED', 'CALDERÓN', 2, 'GUR-909'],
  ['FABIAN', 'ROPERO', 2, 'TFT-215'], ['JACID ANTONIO', 'MUÑOZ', 5, 'EXV-010'],
  ['SERGIO ANDRES', 'NAVARRO', 5, 'GES-629'], ['HEVER ANTONIO', 'PEREZ', 5, 'GUR-735'],
  ['LEONARDO', 'ROJAS', 1, 'THZ-921'],
];
const DESTINOS = ['CAPITANLARGO', 'LA SIERRA', 'HOYO PILÓN', 'SANTA INÉS', 'PLAYAS LINDAS',
  'CARTAGENITA', 'CASA BLANCA', 'CECILIA', 'ASERRÍO', 'TIERRA AZUL', 'LA LAGUNA', 'CAMPO ALEGRE'];

await llamar('POST', '/api/instalar', { clave_instalacion: 'demo', usuario: 'danilo', clave: 'Demo2026Clave' });
const tAdmin = (await llamar('POST', '/api/auth/login', { usuario: 'danilo', clave: 'Demo2026Clave' })).token;
await llamar('POST', '/api/auth/cambiar-clave',
  { clave_actual: 'Demo2026Clave', clave_nueva: 'Demo2026Clave' }, tAdmin).catch(() => {});

const idsPersona = [], idsVehiculo = [];
for (const [nom, ape, mun, placa] of CONDUCTORES) {
  const p = await llamar('POST', '/api/personas',
    { nombres: nom, apellidos: ape, municipio_id: mun, es_conductor: true,
      numero_doc: String(1090000000 + idsPersona.length * 7919), telefono: '31' + (10000000 + idsPersona.length * 131) },
    tAdmin);
  idsPersona.push(p.id);
  const v = await llamar('POST', '/api/vehiculos',
    { placa, tipo: 'camioneta', municipio_base_id: mun,
      propiedad: idsVehiculo.length % 3 === 0 ? 'propio' : 'contratista',
      contratista: idsVehiculo.length % 3 === 0 ? null : 'TRANSPORTES DEL CATATUMBO',
      valor_dia: 180000, km_actual: 140000 + idsVehiculo.length * 1200 },
    tAdmin);
  idsVehiculo.push(v.id);
  db.prepare(`INSERT INTO asignaciones (vehiculo_id, persona_id, rol, desde, creado_en)
              VALUES (?,?, 'conductor', ?, ?)`).bind(v.id, p.id, dia(-60), ahora()).run();
}

// Usuario conductor de demostración: el tercero (Jeison Omar Navarro)
await llamar('POST', '/api/usuarios',
  { usuario: 'jnavarro', clave: 'Conductor2026', rol: 'conductor', persona_id: idsPersona[2] }, tAdmin);
await llamar('POST', '/api/usuarios',
  { usuario: 'coordina', clave: 'Coordina2026', rol: 'coordinacion' }, tAdmin);

// En la demostración los usuarios ya "cambiaron" su clave, para no toparse con
// el aviso obligatorio en cada ingreso.
db.prepare('UPDATE usuarios SET debe_cambiar_clave = 0').run();

// Itinerario de las dos últimas semanas y la siguiente
let semilla = 7;
const azar = n => (semilla = (semilla * 1103515245 + 12345) % 2147483648) % n;
for (let d = -9; d <= 4; d++) {
  const f = dia(d);
  const findeSemana = [0, 6].includes(new Date(f + 'T12:00:00').getDay());
  for (let i = 0; i < idsVehiculo.length; i++) {
    if (findeSemana && azar(10) > 2) continue;
    if (azar(10) > 8) continue;
    const tipo = azar(10) < 2 ? 'disponible' : azar(10) < 3 ? 'vacunacion' : azar(10) < 4 ? 'jornada' : 'ebs';
    await llamar('POST', '/api/itinerario', {
      fecha: f, vehiculo_id: idsVehiculo[i], conductor_id: idsPersona[i],
      municipio_id: 1 + azar(4),
      destino_nombre: tipo === 'disponible' ? undefined : DESTINOS[azar(DESTINOS.length)],
      tipo_jornada: tipo,
    }, tAdmin).catch(() => {});
  }
}

// El conductor de la demostración siempre tiene programación hoy, para que las
// pruebas del ciclo de marcación no dependan del azar de la siembra.
db.prepare("DELETE FROM itinerarios WHERE fecha = ? AND vehiculo_id = ?")
  .bind(hoy, idsVehiculo[2]).run();
await llamar('POST', '/api/itinerario', {
  fecha: hoy, vehiculo_id: idsVehiculo[2], conductor_id: idsPersona[2],
  municipio_id: 1, destino_nombre: 'CAPITANLARGO', tipo_jornada: 'ebs',
}, tAdmin);

// Ejecución: trayectos cerrados en los días pasados
const its = db.prepare(
  "SELECT * FROM itinerarios WHERE fecha < ? AND tipo_jornada != 'disponible'").bind(hoy).all().results || [];
for (const it of its) {
  if (azar(10) > 7) continue;                     // algunos días no se ejecutaron
  const salida = it.fecha + 'T' + String(6 + azar(3)).padStart(2, '0') + ':' + String(azar(60)).padStart(2, '0') + ':00Z';
  const llegada = it.fecha + 'T' + String(14 + azar(4)).padStart(2, '0') + ':' + String(azar(60)).padStart(2, '0') + ':00Z';
  const km = 140000 + azar(5000);
  db.prepare(`INSERT INTO trayectos (consecutivo, itinerario_id, vehiculo_id, conductor_id,
      fecha_operacion, municipio_salida_id, lugar_salida, ts_salida, origen_salida,
      lat_salida, lon_salida, precision_salida, municipio_llegada_id, lugar_llegada,
      ts_llegada, origen_llegada, lat_llegada, lon_llegada, precision_llegada,
      km_inicial, km_final, estado, creado_por, creado_en, cerrado_en)
    VALUES (?,?,?,?,?,?, 'BASE', ?, ?, 8.07, -73.22, ?, ?, ?, ?, ?, 8.15, -73.19, ?, ?, ?, 'cerrado', 1, ?, ?)`)
    .bind('TR-2026-' + String(100000 + it.id).slice(1), it.id, it.vehiculo_id, it.conductor_id,
      it.fecha, it.municipio_id, salida, azar(10) < 8 ? 'en_linea' : 'offline_sincronizado',
      10 + azar(40), it.municipio_id, 'DESTINO', llegada,
      azar(10) < 8 ? 'en_linea' : 'offline_sincronizado', 15 + azar(60),
      km, km + 30 + azar(80), ahora(), ahora()).run();
}
// Recalcular los días a partir de lo sembrado
const { recalcularDia } = await import('../src/lib.js');
for (const f of [...new Set(its.map(i => i.fecha))]) {
  for (const v of idsVehiculo) await recalcularDia(db, f, v);
}

// Algunas novedades
for (const [tipo, grav, desc] of [
  ['reten', 'media', 'Retén en la vía a Santa Inés, demora de 40 minutos.'],
  ['varada', 'alta', 'Se pinchó una llanta en el kilómetro 12.'],
  ['bloqueo_via', 'alta', 'Derrumbe parcial, se pasó con precaución.'],
]) {
  await llamar('POST', '/api/eventos', {
    tipo, gravedad: grav, descripcion: desc, municipio_id: 1,
    vehiculo_id: idsVehiculo[azar(idsVehiculo.length)],
  }, tAdmin);
}

// ── Servidor ────────────────────────────────────────────────────────────────
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.css': 'text/css; charset=utf-8' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost:8788');

  if (url.pathname.startsWith('/api/')) {
    const trozos = [];
    for await (const t of req) trozos.push(t);
    const r = await worker.fetch(new Request('http://localhost:8788' + req.url, {
      method: req.method, headers: req.headers,
      body: trozos.length ? Buffer.concat(trozos) : undefined,
    }), env);
    res.writeHead(r.status, Object.fromEntries(r.headers));
    return res.end(await r.text());
  }

  const archivo = path.join(RAIZ, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
    res.writeHead(404); return res.end('no encontrado');
  }
  res.writeHead(200, { 'Content-Type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
  res.end(fs.readFileSync(archivo));
}).listen(8788, () => {
  const n = db.prepare('SELECT COUNT(*) AS n FROM itinerarios').first().n;
  const t = db.prepare('SELECT COUNT(*) AS n FROM trayectos').first().n;
  console.log(`listo en http://localhost:8788  ·  ${n} itinerarios, ${t} trayectos`);
  console.log('usuarios: danilo/Demo2026Clave · coordina/Coordina2026 · jnavarro/Conductor2026');
});

/**
 * Prueba de extremo a extremo de la API de Flota HRNO.
 * Ejecuta el Worker real contra una base SQLite en memoria y recorre el flujo
 * completo: instalar, ingresar, crear usuarios de los tres roles, adjudicar un
 * desplazamiento, marcar salida y llegada, checklist y dashboard.
 *
 *   node pruebas/prueba_api.mjs
 */
import fs from 'node:fs';
import { crearD1 } from './d1_local.js';
import worker from '../src/index.js';

const db = crearD1();
const esquema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const semilla = fs.readFileSync(new URL('../seed_catalogos.sql', import.meta.url), 'utf8');
db.exec(esquema);
db.exec(semilla);

const env = {
  DB: db,
  ORIGENES_PERMITIDOS: 'https://danto0702.github.io',
  HORAS_SESION: '12',
  CLAVE_ADMIN_INICIAL: 'InstalacionHRNO2026',
};

let fallos = 0, pruebas = 0;

async function api(metodo, ruta, cuerpo, token) {
  const cabeceras = { 'Content-Type': 'application/json', Origin: 'https://danto0702.github.io' };
  if (token) cabeceras.Authorization = `Bearer ${token}`;
  const req = new Request('https://flota.test' + ruta, {
    method: metodo, headers: cabeceras,
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const res = await worker.fetch(req, env);
  return { estado: res.status, datos: await res.json() };
}

function verificar(nombre, condicion, detalle) {
  pruebas++;
  if (condicion) { console.log(`  ✓ ${nombre}`); }
  else { fallos++; console.log(`  ✗ ${nombre}`, detalle !== undefined ? JSON.stringify(detalle) : ''); }
}

const hoy = new Date().toISOString().slice(0, 10);

console.log('\n── Salud e instalación ───────────────────────────────────────');
let r = await api('GET', '/api/salud');
verificar('la sonda de salud responde', r.estado === 200 && r.datos.ok, r.datos);
verificar('hay rutas registradas', r.datos.rutas > 30, r.datos.rutas);

r = await api('POST', '/api/instalar', { clave_instalacion: 'equivocada' });
verificar('instalar rechaza la clave incorrecta', r.estado === 403, r.datos);

r = await api('POST', '/api/instalar', {
  clave_instalacion: 'InstalacionHRNO2026', usuario: 'danilo', clave: 'ClaveInicial2026',
});
verificar('instala el primer usuario principal', r.estado === 200 && r.datos.ok, r.datos);

r = await api('POST', '/api/instalar', { clave_instalacion: 'InstalacionHRNO2026' });
verificar('instalar queda cerrado para siempre', r.estado === 409, r.datos);

console.log('\n── Autenticación ─────────────────────────────────────────────');
r = await api('POST', '/api/auth/login', { usuario: 'danilo', clave: 'incorrecta' });
verificar('rechaza clave incorrecta', r.estado === 401, r.datos);

r = await api('POST', '/api/auth/login', { usuario: 'fantasma', clave: 'loquesea' });
verificar('no revela si el usuario existe', r.estado === 401, r.datos);

r = await api('POST', '/api/auth/login', { usuario: 'danilo', clave: 'ClaveInicial2026' });
verificar('ingresa el usuario principal', r.estado === 200 && !!r.datos.token, r.datos);
verificar('exige cambio de clave inicial', r.datos.usuario.debe_cambiar_clave === true);
const tokenPrincipal = r.datos.token;

r = await api('GET', '/api/vehiculos');
verificar('sin token la API responde 401', r.estado === 401, r.datos);

console.log('\n── Usuarios y roles ──────────────────────────────────────────');
r = await api('POST', '/api/personas', {
  nombres: 'JEISON OMAR', apellidos: 'NAVARRO', numero_doc: '1091665252',
  telefono: '3206167920', municipio_id: 1, es_conductor: true,
}, tokenPrincipal);
verificar('crea una persona conductora', r.estado === 200 && r.datos.id, r.datos);
const personaConductor = r.datos.id;

r = await api('POST', '/api/usuarios', {
  usuario: 'coordina', clave: 'Coordinacion2026', rol: 'coordinacion',
}, tokenPrincipal);
verificar('el principal crea un usuario de coordinación', r.estado === 200, r.datos);

r = await api('POST', '/api/usuarios', {
  usuario: 'jnavarro', clave: 'Conductor2026', rol: 'conductor', persona_id: personaConductor,
}, tokenPrincipal);
verificar('el principal crea un usuario conductor', r.estado === 200, r.datos);

r = await api('POST', '/api/usuarios', { usuario: 'x', clave: 'Clave123456', rol: 'inventado' },
              tokenPrincipal);
verificar('rechaza un rol inexistente', r.estado === 400, r.datos);

const tCoord = (await api('POST', '/api/auth/login',
  { usuario: 'coordina', clave: 'Coordinacion2026' })).datos.token;
const tCond = (await api('POST', '/api/auth/login',
  { usuario: 'jnavarro', clave: 'Conductor2026' })).datos.token;
verificar('ingresan coordinación y conductor', !!tCoord && !!tCond);

r = await api('POST', '/api/usuarios', { usuario: 'colado', clave: 'Clave123456', rol: 'principal' },
              tCoord);
verificar('coordinación NO puede crear usuarios', r.estado === 403, r.datos);

r = await api('POST', '/api/usuarios', { usuario: 'colado2', clave: 'Clave123456', rol: 'principal' },
              tCond);
verificar('el conductor NO puede crear usuarios', r.estado === 403, r.datos);

r = await api('GET', '/api/auditoria', null, tCoord);
verificar('coordinación NO ve la auditoría completa', r.estado === 403, r.datos);

console.log('\n── Vehículos ─────────────────────────────────────────────────');
r = await api('POST', '/api/vehiculos', {
  placa: 'GEU-665', tipo: 'camioneta', municipio_base_id: 1,
  propiedad: 'contratista', contratista: 'TRANSPORTES DEL CATATUMBO',
  valor_dia: 180000,
}, tokenPrincipal);
verificar('el principal crea un vehículo', r.estado === 200 && r.datos.id, r.datos);
const vehiculo = r.datos.id;

r = await api('POST', '/api/vehiculos', { placa: 'GEU-665' }, tokenPrincipal);
verificar('rechaza placa duplicada', r.estado === 409, r.datos);

r = await api('POST', '/api/vehiculos', { placa: 'ZZZ-999' }, tCoord);
verificar('coordinación NO crea vehículos', r.estado === 403, r.datos);

console.log('\n── Itinerario y destinos vivos ───────────────────────────────');
r = await api('POST', '/api/itinerario', {
  fecha: hoy, vehiculo_id: vehiculo, conductor_id: personaConductor,
  municipio_id: 1, destino_nombre: 'hoyo pilón', tipo_jornada: 'ebs',
}, tCoord);
verificar('coordinación adjudica un desplazamiento', r.estado === 200 && r.datos.id, r.datos);
const itinerario = r.datos.id;
verificar('reutiliza el destino ya existente del catálogo', r.datos.destino_id === 8, r.datos);

r = await api('POST', '/api/itinerario', {
  fecha: hoy, vehiculo_id: vehiculo, municipio_id: 1, destino_nombre: 'OTRA VEREDA',
}, tCoord);
verificar('detecta choque: dos programaciones el mismo día', r.estado === 400, r.datos);

r = await api('POST', '/api/itinerario', {
  fecha: '2026-12-01', vehiculo_id: vehiculo, municipio_id: 3,
  destino_nombre: 'VEREDA NUEVA SIN CATÁLOGO',
}, tCoord);
verificar('crea un destino nuevo sobre la marcha', r.estado === 200 && r.datos.destino_id > 17, r.datos);

r = await api('PUT', `/api/itinerario/${itinerario}`, {
  tipo_jornada: 'vacunacion', motivo: 'Se reprogramó por jornada PAI',
}, tCoord);
verificar('coordinación modifica el itinerario', r.estado === 200, r.datos);

r = await api('GET', `/api/itinerario/${itinerario}/cambios`, null, tCoord);
verificar('el cambio queda en el historial visible', r.estado === 200 && r.datos.length === 1, r.datos);
verificar('el historial dice quién y qué cambió',
  r.datos[0] && r.datos[0].campo === 'tipo_jornada' &&
  r.datos[0].valor_antes === 'ebs' && r.datos[0].valor_despues === 'vacunacion' &&
  r.datos[0].usuario === 'coordina', r.datos[0]);

r = await api('PUT', `/api/itinerario/${itinerario}`, { tipo_jornada: 'ebs' }, tCond);
verificar('el conductor NO modifica el itinerario', r.estado === 403, r.datos);

console.log('\n── Marcación con GPS ─────────────────────────────────────────');
r = await api('GET', '/api/mi-dia', null, tCond);
verificar('el conductor ve su programación de hoy',
  r.estado === 200 && r.datos.itinerario && r.datos.itinerario.placa === 'GEU-665', r.datos);

r = await api('POST', '/api/trayectos/salida', {
  municipio_id: 1, lugar: 'BASE ÁBREGO', lat: 8.0796, lon: -73.2216,
  precision: 12, km_inicial: 145200, ts_dispositivo: '2026-09-11T06:10:00Z',
}, tCond);
verificar('el conductor marca salida', r.estado === 200 && r.datos.consecutivo, r.datos);
const trayecto = r.datos.id;
verificar('el consecutivo tiene el formato esperado',
  /^TR-\d{4}-\d{6}$/.test(r.datos.consecutivo), r.datos.consecutivo);

const marcaServidor = r.datos.ts_salida;
verificar('la hora la pone el servidor, no el dispositivo',
  marcaServidor !== '2026-09-11T06:10:00Z', { servidor: marcaServidor });

r = await api('POST', '/api/trayectos/salida', { municipio_id: 1 }, tCond);
verificar('no permite dos trayectos abiertos a la vez', r.estado === 400, r.datos);

r = await api('POST', `/api/trayectos/${trayecto}/llegada`, {
  municipio_id: 1, lugar: 'HOYO PILÓN', lat: 8.1512, lon: -73.1904,
  precision: 25, km_final: 145247,
}, tCond);
verificar('el conductor marca llegada', r.estado === 200 && r.datos.ts_llegada, r.datos);

r = await api('PUT', `/api/trayectos/${trayecto}`, { km_final: 999999, motivo: 'me equivoqué' }, tCond);
verificar('el conductor NO corrige su propia marca', r.estado === 403, r.datos);

r = await api('PUT', `/api/trayectos/${trayecto}`, { km_final: 145250 }, tCoord);
verificar('toda corrección exige motivo', r.estado === 400, r.datos);

r = await api('PUT', `/api/trayectos/${trayecto}`, {
  km_final: 145250, motivo: 'El conductor reportó error de digitación',
}, tCoord);
verificar('coordinación sí corrige, con motivo', r.estado === 200, r.datos);

console.log('\n── Checklist de 5 distintivos + 4 elementos ──────────────────');
const items = [
  { item: 'lateral_izquierdo', estado: 'bueno' },
  { item: 'lateral_derecho', estado: 'bueno' },
  { item: 'frontal', estado: 'bueno' },
  { item: 'trasero', estado: 'obstruido', observacion: 'Tapado por el equipaje' },
  { item: 'techo', estado: 'bueno' },
  { item: 'bandera', estado: 'presente' },
  { item: 'chaleco', estado: 'presente', cantidad: 4 },
  { item: 'carnet', estado: 'presente' },
  { item: 'carta_presentacion', estado: 'ausente' },
];
r = await api('POST', '/api/checklists', {
  trayecto_id: trayecto, vehiculo_id: vehiculo, momento: 'presalida', items,
}, tCond);
verificar('registra el checklist de 9 ítems', r.estado === 200 && r.datos.completo, r.datos);
verificar('cuenta los faltantes (obstruido + ausente)', r.datos.faltantes === 2, r.datos);

r = await api('GET', '/api/eventos', null, tCond);
verificar('un faltante genera novedad automática',
  r.estado === 200 && r.datos.some(e => e.tipo === 'novedad_distintivo'), r.datos.length);

r = await api('GET', `/api/checklists?trayecto_id=${trayecto}`, null, tCoord);
verificar('el checklist se recupera con sus ítems',
  r.estado === 200 && r.datos[0] && r.datos[0].items.length === 9, r.datos[0] && r.datos[0].items.length);

console.log('\n── Bloqueo configurable de salida ────────────────────────────');
await api('PUT', '/api/parametros/checklist_bloquea_salida', { valor: 'bloquear' }, tokenPrincipal);
r = await api('POST', '/api/checklists', {
  vehiculo_id: vehiculo, momento: 'presalida', items,
}, tCond);
verificar('en modo bloquear, un faltante impide salir', r.estado === 400, r.datos);
r = await api('POST', '/api/checklists', {
  vehiculo_id: vehiculo, momento: 'presalida', items,
  excepcion_autorizada: true, justificacion: 'Se sale con carta en camino',
}, tokenPrincipal);
verificar('la excepción autorizada sí deja salir', r.estado === 200, r.datos);
await api('PUT', '/api/parametros/checklist_bloquea_salida', { valor: 'advertir' }, tokenPrincipal);

r = await api('PUT', '/api/parametros/gps_obligatorio', { valor: '0' }, tCoord);
verificar('coordinación NO cambia parámetros', r.estado === 403, r.datos);

console.log('\n── Días de operación y pago ──────────────────────────────────');
r = await api('GET', `/api/dias?desde=${hoy}&hasta=${hoy}`, null, tCoord);
const dia = r.datos[0];
verificar('el día quedó registrado', r.estado === 200 && !!dia, r.datos);
verificar('el día está programado y ejecutado',
  dia && dia.programado === 1 && dia.ejecutado === 1, dia);
verificar('el día ejecutado es pagable', dia && dia.dia_pagable === 1, dia);
verificar('calcula los kilómetros del día', dia && dia.km_dia === 50, dia && dia.km_dia);

// Día DISPONIBLE: se paga igual aunque no haya desplazamiento (D11)
await api('POST', '/api/itinerario', {
  fecha: '2026-10-05', vehiculo_id: vehiculo, conductor_id: personaConductor,
  municipio_id: 1, tipo_jornada: 'disponible',
}, tCoord);
r = await api('GET', '/api/dias?desde=2026-10-05&hasta=2026-10-05', null, tCoord);
const diaDisp = r.datos[0];
verificar('un día DISPONIBLE sin desplazamiento es pagable',
  diaDisp && diaDisp.dia_pagable === 1 && diaDisp.ejecutado === 0, diaDisp);
verificar('y queda marcado como disponible, no como operativo',
  diaDisp && diaDisp.estado_dia === 'disponible', diaDisp && diaDisp.estado_dia);

// Día programado con desplazamiento pero NO ejecutado: no se paga solo
await api('POST', '/api/itinerario', {
  fecha: '2026-10-06', vehiculo_id: vehiculo, municipio_id: 1,
  destino_nombre: 'LA LAGUNA', tipo_jornada: 'ebs',
}, tCoord);
r = await api('GET', '/api/dias?desde=2026-10-06&hasta=2026-10-06', null, tCoord);
verificar('un día programado y NO ejecutado no es pagable',
  r.datos[0] && r.datos[0].dia_pagable === 0, r.datos[0]);

r = await api('PUT', `/api/dias/${r.datos[0].id}`, { dia_pagable: 1 }, tokenPrincipal);
verificar('el ajuste manual exige motivo', r.estado === 400, r.datos);

r = await api('GET', '/api/dias?desde=2026-10-06&hasta=2026-10-06', null, tCoord);
const idAjuste = r.datos[0].id;
r = await api('PUT', `/api/dias/${idAjuste}`, {
  dia_pagable: 1, motivo_ajuste: 'El conductor operó sin señal, soporte en papel',
}, tokenPrincipal);
verificar('el principal ajusta el día con motivo', r.estado === 200, r.datos);

r = await api('GET', '/api/dias?desde=2026-10-06&hasta=2026-10-06', null, tCoord);
verificar('el ajuste queda marcado como manual',
  r.datos[0].ajuste_manual === 1 && r.datos[0].dia_pagable === 1, r.datos[0]);

r = await api('PUT', `/api/dias/${idAjuste}`, { dia_pagable: 0, motivo_ajuste: 'x' }, tCoord);
verificar('coordinación NO ajusta días pagables', r.estado === 403, r.datos);

console.log('\n── Sincronización sin señal ──────────────────────────────────');
r = await api('POST', '/api/sync', {
  marcas: [{
    local_id: 'abc', hito: 'salida', vehiculo_id: vehiculo,
    conductor_id: personaConductor, fecha_operacion: '2026-10-07',
    ts_dispositivo: '2026-10-07T05:45:00Z', lat: 8.07, lon: -73.22, precision: 40,
  }],
}, tCond);
verificar('sincroniza una marca capturada sin señal',
  r.estado === 200 && r.datos.resultados[0].ok, r.datos);

r = await api('GET', '/api/trayectos?desde=2026-10-07&hasta=2026-10-07', null, tCoord);
verificar('la marca offline queda etiquetada como tal',
  r.datos[0] && r.datos[0].origen_salida === 'offline_sincronizado', r.datos[0]);
verificar('y conserva la hora real del dispositivo',
  r.datos[0] && r.datos[0].ts_salida === '2026-10-07T05:45:00Z', r.datos[0]);

console.log('\n── Dashboard ─────────────────────────────────────────────────');
r = await api('GET', '/api/dashboard?desde=2026-01-01&hasta=2026-12-31', null, tCoord);
verificar('el dashboard responde', r.estado === 200 && r.datos.por_vehiculo, r.datos);
const v = r.datos.por_vehiculo[0];
verificar('separa días pagables de días con desplazamiento',
  v && v.dias_pagables !== undefined && v.dias_con_desplazamiento !== undefined, v);
verificar('los días pagables superan los ejecutados (por el día disponible)',
  v && v.dias_pagables > v.dias_con_desplazamiento,
  { pagables: v && v.dias_pagables, ejecutados: v && v.dias_con_desplazamiento });
verificar('estima el valor con la tarifa por día',
  v && v.valor_estimado === v.dias_pagables * 180000,
  { valor: v && v.valor_estimado, dias: v && v.dias_pagables });
verificar('cuenta el origen de las marcas',
  r.datos.origen_marcas.some(o => o.origen === 'offline_sincronizado'), r.datos.origen_marcas);
verificar('el checklist reporta faltantes por vehículo',
  r.datos.checklist[0] && r.datos.checklist[0].faltantes > 0, r.datos.checklist[0]);

r = await api('GET', '/api/dashboard', null, tCond);
verificar('el conductor NO ve el dashboard', r.estado === 403, r.datos);

console.log('\n── Aislamiento del conductor ─────────────────────────────────');
r = await api('POST', '/api/personas', { nombres: 'OTRO', es_conductor: true }, tokenPrincipal);
const otraPersona = r.datos.id;
await api('POST', '/api/usuarios',
  { usuario: 'otro', clave: 'OtroCond2026', rol: 'conductor', persona_id: otraPersona },
  tokenPrincipal);
const tOtro = (await api('POST', '/api/auth/login',
  { usuario: 'otro', clave: 'OtroCond2026' })).datos.token;

r = await api('GET', '/api/trayectos?desde=2026-01-01&hasta=2026-12-31', null, tOtro);
verificar('un conductor no ve los trayectos de otro', r.estado === 200 && r.datos.length === 0,
          r.datos.length);

r = await api('POST', '/api/trayectos/salida',
  { conductor_id: personaConductor, vehiculo_id: vehiculo }, tOtro);
verificar('un conductor no marca a nombre de otro', r.estado === 403, r.datos);

console.log('\n── Cambio de clave y cierre de sesión ────────────────────────');
r = await api('POST', '/api/auth/cambiar-clave',
  { clave_actual: 'equivocada', clave_nueva: 'NuevaClave2026' }, tCond);
verificar('no cambia la clave sin la actual', r.estado === 401, r.datos);

r = await api('POST', '/api/auth/cambiar-clave',
  { clave_actual: 'Conductor2026', clave_nueva: 'corta' }, tCond);
verificar('exige longitud mínima', r.estado === 400, r.datos);

r = await api('POST', '/api/auth/cambiar-clave',
  { clave_actual: 'Conductor2026', clave_nueva: 'NuevaClave2026' }, tCond);
verificar('cambia la clave correctamente', r.estado === 200, r.datos);

r = await api('POST', '/api/auth/logout', null, tCond);
verificar('cierra sesión', r.estado === 200, r.datos);
r = await api('GET', '/api/mi-dia', null, tCond);
verificar('el token queda invalidado tras cerrar sesión', r.estado === 401, r.datos);

console.log('\n── Integridad de catálogos ───────────────────────────────────');
r = await api('DELETE', '/api/catalogos/destinos/8', null, tokenPrincipal);
verificar('borrar un destino solo lo desactiva', r.estado === 200 && r.datos.nota, r.datos);
r = await api('GET', `/api/itinerario?desde=${hoy}&hasta=${hoy}`, null, tCoord);
verificar('el itinerario histórico sobrevive al destino desactivado',
  r.estado === 200 && r.datos[0] && r.datos[0].destino === 'HOYO PILÓN', r.datos[0]);

r = await api('PUT', '/api/usuarios/1', { activo: 0 }, tokenPrincipal);
verificar('no deja al sistema sin usuario principal', r.estado === 400, r.datos);

console.log('\n═══════════════════════════════════════════════════════════════');
console.log(`  ${pruebas - fallos} de ${pruebas} verificaciones pasaron`);
if (fallos) { console.log(`  ${fallos} FALLARON`); process.exit(1); }
console.log('  Todo correcto.');

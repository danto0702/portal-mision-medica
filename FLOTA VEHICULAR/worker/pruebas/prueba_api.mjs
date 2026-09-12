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

console.log('\n── Conductor predeterminado ──────────────────────────────────');
r = await api('GET', '/api/vehiculos', null, tokenPrincipal);
verificar('un vehículo nuevo no trae conductor asignado',
  r.datos[0] && r.datos[0].conductor_id == null, r.datos[0] && r.datos[0].conductor_id);

r = await api('PUT', `/api/vehiculos/${vehiculo}`, { conductor_id: personaConductor }, tokenPrincipal);
verificar('el principal asigna el conductor predeterminado', r.estado === 200, r.datos);

r = await api('GET', '/api/vehiculos', null, tokenPrincipal);
verificar('el vehículo devuelve su conductor', r.datos[0].conductor_id === personaConductor, r.datos[0]);
verificar('y también su nombre para mostrarlo',
  (r.datos[0].conductor_actual || '').includes('JEISON'), r.datos[0].conductor_actual);

// Reasignar a otra persona debe cerrar la anterior, no borrarla
r = await api('POST', '/api/personas', { nombres: 'RELEVO', es_conductor: true }, tokenPrincipal);
const relevo = r.datos.id;
await api('PUT', `/api/vehiculos/${vehiculo}`, { conductor_id: relevo }, tokenPrincipal);
r = await api('GET', '/api/vehiculos', null, tokenPrincipal);
verificar('al reasignar, queda el conductor nuevo', r.datos[0].conductor_id === relevo, r.datos[0]);

r = await api('GET', '/api/auditoria', null, tokenPrincipal);
verificar('el cambio de conductor queda en auditoría',
  r.datos.some(a => a.entidad === 'asignaciones'), r.datos.slice(0, 3));

// Dejar sin conductor
await api('PUT', `/api/vehiculos/${vehiculo}`, { conductor_id: null }, tokenPrincipal);
r = await api('GET', '/api/vehiculos', null, tokenPrincipal);
verificar('se puede dejar el vehículo sin conductor', r.datos[0].conductor_id == null, r.datos[0]);

// Restaurar para las pruebas siguientes
await api('PUT', `/api/vehiculos/${vehiculo}`, { conductor_id: personaConductor }, tokenPrincipal);

r = await api('PUT', `/api/vehiculos/${vehiculo}`, { conductor_id: relevo }, tCoord);
verificar('coordinación NO cambia el conductor del vehículo', r.estado === 403, r.datos);

r = await api('POST', '/api/vehiculos',
  { placa: 'ABC-123', conductor_id: personaConductor }, tokenPrincipal);
const veh2 = r.datos.id;
r = await api('GET', '/api/vehiculos', null, tokenPrincipal);
verificar('también se puede asignar al crear el vehículo',
  r.datos.find(v => v.id === veh2)?.conductor_id === personaConductor,
  r.datos.find(v => v.id === veh2));

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

console.log('\n── Predeterminados ───────────────────────────────────────────');
r = await api('POST', '/api/predeterminados', {
  nombre: 'EBS Santa Inés', tipo_jornada: 'ebs', municipio_id: 3,
  destino_nombre: 'SANTA INÉS', observaciones: 'Ruta habitual',
}, tCoord);
verificar('coordinación crea un predeterminado', r.estado === 200 && r.datos.id, r.datos);
const pred = r.datos.id;

r = await api('GET', '/api/predeterminados', null, tCond);
verificar('el conductor puede leerlos', r.estado === 200 && r.datos.length === 1, r.datos);
verificar('trae el destino resuelto', r.datos[0].destino === 'SANTA INÉS', r.datos[0]);

r = await api('POST', '/api/itinerario', {
  fecha: '2026-11-03', vehiculo_id: vehiculo, predeterminado_id: pred,
}, tCoord);
verificar('adjudicar con un predeterminado', r.estado === 200, r.datos);
const itPred = r.datos.id;

r = await api('GET', '/api/itinerario?desde=2026-11-03&hasta=2026-11-03', null, tCoord);
verificar('el predeterminado llenó tipo, municipio y destino',
  r.datos[0] && r.datos[0].tipo_jornada === 'ebs' && r.datos[0].destino === 'SANTA INÉS'
  && r.datos[0].municipio_id === 3, r.datos[0]);

r = await api('GET', '/api/predeterminados', null, tCoord);
verificar('cuenta cuántas veces se ha usado', r.datos[0].veces_usado === 1, r.datos[0]);

r = await api('DELETE', `/api/predeterminados/${pred}`, null, tCoord);
verificar('coordinación NO borra predeterminados', r.estado === 403, r.datos);
r = await api('DELETE', `/api/predeterminados/${pred}`, null, tokenPrincipal);
verificar('el administrador sí, y solo lo desactiva', r.estado === 200, r.datos);
r = await api('GET', '/api/predeterminados', null, tCoord);
verificar('desactivado deja de aparecer', r.datos.length === 0, r.datos);

console.log('\n── Mover y duplicar ──────────────────────────────────────────');
r = await api('POST', '/api/itinerario/mover', {
  id: itPred, fecha: '2026-11-04', vehiculo_id: vehiculo,
}, tCoord);
verificar('mueve a un día libre', r.estado === 200 && !r.datos.intercambio, r.datos);

r = await api('GET', '/api/itinerario?desde=2026-11-03&hasta=2026-11-04', null, tCoord);
verificar('quedó solo en el día nuevo',
  r.datos.length === 1 && r.datos[0].fecha === '2026-11-04', r.datos.map(x => x.fecha));

r = await api('GET', `/api/itinerario/${itPred}/cambios`, null, tCoord);
verificar('el movimiento queda en el historial',
  r.datos.some(c => c.campo === 'fecha' && c.valor_despues === '2026-11-04'), r.datos);

r = await api('POST', '/api/itinerario/mover', {
  id: itPred, fecha: '2026-11-05', vehiculo_id: vehiculo, duplicar: true,
}, tCoord);
verificar('duplica en otro día', r.estado === 200 && r.datos.duplicado, r.datos);
const itDup = r.datos.id;

r = await api('GET', '/api/itinerario?desde=2026-11-04&hasta=2026-11-05', null, tCoord);
verificar('ahora hay dos, con el mismo destino',
  r.datos.length === 2 && r.datos[0].destino === r.datos[1].destino,
  r.datos.map(x => `${x.fecha}:${x.destino}`));

r = await api('POST', '/api/itinerario/mover', {
  id: itPred, fecha: '2026-11-05', vehiculo_id: vehiculo, duplicar: true,
}, tCoord);
verificar('no duplica sobre una celda ocupada', r.estado === 400, r.datos);

// Intercambio: las dos existentes cambian de lugar
r = await api('POST', '/api/itinerario/mover', {
  id: itPred, fecha: '2026-11-05', vehiculo_id: vehiculo,
}, tCoord);
verificar('mover sobre celda ocupada intercambia', r.estado === 200 && r.datos.intercambio, r.datos);

r = await api('GET', '/api/itinerario?desde=2026-11-04&hasta=2026-11-05', null, tCoord);
const porFecha = Object.fromEntries(r.datos.map(x => [x.fecha, x.id]));
verificar('cada una quedó en el lugar de la otra',
  porFecha['2026-11-05'] === itPred && porFecha['2026-11-04'] === itDup, porFecha);
verificar('ninguna se perdió en el intercambio', r.datos.length === 2, r.datos.length);

console.log('\n── Borrado definitivo ────────────────────────────────────────');
r = await api('DELETE', `/api/itinerario/${itDup}?definitivo=1`, null, tCoord);
verificar('coordinación NO borra definitivamente', r.estado === 403, r.datos);

r = await api('DELETE', `/api/itinerario/${itDup}`, { motivo: 'prueba' }, tCoord);
verificar('coordinación sí puede cancelar', r.estado === 200 && r.datos.borrado === false, r.datos);

r = await api('DELETE', `/api/itinerario/${itPred}?definitivo=1`, null, tokenPrincipal);
verificar('el administrador borra definitivamente', r.estado === 200 && r.datos.borrado, r.datos);

r = await api('GET', '/api/itinerario?desde=2026-11-04&hasta=2026-11-05', null, tCoord);
verificar('el borrado desaparece de verdad', r.datos.length === 1, r.datos.map(x => x.id));

console.log('\n── Carga por lote (plantilla de Excel) ───────────────────────');
r = await api('POST', '/api/itinerario/lote', {
  operaciones: [
    { accion: 'crear', fecha: '2026-12-10', vehiculo_id: vehiculo, municipio_id: 1,
      destino_nombre: 'LA LAGUNA', tipo_jornada: 'ebs' },
    { accion: 'crear', fecha: '2026-12-11', vehiculo_id: vehiculo, tipo_jornada: 'disponible' },
    { accion: 'crear', fecha: '2026-12-12', vehiculo_id: 999999, tipo_jornada: 'ebs' },
  ],
}, tCoord);
verificar('el lote crea lo válido', r.estado === 200 && r.datos.creadas === 2, r.datos);
verificar('y reporta la fila mala sin tumbar el resto',
  r.datos.errores.length === 1, r.datos.errores);

r = await api('GET', '/api/itinerario?desde=2026-12-10&hasta=2026-12-12', null, tCoord);
verificar('quedaron las dos en el itinerario', r.datos.length === 2, r.datos.length);
const idLote = r.datos.find(x => x.fecha === '2026-12-10').id;

r = await api('POST', '/api/itinerario/lote', {
  operaciones: [{ accion: 'actualizar', id: idLote, tipo_jornada: 'vacunacion',
                  municipio_id: 1, destino_nombre: 'HONDURAS' }],
}, tCoord);
verificar('el lote actualiza', r.estado === 200 && r.datos.actualizadas === 1, r.datos);

r = await api('GET', `/api/itinerario/${idLote}/cambios`, null, tCoord);
verificar('la actualización por lote deja historial',
  r.datos.some(c => c.motivo && c.motivo.includes('Excel')), r.datos);

r = await api('POST', '/api/itinerario/lote', {
  operaciones: [{ accion: 'borrar', id: idLote }],
}, tCoord);
verificar('el lote borra', r.estado === 200 && r.datos.borradas === 1, r.datos);

r = await api('POST', '/api/itinerario/lote', { operaciones: [] }, tCoord);
verificar('un lote vacío se rechaza', r.estado === 400, r.datos);

r = await api('POST', '/api/itinerario/lote', {
  operaciones: [{ accion: 'crear', fecha: '2027-01-05', vehiculo_id: vehiculo }],
}, tCond);
verificar('el conductor NO puede cargar lotes', r.estado === 403, r.datos);

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

console.log('\n── Protección de días ya ejecutados ──────────────────────────');
// Aquí el conductor ya marcó salida y llegada del día de hoy.
r = await api('DELETE', `/api/itinerario/${itinerario}?definitivo=1`, null, tokenPrincipal);
verificar('no deja borrar un día con viajes registrados', r.estado === 400, r.datos);
verificar('y lo explica nombrando los viajes', /viaje/i.test(r.datos.error || ''), r.datos.error);

r = await api('DELETE', `/api/itinerario/${itinerario}`, { motivo: 'x' }, tCoord);
verificar('tampoco deja cancelarlo', r.estado === 400, r.datos);

r = await api('POST', '/api/itinerario/mover', {
  id: itinerario, fecha: '2026-11-20', vehiculo_id: vehiculo,
}, tCoord);
verificar('tampoco deja moverlo', r.estado === 400, r.datos);

r = await api('POST', '/api/itinerario/lote', {
  operaciones: [{ accion: 'borrar', id: itinerario }],
}, tCoord);
verificar('ni borrarlo desde la plantilla de Excel',
  r.estado === 200 && r.datos.borradas === 0 && r.datos.errores.length === 1, r.datos);

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
// Se busca por contenido, no por posición: el orden cambia al agregar vehículos.
verificar('el checklist reporta faltantes por vehículo',
  r.datos.checklist.some(c => c.faltantes > 0),
  r.datos.checklist.map(c => `${c.placa}:${c.faltantes}`));

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

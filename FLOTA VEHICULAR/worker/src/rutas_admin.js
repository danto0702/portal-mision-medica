/**
 * FLOTA VEHICULAR HRNO — rutas de administración
 * Autenticación, catálogos, vehículos, personas y usuarios.
 */

import { ruta } from './router.js';
import {
  ahora, hoyISO, malaPeticion, noAutorizado, noEncontrado,
  hashClave, verificarClave, auditar, resolverDestino,
} from './lib.js';

// ── Autenticación ───────────────────────────────────────────────────────────

ruta('POST', '/api/auth/login', async ({ db, cuerpo, env }) => {
  const { usuario, clave } = cuerpo;
  if (!usuario || !clave) throw malaPeticion('Usuario y clave son obligatorios');

  const u = await db.prepare(`
    SELECT u.*, p.nombres, p.apellidos
      FROM usuarios u LEFT JOIN personas p ON p.id = u.persona_id
     WHERE u.usuario = ? AND u.activo = 1`).bind(usuario.trim()).first();

  // Se verifica siempre contra un hash, exista o no el usuario, para no revelar
  // por diferencia de tiempo si el nombre de usuario existe.
  const hashReferencia = 'pbkdf2$120000$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  const valida = await verificarClave(clave, u ? u.clave_hash : hashReferencia);
  if (!u || !valida) throw noAutorizado('Usuario o clave incorrectos');

  const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, '');
  const horas = Number(env.HORAS_SESION || 12);
  const expira = new Date(Date.now() + horas * 3600e3).toISOString().replace(/\.\d{3}Z$/, 'Z');

  await db.prepare(`
    INSERT INTO sesiones (id, usuario_id, creada_en, expira_en, user_agent)
    VALUES (?,?,?,?,?)`)
    .bind(token, u.id, ahora(), expira, '').run();
  await db.prepare('UPDATE usuarios SET ultimo_acceso = ? WHERE id = ?')
    .bind(ahora(), u.id).run();
  await auditar(db, { id: u.id, rol: u.rol }, 'ingresar', 'usuarios', u.id);

  return {
    token, expira_en: expira,
    usuario: {
      id: u.id, usuario: u.usuario, rol: u.rol, persona_id: u.persona_id,
      municipio_id: u.municipio_id, debe_cambiar_clave: !!u.debe_cambiar_clave,
      nombre: [u.nombres, u.apellidos].filter(Boolean).join(' ') || u.usuario,
    },
  };
});

ruta('POST', '/api/auth/logout', async ({ db, sesion }) => {
  await db.prepare('DELETE FROM sesiones WHERE id = ?').bind(sesion.token).run();
  return { ok: true };
}, ['principal', 'coordinacion', 'conductor']);

ruta('GET', '/api/auth/yo', async ({ sesion }) => ({
  id: sesion.id, usuario: sesion.usuario, rol: sesion.rol,
  persona_id: sesion.persona_id, municipio_id: sesion.municipio_id,
  debe_cambiar_clave: !!sesion.debe_cambiar_clave,
  nombre: [sesion.nombres, sesion.apellidos].filter(Boolean).join(' ') || sesion.usuario,
}), ['principal', 'coordinacion', 'conductor']);

ruta('POST', '/api/auth/cambiar-clave', async ({ db, sesion, cuerpo }) => {
  const { clave_actual, clave_nueva } = cuerpo;
  if (!clave_nueva || clave_nueva.length < 8) {
    throw malaPeticion('La clave nueva debe tener al menos 8 caracteres');
  }
  const u = await db.prepare('SELECT clave_hash FROM usuarios WHERE id = ?')
    .bind(sesion.id).first();
  if (!await verificarClave(clave_actual || '', u.clave_hash)) {
    throw noAutorizado('La clave actual no es correcta');
  }
  await db.prepare(
    'UPDATE usuarios SET clave_hash = ?, debe_cambiar_clave = 0 WHERE id = ?')
    .bind(await hashClave(clave_nueva), sesion.id).run();
  await auditar(db, sesion, 'editar', 'usuarios', sesion.id, null, { clave: 'cambiada' });
  return { ok: true };
}, ['principal', 'coordinacion', 'conductor']);

// ── Catálogos ───────────────────────────────────────────────────────────────

ruta('GET', '/api/catalogos', async ({ db }) => {
  const [municipios, destinos, ips] = await Promise.all([
    db.prepare(`SELECT m.*, p.nombre AS municipio_padre
                  FROM cat_municipios m
                  LEFT JOIN cat_municipios p ON p.id = m.municipio_padre_id
                 WHERE m.activo = 1 ORDER BY m.nombre`).all(),
    db.prepare(`SELECT d.*, m.nombre AS municipio
                  FROM cat_destinos d
                  LEFT JOIN cat_municipios m ON m.id = d.municipio_id
                 WHERE d.activo = 1
                 ORDER BY d.veces_usado DESC, d.nombre`).all(),
    db.prepare('SELECT * FROM cat_ips WHERE activo = 1 ORDER BY nombre').all(),
  ]);
  return { municipios: municipios.results, destinos: destinos.results, ips: ips.results };
}, ['principal', 'coordinacion', 'conductor']);

ruta('POST', '/api/catalogos/municipios', async ({ db, sesion, cuerpo }) => {
  const { nombre, codigo_dane, municipio_padre_id, es_base } = cuerpo;
  if (!nombre) throw malaPeticion('El nombre es obligatorio');
  const r = await db.prepare(`
    INSERT INTO cat_municipios (nombre, codigo_dane, municipio_padre_id, es_base,
                                activo, creado_en)
    VALUES (?,?,?,?,1,?)`)
    .bind(nombre.trim().toUpperCase(), codigo_dane || null,
          municipio_padre_id || null, es_base ? 1 : 0, ahora()).run();
  await auditar(db, sesion, 'crear', 'cat_municipios', r.meta.last_row_id, null, cuerpo);
  return { id: r.meta.last_row_id };
}, ['principal']);

ruta('PUT', '/api/catalogos/municipios/:id', async ({ db, sesion, params, cuerpo }) => {
  const antes = await db.prepare('SELECT * FROM cat_municipios WHERE id = ?')
    .bind(params.id).first();
  if (!antes) throw noEncontrado('Municipio no encontrado');
  await db.prepare(`
    UPDATE cat_municipios
       SET nombre = ?, codigo_dane = ?, municipio_padre_id = ?, es_base = ?,
           activo = ?, actualizado_por = ?, actualizado_en = ?
     WHERE id = ?`)
    .bind(cuerpo.nombre != null ? cuerpo.nombre.trim().toUpperCase() : antes.nombre,
          cuerpo.codigo_dane !== undefined ? cuerpo.codigo_dane : antes.codigo_dane,
          cuerpo.municipio_padre_id !== undefined ? cuerpo.municipio_padre_id : antes.municipio_padre_id,
          cuerpo.es_base !== undefined ? (cuerpo.es_base ? 1 : 0) : antes.es_base,
          cuerpo.activo !== undefined ? (cuerpo.activo ? 1 : 0) : antes.activo,
          sesion.id, ahora(), params.id).run();
  await auditar(db, sesion, 'editar', 'cat_municipios', params.id, antes, cuerpo);
  return { ok: true };
}, ['principal']);

// Coordinación también crea destinos: se crean AL ADJUDICAR el desplazamiento (D12).
ruta('POST', '/api/catalogos/destinos', async ({ db, sesion, cuerpo }) => {
  const { nombre, municipio_id, tipo } = cuerpo;
  if (!nombre) throw malaPeticion('El nombre del destino es obligatorio');
  const id = await resolverDestino(db, nombre, municipio_id, tipo, sesion.id);
  await auditar(db, sesion, 'crear', 'cat_destinos', id, null, cuerpo);
  return { id };
}, ['principal', 'coordinacion']);

/**
 * Un destino ya usado NUNCA se borra: se desactiva. Si se eliminara, los
 * itinerarios y trayectos históricos quedarían apuntando al vacío y las
 * liquidaciones ya cerradas dejarían de cuadrar.
 */
ruta('DELETE', '/api/catalogos/destinos/:id', async ({ db, sesion, params }) => {
  await db.prepare('UPDATE cat_destinos SET activo = 0 WHERE id = ?').bind(params.id).run();
  await auditar(db, sesion, 'editar', 'cat_destinos', params.id, null, { activo: 0 });
  return { ok: true, nota: 'Destino desactivado, no eliminado' };
}, ['principal']);


/**
 * Fija el conductor predeterminado de un vehículo.
 *
 * No se reescribe la asignación anterior: se le pone fecha de cierre y se abre
 * una nueva. Así queda la historia de quién manejó qué y desde cuándo, que es
 * lo que permite explicar un trayecto de hace tres meses.
 *
 * Pasar personaId nulo deja el vehículo sin conductor asignado.
 */
async function asignarConductor(db, vehiculoId, personaId, sesion) {
  const actual = await db.prepare(`
    SELECT id, persona_id FROM asignaciones
     WHERE vehiculo_id = ? AND rol = 'conductor' AND hasta IS NULL
     ORDER BY desde DESC, id DESC LIMIT 1`).bind(vehiculoId).first();

  if (actual && Number(actual.persona_id) === Number(personaId)) return;   // sin cambio

  const hoy = hoyISO();
  if (actual) {
    await db.prepare('UPDATE asignaciones SET hasta = ? WHERE id = ?')
      .bind(hoy, actual.id).run();
  }
  if (personaId) {
    await db.prepare(`
      INSERT INTO asignaciones (vehiculo_id, persona_id, rol, desde, creado_por, creado_en)
      VALUES (?,?, 'conductor', ?,?,?)`)
      .bind(vehiculoId, personaId, hoy, sesion.id, ahora()).run();
  }
  await auditar(db, sesion, 'editar', 'asignaciones', vehiculoId,
                { conductor_anterior: actual ? actual.persona_id : null },
                { conductor_nuevo: personaId || null });
}

// ── Vehículos ───────────────────────────────────────────────────────────────

ruta('GET', '/api/vehiculos', async ({ db, url }) => {
  const todos = url.searchParams.get('todos') === '1';
  const r = await db.prepare(`
    SELECT v.*, m.nombre AS municipio_base,
           (SELECT COUNT(*) FROM documentos_vehiculo dv
             WHERE dv.vehiculo_id = v.id AND dv.vencimiento < date('now')) AS docs_vencidos,
           (SELECT p.nombres || ' ' || IFNULL(p.apellidos,'')
              FROM asignaciones a JOIN personas p ON p.id = a.persona_id
             WHERE a.vehiculo_id = v.id AND a.rol = 'conductor'
               AND (a.hasta IS NULL OR a.hasta >= date('now'))
             ORDER BY a.desde DESC, a.id DESC LIMIT 1) AS conductor_actual,
           (SELECT a.persona_id FROM asignaciones a
             WHERE a.vehiculo_id = v.id AND a.rol = 'conductor' AND a.hasta IS NULL
             ORDER BY a.desde DESC, a.id DESC LIMIT 1) AS conductor_id
      FROM vehiculos v
      LEFT JOIN cat_municipios m ON m.id = v.municipio_base_id
     ${todos ? '' : 'WHERE v.activo = 1'}
     ORDER BY v.placa`).all();
  return r.results;
}, ['principal', 'coordinacion', 'conductor']);

ruta('POST', '/api/vehiculos', async ({ db, sesion, cuerpo }) => {
  if (!cuerpo.placa) throw malaPeticion('La placa es obligatoria');
  const r = await db.prepare(`
    INSERT INTO vehiculos (placa, numero_interno, tipo, subtipo, marca, linea,
                           modelo_anio, color, capacidad, municipio_base_id,
                           propiedad, contratista, valor_dia, estado, km_actual,
                           qr_token, activo, creado_en)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,?)`)
    .bind(cuerpo.placa.trim().toUpperCase(), cuerpo.numero_interno || null,
          cuerpo.tipo || 'camioneta', cuerpo.subtipo || null, cuerpo.marca || null,
          cuerpo.linea || null, cuerpo.modelo_anio || null, cuerpo.color || null,
          cuerpo.capacidad || null, cuerpo.municipio_base_id || null,
          cuerpo.propiedad || 'propio', cuerpo.contratista || null,
          cuerpo.valor_dia || null, cuerpo.estado || 'activo',
          cuerpo.km_actual || null, crypto.randomUUID(), ahora()).run();
  if (cuerpo.conductor_id) {
    await asignarConductor(db, r.meta.last_row_id, cuerpo.conductor_id, sesion);
  }
  await auditar(db, sesion, 'crear', 'vehiculos', r.meta.last_row_id, null, cuerpo);
  return { id: r.meta.last_row_id };
}, ['principal']);

ruta('PUT', '/api/vehiculos/:id', async ({ db, sesion, params, cuerpo }) => {
  const antes = await db.prepare('SELECT * FROM vehiculos WHERE id = ?').bind(params.id).first();
  if (!antes) throw noEncontrado('Vehículo no encontrado');
  const campos = ['numero_interno', 'tipo', 'subtipo', 'marca', 'linea', 'modelo_anio',
    'color', 'capacidad', 'municipio_base_id', 'propiedad', 'contratista',
    'valor_dia', 'estado', 'km_actual', 'activo'];
  const set = [], valores = [];
  for (const c of campos) {
    if (cuerpo[c] !== undefined) { set.push(`${c} = ?`); valores.push(cuerpo[c]); }
  }
  if (set.length) {
    valores.push(params.id);
    await db.prepare(`UPDATE vehiculos SET ${set.join(', ')} WHERE id = ?`).bind(...valores).run();
  }
  if (cuerpo.conductor_id !== undefined) {
    await asignarConductor(db, Number(params.id), cuerpo.conductor_id, sesion);
  }
  await auditar(db, sesion, 'editar', 'vehiculos', params.id, antes, cuerpo);
  return { ok: true };
}, ['principal']);

// ── Personas ────────────────────────────────────────────────────────────────

ruta('GET', '/api/personas', async ({ db, url }) => {
  const soloConductores = url.searchParams.get('conductores') === '1';
  const r = await db.prepare(`
    SELECT p.*, m.nombre AS municipio,
           (SELECT COUNT(*) FROM documentos_persona dp
             WHERE dp.persona_id = p.id AND dp.vencimiento < date('now')) AS docs_vencidos
      FROM personas p
      LEFT JOIN cat_municipios m ON m.id = p.municipio_id
     WHERE p.activo = 1 ${soloConductores ? 'AND p.es_conductor = 1' : ''}
     ORDER BY p.nombres, p.apellidos`).all();
  return r.results;
}, ['principal', 'coordinacion']);

ruta('POST', '/api/personas', async ({ db, sesion, cuerpo }) => {
  if (!cuerpo.nombres) throw malaPeticion('El nombre es obligatorio');
  const r = await db.prepare(`
    INSERT INTO personas (tipo_doc, numero_doc, nombres, apellidos, telefono, correo,
                          cargo, vinculacion, municipio_id, territorio,
                          es_conductor, es_tripulante, activo, creado_en)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,1,?)`)
    .bind(cuerpo.tipo_doc || 'CC', cuerpo.numero_doc || null,
          cuerpo.nombres.trim(), cuerpo.apellidos || null, cuerpo.telefono || null,
          cuerpo.correo || null, cuerpo.cargo || 'CONDUCTOR',
          cuerpo.vinculacion || null, cuerpo.municipio_id || null,
          cuerpo.territorio || null,
          cuerpo.es_conductor ? 1 : 0, cuerpo.es_tripulante ? 1 : 0, ahora()).run();
  await auditar(db, sesion, 'crear', 'personas', r.meta.last_row_id, null,
                { nombres: cuerpo.nombres });   // no se audita el documento
  return { id: r.meta.last_row_id };
}, ['principal']);

ruta('PUT', '/api/personas/:id', async ({ db, sesion, params, cuerpo }) => {
  const antes = await db.prepare('SELECT * FROM personas WHERE id = ?').bind(params.id).first();
  if (!antes) throw noEncontrado('Persona no encontrada');
  const campos = ['tipo_doc', 'numero_doc', 'nombres', 'apellidos', 'telefono', 'correo',
    'cargo', 'vinculacion', 'municipio_id', 'territorio', 'es_conductor',
    'es_tripulante', 'activo'];
  const set = [], valores = [];
  for (const c of campos) {
    if (cuerpo[c] !== undefined) { set.push(`${c} = ?`); valores.push(cuerpo[c]); }
  }
  if (!set.length) return { ok: true, sin_cambios: true };
  valores.push(params.id);
  await db.prepare(`UPDATE personas SET ${set.join(', ')} WHERE id = ?`).bind(...valores).run();
  await auditar(db, sesion, 'editar', 'personas', params.id, { id: antes.id }, { campos: set });
  return { ok: true };
}, ['principal']);

// ── Usuarios (solo el rol principal) ────────────────────────────────────────

ruta('GET', '/api/usuarios', async ({ db }) => {
  const r = await db.prepare(`
    SELECT u.id, u.usuario, u.correo, u.rol, u.activo, u.debe_cambiar_clave,
           u.ultimo_acceso, u.creado_en, u.persona_id,
           p.nombres || ' ' || IFNULL(p.apellidos,'') AS nombre,
           m.nombre AS municipio
      FROM usuarios u
      LEFT JOIN personas p ON p.id = u.persona_id
      LEFT JOIN cat_municipios m ON m.id = u.municipio_id
     ORDER BY u.rol, u.usuario`).all();
  return r.results;
}, ['principal']);

ruta('POST', '/api/usuarios', async ({ db, sesion, cuerpo }) => {
  const { usuario, clave, rol, persona_id, correo, municipio_id } = cuerpo;
  if (!usuario || !clave) throw malaPeticion('Usuario y clave temporal son obligatorios');
  if (!['principal', 'coordinacion', 'conductor'].includes(rol)) {
    throw malaPeticion('Rol no válido: principal, coordinacion o conductor');
  }
  if (clave.length < 8) throw malaPeticion('La clave temporal debe tener al menos 8 caracteres');

  const r = await db.prepare(`
    INSERT INTO usuarios (persona_id, usuario, correo, clave_hash, rol, municipio_id,
                          activo, debe_cambiar_clave, creado_por, creado_en)
    VALUES (?,?,?,?,?,?,1,1,?,?)`)
    .bind(persona_id || null, usuario.trim().toLowerCase(), correo || null,
          await hashClave(clave), rol, municipio_id || null, sesion.id, ahora()).run();
  await auditar(db, sesion, 'crear', 'usuarios', r.meta.last_row_id, null,
                { usuario, rol });   // la clave nunca se audita
  return { id: r.meta.last_row_id };
}, ['principal']);

ruta('PUT', '/api/usuarios/:id', async ({ db, sesion, params, cuerpo }) => {
  const antes = await db.prepare('SELECT * FROM usuarios WHERE id = ?').bind(params.id).first();
  if (!antes) throw noEncontrado('Usuario no encontrado');

  // No se permite que el último usuario principal activo se desactive o cambie de rol:
  // dejaría el sistema sin nadie capaz de crear usuarios.
  const quitaPrincipal = (cuerpo.activo === 0 || cuerpo.activo === false) ||
                         (cuerpo.rol && cuerpo.rol !== 'principal');
  if (antes.rol === 'principal' && quitaPrincipal) {
    const otros = await db.prepare(
      "SELECT COUNT(*) AS n FROM usuarios WHERE rol = 'principal' AND activo = 1 AND id != ?")
      .bind(params.id).first();
    if (!otros.n) throw malaPeticion('Debe existir al menos un usuario principal activo');
  }

  const set = [], valores = [];
  for (const c of ['usuario', 'correo', 'rol', 'persona_id', 'municipio_id', 'activo']) {
    if (cuerpo[c] !== undefined) { set.push(`${c} = ?`); valores.push(cuerpo[c]); }
  }
  if (cuerpo.clave) {
    if (cuerpo.clave.length < 8) throw malaPeticion('La clave debe tener al menos 8 caracteres');
    set.push('clave_hash = ?', 'debe_cambiar_clave = 1');
    valores.push(await hashClave(cuerpo.clave));
    // Al restablecer la clave se cierran las sesiones abiertas de ese usuario.
    await db.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(params.id).run();
  }
  if (!set.length) return { ok: true, sin_cambios: true };
  valores.push(params.id);
  await db.prepare(`UPDATE usuarios SET ${set.join(', ')} WHERE id = ?`).bind(...valores).run();
  await auditar(db, sesion, 'editar', 'usuarios', params.id,
                { usuario: antes.usuario, rol: antes.rol, activo: antes.activo },
                { campos: set.filter(s => !s.startsWith('clave')) });
  return { ok: true };
}, ['principal']);

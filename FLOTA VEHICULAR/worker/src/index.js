/**
 * FLOTA VEHICULAR HRNO — punto de entrada del Worker
 *
 * ESE Hospital Regional Noroccidental · Coordinación de Salud Pública
 *
 * Reglas transversales que la API hace cumplir:
 *   1. La hora de toda marca la pone el servidor, nunca el dispositivo.
 *   2. Solo el rol principal crea usuarios y modifica parámetros.
 *   3. El conductor no puede corregir una marca ya registrada.
 *   4. Todo cambio de itinerario deja rastro visible en itinerario_cambios.
 *   5. Un destino ya usado se desactiva, jamás se borra.
 */

import { resolver, totalRutas } from './router.js';
import { cors, json, ErrorApi, sesionActual, ahora, hashClave } from './lib.js';

// El sólo hecho de importarlos registra sus rutas en el router.
import './rutas_admin.js';
import './rutas_operacion.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cabecerasCors = cors(request.headers.get('Origin'), env.ORIGENES_PERMITIDOS);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cabecerasCors });
    }

    // Sonda de salud, sin sesión: sirve para verificar el despliegue.
    if (url.pathname === '/api/salud') {
      return json({ ok: true, servicio: 'flota-hrno', rutas: totalRutas(), ts: ahora() },
                  200, cabecerasCors);
    }

    // Creación del primer usuario principal. Solo funciona si la tabla de
    // usuarios está vacía y quien llama conoce el secreto CLAVE_ADMIN_INICIAL,
    // que vive fuera del repositorio. Después de eso queda inerte para siempre.
    if (url.pathname === '/api/instalar' && request.method === 'POST') {
      return instalar(request, env, cabecerasCors);
    }

    const encontrada = resolver(request.method, url.pathname);
    if (!encontrada) {
      return json({ error: 'Ruta no encontrada', ruta: url.pathname }, 404, cabecerasCors);
    }

    try {
      let sesion = null;
      if (encontrada.roles) {
        sesion = await sesionActual(env.DB, request);
        if (!sesion) throw new ErrorApi(401, 'Sesión no válida o expirada');
        if (!encontrada.roles.includes(sesion.rol)) {
          throw new ErrorApi(403, 'Su rol no permite esta acción');
        }
      }

      let cuerpo = {};
      if (request.method === 'POST' || request.method === 'PUT' || request.method === 'DELETE') {
        const texto = await request.text();
        if (texto) {
          try { cuerpo = JSON.parse(texto); }
          catch { throw new ErrorApi(400, 'El cuerpo de la petición no es JSON válido'); }
        }
      }

      const resultado = await encontrada.manejador({
        db: env.DB, env, sesion, cuerpo, params: encontrada.params, url, request,
      });
      return json(resultado === undefined ? { ok: true } : resultado, 200, cabecerasCors);

    } catch (e) {
      if (e instanceof ErrorApi) {
        return json({ error: e.message }, e.status, cabecerasCors);
      }
      // Restricciones de la base traducidas a algo legible para quien usa la app.
      const m = String(e && e.message || e);
      if (m.includes('UNIQUE constraint failed')) {
        return json({ error: 'Ya existe un registro con esos datos', detalle: m },
                    409, cabecerasCors);
      }
      if (m.includes('FOREIGN KEY constraint failed')) {
        return json({ error: 'El registro referenciado no existe', detalle: m },
                    400, cabecerasCors);
      }
      console.error('Error no controlado:', m);
      return json({ error: 'Error interno del servidor' }, 500, cabecerasCors);
    }
  },
};

/**
 * Instalación inicial. Deliberadamente irrepetible: en cuanto existe un usuario
 * queda cerrada, para que nadie pueda crearse un administrador más adelante.
 */
async function instalar(request, env, cabeceras) {
  const existentes = await env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first();
  if (existentes && existentes.n > 0) {
    return json({ error: 'El sistema ya está instalado' }, 409, cabeceras);
  }
  if (!env.CLAVE_ADMIN_INICIAL) {
    return json({ error: 'Falta configurar el secreto CLAVE_ADMIN_INICIAL' }, 500, cabeceras);
  }

  let cuerpo = {};
  try { cuerpo = JSON.parse(await request.text() || '{}'); } catch { /* cuerpo vacío */ }
  if (cuerpo.clave_instalacion !== env.CLAVE_ADMIN_INICIAL) {
    return json({ error: 'Clave de instalación incorrecta' }, 403, cabeceras);
  }

  const usuario = (cuerpo.usuario || 'admin').trim().toLowerCase();
  const clave = cuerpo.clave || env.CLAVE_ADMIN_INICIAL;

  const r = await env.DB.prepare(`
    INSERT INTO usuarios (usuario, correo, clave_hash, rol, activo,
                          debe_cambiar_clave, creado_en)
    VALUES (?,?,?, 'principal', 1, 1, ?)`)
    .bind(usuario, cuerpo.correo || null, await hashClave(clave), ahora()).run();

  await env.DB.prepare(`
    INSERT INTO auditoria (ts, usuario_id, rol, accion, entidad, entidad_id)
    VALUES (?,?, 'principal', 'crear', 'usuarios', ?)`)
    .bind(ahora(), r.meta.last_row_id, r.meta.last_row_id).run();

  return json({
    ok: true,
    usuario,
    id: r.meta.last_row_id,
    nota: 'Debe cambiar la clave en el primer ingreso',
  }, 200, cabeceras);
}

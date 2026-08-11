// auth.js — Portal Salud Pública HRNO
// Incluir en TODAS las páginas del portal con:
//   <script src="auth.js"></script>          (páginas raíz)
//   <script src="../auth.js"></script>        (páginas en subcarpeta)
// Requiere que supabase-js esté cargado ANTES de este script.

(function () {
  'use strict';

  const SUPA_URL  = 'https://kukauvbqosizlxrapmim.supabase.co';
  const SUPA_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt1a2F1dmJxb3Npemx4cmFwbWltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4ODMzNTUsImV4cCI6MjA5NzQ1OTM1NX0.1ajCazK2YEb_DU14R96dQI5qU-ClwR0t7WHMYKWqOIU';
  const SESSION_KEY = 'portal_session';
  const STALE_MS    = 30 * 60 * 1000; // 30 min — refresca permisos si es más viejo

  // ── Cliente Supabase ─────────────────────────────────────────────
  const _sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);

  // ── Helpers internos ─────────────────────────────────────────────
  function _getLocal() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
  }
  function _setLocal(data) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }
  function _clearAll() {
    sessionStorage.removeItem(SESSION_KEY);
    Object.keys(sessionStorage)
      .filter(k => k.startsWith('portal_bypass_'))
      .forEach(k => sessionStorage.removeItem(k));
  }

  function _loginUrl(error) {
    const ghPages = window.location.hostname.includes('github.io');
    const base    = ghPages ? '/portal-salud-publica-hrno' : _depthPrefix();
    const qs      = error ? '?error=' + encodeURIComponent(error) : '';
    return base + '/login.html' + qs;
  }

  // calcula el prefijo relativo según la profundidad del archivo actual
  function _depthPrefix() {
    const parts = window.location.pathname.split('/').filter(Boolean);
    // si estamos en la raíz del proyecto devuelve '.'
    // si estamos un nivel dentro devuelve '..'
    return parts.length > 1 ? '..' : '.';
  }

  function _redirect(url) { window.location.href = url; }

  // Orden numérico de niveles
  const NIVEL_ORD = { lectura: 0, registro: 1, reportes: 2, admin: 3 };

  // ── Carga permisos desde Supabase ────────────────────────────────
  async function _fetchPermisos(userId) {
    const [{ data: usuario, error: uErr }, { data: permisos }, { data: publicos }] = await Promise.all([
      _sb.from('portal_usuarios').select('id,nombre,email,rol_base,activo').eq('id', userId).single(),
      _sb.from('portal_permisos').select('modulo_id,nivel').eq('usuario_id', userId).eq('activo', true),
      _sb.from('portal_modulos').select('id').eq('es_publico', true)
    ]);

    if (uErr || !usuario) throw new Error('usuario_no_encontrado');
    if (!usuario.activo)  throw new Error('inactivo');

    let permisosMap = {};

    if (usuario.rol_base === 'superadmin') {
      // Superadmin: Admin en todo sin necesitar filas en portal_permisos
      const { data: todos } = await _sb.from('portal_modulos').select('id');
      (todos || []).forEach(m => { permisosMap[m.id] = 'admin'; });
    } else {
      (permisos || []).forEach(p => { permisosMap[p.modulo_id] = p.nivel; });
    }

    return {
      user:            usuario,
      permisos:        permisosMap,
      modulos_publicos: (publicos || []).map(m => m.id),
      cargado_en:      Date.now()
    };
  }

  // ── API pública ──────────────────────────────────────────────────

  /**
   * Llama esto al inicio de cada página protegida.
   * Si no hay sesión → redirige a login.
   * opciones.publico = true → la página es pública, no redirige.
   * Devuelve el objeto sesión { user, permisos, modulos_publicos }.
   */
  async function portalVerificarSesion(opciones) {
    opciones = opciones || {};
    const { data: { session } } = await _sb.auth.getSession();

    if (!session) {
      if (opciones.publico) return null;
      _redirect(_loginUrl());
      return null;
    }

    let local = _getLocal();
    const stale = !local || local.user?.id !== session.user.id || (Date.now() - (local.cargado_en || 0) > STALE_MS);

    if (stale) {
      try {
        local = await _fetchPermisos(session.user.id);
        _setLocal(local);
      } catch (err) {
        await _sb.auth.signOut();
        _clearAll();
        _redirect(_loginUrl(err.message));
        return null;
      }
    }

    return local;
  }

  /**
   * Verifica si el usuario actual tiene al menos el nivel indicado en un módulo.
   * nivelMinimo: 'lectura' | 'registro' | 'reportes' | 'admin'
   */
  function portalTienePermiso(moduloId, nivelMinimo) {
    nivelMinimo = nivelMinimo || 'lectura';
    const local = _getLocal();
    if (!local) return false;
    if ((local.modulos_publicos || []).includes(moduloId)) return true;
    const nivel = local.permisos[moduloId];
    if (!nivel) return false;
    return (NIVEL_ORD[nivel] ?? -1) >= (NIVEL_ORD[nivelMinimo] ?? 0);
  }

  /** Devuelve { id, nombre, email, rol_base } del usuario actual, o null. */
  function portalGetUsuario() {
    return _getLocal()?.user || null;
  }

  /**
   * Escribe el flag de bypass para módulos con admin propio.
   * Llamar ANTES de navegar al módulo si el usuario tiene nivel admin.
   * moduloId: 'mision_medica' | 'ebs' | 'tamizaje'
   */
  function portalEscribirBypass(moduloId) {
    if (!portalTienePermiso(moduloId, 'admin')) return;
    const KEYS = { mision_medica: 'portal_bypass_mm', ebs: 'portal_bypass_ebs', tamizaje: 'portal_bypass_vale' };
    const key  = KEYS[moduloId];
    if (!key) return;
    sessionStorage.setItem(key, JSON.stringify({
      uid:     _getLocal()?.user?.id,
      ts:      Date.now(),
      expires: Date.now() + 8 * 3600 * 1000
    }));
  }

  /**
   * Lee y valida un flag de bypass. Úsalo dentro del módulo con admin propio.
   * key: 'portal_bypass_mm' | 'portal_bypass_ebs' | 'portal_bypass_vale'
   * Devuelve true si el bypass es válido y no ha expirado.
   */
  function portalLeerBypass(key) {
    try {
      const flag = JSON.parse(sessionStorage.getItem(key) || 'null');
      return flag && typeof flag.expires === 'number' && flag.expires > Date.now();
    } catch { return false; }
  }

  /** Cierra sesión: limpia todo y redirige a login. */
  async function portalCerrarSesion() {
    await _sb.auth.signOut();
    _clearAll();
    _redirect(_loginUrl());
  }

  /** Registra un evento en portal_log (silencioso — no lanza errores). */
  async function portalLog(moduloId, evento, detalle) {
    const user = portalGetUsuario();
    if (!user) return;
    _sb.from('portal_log').insert({ usuario_id: user.id, modulo_id: moduloId, evento, detalle: detalle || {} }).then(() => {});
  }

  // Expone el cliente Supabase del portal para uso avanzado
  window.portalSb = _sb;

  // Expone funciones globales
  window.portalVerificarSesion = portalVerificarSesion;
  window.portalTienePermiso    = portalTienePermiso;
  window.portalGetUsuario      = portalGetUsuario;
  window.portalEscribirBypass  = portalEscribirBypass;
  window.portalLeerBypass      = portalLeerBypass;
  window.portalCerrarSesion    = portalCerrarSesion;
  window.portalLog             = portalLog;
})();

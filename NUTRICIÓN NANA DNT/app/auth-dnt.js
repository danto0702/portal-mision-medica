// auth-dnt.js — Sesión, roles y alcance territorial
// Usa el mismo proyecto Supabase del portal (SI-APS HRNO) y la misma cuenta de
// usuario, pero el rol dentro de este módulo vive en la tabla dnt_perfiles.
//
// Roles:
//   admin        — ve y edita todo, gestiona usuarios y elimina documentos
//   coordinador  — ve todos los municipios, descarga y cierra casos; no edita datos
//   responsable  — ve y edita únicamente los municipios que tiene asignados

(function (global) {
  'use strict';

  var SUPA_URL = 'https://wttljozqyaxlzilomnef.supabase.co';
  var SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0dGxqb3pxeWF4bHppbG9tbmVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzMDg5NTEsImV4cCI6MjA5NDg4NDk1MX0.kAQkgGq7RmZxTM9KlwI6KI7BjhEBy-8w6OdHVkOPBDM';

  var sb = global.supabase.createClient(SUPA_URL, SUPA_KEY);
  var _sesion = null;

  function urlLogin(motivo) {
    return 'login.html' + (motivo ? '?motivo=' + encodeURIComponent(motivo) : '');
  }

  /** Carga el perfil del módulo y los municipios del usuario autenticado. */
  async function cargarPerfil(userId) {
    var perfil = await sb.from('dnt_perfiles')
      .select('id,nombre,email,rol,estado,cargo,telefono').eq('id', userId).maybeSingle();
    if (perfil.error) throw new Error(perfil.error.message);

    // El superadministrador del portal entra como admin aunque no tenga perfil propio.
    if (!perfil.data) {
      var portal = await sb.from('portal_usuarios')
        .select('id,nombre,email,rol_base,activo').eq('id', userId).maybeSingle();
      if (portal.data && portal.data.rol_base === 'superadmin' && portal.data.activo) {
        perfil = { data: { id: userId, nombre: portal.data.nombre, email: portal.data.email,
                           rol: 'admin', estado: 'activo', cargo: 'Portal Salud Pública' } };
      } else {
        throw new Error('sin_perfil');
      }
    }
    if (perfil.data.estado === 'pendiente')  throw new Error('pendiente');
    if (perfil.data.estado === 'rechazado')  throw new Error('rechazado');
    if (perfil.data.estado !== 'activo')     throw new Error('inactivo');

    var muni = await sb.from('dnt_municipios').select('codigo,nombre,lat,lng').eq('activo', true).order('orden');
    var mios = await sb.from('dnt_usuarios_municipio').select('municipio').eq('usuario_id', userId);

    var todos = (muni.data || []).map(function (m) { return m.codigo; });
    var alcance = perfil.data.rol === 'responsable'
      ? (mios.data || []).map(function (r) { return r.municipio; })
      : todos;

    return {
      usuario: perfil.data,
      rol: perfil.data.rol,
      municipios: muni.data || [],
      alcance: alcance,
      cargado_en: Date.now()
    };
  }

  /** Llamar al inicio de cada página protegida. Redirige si no hay sesión válida. */
  async function verificar() {
    var s = await sb.auth.getSession();
    var session = s.data && s.data.session;
    if (!session) { location.href = urlLogin(); return null; }
    try {
      _sesion = await cargarPerfil(session.user.id);
      return _sesion;
    } catch (e) {
      await sb.auth.signOut();
      location.href = urlLogin(e.message);
      return null;
    }
  }

  function sesion()      { return _sesion; }
  function usuario()     { return _sesion && _sesion.usuario; }
  function rol()         { return _sesion ? _sesion.rol : null; }
  function esAdmin()     { return rol() === 'admin'; }
  function esCoord()     { return rol() === 'coordinador'; }
  function esResp()      { return rol() === 'responsable'; }
  function veTodo()      { return esAdmin() || esCoord(); }
  function alcance()     { return _sesion ? _sesion.alcance : []; }
  function municipios()  { return _sesion ? _sesion.municipios : []; }

  function nombreMunicipio(codigo) {
    var m = municipios().filter(function (x) { return x.codigo === codigo; })[0];
    return m ? m.nombre : codigo;
  }

  /** ¿Puede ver este municipio? */
  function puedeVer(mun) { return alcance().indexOf(mun) >= 0; }

  /** ¿Puede escribir en este municipio? El coordinador es de sólo lectura. */
  function puedeEditar(mun) {
    if (esAdmin()) return true;
    if (esResp())  return puedeVer(mun);
    return false;
  }

  /** ¿Puede cerrar o reabrir casos? Sólo coordinador y admin. */
  function puedeCerrarCasos() { return esAdmin() || esCoord(); }

  /** ¿Puede eliminar documentos? Sólo admin. */
  function puedeEliminar() { return esAdmin(); }

  // ── Autenticación ────────────────────────────────────────────────
  async function ingresar(email, clave) {
    var r = await sb.auth.signInWithPassword({ email: email.trim(), password: clave });
    if (r.error) throw r.error;
    return cargarPerfil(r.data.user.id);   // lanza si el perfil no está activo
  }

  /**
   * Autoregistro: crea la cuenta y deja el perfil en estado "pendiente".
   * El administrador debe aprobarlo y asignarle municipios antes de que pueda entrar.
   */
  async function registrarse(datos) {
    var r = await sb.auth.signUp({
      email: datos.email.trim(),
      password: datos.clave,
      options: { data: { nombre: datos.nombre } }
    });
    if (r.error) throw r.error;
    var uid = r.data.user && r.data.user.id;
    if (!uid) throw new Error('No se pudo crear la cuenta.');

    var p = await sb.from('dnt_perfiles').insert({
      id: uid,
      nombre: datos.nombre.trim(),
      email: datos.email.trim(),
      telefono: datos.telefono || null,
      cargo: datos.cargo || null,
      municipio_solicitado: datos.municipio || null
    });
    // Si ya existía el perfil (cuenta previa del portal) no es un error real.
    if (p.error && p.error.code !== '23505') throw new Error(p.error.message);
    return true;
  }

  async function recuperar(email) {
    var destino = location.href.replace(/[^/]*$/, 'login.html');
    var r = await sb.auth.resetPasswordForEmail(email.trim(), { redirectTo: destino });
    if (r.error) throw r.error;
  }

  async function cambiarClave(nueva) {
    var r = await sb.auth.updateUser({ password: nueva });
    if (r.error) throw r.error;
  }

  async function salir() {
    await sb.auth.signOut();
    _sesion = null;
    location.href = urlLogin();
  }

  /** Auditoría (E39). Nunca interrumpe el flujo del usuario. */
  function registrar(evento, detalle) {
    var u = usuario();
    if (!u) return;
    var d = detalle || {};
    sb.from('dnt_log').insert({
      usuario_id: u.id,
      evento: evento,
      entidad: d.entidad || null,
      entidad_id: d.entidad_id || null,
      caso_id: d.caso_id || null,
      municipio: d.municipio || null,
      detalle: d.detalle || {}
    }).then(function () {}, function () {});
  }

  global.DNTAuth = {
    sb: sb, verificar: verificar, sesion: sesion, usuario: usuario, rol: rol,
    esAdmin: esAdmin, esCoord: esCoord, esResp: esResp, veTodo: veTodo,
    alcance: alcance, municipios: municipios, nombreMunicipio: nombreMunicipio,
    puedeVer: puedeVer, puedeEditar: puedeEditar,
    puedeCerrarCasos: puedeCerrarCasos, puedeEliminar: puedeEliminar,
    ingresar: ingresar, registrarse: registrarse, recuperar: recuperar,
    cambiarClave: cambiarClave, salir: salir, registrar: registrar
  };
})(window);

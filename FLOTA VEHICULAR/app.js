/**
 * FLOTA VEHICULAR HRNO — aplicación
 * ESE Hospital Regional Noroccidental · Coordinación de Salud Pública
 *
 * Una sola página, sin framework. Tres roles: principal, coordinación, conductor.
 */

// ── Configuración ────────────────────────────────────────────────────────────
// En producción la aplicación se publica en GitHub Pages y la API vive en
// Cloudflare, así que son dominios distintos. Al servirla localmente (servidor
// de pruebas) la API va en el mismo origen, y así no hay que configurar nada.
/**
 * Versión mínima del Worker que esta aplicación necesita.
 *
 * La aplicación se actualiza sola desde GitHub Pages, pero el Worker se publica
 * a mano en Cloudflare. Cuando quedan desfasados, el Worker viejo acepta las
 * peticiones e ignora en silencio lo que no entiende — un campo que no se
 * guarda y ningún mensaje de error. Por eso se comprueba y se avisa.
 */
const VERSION_API_REQUERIDA = 2;

const esLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
const API = localStorage.getItem('flota_api') ||
            (esLocal ? location.origin : 'https://flota-hrno.danto0702.workers.dev');

const TIPOS_JORNADA = {
  ebs:             { et: 'Ruta EBS',       color: 'azul'   },
  jornada:         { et: 'Jornada',        color: 'morado' },
  vacunacion:      { et: 'Vacunación',     color: 'verde'  },
  disponible:      { et: 'Disponible',     color: 'gris'   },
  traslado_ciudad: { et: 'Fuera del área', color: 'ambar'  },
  administrativo:  { et: 'Administrativo', color: 'gris'   },
};

// Checklist: 5 distintivos del vehículo + 4 elementos.
const DISTINTIVOS = [
  ['lateral_izquierdo', 'Lateral izquierdo'],
  ['lateral_derecho',   'Lateral derecho'],
  ['frontal',           'Frontal'],
  ['trasero',           'Trasero'],
  ['techo',             'Techo'],
];
const ELEMENTOS = [
  ['bandera',            'Bandera'],
  ['chaleco',            'Chaleco'],
  ['carnet',             'Carnet'],
  ['carta_presentacion', 'Carta de presentación'],
];
const EST_DISTINTIVO = ['bueno', 'deteriorado', 'ausente', 'obstruido'];
const EST_ELEMENTO   = ['presente', 'deteriorado', 'ausente', 'vencido'];
const FALTANTES      = ['ausente', 'obstruido', 'vencido'];

const TIPOS_EVENTO = [
  ['varada', 'Varada o avería'], ['accidente', 'Accidente'], ['reten', 'Retén'],
  ['bloqueo_via', 'Bloqueo de vía'], ['derrumbe', 'Derrumbe'],
  ['orden_publico', 'Orden público'], ['negacion_paso', 'Negación de paso'],
  ['falla_comunicaciones', 'Falla de comunicaciones'], ['retraso', 'Retraso'],
  ['cancelacion', 'Cancelación'], ['tanqueo', 'Tanqueo'],
  ['mantenimiento', 'Mantenimiento'], ['novedad_distintivo', 'Novedad de distintivo'],
  ['otro', 'Otro'],
];

// ── Estado ───────────────────────────────────────────────────────────────────
let sesion = null;
let cat = { municipios: [], destinos: [], ips: [] };
let vehiculos = [], personas = [];
let vistaActual = '';
const graficas = {};

// ── Utilidades ───────────────────────────────────────────────────────────────
const $  = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const hoy = () => new Date().toLocaleDateString('sv-SE');   // YYYY-MM-DD local
const nDias = (f, n) => new Date(Date.parse(f + 'T12:00:00') + n * 864e5).toLocaleDateString('sv-SE');
const num = n => (n == null ? '—' : Number(n).toLocaleString('es-CO'));
const pesos = n => (n == null ? '—' : '$' + Math.round(n).toLocaleString('es-CO'));

function hora(iso) {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' });
}
function fechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso.endsWith('Z') || iso.includes('+') ? iso : iso.replace(' ', 'T') + 'Z');
  return d.toLocaleString('es-CO', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const diaSemana = f => DIAS[new Date(f + 'T12:00:00').getDay()];

function aviso(texto, clase, titulo) {
  const d = document.createElement('div');
  d.className = 'aviso ' + (clase || '');
  d.innerHTML = (titulo ? `<b>${esc(titulo)}</b>` : '') + esc(texto);
  $('#avisos').appendChild(d);
  setTimeout(() => { d.style.opacity = '0'; setTimeout(() => d.remove(), 300); }, 4200);
}

// ── Llamadas a la API ────────────────────────────────────────────────────────
async function api(ruta, opciones = {}) {
  const cab = { 'Content-Type': 'application/json' };
  if (sesion?.token) cab.Authorization = 'Bearer ' + sesion.token;
  const res = await fetch(API + ruta, {
    method: opciones.metodo || 'GET',
    headers: cab,
    body: opciones.cuerpo ? JSON.stringify(opciones.cuerpo) : undefined,
  });
  let datos = {};
  try { datos = await res.json(); } catch { /* respuesta sin cuerpo */ }
  if (res.status === 401 && sesion) { salir(true); throw new Error('Su sesión expiró'); }
  if (!res.ok) throw new Error(datos.error || `Error ${res.status}`);
  return datos;
}

// ── Cola sin señal ───────────────────────────────────────────────────────────
// Las marcas tomadas sin cobertura se guardan aquí y se envían solas al volver.
const cola = {
  leer:   () => { try { return JSON.parse(localStorage.getItem('flota_cola') || '[]'); } catch { return []; } },
  guardar(l) { localStorage.setItem('flota_cola', JSON.stringify(l)); this.pintar(); },
  agregar(m) { const l = this.leer(); l.push({ ...m, local_id: 'l' + Date.now() }); this.guardar(l); },
  pintar() {
    const n = this.leer().length;
    $('#offline-n').textContent = n;
    $('#barra-offline').classList.toggle('on', n > 0 || !navigator.onLine);
  },
  async sincronizar() {
    const marcas = this.leer();
    if (!marcas.length || !navigator.onLine || !sesion) return;
    try {
      const r = await api('/api/sync', { metodo: 'POST', cuerpo: { marcas } });
      const ok = r.resultados.filter(x => x.ok).map(x => x.local_id);
      this.guardar(marcas.filter(m => !ok.includes(m.local_id)));
      if (ok.length) {
        aviso(`${ok.length} marca(s) enviada(s) al recuperar la señal`, 'ok', 'Sincronizado');
        if (vistaActual === 'hoy') verHoy();
      }
    } catch { /* se reintenta en la próxima oportunidad */ }
  },
};
window.addEventListener('online', () => { cola.pintar(); cola.sincronizar(); });
window.addEventListener('offline', () => cola.pintar());

// ── Ubicación ────────────────────────────────────────────────────────────────
// Se pide SOLO al marcar salida o llegada. Nunca hay rastreo en segundo plano.
function ubicacion() {
  return new Promise(resolve => {
    if (!navigator.geolocation) return resolve({});
    const listo = p => resolve({
      lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy,
    });
    navigator.geolocation.getCurrentPosition(listo, () => resolve({}),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  });
}

// ── Sesión ───────────────────────────────────────────────────────────────────
async function entrar(ev) {
  ev.preventDefault();
  const btn = $('#in-btn'), err = $('#in-error');
  btn.disabled = true; btn.textContent = 'Entrando...'; err.style.display = 'none';
  try {
    const r = await api('/api/auth/login', {
      metodo: 'POST',
      cuerpo: { usuario: $('#in-usuario').value.trim(), clave: $('#in-clave').value },
    });
    sesion = { token: r.token, ...r.usuario };
    localStorage.setItem('flota_sesion', JSON.stringify(sesion));
    await iniciar();
  } catch (e) {
    err.textContent = e.message;
    err.style.display = 'block';
  } finally {
    btn.disabled = false; btn.textContent = 'Entrar';
  }
}

function salir(expiro) {
  if (!expiro && sesion) api('/api/auth/logout', { metodo: 'POST' }).catch(() => {});
  sesion = null;
  localStorage.removeItem('flota_sesion');
  $('#app').hidden = true;
  $('#ingreso').style.display = 'flex';
  $('#in-clave').value = '';
  if (expiro) { $('#in-error').textContent = 'Su sesión expiró. Ingrese de nuevo.'; $('#in-error').style.display = 'block'; }
}

// ── Menú por rol ─────────────────────────────────────────────────────────────
const ico = d => `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
const ICONOS = {
  hoy:        ico('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  itinerario: ico('<rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'),
  dashboard:  ico('<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-4"/>'),
  trayectos:  ico('<path d="M14 17H6V5h11l4 6v6h-3"/><circle cx="17.5" cy="17.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/>'),
  eventos:    ico('<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>'),
  vehiculos:  ico('<path d="M14 17H6V5h11l4 6v6h-3"/><circle cx="17.5" cy="17.5" r="2.5"/><circle cx="6.5" cy="17.5" r="2.5"/>'),
  personas:   ico('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9"/>'),
  usuarios:   ico('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  ajustes:    ico('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6 1.65 1.65 0 0 0 10 3.09V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.2.6.76 1 1.4 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  auditoria:  ico('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15h6M9 11h3"/>'),
};
const VISTAS = {
  hoy:        { et: 'Mi día',      fn: () => verHoy() },
  itinerario: { et: 'Itinerario',  fn: () => verItinerario() },
  dashboard:  { et: 'Dashboard',   fn: () => verDashboard() },
  trayectos:  { et: 'Trayectos',   fn: () => verTrayectos() },
  eventos:    { et: 'Novedades',   fn: () => verEventos() },
  vehiculos:  { et: 'Vehículos',   fn: () => verVehiculos() },
  personas:   { et: 'Personas',    fn: () => verPersonas() },
  usuarios:   { et: 'Usuarios',    fn: () => verUsuarios() },
  ajustes:    { et: 'Ajustes',     fn: () => verAjustes() },
};
const MENU = {
  conductor:    ['hoy', 'eventos'],
  coordinacion: ['itinerario', 'dashboard', 'trayectos', 'eventos', 'hoy'],
  principal:    ['itinerario', 'dashboard', 'trayectos', 'eventos', 'vehiculos', 'personas', 'usuarios', 'ajustes'],
};

function ir(v) {
  vistaActual = v;
  $$('#nav button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  VISTAS[v].fn();
}

async function iniciar() {
  $('#ingreso').style.display = 'none';
  $('#app').hidden = false;
  const rol = { principal: 'Administrador', coordinacion: 'Coordinación', conductor: 'Conductor' }[sesion.rol];
  $('#tb-rol').textContent = rol;

  $('#nav').innerHTML = MENU[sesion.rol].map(v =>
    `<button data-v="${v}" onclick="ir('${v}')">${ICONOS[v] || ''}${VISTAS[v].et}</button>`).join('');

  cola.pintar();
  comprobarVersion();
  try { cat = await api('/api/catalogos'); } catch { /* se reintenta luego */ }
  if (sesion.rol !== 'conductor') {
    try { [vehiculos, personas] = await Promise.all([api('/api/vehiculos'), api('/api/personas')]); }
    catch { /* el conductor no necesita estos listados */ }
  }

  ir(MENU[sesion.rol][0]);
  cola.sincronizar();

  if (sesion.debe_cambiar_clave) setTimeout(modalCambiarClave, 400);
}

/** Avisa si el Worker publicado es más viejo que lo que la aplicación espera. */
async function comprobarVersion() {
  let salud;
  try { salud = await (await fetch(API + '/api/salud')).json(); }
  catch { return; }                                   // sin red: no es el momento
  const v = Number(salud.version || 1);
  if (v >= VERSION_API_REQUERIDA) return;

  const barra = $('#barra-version');
  barra.innerHTML = `El servidor está desactualizado (versión ${v}; esta pantalla
    necesita la ${VERSION_API_REQUERIDA}). Algunos cambios no se guardarán.
    ${sesion.rol === 'principal'
      ? 'Vuelva a publicar el Worker en Cloudflare pegando <b>flota-worker-completo.js</b>.'
      : 'Avise a la Coordinación de Salud Pública.'}`;
  barra.classList.add('on');
}

// ── Modal ────────────────────────────────────────────────────────────────────
function abrirModal(titulo, cuerpo, pie) {
  $('#modal-tit').textContent = titulo;
  $('#modal-cpo').innerHTML = cuerpo;
  $('#modal-pie').innerHTML = pie || '<button class="btn sec" onclick="cerrarModal()">Cerrar</button>';
  $('#modal').classList.add('on');
}
const cerrarModal = () => $('#modal').classList.remove('on');

function modalCambiarClave() {
  abrirModal('Cambie su clave', `
    <div class="nota avi" style="margin-bottom:1rem">
      Está usando una clave temporal. Defina una propia antes de continuar.
    </div>
    <div class="campo"><label class="lb">Clave actual <span class="req">*</span></label>
      <input class="inp" type="password" id="cc-actual"></div>
    <div class="campo"><label class="lb">Clave nueva <span class="req">*</span></label>
      <input class="inp" type="password" id="cc-nueva" placeholder="Mínimo 8 caracteres"></div>
    <div class="campo"><label class="lb">Repita la clave nueva <span class="req">*</span></label>
      <input class="inp" type="password" id="cc-rep"></div>
    <div id="cc-error" class="nota avi" style="display:none"></div>`,
    `<button class="btn" onclick="guardarClave()">Guardar</button>`);
}

async function guardarClave() {
  const a = $('#cc-actual').value, n = $('#cc-nueva').value, r = $('#cc-rep').value;
  const err = $('#cc-error');
  const mostrar = m => { err.textContent = m; err.style.display = 'block'; };
  if (n.length < 8) return mostrar('La clave nueva debe tener al menos 8 caracteres.');
  if (n !== r)      return mostrar('Las dos claves nuevas no coinciden.');
  try {
    await api('/api/auth/cambiar-clave', { metodo: 'POST', cuerpo: { clave_actual: a, clave_nueva: n } });
    sesion.debe_cambiar_clave = false;
    localStorage.setItem('flota_sesion', JSON.stringify(sesion));
    cerrarModal();
    aviso('Su clave quedó actualizada', 'ok', 'Listo');
  } catch (e) { mostrar(e.message); }
}

// ═══════════════════════════════════════════════════════════════════════════
// MI DÍA — pantalla del conductor
// ═══════════════════════════════════════════════════════════════════════════

let diaActual = null;

async function verHoy() {
  $('#main').innerHTML = '<div class="cargando">Cargando su día...</div>';
  try {
    diaActual = await api('/api/mi-dia?fecha=' + hoy());
  } catch (e) {
    return $('#main').innerHTML = `<div class="card"><div class="nota avi">${esc(e.message)}</div></div>`;
  }
  const { itinerario: it, trayecto_abierto: abierto, trayectos } = diaActual;
  const f = hoy();

  const tj = it ? (TIPOS_JORNADA[it.tipo_jornada] || TIPOS_JORNADA.ebs) : null;

  $('#main').innerHTML = `
    <div class="cab">
      <div><h1>${diaSemana(f)}</h1>
        <p>${new Date(f + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
    </div>

    ${it ? `
      <div class="card" style="border-left:4px solid var(--azul)">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap">
          <div>
            <div style="font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Programación de hoy</div>
            <div style="font-size:1.25rem;font-weight:800;margin-top:.2rem">${esc(it.destino || 'Sin destino asignado')}</div>
            <div style="color:var(--text-soft);font-size:.85rem;margin-top:.1rem">
              ${esc(it.municipio || '')} · Vehículo <span class="placa">${esc(it.placa)}</span>
            </div>
          </div>
          <span class="etq ${tj.color}">${tj.et}</span>
        </div>
        ${it.observaciones ? `<div class="nota" style="margin-top:.75rem">${esc(it.observaciones)}</div>` : ''}
      </div>` : `
      <div class="card">
        <div class="nota avi">Hoy no tiene programación asignada. Si va a salir de todos modos,
        avise a Coordinación para que quede registrada.</div>
      </div>`}

    <div class="card" style="margin-top:.85rem">
      ${abierto ? `
        <div class="nota" style="margin-bottom:.85rem">
          <b>Viaje en curso</b><br>
          Salió de ${esc(abierto.lugar_salida || 'la base')} a las ${hora(abierto.ts_salida)}
          · ${esc(abierto.consecutivo)}
        </div>
        <button class="btn-gigante llegada" onclick="marcar('llegada')">
          REGISTRAR LLEGADA
          <small>Toque al llegar a su destino</small>
        </button>` : `
        <button class="btn-gigante salida" onclick="marcar('salida')" ${!it && !diaActual.permitirSinItinerario ? '' : ''}>
          REGISTRAR SALIDA
          <small>Toque al arrancar</small>
        </button>`}
      <p style="text-align:center;font-size:.72rem;color:var(--muted);margin:.85rem 0 0">
        Se registra la hora del servidor y su ubicación en ese momento.
        No hay seguimiento en segundo plano.
      </p>
    </div>

    <div class="grid g2" style="margin-top:.85rem">
      <button class="btn sec" style="padding:.85rem" onclick="modalChecklist()">
        Diligenciar checklist
      </button>
      <button class="btn ambar" style="padding:.85rem" onclick="modalEvento()">
        Reportar novedad
      </button>
    </div>

    <h2 style="margin:1.4rem 0 .6rem">Viajes de hoy</h2>
    ${trayectos.length ? trayectos.map(t => `
      <div class="card" style="padding:.75rem .85rem;margin-bottom:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem">
          <b style="font-size:.8rem;color:var(--muted)">${esc(t.consecutivo || '')}</b>
          ${t.estado === 'cerrado'
            ? '<span class="etq verde">Cerrado</span>'
            : '<span class="etq ambar">En curso</span>'}
        </div>
        <div style="display:flex;align-items:center;gap:.6rem;margin-top:.5rem">
          <div style="flex:1">
            <div style="font-size:.68rem;color:var(--muted);font-weight:700">SALIÓ</div>
            <div style="font-weight:700">${hora(t.ts_salida)}</div>
            <div style="font-size:.78rem;color:var(--text-soft)">${esc(t.lugar_salida || '—')}</div>
          </div>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" style="flex:none"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          <div style="flex:1">
            <div style="font-size:.68rem;color:var(--muted);font-weight:700">LLEGÓ</div>
            <div style="font-weight:700">${hora(t.ts_llegada)}</div>
            <div style="font-size:.78rem;color:var(--text-soft)">${esc(t.lugar_llegada || '—')}</div>
          </div>
        </div>
      </div>`).join('')
      : '<div class="card"><div class="vacio">Todavía no ha registrado viajes hoy.</div></div>'}
  `;
}

/** Marca salida o llegada. Si no hay señal, guarda en el celular y sigue. */
async function marcar(hito) {
  const it = diaActual?.itinerario;
  const abierto = diaActual?.trayecto_abierto;

  const municipios = cat.municipios.map(m =>
    `<option value="${m.id}" ${it && it.municipio_id == m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('');
  const lugarSugerido = hito === 'salida'
    ? (it ? '' : '') : (it?.destino || '');

  abrirModal(hito === 'salida' ? 'Registrar salida' : 'Registrar llegada', `
    <div class="campo"><label class="lb">Municipio <span class="req">*</span></label>
      <select class="inp" id="mk-mun"><option value="">— Seleccione —</option>${municipios}</select></div>
    <div class="campo"><label class="lb">Lugar <span class="req">*</span></label>
      <input class="inp" id="mk-lugar" value="${esc(lugarSugerido)}"
        placeholder="${hito === 'salida' ? 'Ej: Base Ábrego' : 'Ej: Santa Inés'}"></div>
    <div class="campo"><label class="lb">Kilometraje ${hito === 'salida' ? 'inicial' : 'final'}</label>
      <input class="inp" id="mk-km" type="number" inputmode="numeric" placeholder="Opcional"></div>
    ${hito === 'salida' ? `
      <div class="campo"><label class="lb">Personas a bordo</label>
        <input class="inp" id="mk-trip" type="number" inputmode="numeric" placeholder="Opcional"></div>` : ''}
    <div class="campo"><label class="lb">Observaciones</label>
      <textarea class="inp" id="mk-obs" rows="2" placeholder="Opcional"></textarea></div>
    <div id="mk-gps" class="nota">Al guardar se solicitará su ubicación.</div>`,
    `<button class="btn sec" onclick="cerrarModal()">Cancelar</button>
     <button class="btn ${hito === 'salida' ? 'verde' : ''}" id="mk-btn"
       onclick="guardarMarca('${hito}')">Guardar</button>`);
}

async function guardarMarca(hito) {
  const btn = $('#mk-btn');
  const mun = $('#mk-mun').value, lugar = $('#mk-lugar').value.trim();
  if (!mun || !lugar) return aviso('Indique el municipio y el lugar', 'mal', 'Faltan datos');

  btn.disabled = true; btn.textContent = 'Ubicando...';
  $('#mk-gps').textContent = 'Obteniendo su ubicación...';
  const geo = await ubicacion();
  $('#mk-gps').textContent = geo.lat
    ? `Ubicación tomada (precisión ${Math.round(geo.precision)} m)`
    : 'No se pudo obtener la ubicación. La marca se registra igual, señalada sin GPS.';

  const km = $('#mk-km').value;
  const datos = {
    municipio_id: Number(mun), lugar, ...geo,
    observaciones: $('#mk-obs').value.trim() || undefined,
    ts_dispositivo: new Date().toISOString(),
  };
  if (hito === 'salida') {
    datos.km_inicial = km ? Number(km) : undefined;
    datos.num_tripulantes = $('#mk-trip').value ? Number($('#mk-trip').value) : undefined;
    datos.vehiculo_id = diaActual?.itinerario?.vehiculo_id;
  } else {
    datos.km_final = km ? Number(km) : undefined;
  }

  btn.textContent = 'Guardando...';
  try {
    if (hito === 'salida') await api('/api/trayectos/salida', { metodo: 'POST', cuerpo: datos });
    else await api(`/api/trayectos/${diaActual.trayecto_abierto.id}/llegada`, { metodo: 'POST', cuerpo: datos });
    cerrarModal();
    aviso(hito === 'salida' ? 'Salida registrada' : 'Llegada registrada', 'ok', 'Listo');
    verHoy();
  } catch (e) {
    // Sin señal: se guarda en el celular y se envía cuando vuelva la cobertura.
    if (!navigator.onLine || /fetch|network|failed/i.test(e.message)) {
      cola.agregar({
        hito, ...datos,
        fecha_operacion: hoy(),
        trayecto_id: hito === 'llegada' ? diaActual.trayecto_abierto.id : undefined,
      });
      cerrarModal();
      aviso('Sin señal: la marca quedó guardada y se enviará sola', 'avi', 'Guardado en el celular');
    } else {
      aviso(e.message, 'mal', 'No se pudo registrar');
      btn.disabled = false; btn.textContent = 'Guardar';
    }
  }
}

// ── Checklist ────────────────────────────────────────────────────────────────
function modalChecklist() {
  const fila = ([clave, et], estados, pre) => `
    <div class="chk-item">
      <span class="nm">${et}</span>
      <select class="inp" data-item="${clave}">
        ${estados.map(e => `<option value="${e}" ${e === pre ? 'selected' : ''}>${e[0].toUpperCase() + e.slice(1)}</option>`).join('')}
      </select>
    </div>`;

  abrirModal('Checklist de salida', `
    <div class="chk-sec">Distintivos del vehículo (5)</div>
    ${DISTINTIVOS.map(d => fila(d, EST_DISTINTIVO, 'bueno')).join('')}
    <div class="chk-sec">Elementos (4)</div>
    ${ELEMENTOS.map(d => fila(d, EST_ELEMENTO, 'presente')).join('')}
    <div class="campo" style="margin-top:1rem"><label class="lb">Chalecos disponibles</label>
      <input class="inp" id="chk-chalecos" type="number" inputmode="numeric" placeholder="Cantidad"></div>
    <div class="campo"><label class="lb">Observaciones</label>
      <textarea class="inp" id="chk-obs" rows="2" placeholder="Opcional"></textarea></div>
    <div class="nota">Un distintivo <b>obstruido</b> —tapado por barro, lona o equipaje— cuenta
    como faltante: si no se ve, no protege.</div>`,
    `<button class="btn sec" onclick="cerrarModal()">Cancelar</button>
     <button class="btn" id="chk-btn" onclick="guardarChecklist()">Guardar checklist</button>`);
}

async function guardarChecklist() {
  const btn = $('#chk-btn');
  const items = $$('#modal-cpo select[data-item]').map(s => ({
    item: s.dataset.item,
    estado: s.value,
    cantidad: s.dataset.item === 'chaleco' && $('#chk-chalecos').value
      ? Number($('#chk-chalecos').value) : undefined,
    observacion: $('#chk-obs').value.trim() || undefined,
  }));
  const vehiculoId = diaActual?.itinerario?.vehiculo_id || diaActual?.trayecto_abierto?.vehiculo_id;
  if (!vehiculoId) return aviso('No hay vehículo asignado hoy', 'mal', 'No se puede guardar');

  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    const r = await api('/api/checklists', {
      metodo: 'POST',
      cuerpo: {
        vehiculo_id: vehiculoId,
        trayecto_id: diaActual?.trayecto_abierto?.id,
        momento: diaActual?.trayecto_abierto ? 'regreso' : 'presalida',
        items,
      },
    });
    cerrarModal();
    aviso(r.faltantes
      ? `Registrado con ${r.faltantes} novedad(es). Quedó reportado.`
      : 'Checklist completo, todo en orden', r.faltantes ? 'avi' : 'ok', 'Listo');
  } catch (e) {
    // El servidor puede bloquear la salida si falta un distintivo.
    aviso(e.message, 'mal', 'No se pudo guardar');
    btn.disabled = false; btn.textContent = 'Guardar checklist';
  }
}

// ── Novedades ────────────────────────────────────────────────────────────────
function modalEvento() {
  abrirModal('Reportar novedad', `
    <div class="campo"><label class="lb">Tipo <span class="req">*</span></label>
      <select class="inp" id="ev-tipo">${TIPOS_EVENTO.map(([v, e]) => `<option value="${v}">${e}</option>`).join('')}</select></div>
    <div class="campo"><label class="lb">Gravedad</label>
      <select class="inp" id="ev-grav">
        <option value="baja">Baja</option><option value="media" selected>Media</option>
        <option value="alta">Alta</option><option value="critica">Crítica</option></select></div>
    <div class="campo"><label class="lb">Municipio</label>
      <select class="inp" id="ev-mun"><option value="">— Seleccione —</option>
        ${cat.municipios.map(m => `<option value="${m.id}">${esc(m.nombre)}</option>`).join('')}</select></div>
    <div class="campo"><label class="lb">Lugar</label><input class="inp" id="ev-lugar"></div>
    <div class="campo"><label class="lb">Qué pasó <span class="req">*</span></label>
      <textarea class="inp" id="ev-desc" rows="3"></textarea></div>
    <div class="campo"><label class="lb">Qué se hizo</label>
      <textarea class="inp" id="ev-acc" rows="2"></textarea></div>`,
    `<button class="btn sec" onclick="cerrarModal()">Cancelar</button>
     <button class="btn ambar" id="ev-btn" onclick="guardarEvento()">Reportar</button>`);
}

async function guardarEvento() {
  const desc = $('#ev-desc').value.trim();
  if (!desc) return aviso('Describa qué pasó', 'mal', 'Falta la descripción');
  const btn = $('#ev-btn'); btn.disabled = true; btn.textContent = 'Enviando...';
  const geo = await ubicacion();
  try {
    await api('/api/eventos', {
      metodo: 'POST',
      cuerpo: {
        tipo: $('#ev-tipo').value, gravedad: $('#ev-grav').value,
        municipio_id: $('#ev-mun').value ? Number($('#ev-mun').value) : undefined,
        lugar: $('#ev-lugar').value.trim() || undefined,
        descripcion: desc, acciones: $('#ev-acc').value.trim() || undefined,
        trayecto_id: diaActual?.trayecto_abierto?.id,
        vehiculo_id: diaActual?.itinerario?.vehiculo_id,
        ...geo,
      },
    });
    cerrarModal();
    aviso('La novedad quedó reportada', 'ok', 'Listo');
    if (vistaActual === 'eventos') verEventos();
  } catch (e) {
    aviso(e.message, 'mal', 'No se pudo reportar');
    btn.disabled = false; btn.textContent = 'Reportar';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ITINERARIO — la matriz que reemplaza el Excel
// ═══════════════════════════════════════════════════════════════════════════

let itinDesde = null, itinDatos = [];

async function verItinerario() {
  if (!itinDesde) {
    // Arranca el lunes de la semana en curso
    const d = new Date(hoy() + 'T12:00:00');
    itinDesde = nDias(hoy(), -((d.getDay() + 6) % 7));
  }
  const hasta = nDias(itinDesde, 13);   // dos semanas, como el archivo original

  $('#main').innerHTML = '<div class="cargando">Cargando itinerario...</div>';
  try {
    itinDatos = await api(`/api/itinerario?desde=${itinDesde}&hasta=${hasta}`);
  } catch (e) {
    return $('#main').innerHTML = `<div class="card"><div class="nota avi">${esc(e.message)}</div></div>`;
  }

  const dias = Array.from({ length: 14 }, (_, i) => nDias(itinDesde, i));
  const activos = vehiculos.filter(v => v.activo !== 0);
  const porClave = {};
  itinDatos.forEach(i => { porClave[i.fecha + '|' + i.vehiculo_id] = i; });

  const celda = (v, f) => {
    const it = porClave[f + '|' + v.id];
    if (!it) {
      return `<td style="padding:.2rem"><div class="itin-celda vacia"
        onclick="modalItinerario(null,${v.id},'${f}')">+</div></td>`;
    }
    const tj = TIPOS_JORNADA[it.tipo_jornada] || TIPOS_JORNADA.ebs;
    const ejec = it.trayectos_cerrados > 0;
    const enBase = it.tipo_jornada === 'disponible';
    const titulo = enBase ? 'Disponible' : (it.destino || tj.et);
    const pie = enBase ? (it.municipio || 'en base') : tj.et;
    return `<td style="padding:.2rem"><div class="itin-celda ${it.tipo_jornada}"
      onclick="modalItinerario(${it.id},${v.id},'${f}')">
      <span class="dest">${esc(titulo)}</span>
      <span class="tj" style="color:var(--${tj.color === 'gris' ? 'muted' : tj.color})">${esc(pie)}</span>
      <div class="marcas">
        <span class="punto ${ejec ? 'ok' : 'no'}" title="${ejec ? 'Ejecutado' : 'Sin marcar'}"></span>
        <span style="font-size:.62rem;color:var(--muted)">${ejec ? 'ejecutado' : 'pendiente'}</span>
        ${it.num_cambios ? `<span class="mini-cambios" title="${it.num_cambios} modificación(es)">✎${it.num_cambios}</span>` : ''}
      </div></div></td>`;
  };

  const rotulo = f => {
    const esHoy = f === hoy();
    return `<th style="${esHoy ? 'color:var(--azul)' : ''}">
      ${diaSemana(f).slice(0, 3)}<br>
      <span style="font-weight:800;font-size:.9rem">${f.slice(8)}</span>
      <span style="font-weight:500;text-transform:none">/${f.slice(5, 7)}</span></th>`;
  };

  $('#main').innerHTML = `
    <div class="cab">
      <div><h1>Itinerario</h1>
        <p>Programación de vehículos y conductores. Cada cambio queda registrado con su autor.</p></div>
      <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
        <button class="btn sec sm" onclick="moverItin(-14)">← Anterior</button>
        <button class="btn sec sm" onclick="itinDesde=null;verItinerario()">Hoy</button>
        <button class="btn sec sm" onclick="moverItin(14)">Siguiente →</button>
        <button class="btn sm" onclick="modalCopiarSemana()">Copiar quincena</button>
      </div>
    </div>

    ${!activos.length ? `
      <div class="card"><div class="vacio">
        <p>Todavía no hay vehículos registrados.</p>
        ${sesion.rol === 'principal'
          ? '<button class="btn" onclick="ir(\'vehiculos\')">Registrar el primero</button>'
          : '<p style="font-size:.85rem">El administrador debe registrarlos primero.</p>'}
      </div></div>` : `
      <div class="tabla-env"><table>
        <thead><tr>
          <th style="position:sticky;left:0;background:var(--surface-2);z-index:2;min-width:150px">Vehículo</th>
          ${dias.map(rotulo).join('')}
        </tr></thead>
        <tbody>${activos.map(v => `
          <tr>
            <td style="position:sticky;left:0;background:var(--surface);z-index:1;border-right:1px solid var(--border)">
              <div class="placa">${esc(v.placa)}</div>
              <div style="font-size:.72rem;color:var(--muted)">${esc(v.conductor_actual || 'Sin conductor')}</div>
            </td>
            ${dias.map(f => celda(v, f)).join('')}
          </tr>`).join('')}</tbody>
      </table></div>

      <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:.85rem;font-size:.75rem;color:var(--muted)">
        ${Object.entries(TIPOS_JORNADA).map(([k, t]) =>
          `<span><span style="display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--${t.color === 'gris' ? 'muted' : t.color});vertical-align:middle"></span> ${t.et}</span>`).join('')}
        <span><span class="punto ok"></span> ejecutado (el conductor marcó salida)</span>
        <span><span class="mini-cambios">✎</span> modificado</span>
      </div>`}
  `;
}

function moverItin(n) { itinDesde = nDias(itinDesde, n); verItinerario(); }

async function modalItinerario(id, vehiculoId, fecha) {
  const it = id ? itinDatos.find(x => x.id === id) : null;
  const conductores = personas.filter(p => p.es_conductor);
  const veh = vehiculos.find(v => v.id === vehiculoId);
  // En una programación nueva se propone el conductor predeterminado del vehículo.
  const condPropuesto = it ? it.conductor_id : (veh ? veh.conductor_id : null);

  abrirModal(it ? 'Modificar programación' : 'Adjudicar desplazamiento', `
    <div class="nota" style="margin-bottom:1rem">
      <b>${esc(veh?.placa || '')}</b> · ${diaSemana(fecha)}
      ${new Date(fecha + 'T12:00:00').toLocaleDateString('es-CO', { day: 'numeric', month: 'long' })}
    </div>
    <div class="campo"><label class="lb">Tipo de jornada <span class="req">*</span></label>
      <select class="inp" id="it-tipo" onchange="itinToggleDestino()">
        ${Object.entries(TIPOS_JORNADA).map(([k, t]) =>
          `<option value="${k}" ${it && it.tipo_jornada === k ? 'selected' : ''}>${t.et}</option>`).join('')}
      </select></div>
    <div class="campo"><label class="lb">Conductor</label>
      <select class="inp" id="it-cond"><option value="">— Sin asignar —</option>
        ${conductores.map(p => `<option value="${p.id}" ${condPropuesto == p.id ? 'selected' : ''}>${esc(p.nombres)} ${esc(p.apellidos || '')}</option>`).join('')}
      </select>
      ${!it && veh && veh.conductor_id ? `<p style="font-size:.72rem;color:var(--muted);margin:.25rem 0 0">
        Propuesto: conductor predeterminado de ${esc(veh.placa)}.</p>` : ''}</div>
    <div id="it-destino-bloque">
      <div class="campo"><label class="lb">Municipio</label>
        <select class="inp" id="it-mun"><option value="">— Seleccione —</option>
          ${cat.municipios.map(m => `<option value="${m.id}" ${it && it.municipio_id == m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}
        </select></div>
      <div class="campo"><label class="lb">Destino</label>
        <input class="inp" id="it-dest" list="lista-destinos" value="${esc(it?.destino || '')}"
          placeholder="Escriba el destino, o escójalo de la lista">
        <datalist id="lista-destinos">
          ${cat.destinos.map(d => `<option value="${esc(d.nombre)}">`).join('')}
        </datalist>
        <p style="font-size:.72rem;color:var(--muted);margin:.3rem 0 0">
          Si el destino es nuevo, escríbalo y queda guardado para la próxima vez.</p>
      </div>
    </div>
    <div class="campo"><label class="lb">Observaciones</label>
      <textarea class="inp" id="it-obs" rows="2">${esc(it?.observaciones || '')}</textarea></div>
    ${it ? `<div class="campo"><label class="lb">Motivo del cambio</label>
      <input class="inp" id="it-motivo" placeholder="Por qué se modifica (queda registrado)"></div>` : ''}
    ${it?.num_cambios ? `<button class="btn sec sm" onclick="verCambios(${it.id})">
      Ver historial de cambios (${it.num_cambios})</button>` : ''}`,
    `${it ? `<button class="btn sec" onclick="cancelarItinerario(${it.id})">Cancelar programación</button>` : ''}
     <button class="btn sec" onclick="cerrarModal()">Cerrar</button>
     <button class="btn" id="it-btn" onclick="guardarItinerario(${id || 'null'},${vehiculoId},'${fecha}')">Guardar</button>`);
  itinToggleDestino();
}

function itinToggleDestino() {
  const t = $('#it-tipo').value;
  // Un día "disponible" es en base: no lleva destino.
  $('#it-destino-bloque').style.display = t === 'disponible' ? 'none' : '';
}

async function guardarItinerario(id, vehiculoId, fecha) {
  const btn = $('#it-btn'); btn.disabled = true; btn.textContent = 'Guardando...';
  const tipo = $('#it-tipo').value;
  const cuerpo = {
    fecha, vehiculo_id: vehiculoId,
    conductor_id: $('#it-cond').value ? Number($('#it-cond').value) : null,
    municipio_id: $('#it-mun').value ? Number($('#it-mun').value) : null,
    tipo_jornada: tipo,
    observaciones: $('#it-obs').value.trim() || null,
  };
  if (tipo !== 'disponible' && $('#it-dest').value.trim()) {
    cuerpo.destino_nombre = $('#it-dest').value.trim();
  }
  if (id) cuerpo.motivo = $('#it-motivo')?.value.trim() || undefined;

  try {
    if (id) await api('/api/itinerario/' + id, { metodo: 'PUT', cuerpo });
    else await api('/api/itinerario', { metodo: 'POST', cuerpo });
    cerrarModal();
    aviso(id ? 'Programación actualizada' : 'Desplazamiento adjudicado', 'ok', 'Listo');
    cat = await api('/api/catalogos');   // recarga por si se creó un destino nuevo
    verItinerario();
  } catch (e) {
    aviso(e.message, 'mal', 'No se pudo guardar');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function cancelarItinerario(id) {
  const motivo = prompt('Motivo de la cancelación:');
  if (motivo === null) return;
  try {
    await api('/api/itinerario/' + id, { metodo: 'DELETE', cuerpo: { motivo } });
    cerrarModal(); aviso('Programación cancelada', 'ok', 'Listo'); verItinerario();
  } catch (e) { aviso(e.message, 'mal', 'No se pudo cancelar'); }
}

async function verCambios(id) {
  const c = await api(`/api/itinerario/${id}/cambios`);
  const CAMPOS = {
    conductor_id: 'Conductor', municipio_id: 'Municipio', destino_id: 'Destino',
    tipo_jornada: 'Tipo de jornada', observaciones: 'Observaciones', estado: 'Estado',
  };
  abrirModal('Historial de cambios', c.length ? c.map(x => `
    <div style="border-left:3px solid var(--ambar);padding:.5rem .75rem;margin-bottom:.6rem;background:var(--surface-2);border-radius:0 8px 8px 0">
      <div style="font-weight:700;font-size:.85rem">${CAMPOS[x.campo] || esc(x.campo)}</div>
      <div style="font-size:.8rem;color:var(--text-soft);margin:.15rem 0">
        <s style="color:var(--muted)">${esc(x.valor_antes ?? 'vacío')}</s> → <b>${esc(x.valor_despues ?? 'vacío')}</b>
      </div>
      <div style="font-size:.72rem;color:var(--muted)">
        ${esc(x.nombre_usuario?.trim() || x.usuario || 'usuario')} · ${fechaHora(x.ts)}
      </div>
      ${x.motivo ? `<div style="font-size:.78rem;margin-top:.25rem;font-style:italic">"${esc(x.motivo)}"</div>` : ''}
    </div>`).join('') : '<div class="vacio">Sin modificaciones.</div>');
}

function modalCopiarSemana() {
  const hasta = nDias(itinDesde, 13);
  abrirModal('Copiar programación', `
    <p style="font-size:.88rem;color:var(--text-soft);margin:0 0 1rem">
      Copia la programación del <b>${itinDesde}</b> al <b>${hasta}</b> hacia adelante.
      Los días que ya tengan programación se dejan como están.
    </p>
    <div class="campo"><label class="lb">Copiar a partir del</label>
      <input class="inp" type="date" id="cp-desde" value="${nDias(itinDesde, 14)}"></div>`,
    `<button class="btn sec" onclick="cerrarModal()">Cancelar</button>
     <button class="btn" id="cp-btn" onclick="copiarSemana('${itinDesde}','${hasta}')">Copiar</button>`);
}

async function copiarSemana(desde, hasta) {
  const btn = $('#cp-btn'); btn.disabled = true; btn.textContent = 'Copiando...';
  try {
    const r = await api('/api/itinerario/copiar', {
      metodo: 'POST',
      cuerpo: { desde, hasta, destino_desde: $('#cp-desde').value },
    });
    cerrarModal();
    aviso(`${r.creados} copiada(s)${r.omitidos ? `, ${r.omitidos} omitida(s) por tener programación` : ''}`, 'ok', 'Listo');
    verItinerario();
  } catch (e) {
    aviso(e.message, 'mal', 'No se pudo copiar');
    btn.disabled = false; btn.textContent = 'Copiar';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

let dashDesde = null, dashHasta = null;

const COLORES = ['#1e5aa8', '#0a7d57', '#a2620a', '#6d3aad', '#c22e24', '#0e7490', '#9a3412'];

function grafica(id, config) {
  const el = document.getElementById(id);
  if (!el || typeof Chart === 'undefined') return;
  graficas[id]?.destroy();
  Chart.defaults.font.family = "'Inter',system-ui,sans-serif";
  Chart.defaults.color = '#75828f';
  graficas[id] = new Chart(el, config);
}

async function verDashboard() {
  if (!dashDesde) { dashDesde = hoy().slice(0, 8) + '01'; dashHasta = hoy(); }
  $('#main').innerHTML = '<div class="cargando">Calculando...</div>';
  let d;
  try { d = await api(`/api/dashboard?desde=${dashDesde}&hasta=${dashHasta}`); }
  catch (e) { return $('#main').innerHTML = `<div class="card"><div class="nota avi">${esc(e.message)}</div></div>`; }

  const t = d.totales || {};
  const conDatos = d.por_vehiculo.filter(v => v.dias_registrados > 0);
  const cumplimiento = t.programados ? Math.round((t.ejecutados / t.programados) * 100) : 0;
  const totalPagar = d.por_vehiculo.reduce((s, v) => s + (v.valor_estimado || 0), 0);

  $('#main').innerHTML = `
    <div class="cab">
      <div><h1>Dashboard</h1><p>Del ${dashDesde} al ${dashHasta}</p></div>
      <div style="display:flex;gap:.4rem;align-items:flex-end;flex-wrap:wrap">
        <div><label class="lb">Desde</label><input class="inp" type="date" id="d-desde" value="${dashDesde}" style="width:auto"></div>
        <div><label class="lb">Hasta</label><input class="inp" type="date" id="d-hasta" value="${dashHasta}" style="width:auto"></div>
        <button class="btn sm" onclick="dashDesde=$('#d-desde').value;dashHasta=$('#d-hasta').value;verDashboard()">Aplicar</button>
        <button class="btn sec sm" onclick="exportarDashboard()">Descargar</button>
      </div>
    </div>

    <div class="grid g4">
      <div class="kpi azul"><div class="et">Días pagables</div><div class="val">${num(t.pagables || 0)}</div>
        <div class="pie">lo que se liquida</div></div>
      <div class="kpi verde"><div class="et">Con desplazamiento</div><div class="val">${num(t.ejecutados || 0)}</div>
        <div class="pie">días con salida marcada</div></div>
      <div class="kpi"><div class="et">Cumplimiento</div><div class="val">${cumplimiento}%</div>
        <div class="pie">${num(t.ejecutados || 0)} de ${num(t.programados || 0)} programados</div></div>
      <div class="kpi ambar"><div class="et">Valor estimado</div><div class="val" style="font-size:1.3rem">${pesos(totalPagar)}</div>
        <div class="pie">días pagables × tarifa</div></div>
    </div>

    <div class="grid g4" style="margin-top:.85rem">
      <div class="kpi"><div class="et">Viajes</div><div class="val">${num(t.trayectos || 0)}</div></div>
      <div class="kpi"><div class="et">Horas</div><div class="val">${num(Math.round(t.horas || 0))}</div></div>
      <div class="kpi"><div class="et">Kilómetros</div><div class="val">${num(t.km || 0)}</div></div>
      <div class="kpi ${d.vencimientos.length ? 'rojo' : ''}"><div class="et">Vencimientos</div>
        <div class="val">${d.vencimientos.length}</div><div class="pie">próximos 30 días</div></div>
    </div>

    ${t.pagables > t.ejecutados ? `
      <div class="nota" style="margin-top:.85rem">
        Hay <b>${t.pagables - t.ejecutados} día(s) pagables sin desplazamiento</b>: son días en base
        marcados como disponibles, que se pagan igual. Por eso los dos contadores no coinciden.
      </div>` : ''}

    <div class="card" style="margin-top:.85rem">
      <h2>Qué vehículos están trabajando más</h2>
      <p style="color:var(--muted);font-size:.8rem;margin:.2rem 0 .85rem">
        Comparación entre lo que se programó y lo que el conductor marcó en terreno.</p>
      <div class="grafica-env"><canvas id="g-ranking"></canvas></div>
    </div>

    <div class="grid g2" style="margin-top:.85rem">
      <div class="card"><h3>Viajes por día</h3><div class="grafica-env"><canvas id="g-dias"></canvas></div></div>
      <div class="card"><h3>Destinos más visitados</h3><div class="grafica-env"><canvas id="g-destinos"></canvas></div></div>
    </div>

    <div class="grid g2" style="margin-top:.85rem">
      <div class="card"><h3>Viajes por municipio</h3><div class="grafica-env"><canvas id="g-municipios"></canvas></div></div>
      <div class="card"><h3>Novedades por tipo</h3>
        ${d.eventos.length ? '<div class="grafica-env"><canvas id="g-eventos"></canvas></div>'
          : '<div class="vacio">Sin novedades en el período.</div>'}</div>
    </div>

    <div class="card" style="margin-top:.85rem">
      <h2>Detalle por vehículo</h2>
      <div class="tabla-env" style="margin-top:.75rem;border:0">
        <table>
          <thead><tr>
            <th>Vehículo</th><th>Propiedad</th>
            <th class="num">Programados</th><th class="num">Con despl.</th>
            <th class="num">Pagables</th><th class="num">Viajes</th>
            <th class="num">Horas</th><th class="num">Km</th><th class="num">Valor</th>
          </tr></thead>
          <tbody>${d.por_vehiculo.map(v => `
            <tr>
              <td class="placa">${esc(v.placa)}</td>
              <td><span class="etq ${v.propiedad === 'contratista' ? 'ambar' : 'gris'}">${esc(v.propiedad)}</span></td>
              <td class="num">${num(v.dias_programados || 0)}</td>
              <td class="num"><b>${num(v.dias_con_desplazamiento || 0)}</b></td>
              <td class="num">${num(v.dias_pagables || 0)}</td>
              <td class="num">${num(v.trayectos || 0)}</td>
              <td class="num">${num(Math.round(v.horas || 0))}</td>
              <td class="num">${num(v.km || 0)}</td>
              <td class="num">${v.valor_dia ? pesos(v.valor_estimado) : '<span style="color:var(--muted)">sin tarifa</span>'}</td>
            </tr>`).join('')}</tbody>
        </table>
      </div>
    </div>

    ${d.vencimientos.length ? `
      <div class="card" style="margin-top:.85rem;border-left:4px solid var(--rojo)">
        <h2>Vencimientos próximos</h2>
        <div class="tabla-env" style="margin-top:.75rem;border:0"><table>
          <thead><tr><th>Titular</th><th>Documento</th><th>Vence</th><th class="num">Días</th></tr></thead>
          <tbody>${d.vencimientos.map(v => `
            <tr><td><b>${esc(v.titular)}</b></td><td>${esc(v.tipo)}</td><td>${esc(v.vencimiento)}</td>
              <td class="num"><span class="etq ${v.dias < 0 ? 'rojo' : 'ambar'}">${v.dias < 0 ? 'vencido' : v.dias + ' días'}</span></td></tr>`).join('')}
          </tbody></table></div>
      </div>` : ''}

    ${d.checklist.some(c => c.total > 0) ? `
      <div class="card" style="margin-top:.85rem">
        <h2>Cumplimiento del checklist</h2>
        <div class="tabla-env" style="margin-top:.75rem;border:0"><table>
          <thead><tr><th>Vehículo</th><th class="num">Checklists</th><th class="num">Completos</th><th class="num">Ítems faltantes</th></tr></thead>
          <tbody>${d.checklist.filter(c => c.total > 0).map(c => `
            <tr><td class="placa">${esc(c.placa)}</td><td class="num">${c.total}</td>
              <td class="num">${c.completos || 0}</td>
              <td class="num">${c.faltantes ? `<span class="etq rojo">${c.faltantes}</span>` : '<span class="etq verde">0</span>'}</td></tr>`).join('')}
          </tbody></table></div>
      </div>` : ''}

    ${d.origen_marcas.length ? `
      <div class="nota" style="margin-top:.85rem">
        <b>Origen de las marcas:</b>
        ${d.origen_marcas.map(o => `${o.n} ${({
          en_linea: 'en línea', offline_sincronizado: 'sincronizadas sin señal',
          digitado_por_coordinador: 'digitadas',
        })[o.origen] || o.origen}`).join(' · ')}
      </div>` : ''}
  `;

  // ── Gráficas ──
  grafica('g-ranking', {
    type: 'bar',
    data: {
      labels: conDatos.map(v => v.placa),
      datasets: [
        { label: 'Programados', data: conDatos.map(v => v.dias_programados || 0), backgroundColor: '#c3d2e6', borderRadius: 4 },
        { label: 'Con desplazamiento', data: conDatos.map(v => v.dias_con_desplazamiento || 0), backgroundColor: '#1e5aa8', borderRadius: 4 },
        { label: 'Pagables', data: conDatos.map(v => v.dias_pagables || 0), backgroundColor: '#0a7d57', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#e9edf2' } }, x: { grid: { display: false } } },
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 14 } } },
    },
  });

  grafica('g-dias', {
    type: 'line',
    data: {
      labels: d.por_dia.map(x => x.fecha.slice(5)),
      datasets: [{
        label: 'Viajes', data: d.por_dia.map(x => x.trayectos),
        borderColor: '#1e5aa8', backgroundColor: 'rgba(30,90,168,.10)',
        fill: true, tension: .3, pointRadius: 3,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#e9edf2' } }, x: { grid: { display: false } } },
      plugins: { legend: { display: false } },
    },
  });

  const donut = (id, etiquetas, valores) => grafica(id, {
    type: 'doughnut',
    data: { labels: etiquetas, datasets: [{ data: valores, backgroundColor: COLORES, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '58%',
      plugins: { legend: { position: 'bottom', labels: { boxWidth: 11, padding: 10, font: { size: 11 } } } },
    },
  });

  grafica('g-destinos', {
    type: 'bar',
    data: {
      labels: d.por_destino.map(x => x.destino || 'Sin destino'),
      datasets: [{ label: 'Veces', data: d.por_destino.map(x => x.veces), backgroundColor: '#6d3aad', borderRadius: 4 }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: { x: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#e9edf2' } }, y: { grid: { display: false } } },
      plugins: { legend: { display: false } },
    },
  });

  donut('g-municipios', d.por_municipio.map(x => x.municipio), d.por_municipio.map(x => x.trayectos));
  if (d.eventos.length) {
    const ET = Object.fromEntries(TIPOS_EVENTO);
    donut('g-eventos', d.eventos.map(x => ET[x.tipo] || x.tipo), d.eventos.map(x => x.n));
  }
}

/** Descarga el detalle por vehículo como CSV, legible en Excel. */
async function exportarDashboard() {
  const d = await api(`/api/dashboard?desde=${dashDesde}&hasta=${dashHasta}`);
  const cab = ['Placa', 'Propiedad', 'Contratista', 'Dias programados', 'Dias con desplazamiento',
    'Dias pagables', 'Viajes', 'Horas', 'Kilometros', 'Valor dia', 'Valor estimado'];
  const filas = d.por_vehiculo.map(v => [v.placa, v.propiedad, v.contratista || '',
    v.dias_programados || 0, v.dias_con_desplazamiento || 0, v.dias_pagables || 0,
    v.trayectos || 0, Math.round(v.horas || 0), v.km || 0, v.valor_dia || '', v.valor_estimado || 0]);
  const csv = [cab, ...filas].map(f => f.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
  // BOM para que Excel reconozca los acentos
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url; a.download = `flota_${dashDesde}_a_${dashHasta}.csv`; a.click();
  URL.revokeObjectURL(url);
  aviso('Archivo descargado', 'ok');
}

// ═══════════════════════════════════════════════════════════════════════════
// LISTADOS Y ADMINISTRACIÓN
// ═══════════════════════════════════════════════════════════════════════════

async function verTrayectos() {
  const desde = nDias(hoy(), -14), hasta = hoy();
  $('#main').innerHTML = '<div class="cargando">Cargando viajes...</div>';
  const t = await api(`/api/trayectos?desde=${desde}&hasta=${hasta}`);
  const origen = { en_linea: ['verde', 'en línea'], offline_sincronizado: ['ambar', 'sin señal'], digitado_por_coordinador: ['gris', 'digitado'] };

  $('#main').innerHTML = `
    <div class="cab"><div><h1>Viajes</h1><p>Últimos 14 días · ${t.length} registro(s)</p></div></div>
    ${t.length ? `<div class="tabla-env"><table>
      <thead><tr><th>Fecha</th><th>Vehículo</th><th>Conductor</th><th>Salida</th><th>Llegada</th>
        <th class="num">Horas</th><th class="num">Km</th><th>Marca</th><th>Estado</th></tr></thead>
      <tbody>${t.map(x => {
        const o = origen[x.origen_salida] || ['gris', '—'];
        const km = (x.km_final && x.km_inicial) ? x.km_final - x.km_inicial : null;
        return `<tr>
          <td>${esc(x.fecha_operacion)}</td>
          <td class="placa">${esc(x.placa)}</td>
          <td>${esc(x.conductor?.trim() || '—')}</td>
          <td>${hora(x.ts_salida)}<br><span style="font-size:.72rem;color:var(--muted)">${esc(x.lugar_salida || '')}</span></td>
          <td>${hora(x.ts_llegada)}<br><span style="font-size:.72rem;color:var(--muted)">${esc(x.lugar_llegada || '')}</span></td>
          <td class="num">${x.horas ?? '—'}</td>
          <td class="num">${num(km)}</td>
          <td><span class="etq ${o[0]}">${o[1]}</span>${x.lat_salida ? '' : ' <span class="etq gris" title="Sin coordenadas">sin GPS</span>'}</td>
          <td>${x.estado === 'cerrado' ? '<span class="etq verde">Cerrado</span>' : '<span class="etq ambar">En curso</span>'}</td>
        </tr>`; }).join('')}</tbody></table></div>`
      : '<div class="card"><div class="vacio">Sin viajes registrados en el período.</div></div>'}`;
}

async function verEventos() {
  $('#main').innerHTML = '<div class="cargando">Cargando novedades...</div>';
  const ev = await api(`/api/eventos?desde=${nDias(hoy(), -60)}&hasta=${hoy()}`);
  const ET = Object.fromEntries(TIPOS_EVENTO);
  const GRAV = { baja: 'gris', media: 'azul', alta: 'ambar', critica: 'rojo' };
  const puede = sesion.rol !== 'conductor';

  $('#main').innerHTML = `
    <div class="cab">
      <div><h1>Novedades</h1><p>Últimos 60 días · ${ev.length} registro(s)</p></div>
      <button class="btn ambar" onclick="modalEvento()">Reportar novedad</button>
    </div>
    ${ev.length ? ev.map(e => `
      <div class="card" style="border-left:4px solid var(--${GRAV[e.gravedad] === 'gris' ? 'muted' : GRAV[e.gravedad]})">
        <div style="display:flex;justify-content:space-between;gap:1rem;flex-wrap:wrap;align-items:flex-start">
          <div style="flex:1;min-width:220px">
            <div style="display:flex;gap:.4rem;align-items:center;flex-wrap:wrap">
              <b>${esc(ET[e.tipo] || e.tipo)}</b>
              <span class="etq ${GRAV[e.gravedad]}">${esc(e.gravedad)}</span>
              ${e.estado === 'cerrado' ? '<span class="etq verde">Cerrada</span>' : '<span class="etq ambar">Abierta</span>'}
            </div>
            <p style="margin:.4rem 0 .2rem;font-size:.88rem">${esc(e.descripcion)}</p>
            ${e.acciones ? `<p style="margin:.2rem 0;font-size:.82rem;color:var(--text-soft)"><b>Acciones:</b> ${esc(e.acciones)}</p>` : ''}
            <div style="font-size:.74rem;color:var(--muted);margin-top:.3rem">
              ${fechaHora(e.ts_evento)}
              ${e.placa ? ' · ' + esc(e.placa) : ''}
              ${e.municipio ? ' · ' + esc(e.municipio) : ''}
              ${e.lugar ? ' · ' + esc(e.lugar) : ''}
              ${e.persona ? ' · ' + esc(e.persona.trim()) : ''}
            </div>
          </div>
          ${puede && e.estado !== 'cerrado'
            ? `<button class="btn sec sm" onclick="cerrarEvento(${e.id})">Marcar cerrada</button>` : ''}
        </div>
      </div>`).join('')
      : '<div class="card"><div class="vacio">Sin novedades reportadas.</div></div>'}`;
}

async function cerrarEvento(id) {
  try {
    await api('/api/eventos/' + id, { metodo: 'PUT', cuerpo: { estado: 'cerrado' } });
    aviso('Novedad cerrada', 'ok'); verEventos();
  } catch (e) { aviso(e.message, 'mal'); }
}

// ── Vehículos ────────────────────────────────────────────────────────────────
async function verVehiculos() {
  // Las personas hacen falta para el selector de conductor predeterminado.
  [vehiculos, personas] = await Promise.all([
    api('/api/vehiculos?todos=1'),
    api('/api/personas'),
  ]);
  $('#main').innerHTML = `
    <div class="cab">
      <div><h1>Vehículos</h1><p>${vehiculos.length} registrado(s)</p></div>
      <button class="btn" onclick="modalVehiculo()">Registrar vehículo</button>
    </div>
    ${vehiculos.length ? `<div class="tabla-env"><table>
      <thead><tr><th>Placa</th><th>Tipo</th><th>Base</th><th>Conductor</th>
        <th>Propiedad</th><th class="num">Valor día</th><th>Estado</th><th></th></tr></thead>
      <tbody>${vehiculos.map(v => `
        <tr>
          <td class="placa">${esc(v.placa)}</td>
          <td>${esc(v.tipo)}${v.subtipo ? ' ' + esc(v.subtipo) : ''}</td>
          <td>${esc(v.municipio_base || '—')}</td>
          <td>${esc(v.conductor_actual?.trim() || '—')}</td>
          <td><span class="etq ${v.propiedad === 'contratista' ? 'ambar' : 'gris'}">${esc(v.propiedad)}</span>
            ${v.contratista ? `<br><span style="font-size:.7rem;color:var(--muted)">${esc(v.contratista)}</span>` : ''}</td>
          <td class="num">${v.valor_dia ? pesos(v.valor_dia) : '—'}</td>
          <td>${v.activo ? `<span class="etq ${v.estado === 'activo' ? 'verde' : 'ambar'}">${esc(v.estado)}</span>`
            : '<span class="etq gris">inactivo</span>'}
            ${v.docs_vencidos ? `<br><span class="etq rojo">${v.docs_vencidos} doc. vencido(s)</span>` : ''}</td>
          <td><button class="btn sec sm" onclick="modalVehiculo(${v.id})">Editar</button></td>
        </tr>`).join('')}</tbody></table></div>`
      : `<div class="card"><div class="vacio">
          <p>No hay vehículos registrados.</p>
          <button class="btn" onclick="modalVehiculo()">Registrar el primero</button></div></div>`}`;
}

function modalVehiculo(id) {
  const v = id ? vehiculos.find(x => x.id === id) : null;
  const conductores = personas.filter(p => p.es_conductor);
  const sel = (val, opciones) => opciones.map(o =>
    `<option value="${o}" ${val === o ? 'selected' : ''}>${o}</option>`).join('');

  abrirModal(v ? 'Editar vehículo' : 'Registrar vehículo', `
    <div class="campo"><label class="lb">Placa <span class="req">*</span></label>
      <input class="inp" id="v-placa" value="${esc(v?.placa || '')}" ${v ? 'disabled' : ''}
        placeholder="Ej: GEU-665" style="text-transform:uppercase"></div>
    <div class="grid g2" style="gap:0 .75rem">
      <div class="campo"><label class="lb">Tipo</label>
        <select class="inp" id="v-tipo">${sel(v?.tipo || 'camioneta', ['camioneta', 'ambulancia', 'moto', 'fluvial', 'otro'])}</select></div>
      <div class="campo"><label class="lb">Municipio base</label>
        <select class="inp" id="v-mun"><option value="">— Ninguno —</option>
          ${cat.municipios.map(m => `<option value="${m.id}" ${v?.municipio_base_id == m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select></div>
    </div>
    <div class="grid g2" style="gap:0 .75rem">
      <div class="campo"><label class="lb">Marca</label><input class="inp" id="v-marca" value="${esc(v?.marca || '')}"></div>
      <div class="campo"><label class="lb">Modelo (año)</label><input class="inp" id="v-anio" type="number" value="${v?.modelo_anio || ''}"></div>
    </div>
    <div class="grid g2" style="gap:0 .75rem">
      <div class="campo"><label class="lb">Propiedad</label>
        <select class="inp" id="v-prop" onchange="$('#v-contr-campo').style.display=this.value==='contratista'?'':'none'">
          ${sel(v?.propiedad || 'propio', ['propio', 'contratista', 'comodato'])}</select></div>
      <div class="campo"><label class="lb">Valor por día</label>
        <input class="inp" id="v-valor" type="number" value="${v?.valor_dia || ''}" placeholder="Ej: 180000"></div>
    </div>
    <div class="campo" id="v-contr-campo" style="display:${v?.propiedad === 'contratista' ? '' : 'none'}">
      <label class="lb">Contratista</label>
      <input class="inp" id="v-contr" list="lista-contratistas" value="${esc(v?.contratista || '')}"
        placeholder="Escoja una persona o escriba la razón social">
      <datalist id="lista-contratistas">
        ${personas.map(p => `<option value="${esc((p.nombres + ' ' + (p.apellidos || '')).trim())}">`).join('')}
      </datalist>
      <p style="font-size:.72rem;color:var(--muted);margin:.25rem 0 0">
        Se despliegan las personas registradas. Si el contrato está a nombre de una
        empresa, escriba la razón social.</p></div>
    <div class="campo">
      <label class="lb">Conductor predeterminado</label>
      <select class="inp" id="v-conductor">
        <option value="">— Sin asignar —</option>
        ${conductores.map(p => `<option value="${p.id}" ${v?.conductor_id == p.id ? 'selected' : ''}>${esc(p.nombres)} ${esc(p.apellidos || '')}</option>`).join('')}
      </select>
      <p style="font-size:.72rem;color:var(--muted);margin:.25rem 0 0">
        Se propone solo al programar el itinerario; se puede cambiar cualquier día.
        ${conductores.length ? '' : 'Primero registre personas marcadas como conductor.'}</p></div>
    <div class="grid g2" style="gap:0 .75rem">
      <div class="campo"><label class="lb">Estado</label>
        <select class="inp" id="v-estado">${sel(v?.estado || 'activo', ['activo', 'mantenimiento', 'taller', 'fuera_servicio', 'reserva'])}</select></div>
      <div class="campo"><label class="lb">Kilometraje</label><input class="inp" id="v-km" type="number" value="${v?.km_actual || ''}"></div>
    </div>
    ${v ? `<div class="campo"><label class="lb">
      <input type="checkbox" id="v-activo" ${v.activo ? 'checked' : ''}> Vehículo activo</label></div>` : ''}`,
    `<button class="btn sec" onclick="cerrarModal()">Cancelar</button>
     <button class="btn" id="v-btn" onclick="guardarVehiculo(${id || 'null'})">Guardar</button>`);
}

async function guardarVehiculo(id) {
  const btn = $('#v-btn'); btn.disabled = true; btn.textContent = 'Guardando...';
  const c = {
    tipo: $('#v-tipo').value,
    municipio_base_id: $('#v-mun').value ? Number($('#v-mun').value) : null,
    marca: $('#v-marca').value.trim() || null,
    modelo_anio: $('#v-anio').value ? Number($('#v-anio').value) : null,
    propiedad: $('#v-prop').value,
    contratista: $('#v-prop').value === 'contratista' ? ($('#v-contr').value.trim() || null) : null,
    valor_dia: $('#v-valor').value ? Number($('#v-valor').value) : null,
    estado: $('#v-estado').value,
    km_actual: $('#v-km').value ? Number($('#v-km').value) : null,
    conductor_id: $('#v-conductor').value ? Number($('#v-conductor').value) : null,
  };
  if (!id) {
    c.placa = $('#v-placa').value.trim().toUpperCase();
    if (!c.placa) { btn.disabled = false; btn.textContent = 'Guardar'; return aviso('La placa es obligatoria', 'mal'); }
  } else {
    c.activo = $('#v-activo')?.checked ? 1 : 0;
  }
  try {
    if (id) await api('/api/vehiculos/' + id, { metodo: 'PUT', cuerpo: c });
    else await api('/api/vehiculos', { metodo: 'POST', cuerpo: c });
    cerrarModal(); aviso('Vehículo guardado', 'ok', 'Listo'); verVehiculos();
  } catch (e) {
    aviso(e.message, 'mal', 'No se pudo guardar');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ── Personas ─────────────────────────────────────────────────────────────────
async function verPersonas() {
  personas = await api('/api/personas');
  $('#main').innerHTML = `
    <div class="cab">
      <div><h1>Personas</h1><p>${personas.length} registrada(s)</p></div>
      <button class="btn" onclick="modalPersona()">Registrar persona</button>
    </div>
    <div class="nota" style="margin-bottom:.85rem">
      Los datos personales se guardan solo en esta aplicación, nunca en el repositorio de código.
    </div>
    ${personas.length ? `<div class="tabla-env"><table>
      <thead><tr><th>Nombre</th><th>Documento</th><th>Teléfono</th><th>Municipio</th><th>Rol</th><th></th></tr></thead>
      <tbody>${personas.map(p => `
        <tr>
          <td><b>${esc(p.nombres)} ${esc(p.apellidos || '')}</b></td>
          <td>${p.numero_doc ? esc(p.numero_doc) : '<span class="etq ambar">falta</span>'}</td>
          <td>${p.telefono ? esc(p.telefono) : '<span class="etq ambar">falta</span>'}</td>
          <td>${esc(p.municipio || '—')}</td>
          <td>${p.es_conductor ? '<span class="etq azul">Conductor</span> ' : ''}${p.es_tripulante ? '<span class="etq morado">Tripulante</span>' : ''}</td>
          <td><button class="btn sec sm" onclick="modalPersona(${p.id})">Editar</button></td>
        </tr>`).join('')}</tbody></table></div>`
      : `<div class="card"><div class="vacio">
          <p>No hay personas registradas.</p>
          <button class="btn" onclick="modalPersona()">Registrar la primera</button></div></div>`}`;
}

function modalPersona(id) {
  const p = id ? personas.find(x => x.id === id) : null;
  abrirModal(p ? 'Editar persona' : 'Registrar persona', `
    <div class="grid g2" style="gap:0 .75rem">
      <div class="campo"><label class="lb">Nombres <span class="req">*</span></label>
        <input class="inp" id="p-nom" value="${esc(p?.nombres || '')}"></div>
      <div class="campo"><label class="lb">Apellidos</label>
        <input class="inp" id="p-ape" value="${esc(p?.apellidos || '')}"></div>
    </div>
    <div class="grid g2" style="gap:0 .75rem">
      <div class="campo"><label class="lb">Documento</label>
        <input class="inp" id="p-doc" value="${esc(p?.numero_doc || '')}" inputmode="numeric"></div>
      <div class="campo"><label class="lb">Teléfono</label>
        <input class="inp" id="p-tel" value="${esc(p?.telefono || '')}" inputmode="tel"></div>
    </div>
    <div class="grid g2" style="gap:0 .75rem">
      <div class="campo"><label class="lb">Municipio base</label>
        <select class="inp" id="p-mun"><option value="">— Ninguno —</option>
          ${cat.municipios.map(m => `<option value="${m.id}" ${p?.municipio_id == m.id ? 'selected' : ''}>${esc(m.nombre)}</option>`).join('')}</select>
        <p style="font-size:.7rem;color:var(--muted);margin:.25rem 0 0">Solo precarga el formulario; puede desplazarse a cualquier municipio.</p></div>
      <div class="campo"><label class="lb">Vinculación</label>
        <select class="inp" id="p-vinc"><option value="">— Ninguna —</option>
          ${['planta', 'contrato', 'ops', 'tercero'].map(v => `<option value="${v}" ${p?.vinculacion === v ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
    </div>
    <div class="campo"><label class="lb">Correo</label><input class="inp" id="p-cor" type="email" value="${esc(p?.correo || '')}"></div>
    <div class="campo">
      <label class="lb" style="display:block;margin-bottom:.4rem">Función</label>
      <label style="display:inline-flex;gap:.35rem;align-items:center;margin-right:1rem;font-size:.88rem">
        <input type="checkbox" id="p-cond" ${p?.es_conductor ? 'checked' : ''}> Conductor</label>
      <label style="display:inline-flex;gap:.35rem;align-items:center;font-size:.88rem">
        <input type="checkbox" id="p-trip" ${p?.es_tripulante ? 'checked' : ''}> Tripulante</label>
    </div>`,
    `<button class="btn sec" onclick="cerrarModal()">Cancelar</button>
     <button class="btn" id="p-btn" onclick="guardarPersona(${id || 'null'})">Guardar</button>`);
}

async function guardarPersona(id) {
  const nombres = $('#p-nom').value.trim();
  if (!nombres) return aviso('El nombre es obligatorio', 'mal');
  const btn = $('#p-btn'); btn.disabled = true; btn.textContent = 'Guardando...';
  const c = {
    nombres, apellidos: $('#p-ape').value.trim() || null,
    numero_doc: $('#p-doc').value.trim() || null,
    telefono: $('#p-tel').value.trim() || null,
    correo: $('#p-cor').value.trim() || null,
    municipio_id: $('#p-mun').value ? Number($('#p-mun').value) : null,
    vinculacion: $('#p-vinc').value || null,
    es_conductor: $('#p-cond').checked ? 1 : 0,
    es_tripulante: $('#p-trip').checked ? 1 : 0,
  };
  try {
    if (id) await api('/api/personas/' + id, { metodo: 'PUT', cuerpo: c });
    else await api('/api/personas', { metodo: 'POST', cuerpo: c });
    cerrarModal(); aviso('Persona guardada', 'ok', 'Listo'); verPersonas();
  } catch (e) {
    aviso(e.message, 'mal', 'No se pudo guardar');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ── Usuarios (solo el rol principal) ─────────────────────────────────────────
async function verUsuarios() {
  const us = await api('/api/usuarios');
  const ROL = { principal: ['rojo', 'Administrador'], coordinacion: ['azul', 'Coordinación'], conductor: ['verde', 'Conductor'] };

  $('#main').innerHTML = `
    <div class="cab">
      <div><h1>Usuarios</h1><p>${us.length} cuenta(s) · usted es el único que puede crearlas</p></div>
      <button class="btn" onclick="modalUsuario()">Crear usuario</button>
    </div>
    <div class="tabla-env"><table>
      <thead><tr><th>Usuario</th><th>Nombre</th><th>Rol</th><th>Último ingreso</th><th>Estado</th><th></th></tr></thead>
      <tbody>${us.map(u => {
        const r = ROL[u.rol] || ['gris', u.rol];
        return `<tr>
          <td><b>${esc(u.usuario)}</b></td>
          <td>${esc(u.nombre?.trim() || '—')}</td>
          <td><span class="etq ${r[0]}">${r[1]}</span></td>
          <td>${u.ultimo_acceso ? fechaHora(u.ultimo_acceso) : '<span style="color:var(--muted)">nunca</span>'}</td>
          <td>${u.activo ? '<span class="etq verde">Activo</span>' : '<span class="etq gris">Inactivo</span>'}
            ${u.debe_cambiar_clave ? '<br><span class="etq ambar">clave temporal</span>' : ''}</td>
          <td><button class="btn sec sm" onclick="modalUsuario(${u.id})">Editar</button></td>
        </tr>`; }).join('')}</tbody></table></div>
    <div class="nota" style="margin-top:.85rem">
      No existe registro por cuenta propia ni recuperación de clave por correo: usted crea la cuenta
      con una clave temporal y el usuario la cambia al entrar por primera vez.
    </div>`;
  window._usuarios = us;
}

function modalUsuario(id) {
  const u = id ? window._usuarios.find(x => x.id === id) : null;
  const sinCuenta = personas.filter(p => !window._usuarios.some(x => x.persona_id === p.id && x.id !== id));

  abrirModal(u ? 'Editar usuario' : 'Crear usuario', `
    <div class="campo"><label class="lb">Nombre de usuario <span class="req">*</span></label>
      <input class="inp" id="u-usuario" value="${esc(u?.usuario || '')}" autocapitalize="none"
        placeholder="Ej: jnavarro"></div>
    <div class="campo"><label class="lb">Rol <span class="req">*</span></label>
      <select class="inp" id="u-rol">
        <option value="conductor" ${u?.rol === 'conductor' ? 'selected' : ''}>Conductor — marca salida y llegada, reporta novedades</option>
        <option value="coordinacion" ${u?.rol === 'coordinacion' ? 'selected' : ''}>Coordinación — ve todo, descarga y modifica itinerarios</option>
        <option value="principal" ${u?.rol === 'principal' ? 'selected' : ''}>Administrador — control total y creación de usuarios</option>
      </select></div>
    <div class="campo"><label class="lb">Persona vinculada</label>
      <select class="inp" id="u-persona"><option value="">— Ninguna —</option>
        ${sinCuenta.map(p => `<option value="${p.id}" ${u?.persona_id == p.id ? 'selected' : ''}>${esc(p.nombres)} ${esc(p.apellidos || '')}</option>`).join('')}
      </select>
      <p style="font-size:.72rem;color:var(--muted);margin:.25rem 0 0">
        Obligatorio para los conductores: es lo que conecta la cuenta con su itinerario.</p></div>
    <div class="campo"><label class="lb">Correo</label><input class="inp" id="u-correo" type="email" value="${esc(u?.correo || '')}"></div>
    <div class="campo"><label class="lb">${u ? 'Nueva clave temporal (dejar vacío para no cambiarla)' : 'Clave temporal'} ${u ? '' : '<span class="req">*</span>'}</label>
      <input class="inp" id="u-clave" placeholder="Mínimo 8 caracteres">
      <p style="font-size:.72rem;color:var(--muted);margin:.25rem 0 0">
        Anótela y entréguesela a la persona. El sistema le exige cambiarla al entrar.</p></div>
    ${u ? `<div class="campo"><label class="lb">
      <input type="checkbox" id="u-activo" ${u.activo ? 'checked' : ''}> Cuenta activa</label></div>` : ''}`,
    `<button class="btn sec" onclick="cerrarModal()">Cancelar</button>
     <button class="btn" id="u-btn" onclick="guardarUsuario(${id || 'null'})">Guardar</button>`);
}

async function guardarUsuario(id) {
  const btn = $('#u-btn'); btn.disabled = true; btn.textContent = 'Guardando...';
  const clave = $('#u-clave').value;
  const c = {
    usuario: $('#u-usuario').value.trim().toLowerCase(),
    rol: $('#u-rol').value,
    persona_id: $('#u-persona').value ? Number($('#u-persona').value) : null,
    correo: $('#u-correo').value.trim() || null,
  };
  if (clave) c.clave = clave;
  if (id) c.activo = $('#u-activo')?.checked ? 1 : 0;

  if (!c.usuario || (!id && !clave)) {
    btn.disabled = false; btn.textContent = 'Guardar';
    return aviso('Indique el usuario y la clave temporal', 'mal', 'Faltan datos');
  }
  try {
    if (id) await api('/api/usuarios/' + id, { metodo: 'PUT', cuerpo: c });
    else await api('/api/usuarios', { metodo: 'POST', cuerpo: c });
    cerrarModal();
    aviso(clave ? `Entregue la clave a ${c.usuario}. Se la pedirá cambiar al entrar.` : 'Usuario actualizado',
          'ok', 'Listo');
    verUsuarios();
  } catch (e) {
    aviso(e.message, 'mal', 'No se pudo guardar');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ── Ajustes ──────────────────────────────────────────────────────────────────
const EXPLICA = {
  checklist_bloquea_salida: ['¿Qué pasa si falta un distintivo?',
    [['advertir', 'Solo advertir y dejar registrado'], ['bloquear', 'Impedir la salida']]],
  dia_disponible_es_pagable: ['¿Un día disponible en base se paga?',
    [['1', 'Sí, igual que un día con desplazamiento'], ['0', 'No']]],
  gps_obligatorio: ['¿Exigir ubicación al marcar?', [['1', 'Sí'], ['0', 'No']]],
  gps_precision_maxima_m: ['Precisión máxima aceptada (metros)', null],
  dias_alerta_vencimiento: ['Avisar vencimientos con esta anticipación (días)', null],
  umbral_discrepancia_dias: ['Diferencia tolerada con el soporte firmado (días)', null],
  correo_alertas: ['Correos para las alertas (separados por coma)', null],
};

async function verAjustes() {
  const ps = await api('/api/parametros');
  $('#main').innerHTML = `
    <div class="cab"><div><h1>Ajustes</h1><p>Reglas de operación. Solo usted puede cambiarlas.</p></div></div>
    ${ps.map(p => {
      const [et, ops] = EXPLICA[p.clave] || [p.clave, null];
      return `<div class="card" style="margin-bottom:.75rem">
        <label class="lb" style="font-size:.85rem;text-transform:none;letter-spacing:0">${esc(et)}</label>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap;margin-top:.4rem">
          ${ops
            ? `<select class="inp" id="par-${p.clave}" style="flex:1;min-width:220px">
                 ${ops.map(([v, e]) => `<option value="${v}" ${p.valor === v ? 'selected' : ''}>${e}</option>`).join('')}
               </select>`
            : `<input class="inp" id="par-${p.clave}" value="${esc(p.valor)}" style="flex:1;min-width:220px">`}
          <button class="btn sm" onclick="guardarParametro('${p.clave}')">Guardar</button>
        </div>
        ${p.descripcion ? `<p style="font-size:.72rem;color:var(--muted);margin:.4rem 0 0">${esc(p.descripcion)}</p>` : ''}
      </div>`;
    }).join('')}
    <div class="card">
      <h3>Auditoría</h3>
      <p style="font-size:.85rem;color:var(--text-soft);margin:.3rem 0 .75rem">
        Registro de quién hizo qué y cuándo. No se puede modificar ni borrar.</p>
      <button class="btn sec" onclick="verAuditoria()">Ver los últimos 200 movimientos</button>
    </div>`;
}

async function guardarParametro(clave) {
  try {
    await api('/api/parametros/' + clave, { metodo: 'PUT', cuerpo: { valor: $('#par-' + clave).value } });
    aviso('Ajuste guardado', 'ok');
  } catch (e) { aviso(e.message, 'mal', 'No se pudo guardar'); }
}

async function verAuditoria() {
  const a = await api('/api/auditoria?limite=200');
  abrirModal('Auditoría', `<div class="tabla-env" style="border:0"><table>
    <thead><tr><th>Cuándo</th><th>Quién</th><th>Qué</th></tr></thead>
    <tbody>${a.map(x => `
      <tr><td style="white-space:nowrap">${fechaHora(x.ts)}</td>
        <td>${esc(x.nombre?.trim() || x.usuario || '—')}<br><span style="font-size:.68rem;color:var(--muted)">${esc(x.rol || '')}</span></td>
        <td>${esc(x.accion)} <b>${esc(x.entidad)}</b>${x.entidad_id ? ' #' + x.entidad_id : ''}</td></tr>`).join('')}
    </tbody></table></div>`);
}

// ── Arranque ─────────────────────────────────────────────────────────────────
(function arrancar() {
  try {
    const guardada = JSON.parse(localStorage.getItem('flota_sesion') || 'null');
    if (guardada?.token) {
      sesion = guardada;
      api('/api/auth/yo')
        .then(u => { sesion = { ...sesion, ...u }; iniciar(); })
        .catch(() => salir(true));
      return;
    }
  } catch { /* sesión ilegible: se pide ingreso */ }
  $('#ingreso').style.display = 'flex';
})();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* opcional */ });
}

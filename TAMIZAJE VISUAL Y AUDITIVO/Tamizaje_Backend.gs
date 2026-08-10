// ============================================================
// TAMIZAJE VISUAL Y AUDITIVO — Backend Google Apps Script
// ESE Hospital Regional Noroccidental (HRNO) — Salud Publica
// Instrumento VALE (auditivo/comunicativo) + Snellen (visual)
// ------------------------------------------------------------
// Este script queda ENLAZADO a la hoja "TAMIZAJE VISUAL Y
// AUDITIVO - HRNO (Backend)". Se instala desde:
//   Extensiones -> Apps Script  (dentro de esa hoja)
// Ver archivo INSTRUCCIONES_BACKEND.txt para el paso a paso.
// ============================================================

const CONFIG = {
  HOJA_VISUAL:   'TAMIZAJE_VISUAL',
  HOJA_AUDITIVO: 'TAMIZAJE_AUDITIVO',

  // >>> CAMBIA ESTA CONTRASENA por una tuya (solo la conoce el admin). <<<
  ADMIN_PASSWORD: 'HRNO-Tamizaje-2026',

  VERSION: '1.0',
};

// Columnas (encabezados) de cada pestana. NO cambiar el orden despues de
// tener datos: la app y el dashboard dependen de estos nombres.
const COLS_VISUAL = [
  'id','fecha_registro','tipo_tamizaje',
  'paciente_nombre','tipo_doc','num_doc','fecha_nacimiento','edad_texto','edad_meses','curso_vida','genero','eps','municipio','acudiente',
  'evaluador_nombre','evaluador_registro','evaluador_especialidad','consentimiento',
  'optotipo','usa_correccion',
  'sc_od','sc_oi','sc_ao','cc_od','cc_oi','cc_ao',
  'resultado','motivo_remision','observaciones',
];

const COLS_AUDITIVO = [
  'id','fecha_registro','tipo_tamizaje',
  'paciente_nombre','tipo_doc','num_doc','fecha_nacimiento','edad_texto','edad_meses','curso_vida','genero','eps','municipio','acudiente',
  'evaluador_nombre','evaluador_registro','evaluador_especialidad','consentimiento',
  'rango_edad_vale',
  'riesgo_bajo_peso','riesgo_prematuro','riesgo_ucin',
  'comp_perinatales','diagnosticos_riesgo','dificultades_aprendizaje',
  'estructuras_json','respuestas_json',
  'neg_comprension','neg_expresion','neg_interaccion','neg_vestibular','total_negativas',
  'resultado','conducta','observaciones',
];

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────
function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
function errorResponse(msg) {
  return jsonResponse({ ok: false, error: String(msg) });
}

function getHoja_(nombre, cols) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
  }
  // Asegura encabezados
  const firstRow = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).getValues()[0];
  const vacio = firstRow.join('').trim() === '';
  if (vacio) {
    sh.getRange(1, 1, 1, cols.length).setValues([cols]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, cols.length).setFontWeight('bold').setBackground('#0f4c81').setFontColor('#ffffff');
  }
  return sh;
}

// Crea/asegura las dos pestanas con encabezados. Ejecutar una vez tras pegar el script.
function setup() {
  getHoja_(CONFIG.HOJA_VISUAL, COLS_VISUAL);
  getHoja_(CONFIG.HOJA_AUDITIVO, COLS_AUDITIVO);
  // Elimina la hoja por defecto "Hoja 1"/"Sheet1" si quedo vacia
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  ['Hoja 1','Hoja1','Sheet1','Hoja de cálculo sin título'].forEach(function(n){
    const s = ss.getSheetByName(n);
    if (s && s.getLastRow() === 0 && ss.getSheets().length > 1) { try { ss.deleteSheet(s); } catch(e){} }
  });
  return 'Listo. Pestanas creadas: ' + CONFIG.HOJA_VISUAL + ', ' + CONFIG.HOJA_AUDITIVO;
}

function appendFila_(sh, cols, obj) {
  const fila = cols.map(function(c){
    let v = obj[c];
    if (v === undefined || v === null) return '';
    if (typeof v === 'object') return JSON.stringify(v);
    return v;
  });
  sh.appendRow(fila);
}

function leerHoja_(sh) {
  const rango = sh.getDataRange().getValues();
  if (rango.length < 2) return [];
  const head = rango[0];
  const out = [];
  for (let i = 1; i < rango.length; i++) {
    const row = rango[i];
    if (String(row[0] || '').trim() === '') continue; // sin id -> vacia
    const o = {};
    for (let j = 0; j < head.length; j++) o[head[j]] = row[j];
    out.push(o);
  }
  return out;
}

// ─────────────────────────────────────────────
// ROUTER
// ─────────────────────────────────────────────
function doGet(e) {
  const accion = ((e && e.parameter && e.parameter.accion) || 'ping').toLowerCase();
  try {
    if (accion === 'ping') return jsonResponse({ ok: true, version: CONFIG.VERSION, ts: new Date().toISOString() });
    return jsonResponse({ ok: true, mensaje: 'Backend Tamizaje Visual y Auditivo activo. Use POST.', version: CONFIG.VERSION });
  } catch (err) {
    return errorResponse(err.message);
  }
}

function doPost(e) {
  let body;
  try {
    const raw = (e.parameter && e.parameter.payload) ? e.parameter.payload : (e.postData ? e.postData.contents : '{}');
    body = JSON.parse(raw || '{}');
  } catch (pe) { return errorResponse('JSON invalido: ' + pe.message); }

  const accion = (body.accion || '').toLowerCase();
  try {
    switch (accion) {
      case 'guardar_visual':   return apiGuardarVisual(body);
      case 'guardar_auditivo': return apiGuardarAuditivo(body);
      case 'login':            return apiLogin(body);
      case 'listar':           return apiListar(body);
      default: return errorResponse('Accion desconocida: ' + accion);
    }
  } catch (err) {
    return errorResponse('Error en ' + accion + ': ' + err.message);
  }
}

// ─────────────────────────────────────────────
// ACCIONES
// ─────────────────────────────────────────────
function apiGuardarVisual(body) {
  const d = body.datos || {};
  if (!d.id) d.id = Utilities.getUuid();
  if (!d.fecha_registro) d.fecha_registro = new Date().toISOString();
  d.tipo_tamizaje = 'VISUAL';
  const sh = getHoja_(CONFIG.HOJA_VISUAL, COLS_VISUAL);
  appendFila_(sh, COLS_VISUAL, d);
  return jsonResponse({ ok: true, id: d.id });
}

function apiGuardarAuditivo(body) {
  const d = body.datos || {};
  if (!d.id) d.id = Utilities.getUuid();
  if (!d.fecha_registro) d.fecha_registro = new Date().toISOString();
  d.tipo_tamizaje = 'AUDITIVO';
  const sh = getHoja_(CONFIG.HOJA_AUDITIVO, COLS_AUDITIVO);
  appendFila_(sh, COLS_AUDITIVO, d);
  return jsonResponse({ ok: true, id: d.id });
}

function apiLogin(body) {
  const clave = String(body.clave || '');
  if (clave && clave === CONFIG.ADMIN_PASSWORD) return jsonResponse({ ok: true });
  return jsonResponse({ ok: false, error: 'Contrasena incorrecta' });
}

function apiListar(body) {
  const clave = String(body.clave || '');
  if (clave !== CONFIG.ADMIN_PASSWORD) return errorResponse('No autorizado');
  const shV = getHoja_(CONFIG.HOJA_VISUAL, COLS_VISUAL);
  const shA = getHoja_(CONFIG.HOJA_AUDITIVO, COLS_AUDITIVO);
  return jsonResponse({ ok: true, visual: leerHoja_(shV), auditivo: leerHoja_(shA) });
}

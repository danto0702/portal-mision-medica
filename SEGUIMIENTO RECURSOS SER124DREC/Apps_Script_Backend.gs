/**
 * ════════════════════════════════════════════════════════════════════════
 *  BACKEND — SEGUIMIENTO DE RECURSOS DE TRANSFERENCIAS (SER124DREC)
 *  ESE Hospital Regional Noroccidental · PISIS / SISPRO
 * ────────────────────────────────────────────────────────────────────────
 *  Cómo instalar:
 *   1. Abre la hoja de cálculo de respaldo en Google Sheets.
 *   2. Menú  Extensiones → Apps Script.
 *   3. Borra todo y pega ESTE código. Guarda (Ctrl+S).
 *   4. (Opcional) cambia TOKEN por una clave secreta y ponla igual en el app.
 *   5. Implementar → Nueva implementación → Aplicación web:
 *        - Ejecutar como:      Yo (tu cuenta)
 *        - Quién tiene acceso:  Cualquier usuario
 *   6. Autoriza los permisos. Copia la URL que termina en /exec.
 *   7. Pega esa URL en la pestaña "Ajustes" del aplicativo → Probar conexión.
 * ════════════════════════════════════════════════════════════════════════
 */

// Si quieres proteger el endpoint, define un token (misma cadena en el app).
// Déjalo vacío ('') para no exigir token.
const TOKEN = '';

// Orden de campos por tipo de registro (coincide con la plantilla Excel y el aplicativo)
const CAMPOS = {
  2: ['idRecurso','nit','indicador','tipoActo','numActo','fecha','valor'],
  3: ['idRecurso','nit','indicador','tipoActo','numActo','fecha','fechaFin','objeto','valor','tipoIdContratista','numIdContratista','nomContratista','tipoIdSuperv','numIdSuperv','nomSuperv'],
  4: ['idRecurso','nit','indicador','tipoActo','numActo','numPoliza','fecha'],
  5: ['idRecurso','nit','indicador','tipoActo','numActo','tipoActa','noActa','fecha','valorObligado','valorPagado','pctTecnica','conclusiones'],
  6: ['idRecurso','nit','indicador','tipoActo','numActo','fecha','codEntidad','nitBanco','numCuenta','valor','fechaConsig','portafolio'],
  7: ['idRecurso','nit','indicador','tipoActo','numActo','fecha','codEntidad','nitBanco','numCuenta','valor','fechaConsig','portafolio']
};
const HOJA = { 2:'INCORPORACION', 3:'CONTRATOS', 4:'POLIZAS', 5:'SEGUIMIENTO', 6:'REINT_RECURSOS', 7:'REINT_RENDIM' };
const H_ENVIOS = ['FechaHora','NombreArchivo','TipoIdEntidad','NumIdEntidad','IDRecurso','NITBeneficiaria','FechaIni','FechaFin','TotalRegistros','Origen'];

function doGet(e)  { return json({ ok:true, msg:'API SER124DREC activa', metodo:'GET' }); }

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (TOKEN && body.token !== TOKEN) return json({ ok:false, error:'Token invalido' });
    switch (body.action) {
      case 'ping':         return json({ ok:true, msg:'pong', version:'1.0' });
      case 'guardarEnvio': return guardarEnvio(body);
      default:             return json({ ok:false, error:'Accion no reconocida: ' + body.action });
    }
  } catch (err) {
    return json({ ok:false, error:String(err) });
  }
}

function guardarEnvio(body) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ts = new Date();
  const arc = body.archivo || '';
  const ent = body.entidad || {};
  const registros = body.registros || [];

  // 1) Bitácora del envío
  const shE = getSheet(ss, 'ENVIOS', H_ENVIOS);
  shE.appendRow([ ts, arc, ent.tipoId || '', ent.numId || '', ent.idRecurso || '', ent.nitBenef || '',
                  ent.fechaIni || '', ent.fechaFin || '', registros.length, 'Aplicativo HTML' ]);

  // 2) Detalle por tipo de registro
  const porTipo = {};
  registros.forEach(function(r){ (porTipo[r.tipo] = porTipo[r.tipo] || []).push(r); });

  Object.keys(porTipo).forEach(function(t){
    const campos = CAMPOS[t]; if (!campos) return;
    const headers = ['FechaHora','NombreArchivo','Consecutivo'].concat(campos.map(cap));
    const sh = getSheet(ss, HOJA[t], headers);
    const filas = porTipo[t].map(function(r){
      return [ ts, arc, r.consecutivo || '' ].concat(campos.map(function(k){ return r[k] != null ? r[k] : ''; }));
    });
    sh.getRange(sh.getLastRow() + 1, 1, filas.length, headers.length).setValues(filas);
  });

  return json({ ok:true, filas: registros.length + 1, archivo: arc });
}

// Devuelve la hoja; la crea con encabezados si no existe.
function getSheet(ss, nombre, headers) {
  let sh = ss.getSheetByName(nombre);
  if (!sh) {
    sh = ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, headers.length).setValues([headers])
      .setFontWeight('bold').setBackground('#0f4c81').setFontColor('#ffffff');
    sh.setFrozenRows(1);
  }
  return sh;
}

function cap(s){ return String(s).charAt(0).toUpperCase() + String(s).slice(1); }

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * ════════════════════════════════════════════════════════════════════════
 *  BACKEND — REPORTE DE USUARIOS INSTITUCIONALES SISPRO (SEG500USIN)
 *  ESE Hospital Regional Noroccidental
 * ────────────────────────────────────────────────────────────────────────
 *  Cómo instalar:
 *   1. Abre la hoja de cálculo de respaldo en Google Sheets.
 *   2. Menú  Extensiones → Apps Script.
 *   3. Borra todo y pega ESTE código. Guarda (Ctrl+S).
 *   4. (Opcional) cambia TOKEN por una clave secreta y ponla igual en el app.
 *   5. Implementar → Nueva implementación → Aplicación web:
 *        - Ejecutar como:  Yo (tu cuenta)
 *        - Quién tiene acceso:  Cualquier usuario
 *   6. Autoriza los permisos. Copia la URL que termina en /exec.
 *   7. Pega esa URL en la pestaña "Ajustes" del aplicativo.
 * ════════════════════════════════════════════════════════════════════════
 */

// Si quieres proteger el endpoint, define un token (misma cadena en el app).
// Déjalo vacío ('') para no exigir token.
const TOKEN = '';

// Encabezados de cada hoja
const H_ENVIOS   = ['FechaHora','NombreArchivo','FechaCorte','TipoIdEntidad','NumIdEntidad','RazonSocial','TotalUsuarios','TotalPerfiles','TotalRegistros','Origen'];
const H_USUARIOS = ['FechaHora','NombreArchivo','Consecutivo','Accion','TipoId','NumeroId','PrimerNombre','PrimerApellido','Telefono','Cargo','ContratoIndefinido','FechaFinContrato','CorreoInstitucional'];
const H_PERFILES = ['FechaHora','NombreArchivo','Consecutivo','TipoId','NumeroId','Aplicacion','Accion','CodigoPerfil'];

function doGet(e)  { return json({ ok:true, msg:'API SEG500USIN activa', metodo:'GET' }); }

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (TOKEN && body.token !== TOKEN) return json({ ok:false, error:'Token invalido' });

    switch (body.action) {
      case 'ping':          return json({ ok:true, msg:'pong', version:'1.0' });
      case 'guardarEnvio':  return guardarEnvio(body);
      default:              return json({ ok:false, error:'Accion no reconocida: ' + body.action });
    }
  } catch (err) {
    return json({ ok:false, error:String(err) });
  }
}

function guardarEnvio(body) {
  const ss  = SpreadsheetApp.getActiveSpreadsheet();
  const ts  = new Date();
  const arc = body.archivo || '';
  const ent = body.entidad || {};
  const usuarios = body.usuarios || [];
  const perfiles = body.perfiles || [];

  const shE = getSheet(ss, 'ENVIOS',   H_ENVIOS);
  const shU = getSheet(ss, 'USUARIOS', H_USUARIOS);
  const shP = getSheet(ss, 'PERFILES', H_PERFILES);

  // 1) Log del envío
  shE.appendRow([ ts, arc, body.fechaCorte || '', ent.tipoId || '', ent.numId || '', ent.razon || '',
                  usuarios.length, perfiles.length, usuarios.length + perfiles.length, 'Aplicativo HTML' ]);

  // 2) Detalle de usuarios (Tipo 2)
  if (usuarios.length) {
    const filas = usuarios.map(u => [ ts, arc, u.consecutivo || '', u.accion || '', u.tipo || '', u.num || '',
      u.nom || '', u.ape || '', u.tel || '', u.cargo || '',
      u.indef === '1' ? 'SI' : (u.indef === '0' ? 'NO' : ''), u.fechaFin || '', u.correo || '' ]);
    shU.getRange(shU.getLastRow() + 1, 1, filas.length, H_USUARIOS.length).setValues(filas);
  }

  // 3) Detalle de perfiles (Tipo 3)
  if (perfiles.length) {
    const filas = perfiles.map(p => [ ts, arc, p.consecutivo || '', p.tipo || '', p.num || '',
      p.app || '', p.accion || '', p.perfil || '' ]);
    shP.getRange(shP.getLastRow() + 1, 1, filas.length, H_PERFILES.length).setValues(filas);
  }

  return json({ ok:true, filas: usuarios.length + perfiles.length + 1, archivo: arc });
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

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

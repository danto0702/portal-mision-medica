/**
 * ════════════════════════════════════════════════════════════════
 *  APPS SCRIPT — Misión Médica HRNO
 *  Versión: 3.0  (Drive PDF + Sheets + Emblemas + Correos)
 *  Acciones soportadas:
 *    GET  → getInventory, getData
 *    POST → uploadCard, requestEmblem, updateInventory,
 *            updateStatus, sendEmail, uploadDrivePDF
 * ════════════════════════════════════════════════════════════════
 *
 *  INSTRUCCIONES DE INSTALACIÓN:
 *  1. Abre script.google.com
 *  2. Abre el proyecto de tu Apps Script existente
 *  3. Reemplaza TODO el contenido con este código
 *  4. Guarda (Ctrl+S)
 *  5. Ve a Implementar → Administrar implementaciones → editar (lápiz)
 *  6. Cambia la versión a "Nueva versión"
 *  7. Haz clic en "Implementar"
 *  8. Acepta los permisos nuevos si el sistema los solicita
 *
 *  PERMISOS requeridos:
 *  - Google Sheets (leer/escribir solicitudes de carnets y emblemas)
 *  - Gmail (enviar correos de confirmación y autorización)
 *  - Google Drive (guardar PDFs de documentos de identidad)
 *
 *  SPREADSHEET: https://docs.google.com/spreadsheets/d/1YXcFzbr6k3xowbDBSsZ8qYuTjkZSRJLHExFQcR5cbY0
 *  DRIVE FOLDER: https://drive.google.com/drive/folders/1lvd00auoazlCUMuASOfBC3A4UvvG9Fwm
 */

// ── CONFIGURACIÓN ──────────────────────────────────────────────
const SPREADSHEET_ID   = '1YXcFzbr6k3xowbDBSsZ8qYuTjkZSRJLHExFQcR5cbY0';
const SHEET_TARJETAS   = 'Tarjetas';
const SHEET_EMBLEMAS   = 'Emblemas';
const SHEET_INVENTARIO = 'Inventario';
const DRIVE_FOLDER_ID  = '1lvd00auoazlCUMuASOfBC3A4UvvG9Fwm';
const EMAIL_REMITENTE_NOMBRE = 'Misión Médica — ESE HRNO';

// ── HELPERS ────────────────────────────────────────────────────
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  return sheet;
}

function timestamp() {
  return new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });
}

function json(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function ok(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

function error(msg) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'error', message: msg }))
    .setMimeType(ContentService.MimeType.JSON);
}

// ══════════════════════════════════════════════════════════════
//  doGet — Maneja peticiones GET
// ══════════════════════════════════════════════════════════════
function doGet(e) {
  try {
    const action = e.parameter.action;

    if (action === 'getInventory') {
      const sheet = getSheet(SHEET_INVENTARIO);
      const data = sheet.getRange(2, 1, 1, 3).getValues()[0];
      return json({ banderas: data[0] || 0, chalecos: data[1] || 0, petos: data[2] || 0 });
    }

    if (action === 'getData') {
      const rowsT = getSheet(SHEET_TARJETAS).getDataRange().getValues();
      const rowsE = getSheet(SHEET_EMBLEMAS).getDataRange().getValues();
      const result = [];

      for (let i = 1; i < rowsT.length; i++) {
        const r = rowsT[i];
        if (!r[0]) continue;
        result.push({
          tipo: 'Tarjeta',
          nombre: r[0] || '', documento: r[1] || '', perfil: r[2] || '',
          cargo: r[3] || '', municipio: r[4] || '', ips: r[5] || '',
          email: r[6] || '', telefono: r[7] || '',
          estado: r[8] || 'Pendiente', fecha_solicitud: r[9] || '',
        });
      }

      for (let i = 1; i < rowsE.length; i++) {
        const r = rowsE[i];
        if (!r[0]) continue;
        result.push({
          tipo: 'Emblema',
          nombre: r[0] || '', documento: r[1] || '', municipio: r[2] || '',
          ips: r[3] || '', email: r[4] || '', telefono: r[5] || '',
          tipo_emblema: r[6] || '', cantidad_solicitada: r[7] || 1,
          cantidad_autorizada: r[8] || 0, estado: r[9] || 'Pendiente',
          fecha_solicitud: r[10] || '',
        });
      }

      return json(result);
    }

    return error('Acción no reconocida: ' + action);

  } catch (err) {
    return error(err.message);
  }
}

// ══════════════════════════════════════════════════════════════
//  doPost — Maneja peticiones POST
// ══════════════════════════════════════════════════════════════
function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const action = data.action;

    // ── uploadCard ────────────────────────────────────────────
    if (action === 'uploadCard') {
      const sheet = getSheet(SHEET_TARJETAS);

      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          'Nombre', 'Documento', 'Perfil', 'Cargo', 'Municipio', 'IPS',
          'Correo', 'Teléfono', 'Estado', 'Fecha Solicitud',
          'Fecha Nacimiento', 'Sexo', 'Vinculación', 'RH', 'Estatura',
          'Responsable', 'Número Carnet', 'Fecha Autorización'
        ]);
      }

      sheet.appendRow([
        data.nombre           || '',
        data.documento        || '',
        data.perfil           || '',
        data.cargo            || '',
        data.municipio        || '',
        data.ips              || '',
        data.email            || '',
        data.telefono         || '',
        'Pendiente',
        timestamp(),
        data.fecha_nacimiento || '',
        data.sexo             || '',
        data.vinculacion      || '',
        data.rh               || '',
        data.estatura         || '',
        data.responsable      || '',
        '',
        ''
      ]);

      if (data.email) {
        enviarCorreo(
          data.email,
          'Solicitud recibida — Tarjeta Misión Médica · ESE HRNO',
          'Estimado(a) ' + data.nombre + ',\n\n' +
          'Hemos recibido tu solicitud de tarjeta de identificación de la Misión Médica.\n\n' +
          'Una vez sea revisada y autorizada, recibirás un correo con el enlace para completar el proceso fotográfico.\n\n' +
          'Número de documento registrado: ' + data.documento + '\n\n' +
          'Atentamente,\nMisión Médica — ESE Hospital Regional Noroccidental'
        );
      }

      return ok('Tarjeta registrada');
    }

    // ── requestEmblem ─────────────────────────────────────────
    if (action === 'requestEmblem') {
      const sheet = getSheet(SHEET_EMBLEMAS);

      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          'Nombre', 'Documento', 'Municipio', 'IPS', 'Correo', 'Teléfono',
          'Tipo Emblema', 'Cantidad Solicitada', 'Cantidad Autorizada',
          'Estado', 'Fecha Solicitud'
        ]);
      }

      sheet.appendRow([
        data.nombre              || '',
        data.documento           || '',
        data.municipio           || '',
        data.ips                 || '',
        data.email               || '',
        data.telefono            || '',
        data.tipo_emblema        || '',
        data.cantidad_solicitada || 1,
        0,
        'Pendiente',
        timestamp()
      ]);

      return ok('Emblema registrado');
    }

    // ── updateInventory ───────────────────────────────────────
    if (action === 'updateInventory') {
      const sheet = getSheet(SHEET_INVENTARIO);

      if (sheet.getLastRow() === 0) {
        sheet.appendRow(['Banderas', 'Chalecos', 'Petos', 'Última actualización']);
        sheet.appendRow([0, 0, 0, timestamp()]);
      }

      sheet.getRange(2, 1, 1, 4).setValues([[
        parseInt(data.banderas) || 0,
        parseInt(data.chalecos) || 0,
        parseInt(data.petos)    || 0,
        timestamp()
      ]]);

      return ok('Inventario actualizado');
    }

    // ── updateStatus ──────────────────────────────────────────
    if (action === 'updateStatus') {
      const sheetName = data.type === 'Tarjeta' ? SHEET_TARJETAS : SHEET_EMBLEMAS;
      const sheet     = getSheet(sheetName);
      const colEstado = data.type === 'Tarjeta' ? 9 : 10;

      const rows = sheet.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][1]) === String(data.documento)) {
          const nuevoEstado = data.status === 'Aceptado' ? 'Autorizado' : 'Rechazado';
          sheet.getRange(i + 1, colEstado).setValue(nuevoEstado);

          if (data.type === 'Tarjeta' && data.status === 'Aceptado') {
            if (data.numero_carnet) sheet.getRange(i + 1, 17).setValue(data.numero_carnet);
            sheet.getRange(i + 1, 18).setValue(timestamp());
          }

          if (data.type === 'Emblema' && data.cantidad_autorizada !== undefined) {
            sheet.getRange(i + 1, 9).setValue(parseInt(data.cantidad_autorizada) || 0);
          }

          const emailRow  = data.type === 'Tarjeta' ? rows[i][6] : rows[i][4];
          const nombreRow = rows[i][0];
          if (data.status === 'Aceptado' && emailRow) {
            const cuerpo = data.type === 'Tarjeta'
              ? 'Estimado(a) ' + nombreRow + ',\n\nTu solicitud de tarjeta de identificación de la Misión Médica ha sido APROBADA.\n\nPróximamente recibirás instrucciones para completar el proceso.\n\nAtentamente,\nMisión Médica — ESE HRNO'
              : 'Estimado(a) ' + nombreRow + ',\n\nTu solicitud de ' + rows[i][6] + ' (Cantidad: ' + data.cantidad_autorizada + ') ha sido APROBADA.\n\nEl emblema estará disponible para recogida en tu IPS.\n\nAtentamente,\nMisión Médica — ESE HRNO';
            enviarCorreo(emailRow, 'Tu solicitud fue aprobada — Misión Médica · ESE HRNO', cuerpo);
          }
          break;
        }
      }

      return ok('Estado actualizado');
    }

    // ── uploadDrivePDF ────────────────────────────────────────
    if (action === 'uploadDrivePDF') {
      if (!data.base64 || !data.filename) {
        return error('Faltan campos: base64, filename');
      }

      const bytes  = Utilities.base64Decode(data.base64);
      const blob   = Utilities.newBlob(bytes, 'application/pdf', data.filename);
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const file   = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      return json({ status: 'ok', url: file.getUrl(), id: file.getId() });
    }

    // ── sendEmail ─────────────────────────────────────────────
    if (action === 'sendEmail') {
      if (!data.to || !data.subject || !data.body) {
        return error('Faltan campos: to, subject, body');
      }
      enviarCorreo(data.to, data.subject, data.body);
      return ok('Correo enviado a ' + data.to);
    }

    return error('Acción no reconocida: ' + action);

  } catch (err) {
    console.error('Error en doPost:', err.message);
    return error(err.message);
  }
}

// ── UTILIDADES ─────────────────────────────────────────────────
function enviarCorreo(destinatario, asunto, cuerpo) {
  try {
    GmailApp.sendEmail(destinatario, asunto, cuerpo, {
      name: EMAIL_REMITENTE_NOMBRE,
      replyTo: Session.getActiveUser().getEmail()
    });
    console.log('Correo enviado a:', destinatario);
  } catch (err) {
    console.error('Error enviando correo a', destinatario, ':', err.message);
  }
}

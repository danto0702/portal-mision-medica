// importador.js — Cargue de datos: archivo Excel institucional y formulario caso a caso.
//
// El archivo esperado es el informe "Inf_PrimeraInfancia" que exporta el sistema
// asistencial: una fila por ATENCIÓN, no por niño. El importador agrupa las
// atenciones por documento, crea el niño y el caso, y registra cada atención
// como un seguimiento recalculando los puntajes Z con las tablas OMS.
//
// Reglas de duplicado (definidas con la Coordinación):
//   · mismo documento y mismo municipio  → no se vuelve a cargar, se omite
//   · mismo documento en otro municipio  → se avisa y se deja sin cargar
//   · misma atención (caso y fecha)      → se omite

var DNTImportador = (function () {
  'use strict';

  var A;
  function $(i) { return DNTApp.$(i); }
  function esc(s) { return DNTApp.esc(s); }

  // ── Encabezados que definen la estructura válida ─────────────────
  var REQUERIDAS = [
    'Tipo Identificación', 'Nro Doc. Paciente', 'Primer Nombre', 'Primer Apellido Paciente',
    'Fecha de Nac.', 'Género', 'Municipio Residencia', 'Fecha de Consulta', 'Talla', 'Peso'
  ];

  var OPCIONALES = {
    segundo_nombre: 'Segundo Nombre Paciente', segundo_apellido: 'Segundo Apellido Paciente',
    telefono: 'Telefono', direccion: 'Dirección', zona: 'Zona', etnia: 'Pertenencia Étnica',
    pueblo: 'Pueblo Indigena', asentamiento: 'Asentamiento/ Comunidad', regimen: 'Regimen',
    nacionalidad: 'Nacionalidad', eps: 'EPS Atención', sede: 'Nombre Sede',
    peso_nacer: 'Peso Al Nacer', talla_nacer: 'Talla Al Nacer', edad_gestacional: 'Edad Gestacional Al Nacer',
    hemoglobina: 'Resultado Hemoglobina', pb: 'Perimetro Braquial', pc: 'PerimetroCefalico',
    pt_archivo: 'Peso para la Talla(P/T)', profesional: 'Nombre Profesional'
  };

  var TIPO_DOC = {
    'registro civil': 'RC', 'certificado de nacido vivo': 'CNV', 'tarjeta de identidad': 'TI',
    'cedula de ciudadania': 'CC', 'cédula de ciudadanía': 'CC', 'pasaporte': 'PA',
    'cedula de extranjeria': 'CE', 'cédula de extranjería': 'CE',
    'permiso especial de permanencia': 'PE', 'permiso por proteccion temporal': 'PT',
    'adulto sin identificacion': 'AS', 'menor sin identificacion': 'MS'
  };

  function sinTildes(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
  }
  function normalizarMunicipio(raw) {
    var t = sinTildes(raw).replace(/\s+/g, ' ');
    var mapa = { 'ABREGO': 'ABREGO', 'CONVENCION': 'CONVENCION', 'EL CARMEN': 'EL CARMEN',
                 'CARMEN': 'EL CARMEN', 'TEORAMA': 'TEORAMA' };
    return mapa[t] || t;
  }
  function aISO(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    var s = String(v).trim();
    var m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[0];
    return null;
  }
  function numero(v) {
    if (v == null || v === '') return null;
    var n = parseFloat(String(v).replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  // ═══ Vista ═══════════════════════════════════════════════════════
  function pintar() {
    A = DNTApp;
    var puedeCargar = DNTAuth.esAdmin() || DNTAuth.esResp();

    $('vista-cargar').innerHTML =
      '<div class="titulo-vista"><div class="icono">📥</div><div>' +
        '<h1>Cargar datos</h1>' +
        '<p>Importe el informe de primera infancia en Excel o registre un caso nuevo con el formulario. ' +
        'El sistema recalcula los puntajes Z con las tablas de la OMS y no admite registros duplicados.</p>' +
      '</div></div>' +

      (!puedeCargar
        ? '<div class="aviso info"><span class="ic">i</span><div><strong>Su rol es de consulta</strong>' +
          'El coordinador puede ver y descargar la información, pero el cargue lo hace el responsable del municipio.</div></div>'
        : '<div class="rejilla c2">' +
          '<div class="tarjeta"><h3>📗 Importar archivo Excel</h3>' +
            '<p class="tarjeta-sub">Formato <code>Inf_PrimeraInfancia</code>. Debe conservar los encabezados originales.</p>' +
            '<div class="soltar" id="zonaExcel">📊 Haga clic o arrastre el archivo .xlsx aquí' +
              '<input type="file" id="archivoExcel" accept=".xlsx,.xls" hidden></div>' +
            '<div id="excelElegido"></div>' +
            '<div class="btn-fila" style="margin-top:12px">' +
              '<button class="btn" id="btnAnalizar" disabled>Analizar archivo</button>' +
            '</div></div>' +
          '<div class="tarjeta"><h3>📝 Registrar un caso</h3>' +
            '<p class="tarjeta-sub">Para niños detectados en consulta, búsqueda activa o remisión externa.</p>' +
            '<button class="btn acc" id="btnCasoManual">➕ Nuevo caso</button>' +
            '<div class="aviso info" style="margin-top:14px"><span class="ic">i</span><div>' +
            'El formulario valida el documento antes de crear el caso y avisa si el niño ya está registrado ' +
            'en otro municipio.</div></div></div>' +
        '</div>') +

      '<div id="resultadoImport"></div>' +
      '<div class="tarjeta"><h3>🕘 Historial de cargues</h3>' +
        '<div id="historialImport" class="cargando"><span class="hilo">◐</span> Cargando…</div></div>';

    if (puedeCargar) {
      var zona = $('zonaExcel'), input = $('archivoExcel');
      zona.onclick = function () { input.click(); };
      zona.ondragover = function (e) { e.preventDefault(); zona.classList.add('encima'); };
      zona.ondragleave = function () { zona.classList.remove('encima'); };
      zona.ondrop = function (e) {
        e.preventDefault(); zona.classList.remove('encima');
        input.files = e.dataTransfer.files; elegido();
      };
      input.onchange = elegido;
      $('btnAnalizar').onclick = analizar;
      $('btnCasoManual').onclick = dialogoCasoManual;
    }
    historial();
  }

  function elegido() {
    var f = $('archivoExcel').files[0];
    $('excelElegido').innerHTML = f
      ? '<div class="archivo"><span class="ic">📗</span><span class="nom">' + esc(f.name) +
        '<div class="meta">' + Math.round(f.size / 1024) + ' KB</div></span></div>' : '';
    $('btnAnalizar').disabled = !f;
  }

  async function historial() {
    try {
      var lista = await DNTDatos.importaciones();
      $('historialImport').className = '';
      $('historialImport').innerHTML = lista.length
        ? '<div class="tabla-env"><table class="t"><thead><tr><th>Fecha</th><th>Archivo</th>' +
          '<th>Municipio</th><th class="num">Filas</th><th class="num">Niños nuevos</th>' +
          '<th class="num">Seguimientos</th><th class="num">Omitidos</th><th class="num">Avisos</th>' +
          '</tr></thead><tbody>' + lista.map(function (i) {
            return '<tr><td>' + A.fecha(i.creado_en) + '</td><td>' + esc(i.archivo) + '</td>' +
              '<td>' + esc(i.municipio ? DNTAuth.nombreMunicipio(i.municipio) : 'Varios') + '</td>' +
              '<td class="num">' + i.filas_leidas + '</td><td class="num">' + i.ninos_nuevos + '</td>' +
              '<td class="num">' + i.seguimientos_nuevos + '</td>' +
              '<td class="num">' + i.duplicados_omitidos + '</td>' +
              '<td class="num">' + (i.alertas || []).length + '</td></tr>';
          }).join('') + '</tbody></table></div>'
        : '<div class="vacio"><span class="emo">📗</span>Todavía no se ha importado ningún archivo.</div>';
    } catch (e) {
      $('historialImport').className = '';
      $('historialImport').innerHTML = '<p class="vacio">No se pudo cargar el historial.</p>';
    }
  }

  // ═══ Análisis del archivo ════════════════════════════════════════
  var analisis = null;

  function analizar() {
    var f = $('archivoExcel').files[0];
    var lector = new FileReader();
    $('resultadoImport').innerHTML = '<div class="cargando"><span class="hilo">◐</span> Leyendo el archivo…</div>';
    lector.onload = function (e) {
      try {
        var libro = XLSX.read(new Uint8Array(e.target.result), { type: 'array', cellDates: true });
        var hoja = libro.Sheets[libro.SheetNames[0]];
        var filas = XLSX.utils.sheet_to_json(hoja, { header: 1, raw: false, defval: '' });
        procesar(f.name, filas);
      } catch (err) {
        $('resultadoImport').innerHTML = aviso('grave', 'No se pudo leer el archivo', err.message);
      }
    };
    lector.readAsArrayBuffer(f);
  }

  function aviso(tipo, titulo, texto) {
    return '<div class="aviso ' + tipo + '"><span class="ic">' +
      ({ grave: '⚠', ojo: '!', ok: '✓', info: 'i' }[tipo]) + '</span><div><strong>' +
      esc(titulo) + '</strong>' + texto + '</div></div>';
  }

  function procesar(nombreArchivo, filas) {
    if (filas.length < 2) {
      $('resultadoImport').innerHTML = aviso('grave', 'Archivo vacío', 'No se encontraron filas de datos.');
      return;
    }
    var cab = filas[0].map(function (h) { return String(h || '').trim(); });
    var idx = {};
    cab.forEach(function (h, i) { if (h && idx[h] === undefined) idx[h] = i; });

    var faltan = REQUERIDAS.filter(function (h) { return idx[h] === undefined; });
    if (faltan.length) {
      $('resultadoImport').innerHTML = aviso('grave', 'La estructura del archivo no corresponde',
        'Faltan estas columnas obligatorias:<ul style="margin:6px 0 0;padding-left:18px">' +
        faltan.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') +
        '</ul><p style="margin:8px 0 0">Exporte el informe <code>Inf_PrimeraInfancia</code> sin modificar los encabezados.</p>');
      return;
    }

    function v(fila, clave) {
      var i = idx[clave];
      return i === undefined ? '' : String(fila[i] == null ? '' : fila[i]).trim();
    }

    var atenciones = [], errores = [];
    for (var r = 1; r < filas.length; r++) {
      var fila = filas[r];
      if (!fila || !v(fila, 'Nro Doc. Paciente')) continue;
      var fnac = aISO(v(fila, 'Fecha de Nac.'));
      var fcons = aISO(v(fila, 'Fecha de Consulta'));
      var peso = numero(v(fila, 'Peso')), talla = numero(v(fila, 'Talla'));
      var fallo = null;
      if (!fnac)  fallo = 'fecha de nacimiento ilegible';
      else if (!fcons) fallo = 'fecha de consulta ilegible';
      else if (!(peso > 0)) fallo = 'peso ausente o no numérico';
      else if (!(talla > 0)) fallo = 'talla ausente o no numérica';
      if (fallo) { errores.push({ fila: r + 1, doc: v(fila, 'Nro Doc. Paciente'), motivo: fallo }); continue; }

      var tipoRaw = v(fila, 'Tipo Identificación');
      atenciones.push({
        fila: r + 1,
        tipo_doc: TIPO_DOC[tipoRaw.toLowerCase()] || sinTildes(tipoRaw).slice(0, 4),
        tipo_doc_texto: tipoRaw,
        num_doc: v(fila, 'Nro Doc. Paciente'),
        primer_nombre: v(fila, 'Primer Nombre'), segundo_nombre: v(fila, OPCIONALES.segundo_nombre) || null,
        primer_apellido: v(fila, 'Primer Apellido Paciente'), segundo_apellido: v(fila, OPCIONALES.segundo_apellido) || null,
        fecha_nac: fnac, sexo: /^f/i.test(v(fila, 'Género')) ? 'F' : 'M',
        municipio: normalizarMunicipio(v(fila, 'Municipio Residencia')),
        sede_texto: v(fila, OPCIONALES.sede) || null,
        zona: /rural/i.test(v(fila, OPCIONALES.zona)) ? 'Rural' : (/urban/i.test(v(fila, OPCIONALES.zona)) ? 'Urbano' : null),
        direccion: v(fila, OPCIONALES.direccion) || null,
        telefono: v(fila, OPCIONALES.telefono) || null,
        etnia: v(fila, OPCIONALES.etnia) || null,
        pueblo_indigena: v(fila, OPCIONALES.pueblo) || null,
        asentamiento: v(fila, OPCIONALES.asentamiento) || null,
        regimen: v(fila, OPCIONALES.regimen) || null,
        nacionalidad: v(fila, OPCIONALES.nacionalidad) || null,
        eps: v(fila, OPCIONALES.eps) || null,
        peso_nacer_g: numero(v(fila, OPCIONALES.peso_nacer)),
        talla_nacer_cm: numero(v(fila, OPCIONALES.talla_nacer)),
        edad_gestacional_sem: numero(v(fila, OPCIONALES.edad_gestacional)),
        fecha: fcons, peso_kg: peso, talla_cm: talla,
        pb_cm: numero(v(fila, OPCIONALES.pb)),
        perimetro_cefalico_cm: numero(v(fila, OPCIONALES.pc)),
        hemoglobina: numero(v(fila, OPCIONALES.hemoglobina)),
        pt_archivo: v(fila, OPCIONALES.pt_archivo) || null,
        profesional: v(fila, OPCIONALES.profesional) || null
      });
    }

    // Agrupar por documento
    var porNino = {};
    atenciones.forEach(function (a) {
      var k = a.tipo_doc + '|' + a.num_doc;
      (porNino[k] = porNino[k] || []).push(a);
    });

    // Evaluar cada atención con el motor antropométrico
    var discrepancias = 0;
    Object.keys(porNino).forEach(function (k) {
      porNino[k].sort(function (x, y) { return x.fecha.localeCompare(y.fecha); });
      porNino[k].forEach(function (a) {
        a.ev = DNTAntro.evaluar({
          fecha_nac: a.fecha_nac, fecha: a.fecha, sexo: a.sexo,
          peso_kg: a.peso_kg, talla_cm: a.talla_cm, pb_cm: a.pb_cm
        });
        if (a.pt_archivo && a.ev.clasificacion_pt) {
          var mapa = { 'desnutricion aguda severa': 'DNT_AGUDA_SEVERA',
                       'desnutricion aguda moderada': 'DNT_AGUDA_MODERADA',
                       'riesgo de desnutricion aguda': 'RIESGO_DNT',
                       'peso adecuado para la talla': 'PESO_ADECUADO' };
          var esperado = mapa[sinTildes(a.pt_archivo).toLowerCase()];
          a.discrepa = esperado && esperado !== a.ev.clasificacion_pt;
          if (a.discrepa) discrepancias++;
        }
      });
    });

    analisis = { archivo: nombreArchivo, porNino: porNino, errores: errores, atenciones: atenciones };
    mostrarAnalisis(discrepancias);
  }

  function mostrarAnalisis(discrepancias) {
    var claves = Object.keys(analisis.porNino);
    var municipios = {};
    claves.forEach(function (k) { municipios[analisis.porNino[k][0].municipio] = true; });
    var fueraAlcance = Object.keys(municipios).filter(function (m) { return !DNTAuth.puedeEditar(m); });
    var noReconocidos = Object.keys(municipios).filter(function (m) {
      return !DNTAuth.municipios().some(function (x) { return x.codigo === m; });
    });

    var ejemplos = analisis.atenciones.filter(function (a) { return a.discrepa; }).slice(0, 6);

    $('resultadoImport').innerHTML =
      '<div class="tarjeta"><h3>🔎 Análisis previo de «' + esc(analisis.archivo) + '»</h3>' +
        '<p class="tarjeta-sub">Revise el resumen antes de confirmar. Nada se guarda hasta que pulse Importar.</p>' +
        '<div class="rejilla c4" style="margin-bottom:14px">' +
          A.kpi('Atenciones legibles', analisis.atenciones.length, '', 'Filas válidas del archivo') +
          A.kpi('Niños distintos', claves.length, '', 'Agrupados por documento') +
          A.kpi('Municipios', Object.keys(municipios).length, '', Object.keys(municipios).join(', ')) +
          A.kpi('Filas descartadas', analisis.errores.length, analisis.errores.length ? 'naranja' : 'verde',
                'Datos incompletos o ilegibles') +
        '</div>' +

        (noReconocidos.length
          ? aviso('grave', 'Municipios no reconocidos',
              'El archivo trae ' + esc(noReconocidos.join(', ')) + ', que no está en la cobertura de la ESE. ' +
              'Esas filas no se cargarán.')
          : '') +
        (fueraAlcance.length
          ? aviso('ojo', 'Municipios fuera de su alcance',
              'No puede cargar datos de ' + esc(fueraAlcance.map(DNTAuth.nombreMunicipio).join(', ')) +
              '. Esas filas se omitirán.')
          : '') +
        (discrepancias
          ? aviso('ojo', discrepancias + ' clasificación(es) difieren de las del archivo',
              'El sistema recalcula el puntaje Z con las tablas OMS 2006 e indexa por meses cumplidos. ' +
              'Las diferencias suelen aparecer justo en los puntos de corte. <strong>Se guarda el valor calculado.</strong>' +
              (ejemplos.length ? '<div class="tabla-env" style="margin-top:8px"><table class="t"><thead><tr>' +
                '<th>Documento</th><th>Edad</th><th class="num">Talla</th><th class="num">Peso</th>' +
                '<th class="num">Z calculado</th><th>Sistema</th><th>Archivo</th></tr></thead><tbody>' +
                ejemplos.map(function (a) {
                  return '<tr><td class="mono">' + esc(a.num_doc) + '</td><td>' + esc(a.ev.edad_texto) + '</td>' +
                    '<td class="num mono">' + a.talla_cm + '</td><td class="num mono">' + a.peso_kg + '</td>' +
                    '<td class="num mono">' + A.num(a.ev.z_pt, 2) + '</td>' +
                    '<td>' + A.semaforo(a.ev.clasificacion_pt.codigo) + '</td>' +
                    '<td style="font-size:.78rem">' + esc(a.pt_archivo) + '</td></tr>';
                }).join('') + '</tbody></table></div>' : ''))
          : '') +
        (analisis.errores.length
          ? '<details class="acordeon"><summary>Ver las ' + analisis.errores.length + ' filas descartadas</summary>' +
            '<div class="acordeon-cuerpo"><div class="tabla-env"><table class="t"><thead><tr>' +
            '<th>Fila</th><th>Documento</th><th>Motivo</th></tr></thead><tbody>' +
            analisis.errores.map(function (e) {
              return '<tr><td class="mono">' + e.fila + '</td><td class="mono">' + esc(e.doc) + '</td>' +
                     '<td>' + esc(e.motivo) + '</td></tr>';
            }).join('') + '</tbody></table></div></div></details>'
          : '') +

        '<div class="btn-fila" style="margin-top:14px">' +
          '<button class="btn" id="btnImportar">✅ Importar al sistema</button>' +
          '<button class="btn sec" id="btnCancelarImport">Cancelar</button>' +
        '</div>' +
        '<div id="progreso"></div>' +
      '</div>';

    $('btnImportar').onclick = importar;
    $('btnCancelarImport').onclick = function () { analisis = null; $('resultadoImport').innerHTML = ''; };
  }

  // ═══ Importación ═════════════════════════════════════════════════
  async function importar() {
    $('btnImportar').disabled = true;
    var claves = Object.keys(analisis.porNino);
    var res = { archivo: analisis.archivo, filas_leidas: analisis.atenciones.length,
                ninos_nuevos: 0, ninos_existentes: 0, casos_nuevos: 0, seguimientos_nuevos: 0,
                duplicados_omitidos: 0, alertas: [], errores: [] };
    analisis.errores.forEach(function (e) {
      res.errores.push({ tipo: 'fila_ilegible', fila: e.fila, doc: e.doc, motivo: e.motivo });
    });

    for (var i = 0; i < claves.length; i++) {
      var atens = analisis.porNino[claves[i]];
      $('progreso').innerHTML = '<div class="cargando"><span class="hilo">◐</span> Procesando ' +
        (i + 1) + ' de ' + claves.length + '…</div>';
      try { await importarNino(atens, res); }
      catch (e) {
        res.errores.push({ tipo: 'error', doc: atens[0].num_doc, motivo: e.message });
      }
    }

    try { await DNTDatos.registrarImportacion(res); } catch (e) { /* el resumen es informativo */ }
    DNTAuth.registrar('importacion_excel', { detalle: { archivo: res.archivo, filas: res.filas_leidas } });
    await A.recargarCasos();
    resumenFinal(res);
    historial();
  }

  async function importarNino(atens, res) {
    var base = atens[0];
    var mun = base.municipio;

    if (!DNTAuth.municipios().some(function (x) { return x.codigo === mun; })) {
      res.duplicados_omitidos += atens.length;
      res.alertas.push({ tipo: 'municipio_no_reconocido', doc: base.num_doc, municipio: mun });
      return;
    }
    if (!DNTAuth.puedeEditar(mun)) {
      res.duplicados_omitidos += atens.length;
      res.alertas.push({ tipo: 'fuera_de_alcance', doc: base.num_doc, municipio: mun });
      return;
    }

    // ── Niño: existente o nuevo ──
    var dup = await DNTDatos.verificarDuplicado(base.tipo_doc, base.num_doc, mun);
    var nino;
    if (dup.estado === 'duplicado_otro_municipio') {
      res.duplicados_omitidos += atens.length;
      res.alertas.push({ tipo: 'duplicado_otro_municipio', doc: base.num_doc,
        nombre: base.primer_nombre + ' ' + base.primer_apellido,
        municipio_archivo: mun, municipio_registrado: dup.municipio });
      return;
    }
    if (dup.estado === 'duplicado_mismo_municipio') {
      nino = dup.nino; res.ninos_existentes++;
    } else {
      nino = await DNTDatos.guardarNino({
        tipo_doc: base.tipo_doc, num_doc: base.num_doc,
        primer_nombre: base.primer_nombre, segundo_nombre: base.segundo_nombre,
        primer_apellido: base.primer_apellido, segundo_apellido: base.segundo_apellido,
        fecha_nac: base.fecha_nac, sexo: base.sexo, municipio: mun,
        sede_id: sedeDe(base.sede_texto, mun),
        zona: base.zona, direccion: base.direccion, telefono: base.telefono,
        asentamiento: base.asentamiento, regimen: base.regimen, eps: base.eps,
        nacionalidad: base.nacionalidad, etnia: base.etnia,
        pueblo_indigena: base.pueblo_indigena,
        requiere_traductor: !!(base.pueblo_indigena && base.pueblo_indigena.length > 2),
        peso_nacer_g: base.peso_nacer_g, talla_nacer_cm: base.talla_nacer_cm,
        edad_gestacional_sem: base.edad_gestacional_sem
      });
      res.ninos_nuevos++;
    }

    // ── Caso: reutiliza el abierto, o abre uno nuevo ──
    var existentes = await DNTDatos.casos({ texto: base.num_doc });
    var caso = existentes.filter(function (c) { return c.nino_id === nino.id && c.abierto; })[0];
    var clasIngreso = CLAS_CASO[base.ev.clasificacion_final];

    if (!caso) {
      if (!clasIngreso) {
        res.alertas.push({ tipo: 'sin_criterio_de_ingreso', doc: base.num_doc,
          clasificacion: base.ev.clasificacion_final, z: base.ev.z_pt,
          nota: 'El cálculo no arroja riesgo ni desnutrición aguda, por eso no se abrió caso.' });
        return;
      }
      var nuevo = await DNTDatos.guardarCaso({
        nino_id: nino.id, municipio: mun, sede_id: sedeDe(base.sede_texto, mun),
        fecha_apertura: base.fecha, clasificacion_ingreso: clasIngreso,
        estado: ESTADO_CASO[base.ev.clasificacion_final] || 'riesgo',
        origen: 'importacion'
      });
      caso = { id: nuevo.id, municipio: mun, sede_id: nuevo.sede_id };
      res.casos_nuevos++;
    }

    // ── Seguimientos ──
    var previos = await DNTDatos.caso(caso.id);
    var fechasExistentes = {};
    previos.seguimientos.forEach(function (s) { fechasExistentes[s.fecha] = true; });
    var ultimoPrevio = previos.seguimientos[previos.seguimientos.length - 1];

    for (var j = 0; j < atens.length; j++) {
      var a = atens[j];
      if (fechasExistentes[a.fecha]) { res.duplicados_omitidos++; continue; }
      var anterior = j > 0 ? atens[j - 1] : ultimoPrevio;
      var gan = anterior
        ? DNTAntro.gananciaPonderal(a.peso_kg, a.fecha, anterior.peso_kg, anterior.fecha, a.ev.edad_meses_cumplidos)
        : null;

      await DNTDatos.guardarSeguimiento({
        caso_id: caso.id,
        numero: previos.seguimientos.length + j + 1,
        fecha: a.fecha,
        tipo: (previos.seguimientos.length === 0 && j === 0) ? 'ingreso' : 'control',
        modalidad: 'intramural', sede_id: caso.sede_id,
        peso_kg: a.peso_kg, talla_cm: a.talla_cm, medicion: 'auto',
        pb_cm: a.pb_cm, perimetro_cefalico_cm: a.perimetro_cefalico_cm,
        edema: 'ninguno', edad_meses: a.ev.edad_meses,
        z_pt: a.ev.z_pt, z_pe: a.ev.z_pe, z_te: a.ev.z_te, z_imc: a.ev.z_imc,
        clasificacion_pt: a.ev.clasificacion_pt ? a.ev.clasificacion_pt.codigo : null,
        clasificacion_pe: a.ev.clasificacion_pe ? a.ev.clasificacion_pe.codigo : null,
        clasificacion_te: a.ev.clasificacion_te ? a.ev.clasificacion_te.codigo : null,
        clasificacion_final: a.ev.clasificacion_final,
        ganancia_g_dia: gan ? gan.g_dia : null,
        hemoglobina: a.hemoglobina,
        observaciones: 'Importado del informe institucional' +
          (a.profesional ? ' · profesional: ' + a.profesional : '') +
          (a.pt_archivo ? ' · clasificación del archivo: ' + a.pt_archivo : ''),
        fecha_proximo_control: DNTClinico.proximoControl(a.fecha, a.ev.clasificacion_final,
          a.ev.edad_meses_cumplidos).fecha
      });
      fechasExistentes[a.fecha] = true;
      res.seguimientos_nuevos++;
    }

    // El estado del caso refleja la última medición cargada.
    var ultima = atens[atens.length - 1];
    if (ultima && ultima.ev.clasificacion_final) {
      await DNTDatos.guardarCaso({ id: caso.id, estado: ESTADO_CASO[ultima.ev.clasificacion_final] || 'ambulatorio' });
    }
  }

  var CLAS_CASO = {
    RIESGO_DNT: 'RIESGO_DNT', DNT_AGUDA_MODERADA: 'DNT_MODERADA', DNT_AGUDA_SEVERA: 'DNT_SEVERA'
  };
  var ESTADO_CASO = {
    RIESGO_DNT: 'riesgo', DNT_AGUDA_MODERADA: 'dnt_moderada', DNT_AGUDA_SEVERA: 'dnt_severa'
  };

  function sedeDe(texto, municipio) {
    if (!texto) return null;
    var t = sinTildes(texto).replace(/[^A-Z ]/g, '').trim();
    var mapa = { 'HOSPITAL DE ABREGO  PRINCPAL': 'HOSPITAL_ABREGO', 'HOSPITAL DE ABREGO': 'HOSPITAL_ABREGO',
                 'CONVENCION': 'CONVENCION', 'EL CARMEN': 'EL_CARMEN',
                 'GUAMALITO': 'GUAMALITO', 'SAN PABLO': 'SAN_PABLO', 'TEORAMA': 'TEORAMA' };
    return mapa[t] || null;
  }

  function resumenFinal(res) {
    var porTipo = {};
    res.alertas.forEach(function (a) { (porTipo[a.tipo] = porTipo[a.tipo] || []).push(a); });
    var TITULO = {
      duplicado_otro_municipio: 'Niños ya registrados en otro municipio',
      fuera_de_alcance: 'Registros fuera de su alcance territorial',
      municipio_no_reconocido: 'Municipios fuera de la cobertura',
      sin_criterio_de_ingreso: 'Sin criterio de ingreso al programa'
    };

    $('resultadoImport').innerHTML =
      '<div class="tarjeta">' +
        aviso('ok', 'Importación terminada', 'Los datos ya están disponibles en el listado de casos.') +
        '<div class="rejilla c4" style="margin:14px 0">' +
          A.kpi('Niños nuevos', res.ninos_nuevos, 'verde', '') +
          A.kpi('Casos abiertos', res.casos_nuevos, '', '') +
          A.kpi('Seguimientos cargados', res.seguimientos_nuevos, '', '') +
          A.kpi('Registros omitidos', res.duplicados_omitidos, res.duplicados_omitidos ? 'naranja' : 'verde',
                'Duplicados o fuera de alcance') +
        '</div>' +
        Object.keys(porTipo).map(function (t) {
          var lista = porTipo[t];
          return '<details class="acordeon"' + (t === 'duplicado_otro_municipio' ? ' open' : '') + '>' +
            '<summary>' + esc(TITULO[t] || t) + ' <span class="sem ' +
            (t === 'duplicado_otro_municipio' ? 'naranja' : 'gris') + '">' + lista.length + '</span></summary>' +
            '<div class="acordeon-cuerpo"><div class="tabla-env"><table class="t"><tbody>' +
            lista.map(function (a) {
              return '<tr><td class="mono">' + esc(a.doc) + '</td><td>' +
                esc(a.nombre || '') + '</td><td>' +
                (a.municipio_registrado
                  ? 'El archivo lo ubica en ' + esc(DNTAuth.nombreMunicipio(a.municipio_archivo)) +
                    ' pero ya está registrado en ' + esc(DNTAuth.nombreMunicipio(a.municipio_registrado)) +
                    '. Resuélvalo con el coordinador.'
                  : esc(a.nota || a.municipio || '')) + '</td></tr>';
            }).join('') + '</tbody></table></div></div></details>';
        }).join('') +
        (res.errores.length
          ? '<details class="acordeon"><summary>Filas descartadas <span class="sem gris">' +
            res.errores.length + '</span></summary><div class="acordeon-cuerpo"><div class="tabla-env">' +
            '<table class="t"><tbody>' + res.errores.map(function (e) {
              return '<tr><td class="mono">' + esc(e.doc || '') + '</td><td>' + esc(e.motivo) + '</td></tr>';
            }).join('') + '</tbody></table></div></div></details>'
          : '') +
        '<div class="btn-fila" style="margin-top:14px">' +
          '<button class="btn" onclick="DNTApp.ir(\'casos\')">Ver los casos</button></div>' +
      '</div>';
    A.toast('Importación terminada: ' + res.seguimientos_nuevos + ' seguimientos cargados.', 'ok');
  }

  // ═══ Caso a caso ═════════════════════════════════════════════════
  function dialogoCasoManual() {
    var c = function (id, et, ctrl) {
      return '<div class="campo"><label for="' + id + '">' + esc(et) + '</label>' + ctrl + '</div>';
    };
    A.modal('Registrar un caso nuevo',
      '<h4>Identificación</h4>' +
      '<div class="fila">' +
        c('mTipoDoc', 'Tipo de documento', '<select id="mTipoDoc">' +
          A.opcion('RC', 'Registro civil') + A.opcion('CNV', 'Certificado de nacido vivo') +
          A.opcion('TI', 'Tarjeta de identidad') + A.opcion('MS', 'Menor sin identificación') +
          A.opcion('PT', 'Permiso por protección temporal') + '</select>') +
        c('mNumDoc', 'Número de documento', '<input type="text" id="mNumDoc" required>') +
        c('mMunicipio', 'Municipio de residencia', '<select id="mMunicipio">' +
          A.opcionesMunicipio(DNTAuth.alcance()[0], false) + '</select>') +
      '</div>' +
      '<div id="mAvisoDup"></div>' +
      '<div class="fila">' +
        c('mPNombre', 'Primer nombre', '<input type="text" id="mPNombre" required>') +
        c('mSNombre', 'Segundo nombre', '<input type="text" id="mSNombre">') +
      '</div>' +
      '<div class="fila">' +
        c('mPApellido', 'Primer apellido', '<input type="text" id="mPApellido" required>') +
        c('mSApellido', 'Segundo apellido', '<input type="text" id="mSApellido">') +
      '</div>' +
      '<div class="fila">' +
        c('mFNac', 'Fecha de nacimiento', '<input type="date" id="mFNac" max="' + A.hoy() + '" required>') +
        c('mSexo', 'Sexo', '<select id="mSexo">' + A.opcion('M', 'Masculino') + A.opcion('F', 'Femenino') + '</select>') +
        c('mZona', 'Zona', '<select id="mZona">' + A.opcion('Urbano', 'Urbano') + A.opcion('Rural', 'Rural') + '</select>') +
      '</div>' +
      '<div class="fila">' +
        c('mTelefono', 'Teléfono del cuidador', '<input type="tel" id="mTelefono">') +
        c('mEPS', 'EPS', '<input type="text" id="mEPS">') +
        c('mDireccion', 'Dirección o vereda', '<input type="text" id="mDireccion">') +
      '</div>' +
      '<div class="fila">' +
        c('mEtnia', 'Pertenencia étnica', '<input type="text" id="mEtnia" placeholder="Ninguna">') +
        c('mTraductor', 'Requiere traductor', '<select id="mTraductor">' +
          A.opcion('no', 'No') + A.opcion('si', 'Sí') + '</select>') +
      '</div>' +
      '<h4 style="margin-top:14px">Primera medición</h4>' +
      '<div class="fila">' +
        c('mFecha', 'Fecha de la atención', '<input type="date" id="mFecha" value="' + A.hoy() + '" max="' + A.hoy() + '">') +
        c('mPeso', 'Peso (kg)', '<input type="number" id="mPeso" step="0.001" min="0.5" max="40">') +
        c('mTalla', 'Talla o longitud (cm)', '<input type="number" id="mTalla" step="0.1" min="40" max="130">') +
      '</div>' +
      '<div class="fila">' +
        c('mPB', 'Perímetro braquial (cm)', '<input type="number" id="mPB" step="0.1" min="5" max="25">') +
        c('mEdema', 'Edema bilateral', '<select id="mEdema">' + A.opcion('ninguno', 'Ninguno') +
          A.opcion('+', 'Leve (+)') + A.opcion('++', 'Moderado (++)') + A.opcion('+++', 'Severo (+++)') + '</select>') +
      '</div>' +
      '<div id="mCalculo"></div>',
      [
        { texto: 'Cancelar', accion: A.cerrarModal },
        { texto: 'Crear el caso', accion: crearCasoManual }
      ]);

    ['mFNac', 'mSexo', 'mPeso', 'mTalla', 'mPB', 'mEdema', 'mFecha'].forEach(function (id) {
      $(id).oninput = $(id).onchange = calcularManual;
    });
    $('mNumDoc').onblur = comprobarDuplicado;
    $('mMunicipio').onchange = comprobarDuplicado;
  }

  async function comprobarDuplicado() {
    var doc = $('mNumDoc').value.trim();
    if (!doc) { $('mAvisoDup').innerHTML = ''; return; }
    try {
      var r = await DNTDatos.verificarDuplicado($('mTipoDoc').value, doc, $('mMunicipio').value);
      $('mAvisoDup').innerHTML =
        r.estado === 'duplicado_mismo_municipio'
          ? aviso('ojo', 'Este niño ya está registrado',
              esc(r.nino.primer_nombre + ' ' + r.nino.primer_apellido) +
              ' ya existe en este municipio. No se creará otro registro: abra su caso desde el listado.')
        : r.estado === 'duplicado_otro_municipio'
          ? aviso('grave', 'Documento duplicado en otro municipio',
              'El documento ya está registrado en ' + esc(DNTAuth.nombreMunicipio(r.municipio)) +
              '. Resuelva el caso con el coordinador antes de continuar.')
          : aviso('ok', 'Documento disponible', 'No existe ningún registro previo con este documento.');
    } catch (e) { $('mAvisoDup').innerHTML = ''; }
  }

  var calculoManual = null;
  function calcularManual() {
    var fnac = $('mFNac').value, peso = parseFloat($('mPeso').value), talla = parseFloat($('mTalla').value);
    if (!fnac || !(peso > 0) || !(talla > 0)) {
      $('mCalculo').innerHTML = aviso('info', 'Cálculo automático',
        'Ingrese fecha de nacimiento, peso y talla para clasificar el estado nutricional.');
      calculoManual = null;
      return;
    }
    var ev = DNTAntro.evaluar({
      fecha_nac: fnac, fecha: $('mFecha').value, sexo: $('mSexo').value,
      peso_kg: peso, talla_cm: talla, pb_cm: parseFloat($('mPB').value), edema: $('mEdema').value
    });
    calculoManual = ev;
    var clas = CLAS_CASO[ev.clasificacion_final];
    $('mCalculo').innerHTML =
      '<div class="tarjeta" style="background:var(--menta-luz);border-color:var(--menta-borde)">' +
        '<div class="rejilla c3">' +
          A.kpi('Z P/T-L', A.num(ev.z_pt, 2), '', ev.tabla_pt || '') +
          A.kpi('Edad', ev.edad_texto, '', ev.edad_meses_cumplidos + ' meses cumplidos') +
          A.kpi('Z T/E', A.num(ev.z_te, 2), '', 'Talla para la edad') +
        '</div>' +
        '<div style="margin-top:10px">' + A.semaforo(ev.clasificacion_final) +
          (ev.clasificacion_final_criterio ? ' <span style="font-size:.79rem;color:var(--texto-2)">por ' +
            esc(ev.clasificacion_final_criterio) + '</span>' : '') + '</div>' +
      '</div>' +
      (clas ? '' : aviso('ojo', 'Sin criterio de ingreso al programa',
        'Con estas medidas el niño no clasifica en riesgo ni en desnutrición aguda. ' +
        'Verifique las medidas antes de crear el caso.'));
  }

  async function crearCasoManual() {
    if (!calculoManual || !CLAS_CASO[calculoManual.clasificacion_final]) {
      A.toast('Complete las medidas: el caso sólo se abre con riesgo o desnutrición aguda.', 'error'); return;
    }
    var doc = $('mNumDoc').value.trim(), mun = $('mMunicipio').value;
    if (!doc || !$('mPNombre').value.trim() || !$('mPApellido').value.trim() || !$('mFNac').value) {
      A.toast('Faltan datos obligatorios.', 'error'); return;
    }
    try {
      var dup = await DNTDatos.verificarDuplicado($('mTipoDoc').value, doc, mun);
      if (dup.estado === 'duplicado_otro_municipio') {
        A.toast('El documento ya está registrado en ' + DNTAuth.nombreMunicipio(dup.municipio) + '.', 'error');
        return;
      }
      var nino = dup.estado === 'duplicado_mismo_municipio' ? dup.nino : await DNTDatos.guardarNino({
        tipo_doc: $('mTipoDoc').value, num_doc: doc,
        primer_nombre: $('mPNombre').value.trim(), segundo_nombre: $('mSNombre').value.trim() || null,
        primer_apellido: $('mPApellido').value.trim(), segundo_apellido: $('mSApellido').value.trim() || null,
        fecha_nac: $('mFNac').value, sexo: $('mSexo').value, municipio: mun,
        zona: $('mZona').value, direccion: $('mDireccion').value || null,
        telefono: $('mTelefono').value || null, eps: $('mEPS').value || null,
        etnia: $('mEtnia').value || null, requiere_traductor: $('mTraductor').value === 'si'
      });

      var abiertos = (await DNTDatos.casos({ texto: doc })).filter(function (x) {
        return x.nino_id === nino.id && x.abierto;
      });
      if (abiertos.length) {
        A.cerrarModal();
        A.toast('Este niño ya tiene un caso abierto. Se abre su ficha.', 'ojo');
        A.ir('ficha', abiertos[0].id);
        return;
      }

      var caso = await DNTDatos.guardarCaso({
        nino_id: nino.id, municipio: mun, fecha_apertura: $('mFecha').value,
        clasificacion_ingreso: CLAS_CASO[calculoManual.clasificacion_final],
        estado: ESTADO_CASO[calculoManual.clasificacion_final], origen: 'manual'
      });

      await DNTDatos.guardarSeguimiento({
        caso_id: caso.id, numero: 1, fecha: $('mFecha').value, tipo: 'ingreso', modalidad: 'intramural',
        peso_kg: parseFloat($('mPeso').value), talla_cm: parseFloat($('mTalla').value), medicion: 'auto',
        pb_cm: parseFloat($('mPB').value) || null, edema: $('mEdema').value,
        edad_meses: calculoManual.edad_meses,
        z_pt: calculoManual.z_pt, z_pe: calculoManual.z_pe, z_te: calculoManual.z_te, z_imc: calculoManual.z_imc,
        clasificacion_pt: calculoManual.clasificacion_pt ? calculoManual.clasificacion_pt.codigo : null,
        clasificacion_te: calculoManual.clasificacion_te ? calculoManual.clasificacion_te.codigo : null,
        clasificacion_final: calculoManual.clasificacion_final,
        fecha_proximo_control: DNTClinico.proximoControl($('mFecha').value,
          calculoManual.clasificacion_final, calculoManual.edad_meses_cumplidos).fecha
      });

      A.cerrarModal();
      A.toast('Caso creado.', 'ok');
      await A.recargarCasos();
      A.ir('ficha', caso.id);
    } catch (e) { A.toast('No se pudo crear el caso: ' + e.message, 'error'); }
  }

  return { pintar: pintar, normalizarMunicipio: normalizarMunicipio, aISO: aISO };
})();

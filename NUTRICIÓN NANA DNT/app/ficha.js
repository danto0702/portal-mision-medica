// ficha.js — Ficha del caso: datos del niño, curva de crecimiento, seguimientos,
// factores de riesgo, check-lists A/B/C, soportes versionados y egreso.

var DNTFicha = (function () {
  'use strict';

  var A = null;                 // atajo a DNTApp
  var d = null;                 // datos del caso cargado
  var subtab = 'resumen';

  function esc(s) { return DNTApp.esc(s); }
  function $(i) { return DNTApp.$(i); }

  function editable() {
    return d && d.caso && !d.caso.fecha_cierre && DNTAuth.puedeEditar(d.caso.municipio);
  }

  // ═══ Carga ═══════════════════════════════════════════════════════
  async function pintar(casoId) {
    A = DNTApp;
    if (!casoId) { A.ir('casos'); return; }
    $('vista-ficha').innerHTML = '<div class="cargando"><span class="hilo">◐</span> Cargando la ficha…</div>';
    try {
      d = await DNTDatos.caso(casoId);
      DNTAuth.registrar('caso_consultado', { caso_id: casoId, municipio: d.caso.municipio });
      render();
    } catch (e) {
      $('vista-ficha').innerHTML = '<div class="aviso grave"><span class="ic">⚠</span><div>' +
        '<strong>No se pudo abrir el caso</strong>' + esc(e.message) + '</div></div>';
    }
  }

  function render() {
    var n = d.nino, v = d.vista, c = d.caso;
    var ultimo = d.seguimientos[d.seguimientos.length - 1];
    var edadM = DNTAntro.mesesCumplidos(n.fecha_nac);

    $('vista-ficha').innerHTML =
      '<button class="btn sec chico" id="volverCasos" style="margin-bottom:14px">← Volver a los casos</button>' +

      '<div class="tarjeta" style="border-left:5px solid var(--menta)">' +
        '<div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">' +
          '<div style="flex:1;min-width:260px">' +
            '<h1 style="margin-bottom:6px">' + esc(v.nombre) + '</h1>' +
            '<div class="btn-fila" style="margin-bottom:10px">' +
              A.semaforo(v.clasificacion_actual || c.clasificacion_ingreso) +
              A.estadoCaso(c.estado) +
              A.estadoControl(v.estado_control) +
              (c.nivel_riesgo ? '<span class="sem ' +
                 ({ alto: 'rojo', medio: 'amarillo', bajo: 'verde' }[c.nivel_riesgo]) +
                 '">Riesgo ' + c.nivel_riesgo + ' · ' + c.puntaje_riesgo + ' pts</span>' : '') +
            '</div>' +
            '<div style="font-size:.85rem;color:var(--texto-2);line-height:1.8">' +
              esc(n.tipo_doc) + ' <strong class="mono">' + esc(n.num_doc) + '</strong> · ' +
              (n.sexo === 'F' ? 'Femenino' : 'Masculino') + ' · ' +
              esc(DNTAntro.edadTexto(n.fecha_nac)) + ' (' + edadM + ' meses cumplidos)<br>' +
              '📍 ' + esc(DNTAuth.nombreMunicipio(n.municipio)) + (n.zona ? ' · ' + esc(n.zona) : '') +
              (n.direccion ? ' · ' + esc(n.direccion) : '') + '<br>' +
              (n.eps ? '🏥 ' + esc(n.eps) + (n.regimen ? ' · ' + esc(n.regimen) : '') + '<br>' : '') +
              (n.telefono ? '📞 ' + esc(n.telefono) : '') +
            '</div>' +
          '</div>' +
          '<div style="min-width:190px">' +
            '<div class="kpi ' + colorZ(v.z_pt_ultimo) + '">' +
              '<div class="valor mono">' + A.num(v.z_pt_ultimo, 2) + '</div>' +
              '<div class="etiqueta">Puntaje Z de P/T-L</div>' +
              '<div class="pie">Meta de egreso: ≥ -1 DE</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
        (alertaCaso(edadM, ultimo)) +
      '</div>' +

      '<div class="subtabs" id="subtabs">' +
        ['resumen|📋 Resumen', 'seguimientos|📏 Seguimientos', 'riesgo|⚠️ Factores de riesgo',
         'chkA|✅ Check-list A', 'chkB|🔁 Check-list B', 'chkC|🎓 Egreso (C)', 'soportes|📎 Soportes']
        .map(function (t) {
          var p = t.split('|');
          return '<button data-sub="' + p[0] + '"' + (subtab === p[0] ? ' class="activo"' : '') + '>' + p[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div id="subpanel"></div>';

    $('volverCasos').onclick = function () { A.ir('casos'); };
    Array.prototype.forEach.call($('subtabs').querySelectorAll('button'), function (b) {
      b.onclick = function () { subtab = b.dataset.sub; render(); };
    });
    ({ resumen: panelResumen, seguimientos: panelSeguimientos, riesgo: panelRiesgo,
       chkA: function () { panelChecklist('A'); }, chkB: panelChecklistB,
       chkC: panelEgreso, soportes: panelSoportes })[subtab]();
  }

  function colorZ(z) {
    if (z == null) return '';
    if (z < -3) return 'rojo';
    if (z < -2) return 'naranja';
    if (z < -1) return 'amarillo';
    return 'verde';
  }

  function alertaCaso(edadM, ultimo) {
    var h = '';
    if (edadM < 6 && ['DNT_AGUDA_MODERADA', 'DNT_AGUDA_SEVERA'].indexOf(d.caso.clasificacion_ingreso) >= 0) {
      h += '<div class="aviso grave" style="margin-top:14px"><span class="ic">⚠</span><div>' +
        '<strong>Urgencia vital</strong>Todo lactante menor de 6 meses con desnutrición aguda requiere ' +
        'remisión e internación intrahospitalaria previa estabilización. No requiere autorización de la EAPB ' +
        '(Art. 4, Res. 2350 de 2020).</div></div>';
    }
    if (ultimo && ultimo.edema && ultimo.edema !== 'ninguno') {
      h += '<div class="aviso grave" style="margin-top:10px"><span class="ic">⚠</span><div>' +
        '<strong>Edema nutricional bilateral (' + esc(ultimo.edema) + ')</strong>' +
        'Clasifica como desnutrición aguda severa con independencia del puntaje Z.</div></div>';
    }
    if (d.vista.estado_control === 'vencido') {
      h += '<div class="aviso ojo" style="margin-top:10px"><span class="ic">!</span><div>' +
        '<strong>Control vencido</strong>Estaba programado para el ' + A.fecha(d.caso.fecha_proximo_control) +
        '. Contacte al cuidador y registre el seguimiento.</div></div>';
    }
    if (d.caso.fecha_cierre) {
      h += '<div class="aviso info" style="margin-top:10px"><span class="ic">i</span><div>' +
        '<strong>Caso cerrado el ' + A.fecha(d.caso.fecha_cierre) + '</strong>' +
        'Motivo: ' + esc(MOTIVOS_CIERRE[d.caso.motivo_cierre] || d.caso.motivo_cierre) +
        (d.caso.egreso_con_pendientes ? ' · Egreso autorizado con ítems pendientes.' : '') +
        '</div></div>';
    }
    return h;
  }

  // ═══ Resumen ═════════════════════════════════════════════════════
  function panelResumen() {
    var n = d.nino, segs = d.seguimientos;
    var resp = (DNTApp.estado.responsables || []).filter(function (r) { return r.id === d.caso.responsable_id; })[0];

    $('subpanel').innerHTML =
      '<div class="rejilla c2">' +
        '<div class="tarjeta"><h3>📈 Evolución del puntaje Z de P/T-L</h3>' +
          '<p class="tarjeta-sub">Las líneas de referencia marcan los puntos de corte de la Res. 2465 de 2016 ' +
          'y la meta de egreso de la Res. 115 de 2026.</p>' +
          '<div class="grafica"><canvas id="gZ"></canvas></div></div>' +
        '<div class="tarjeta"><h3>⚖️ Peso y talla</h3>' +
          '<p class="tarjeta-sub">Evolución de las medidas registradas en cada control.</p>' +
          '<div class="grafica"><canvas id="gPeso"></canvas></div></div>' +
      '</div>' +

      '<div class="rejilla c2">' +
        '<div class="tarjeta"><h3>👤 Datos del caso</h3>' + tablaDatos([
          ['Consecutivo', '#' + d.caso.consecutivo],
          ['Municipio', DNTAuth.nombreMunicipio(d.caso.municipio)],
          ['Sede de atención', d.caso.sede_id || '—'],
          ['Fecha de apertura', A.fecha(d.caso.fecha_apertura)],
          ['Clasificación de ingreso', (A.CLASES_TXT[d.caso.clasificacion_ingreso] || [, '—'])[1]],
          ['Responsable del seguimiento', resp ? resp.nombre : 'Sin asignar'],
          ['Origen del registro', d.caso.origen === 'importacion' ? 'Cargue de Excel' : 'Formulario'],
          ['Seguimientos registrados', segs.length],
          ['Próximo control', A.fecha(d.caso.fecha_proximo_control)]
        ]) +
        (DNTAuth.puedeCerrarCasos()
          ? '<div class="btn-fila" style="margin-top:12px">' +
            '<button class="btn sec chico" id="btnReasignar">Reasignar responsable</button>' +
            (d.caso.fecha_cierre
              ? '<button class="btn sec chico" id="btnReabrir">Reabrir caso</button>'
              : '') + '</div>'
          : '') +
        '</div>' +

        '<div class="tarjeta"><h3>🍼 Antecedentes del niño</h3>' + tablaDatos([
          ['Peso al nacer', n.peso_nacer_g ? n.peso_nacer_g + ' g' : '—'],
          ['Talla al nacer', n.talla_nacer_cm ? n.talla_nacer_cm + ' cm' : '—'],
          ['Edad gestacional', n.edad_gestacional_sem ? n.edad_gestacional_sem + ' semanas' : '—'],
          ['Pertenencia étnica', n.etnia || '—'],
          ['Pueblo indígena', n.pueblo_indigena || '—'],
          ['Requiere traductor', n.requiere_traductor ? 'Sí' : 'No'],
          ['Asentamiento o comunidad', n.asentamiento || '—'],
          ['Cuidador', n.cuidador_nombre || '—']
        ]) + '</div>' +
      '</div>' +

      '<div class="tarjeta"><h3>📄 Informe del caso</h3>' +
        '<p class="tarjeta-sub">Genera la ficha completa en PDF para la historia clínica o la auditoría.</p>' +
        '<button class="btn" id="btnPDF">⬇ Descargar ficha en PDF</button></div>';

    graficaZ(segs);
    graficaPeso(segs);
    $('btnPDF').onclick = generarPDF;
    if ($('btnReasignar')) $('btnReasignar').onclick = dialogoReasignar;
    if ($('btnReabrir')) $('btnReabrir').onclick = async function () {
      try { await DNTDatos.reabrirCaso(d.caso.id); A.toast('Caso reabierto.', 'ok'); await A.recargarCasos(); pintar(d.caso.id); }
      catch (e) { A.toast(e.message, 'error'); }
    };
  }

  function tablaDatos(filas) {
    return '<div class="tabla-env"><table class="t"><tbody>' + filas.map(function (f) {
      return '<tr><td style="color:var(--texto-3);font-weight:600;width:48%">' + esc(f[0]) +
             '</td><td>' + esc(f[1]) + '</td></tr>';
    }).join('') + '</tbody></table></div>';
  }

  function graficaZ(segs) {
    var puntos = segs.filter(function (s) { return s.z_pt != null; });
    if (!puntos.length) { $('gZ').parentNode.innerHTML = '<p class="vacio">Aún no hay mediciones con puntaje Z.</p>'; return; }
    var etiquetas = puntos.map(function (s) { return A.fecha(s.fecha); });
    function linea(valor, color, texto, guion) {
      return { label: texto, data: etiquetas.map(function () { return valor; }),
               borderColor: color, borderWidth: 1.5, borderDash: guion, pointRadius: 0, fill: false, tension: 0 };
    }
    A.grafica('gZ', {
      type: 'line',
      data: {
        labels: etiquetas,
        datasets: [
          { label: 'Puntaje Z de P/T-L', data: puntos.map(function (s) { return s.z_pt; }),
            borderColor: '#0D9488', backgroundColor: '#0D9488', borderWidth: 2, tension: .25,
            pointRadius: 5, pointHoverRadius: 8, pointBorderColor: '#fff', pointBorderWidth: 2 },
          linea(-1, '#059669', 'Meta de egreso (-1 DE)', [6, 4]),
          linea(-2, '#F97316', 'Desnutrición moderada (-2 DE)', [6, 4]),
          linea(-3, '#9A3412', 'Desnutrición severa (-3 DE)', [3, 3])
        ]
      },
      options: A.opcionesBase({
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4B6B67', font: { size: 10 } } },
          y: { beginAtZero: false, suggestedMin: -4, suggestedMax: 1,
               grid: { color: 'rgba(11,43,40,.08)' }, border: { display: false },
               ticks: { color: '#4B6B67', font: { size: 11 } },
               title: { display: true, text: 'Desviaciones estándar', color: '#7B9995', font: { size: 11 } } }
        }
      })
    });
  }

  function graficaPeso(segs) {
    var puntos = segs.filter(function (s) { return s.peso_kg != null; });
    if (!puntos.length) { $('gPeso').parentNode.innerHTML = '<p class="vacio">Sin mediciones registradas.</p>'; return; }
    A.grafica('gPeso', {
      type: 'line',
      data: {
        labels: puntos.map(function (s) { return A.fecha(s.fecha); }),
        datasets: [{ label: 'Peso (kg)', data: puntos.map(function (s) { return s.peso_kg; }),
          borderColor: '#0D9488', backgroundColor: 'rgba(13,148,136,.12)', borderWidth: 2,
          fill: true, tension: .25, pointRadius: 5, pointHoverRadius: 8,
          pointBorderColor: '#fff', pointBorderWidth: 2 }]
      },
      options: A.opcionesBase({
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4B6B67', font: { size: 10 } } },
          y: { beginAtZero: false, grid: { color: 'rgba(11,43,40,.08)' }, border: { display: false },
               ticks: { color: '#4B6B67', font: { size: 11 } },
               title: { display: true, text: 'Kilogramos', color: '#7B9995', font: { size: 11 } } }
        }
      })
    });
  }

  // Texto de la clasificación de perímetro cefálico, para tabla y detalle.
  var TXT_PC = {
    PC_BAJO:     'Perímetro cefálico bajo para la edad',
    PC_ADECUADO: 'Perímetro cefálico adecuado para la edad',
    PC_ALTO:     'Perímetro cefálico alto para la edad'
  };

  // ═══ Seguimientos ════════════════════════════════════════════════
  function panelSeguimientos() {
    var segs = d.seguimientos;
    $('subpanel').innerHTML =
      '<div class="tarjeta">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<div><h3>📏 Historial de seguimientos</h3>' +
          '<p class="tarjeta-sub" style="margin:0">El control es semanal. Cada registro recalcula el puntaje Z y la conducta.</p></div>' +
          (editable() ? '<button class="btn" id="btnNuevoSeg">➕ Registrar seguimiento</button>' : '') +
        '</div>' +
        (segs.length ? tablaSeguimientos(segs)
          : '<div class="vacio"><span class="emo">📏</span>Todavía no hay mediciones registradas.</div>') +
      '</div>';
    if ($('btnNuevoSeg')) $('btnNuevoSeg').onclick = function () { dialogoSeguimiento(); };
    Array.prototype.forEach.call($('subpanel').querySelectorAll('[data-seg]'), function (b) {
      b.onclick = function () { verSeguimiento(b.dataset.seg); };
    });
  }

  function tablaSeguimientos(segs) {
    return '<div class="tabla-env" style="margin-top:12px"><table class="t"><thead><tr>' +
      '<th>#</th><th>Fecha</th><th>Tipo</th><th class="num">Peso</th><th class="num">Talla</th>' +
      '<th class="num">PB</th><th class="num">PC</th><th class="num">PA</th>' +
      '<th>Edema</th><th class="num">Z P/T-L</th><th>Clasificación</th>' +
      '<th>Apetito</th><th>Escenario</th><th></th></tr></thead><tbody>' +
      segs.slice().reverse().map(function (s, i) {
        return '<tr>' +
          '<td class="mono">' + (segs.length - i) + '</td>' +
          '<td>' + A.fecha(s.fecha) + '</td>' +
          '<td>' + ({ ingreso: 'Ingreso', control: 'Control', egreso: 'Egreso' }[s.tipo] || s.tipo) +
            (s.modalidad !== 'intramural' ? ' <span class="sem gris">' + esc(s.modalidad) + '</span>' : '') + '</td>' +
          '<td class="num mono">' + A.num(s.peso_kg, 2) + '</td>' +
          '<td class="num mono">' + A.num(s.talla_cm, 1) + '</td>' +
          '<td class="num mono">' + A.num(s.pb_cm, 1) + '</td>' +
          '<td class="num mono"' +
            (s.clasificacion_pc && s.clasificacion_pc !== 'PC_ADECUADO'
              ? ' title="' + esc(TXT_PC[s.clasificacion_pc] || '') + '" style="color:var(--naranja-s);font-weight:700"'
              : '') + '>' + A.num(s.perimetro_cefalico_cm, 1) + '</td>' +
          '<td class="num mono">' + A.num(s.perimetro_abdominal_cm, 1) + '</td>' +
          '<td>' + (s.edema === 'ninguno' ? '—' : '<span class="sem rojo">' + esc(s.edema) + '</span>') + '</td>' +
          '<td class="num mono"><strong>' + A.num(s.z_pt, 2) + '</strong></td>' +
          '<td>' + A.semaforo(s.clasificacion_final) + '</td>' +
          '<td>' + (s.apetito_resultado
              ? '<span class="sem ' + (s.apetito_resultado === 'positiva' ? 'verde' : 'rojo') + '">' +
                s.apetito_resultado + '</span>' : '—') + '</td>' +
          '<td>' + (s.escenario === 'hospitalizacion'
              ? '<span class="sem rojo">Hospitalización</span>'
              : s.escenario ? '<span class="sem verde">Ambulatorio</span>' : '—') + '</td>' +
          '<td><button class="btn sec chico" data-seg="' + esc(s.id) + '">Ver</button></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function verSeguimiento(id) {
    var s = d.seguimientos.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    var farmacos = s.medicamentos && s.medicamentos.lista ? s.medicamentos.lista : [];
    A.modal('Seguimiento del ' + A.fecha(s.fecha),
      tablaDatos([
        ['Tipo', s.tipo], ['Modalidad', s.modalidad],
        ['Edad', s.edad_meses != null ? s.edad_meses + ' meses' : '—'],
        ['Peso', A.num(s.peso_kg, 2) + ' kg'], ['Talla o longitud', A.num(s.talla_cm, 1) + ' cm'],
        ['Perímetro braquial', A.num(s.pb_cm, 1) + ' cm'],
        ['Perímetro cefálico', s.perimetro_cefalico_cm
          ? A.num(s.perimetro_cefalico_cm, 1) + ' cm · Z ' + A.num(s.z_pc, 2) +
            (s.clasificacion_pc ? ' · ' + (TXT_PC[s.clasificacion_pc] || s.clasificacion_pc) : '')
          : '—'],
        ['Perímetro abdominal', s.perimetro_abdominal_cm
          ? A.num(s.perimetro_abdominal_cm, 1) + ' cm' : '—'],
        ['Edema', s.edema],
        ['Z P/T-L', A.num(s.z_pt, 2)], ['Z P/E', A.num(s.z_pe, 2)], ['Z T/E', A.num(s.z_te, 2)],
        ['Clasificación', (A.CLASES_TXT[s.clasificacion_final] || [, '—'])[1]],
        ['Ganancia de peso', s.ganancia_g_dia != null ? s.ganancia_g_dia + ' g/día' : '—'],
        ['Hemoglobina', s.hemoglobina ? s.hemoglobina + ' g/dL' : '—'],
        ['Prueba de apetito', s.apetito_realizada
          ? (s.apetito_resultado || '—') + ' (mínimo ' + (s.apetito_minimo_requerido || '—') +
            ', consumió ' + (s.apetito_consumido || '—') + ')'
          : (s.apetito_no_aplica_motivo || 'No realizada')],
        ['Signos de alarma', (s.signos_alarma || []).length ? (s.signos_alarma || []).join(', ') : 'Ninguno'],
        ['Escenario', s.escenario || '—'],
        ['FTLC', s.ftlc_kcal_dia ? s.ftlc_kcal_dia + ' kcal/día · ' + A.num(s.ftlc_sobres_dia, 2) + ' sobres/día' : '—'],
        ['Sobres entregados', s.ftlc_sobres_entregados || '—'],
        ['Fórmula de inicio', s.formula_inicio_entregada ? 'Sí · ' + (s.formula_inicio_detalle || '') : 'No'],
        ['Conducta', s.conducta || '—'],
        ['Observaciones', s.observaciones || '—'],
        ['Próximo control', A.fecha(s.fecha_proximo_control)]
      ]) +
      (s.criterios_remision && s.criterios_remision.length
        ? '<div class="aviso grave" style="margin-top:12px"><span class="ic">⚠</span><div>' +
          '<strong>Criterios de remisión registrados</strong><ul style="margin:6px 0 0;padding-left:18px">' +
          s.criterios_remision.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
          '</ul></div></div>' : '') +
      (farmacos.length
        ? '<h4 style="margin-top:16px">Esquema farmacológico</h4><div class="tabla-env"><table class="t"><tbody>' +
          farmacos.map(function (f) {
            return '<tr><td><strong>' + esc(f.farmaco) + '</strong><div style="font-size:.78rem;color:var(--texto-2)">' +
              esc(f.indicacion) + '</div></td><td>' + esc(f.dosis) + '<div style="font-size:.78rem;color:var(--texto-2)">' +
              esc(f.duracion) + '</div></td></tr>';
          }).join('') + '</tbody></table></div>' : ''),
      [{ texto: 'Cerrar', accion: A.cerrarModal }]);
  }

  // ── Formulario de seguimiento con cálculo en vivo ────────────────
  function dialogoSeguimiento() {
    var n = d.nino;
    var previo = d.seguimientos[d.seguimientos.length - 1];
    var edadM = DNTAntro.mesesCumplidos(n.fecha_nac);

    A.modal('Registrar seguimiento', formularioSeguimiento(previo, edadM), [
      { texto: 'Cancelar', accion: A.cerrarModal },
      { texto: 'Guardar seguimiento', clase: '', accion: guardarSeguimiento }
    ]);

    ['sFecha', 'sPeso', 'sTalla', 'sPB', 'sPC', 'sPA', 'sEdema', 'sMedicion',
     'sApetitoConsumo', 'sTemp', 'sFR', 'sHb', 'sTipo'].forEach(function (id) {
      var el = $(id); if (el) el.oninput = el.onchange = recalcular;
    });
    Array.prototype.forEach.call(document.querySelectorAll('[name=signo]'), function (ch) {
      ch.onchange = recalcular;
    });
    recalcular();
  }

  function formularioSeguimiento(previo, edadM) {
    return '<div class="fila">' +
        campo('sFecha', 'Fecha de la atención', '<input type="date" id="sFecha" value="' + A.hoy() + '" max="' + A.hoy() + '">') +
        campo('sTipo', 'Tipo', '<select id="sTipo">' +
          A.opcion('control', 'Control de seguimiento', d.seguimientos.length ? 'control' : 'ingreso') +
          A.opcion('ingreso', 'Atención inicial', d.seguimientos.length ? '' : 'ingreso') +
          A.opcion('egreso', 'Control de egreso') + '</select>') +
        campo('sModalidad', 'Modalidad', '<select id="sModalidad">' +
          A.opcion('intramural', 'Intramural') + A.opcion('extramural', 'Extramural') +
          A.opcion('telesalud', 'Telesalud') + '</select>') +
      '</div>' +

      '<h4 style="margin-top:14px">Antropometría</h4>' +
      '<div class="fila">' +
        campo('sPeso', 'Peso (kg)', '<input type="number" id="sPeso" step="0.001" min="0.5" max="40" placeholder="0,000">') +
        campo('sTalla', 'Talla o longitud (cm)', '<input type="number" id="sTalla" step="0.1" min="40" max="130" placeholder="0,0">') +
        campo('sMedicion', 'Forma de medición', '<select id="sMedicion">' +
          A.opcion('auto', 'La que corresponde a la edad') +
          A.opcion('longitud', 'Acostado (longitud)') + A.opcion('talla', 'De pie (talla)') + '</select>') +
      '</div>' +
      '<div class="fila">' +
        campo('sPB', 'Perímetro braquial (cm)', '<input type="number" id="sPB" step="0.1" min="5" max="25" placeholder="0,0">' +
          (edadM < 6 ? '<div class="ayuda">No aplica en menores de 6 meses.</div>' : '')) +
        campo('sPC', 'Perímetro cefálico (cm)', '<input type="number" id="sPC" step="0.1" min="25" max="60" placeholder="0,0">' +
          '<div class="ayuda">Se compara con el patrón OMS para la edad.</div>') +
      '</div>' +
      '<div class="fila">' +
        campo('sPA', 'Perímetro abdominal (cm)', '<input type="number" id="sPA" step="0.1" min="20" max="90" placeholder="0,0">' +
          '<div class="ayuda">Sin punto de corte: se lee por la tendencia entre controles.</div>') +
        campo('sEdema', 'Edema bilateral', '<select id="sEdema">' +
          A.opcion('ninguno', 'Ninguno') + A.opcion('+', 'Leve (+)') +
          A.opcion('++', 'Moderado (++)') + A.opcion('+++', 'Severo (+++)') + '</select>') +
        '<div class="campo"></div>' +
      '</div>' +

      '<div id="calculo"></div>' +

      '<h4 style="margin-top:14px">Evaluación clínica</h4>' +
      '<div class="fila">' +
        campo('sTemp', 'Temperatura axilar (°C)', '<input type="number" id="sTemp" step="0.1" min="30" max="43">') +
        campo('sFR', 'Frecuencia respiratoria', '<input type="number" id="sFR" step="1" min="10" max="120">') +
        campo('sHb', 'Hemoglobina (g/dL)', '<input type="number" id="sHb" step="0.1" min="1" max="20">') +
      '</div>' +
      '<div class="campo"><label>Signos de alarma presentes</label>' +
        '<div style="display:grid;gap:5px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">' +
        DNTClinico.SIGNOS.map(function (s) {
          return '<label style="display:flex;gap:7px;align-items:flex-start;font-size:.82rem;font-weight:400">' +
            '<input type="checkbox" name="signo" value="' + s.codigo + '" style="width:auto;margin-top:3px">' +
            '<span>' + esc(s.texto) + '</span></label>';
        }).join('') + '</div></div>' +

      '<div id="bloqueApetito"></div>' +
      '<div id="bloqueConducta"></div>' +

      '<h4 style="margin-top:14px">Entrega y observaciones</h4>' +
      '<div class="fila">' +
        campo('sSobres', 'Sobres de FTLC entregados', '<input type="number" id="sSobres" step="1" min="0" max="200">') +
        campo('sFormula', 'Fórmula láctea de inicio', '<select id="sFormula">' +
          A.opcion('no', 'No entregada') + A.opcion('si', 'Entregada') + '</select>') +
        campo('sProximo', 'Próximo control', '<input type="date" id="sProximo">') +
      '</div>' +
      campo('sObs', 'Observaciones', '<textarea id="sObs" placeholder="Hallazgos, acuerdos con el cuidador, ajustes del plan…"></textarea>');
  }

  function campo(id, etiqueta, control) {
    return '<div class="campo"><label for="' + id + '">' + esc(etiqueta) + '</label>' + control + '</div>';
  }

  /**
   * Perímetro cefálico y abdominal.
   *
   * El cefálico tiene patrón OMS y punto de corte en la Res. 2465/2016, así que
   * se muestra con su puntaje Z. El abdominal no tiene referencia para menores
   * de 5 años: lo que informa es cuánto cambió desde el control anterior, no el
   * número suelto, de modo que se muestra con su diferencia.
   */
  function bloquePerimetros(ev, previo) {
    var pa = ev.perimetro_abdominal;
    if (ev.z_pc === null && pa === null) return '';

    var partes = [];
    if (ev.z_pc !== null) {
      partes.push(A.kpi('Z PC/E', A.num(ev.z_pc, 2),
        ev.clasificacion_pc.color, ev.clasificacion_pc.texto));
    }
    if (pa !== null) {
      var dif = previo && previo.perimetro_abdominal_cm > 0
        ? +(pa - previo.perimetro_abdominal_cm).toFixed(1) : null;
      partes.push(A.kpi('Perímetro abdominal', A.num(pa, 1) + ' cm', '',
        dif === null ? 'Primer registro: queda como línea de base'
                     : (dif > 0 ? '+' : '') + A.num(dif, 1) + ' cm desde el control anterior'));
    }
    return '<div style="margin:0 0 12px">' +
      '<div style="display:grid;gap:12px;' +
        'grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">' + partes.join('') + '</div>' +
      '<div class="ayuda" style="margin-top:7px">Medidas complementarias: ' +
        'no modifican la clasificación nutricional del caso.</div></div>';
  }

  /** Recalcula puntajes, prueba de apetito, conducta y esquemas en tiempo real. */
  var ultimoCalculo = null;
  function recalcular() {
    var n = d.nino;
    var fechaAt = $('sFecha').value || A.hoy();
    var edadM = DNTAntro.mesesCumplidos(n.fecha_nac, fechaAt);
    var peso = parseFloat($('sPeso').value), talla = parseFloat($('sTalla').value);

    var ev = DNTAntro.evaluar({
      fecha_nac: n.fecha_nac, fecha: fechaAt, sexo: n.sexo,
      peso_kg: peso, talla_cm: talla, medicion: $('sMedicion').value,
      pb_cm: parseFloat($('sPB').value), pc_cm: parseFloat($('sPC').value),
      pa_cm: parseFloat($('sPA').value), edema: $('sEdema').value
    });

    var previo = d.seguimientos[d.seguimientos.length - 1];
    var gan = previo ? DNTAntro.gananciaPonderal(peso, fechaAt, previo.peso_kg, previo.fecha, edadM) : null;

    // Bloque de cálculo antropométrico
    $('calculo').innerHTML = (peso > 0 && talla > 0)
      ? '<div class="tarjeta" style="background:var(--menta-luz);border-color:var(--menta-borde);margin:12px 0">' +
          '<div class="rejilla c4">' +
            A.kpi('Z P/T-L', A.num(ev.z_pt, 2), colorZ(ev.z_pt), ev.tabla_pt || '') +
            A.kpi('Z P/E', A.num(ev.z_pe, 2), '', 'Peso para la edad') +
            A.kpi('Z T/E', A.num(ev.z_te, 2), '', 'Talla para la edad') +
            A.kpi('IMC', A.num(ev.imc, 1), '', 'Z IMC/E ' + A.num(ev.z_imc, 2)) +
          '</div>' +
          '<div style="margin-top:12px">' + A.semaforo(ev.clasificacion_final) +
            (ev.clasificacion_final_criterio
              ? ' <span style="font-size:.79rem;color:var(--texto-2)">por ' + esc(ev.clasificacion_final_criterio) + '</span>'
              : '') +
          '</div>' +
          (gan ? '<div class="aviso ' + (gan.adecuada ? 'ok' : 'ojo') + '" style="margin:12px 0 0">' +
            '<span class="ic">' + (gan.adecuada ? '✓' : '!') + '</span><div><strong>Ganancia de peso: ' +
            gan.g_dia + ' g/día</strong>' + esc(gan.criterio) + ' · ' + gan.dias + ' días desde el control anterior.' +
            '</div></div>' : '') +
          (ev.avisos.length ? '<div class="aviso ojo" style="margin:10px 0 0"><span class="ic">!</span><div>' +
            ev.avisos.map(esc).join('<br>') + '</div></div>' : '') +
        '</div>'
      : '<div class="aviso info" style="margin:12px 0"><span class="ic">i</span><div>' +
        'Ingrese peso y talla para calcular automáticamente los puntajes Z y la clasificación.</div></div>';

    // Perímetros cefálico y abdominal. Van aparte del bloque de peso y talla
    // porque no entran en la clasificación nutricional y porque se pueden
    // registrar solos, sin que haya peso ni talla en esa consulta.
    $('calculo').innerHTML += bloquePerimetros(ev, previo);

    // Prueba de apetito
    var min = DNTClinico.minimoApetito(peso);
    if (edadM >= 6 && edadM < 60 && peso > 0) {
      var consumo = parseFloat($('sApetitoConsumo') ? $('sApetitoConsumo').value : NaN);
      var ap = DNTClinico.evaluarApetito(peso, edadM, consumo);
      $('bloqueApetito').innerHTML =
        '<h4 style="margin-top:14px">Prueba de apetito con FTLC</h4>' +
        (min && min.aplica
          ? '<div class="aviso info"><span class="ic">🥄</span><div><strong>Consumo mínimo requerido: ' +
            esc(min.fraccion) + '</strong>Rango de peso ' + esc(min.rango) + '. Observe la ingesta durante ' +
            '15 minutos en un área tranquila, sin forzar al niño.</div></div>' +
            '<div class="fila">' +
              campo('sApetitoConsumo', 'Fracción de sobre consumida',
                '<select id="sApetitoConsumo">' +
                  '<option value="">Sin realizar</option>' +
                  '<option value="0">Rechazó (0)</option>' +
                  '<option value="0.125">Menos de 1/4</option>' +
                  '<option value="0.25">1/4 de sobre</option>' +
                  '<option value="0.3333">1/3 de sobre</option>' +
                  '<option value="0.5">1/2 sobre</option>' +
                  '<option value="0.75">3/4 de sobre</option>' +
                  '<option value="1">Un sobre completo</option>' +
                '</select>') +
              '<div class="campo"><label>Resultado</label><div style="padding-top:8px">' +
                (ap.resultado
                  ? '<span class="sem ' + (ap.resultado === 'positiva' ? 'verde' : 'rojo') + '">Prueba ' + ap.resultado + '</span>'
                  : '<span class="sem gris">Pendiente</span>') + '</div></div>' +
            '</div>'
          : '<div class="aviso grave"><span class="ic">⚠</span><div><strong>No aplica</strong>' +
            esc(min ? min.motivo : 'Peso no válido') + '</div></div>');
      if ($('sApetitoConsumo')) {
        $('sApetitoConsumo').value = isNaN(consumo) ? '' : String(consumo);
        $('sApetitoConsumo').onchange = recalcular;
      }
    } else {
      $('bloqueApetito').innerHTML = '<div class="aviso info" style="margin-top:14px"><span class="ic">i</span><div>' +
        '<strong>Prueba de apetito no aplicable</strong>' +
        (edadM < 6 ? 'El niño tiene menos de 6 meses. Evalúe la técnica de lactancia materna y la ganancia ponderal.'
                   : 'Fuera del rango de 6 a 59 meses.') + '</div></div>';
    }

    // Conducta: criterios de remisión, FTLC y fármacos
    var signos = Array.prototype.slice.call(document.querySelectorAll('[name=signo]:checked'))
      .map(function (c) { return c.value; });
    var apRes = $('sApetitoConsumo') && $('sApetitoConsumo').value !== ''
      ? DNTClinico.evaluarApetito(peso, edadM, parseFloat($('sApetitoConsumo').value)).resultado : null;

    var datosClin = {
      edad_meses: edadM, peso_kg: peso, clasificacion: ev.clasificacion_final,
      edema: $('sEdema').value, apetito: apRes,
      temperatura: parseFloat($('sTemp').value), frecuencia_respiratoria: parseFloat($('sFR').value),
      hemoglobina: parseFloat($('sHb').value), signos: signos,
      edema_incremento: previo && previo.edema !== 'ninguno' && $('sEdema').value !== 'ninguno' &&
                        pesoEdema($('sEdema').value) > pesoEdema(previo.edema)
    };
    var rem = DNTClinico.criteriosRemision(datosClin);
    var dia = diaTratamiento(fechaAt);
    var ftlc = ev.clasificacion_final ? DNTClinico.esquemaFTLC(ev.clasificacion_final, peso, dia) : null;
    var farm = ev.clasificacion_final
      ? DNTClinico.esquemaFarmacologico(ev.clasificacion_final, peso, edadM, parseFloat($('sHb').value),
          { z_pt: ev.z_pt, con_complicacion: rem.remitir })
      : [];

    $('bloqueConducta').innerHTML =
      '<h4 style="margin-top:14px">Conducta</h4>' +
      (rem.remitir
        ? '<div class="aviso grave"><span class="ic">⚠</span><div><strong>REMISIÓN A HOSPITALIZACIÓN</strong>' +
          '<ul style="margin:6px 0 0;padding-left:18px">' +
          rem.criterios.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
          (rem.regla ? '<p style="margin:8px 0 0"><strong>' + esc(rem.regla) + '</strong></p>' : '') +
          '</div></div>'
        : (peso > 0 && talla > 0
          ? '<div class="aviso ok"><span class="ic">✓</span><div><strong>Manejo ambulatorio</strong>' +
            'No se identificaron signos de alarma ni criterios de remisión.</div></div>' : '')) +

      (ftlc ? '<div class="tarjeta" style="margin:10px 0"><h4 style="margin:0 0 8px">🥜 Esquema de FTLC sugerido</h4>' +
        '<div class="rejilla c3">' +
          A.kpi('kcal/día', ftlc.kcal_dia, '', ftlc.kcal_kg_dia ? ftlc.kcal_kg_dia + ' kcal/kg/día' : '') +
          A.kpi('Sobres/día', A.num(ftlc.sobres_dia, 2), '', 'Sobre de 92 g = 500 kcal') +
          A.kpi('Sobres por semana', ftlc.sobres_semana, '', 'Hasta el próximo control') +
        '</div>' +
        '<p style="font-size:.82rem;color:var(--texto-2);margin:10px 0 0">' + esc(ftlc.etapa) +
        (ftlc.nota ? ' — ' + esc(ftlc.nota) : '') + '</p></div>' : '') +

      (farm.length ? '<details class="acordeon"><summary>💊 Esquema farmacológico sugerido</summary>' +
        '<div class="acordeon-cuerpo"><div class="tabla-env"><table class="t"><tbody>' +
        farm.map(function (f) {
          return '<tr' + (f.inactivo ? ' style="opacity:.55"' : '') + '>' +
            '<td><strong>' + esc(f.farmaco) + '</strong><div style="font-size:.77rem;color:var(--texto-2)">' +
            esc(f.indicacion) + '</div></td><td>' + esc(f.dosis) +
            '<div style="font-size:.77rem;color:var(--texto-2)">' + esc(f.duracion) + '</div>' +
            (f.alerta ? '<div style="font-size:.77rem;color:var(--rojo);margin-top:4px">' + esc(f.alerta) + '</div>' : '') +
            '</td></tr>';
        }).join('') + '</tbody></table></div>' +
        '<p style="font-size:.78rem;color:var(--texto-3);margin:10px 0 0">Cálculo de apoyo. No reemplaza la ' +
        'prescripción médica ni la valoración clínica individual.</p></div></details>' : '') +

      (rem.remitir ? bloqueEstabilizacion(peso) : '');

    // Próximo control sugerido
    if ($('sProximo') && !$('sProximo').dataset.tocado) {
      $('sProximo').value = DNTClinico.proximoControl(fechaAt, ev.clasificacion_final, edadM).fecha;
      $('sProximo').onchange = function () { this.dataset.tocado = '1'; };
    }

    ultimoCalculo = { ev: ev, gan: gan, rem: rem, ftlc: ftlc, farm: farm, edadM: edadM,
                      apetito: apRes, min: min, signos: signos, dia: dia };
  }

  function pesoEdema(e) { return { ninguno: 0, '+': 1, '++': 2, '+++': 3 }[e] || 0; }

  function diaTratamiento(fechaAt) {
    var ini = d.caso.fecha_apertura;
    var dd = DNTAntro.dias(ini, fechaAt);
    return Math.max(1, (dd || 0) + 1);
  }

  function bloqueEstabilizacion(peso) {
    var e = DNTClinico.estabilizacion(peso);
    return '<details class="acordeon" open><summary>🚑 Paquete de estabilización antes de remitir</summary>' +
      '<div class="acordeon-cuerpo">' +
      e.pasos.map(function (p, i) {
        return '<div class="paso"><div class="paso-n">' + (i + 1) + '</div><div><h4>' + esc(p.titulo) +
          '</h4><p>' + esc(p.detalle) + '</p></div></div>';
      }).join('') +
      '<div class="aviso grave" style="margin-top:12px"><span class="ic">⛔</span><div>' +
      '<strong>Contraindicaciones absolutas</strong><ul style="margin:6px 0 0;padding-left:18px">' +
      e.contraindicaciones.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
      '</ul></div></div></div></details>';
  }

  async function guardarSeguimiento() {
    var c = ultimoCalculo;
    if (!c || c.ev.z_pt == null) { A.toast('Registre peso y talla válidos antes de guardar.', 'error'); return; }
    var fechaAt = $('sFecha').value;
    if (d.seguimientos.some(function (s) { return s.fecha === fechaAt; })) {
      A.toast('Ya existe un seguimiento de este caso en esa fecha.', 'error'); return;
    }
    try {
      var fila = {
        caso_id: d.caso.id, numero: d.seguimientos.length + 1,
        fecha: fechaAt, tipo: $('sTipo').value, modalidad: $('sModalidad').value,
        sede_id: d.caso.sede_id,
        peso_kg: parseFloat($('sPeso').value), talla_cm: parseFloat($('sTalla').value),
        medicion: $('sMedicion').value,
        pb_cm: parseFloat($('sPB').value) || null,
        perimetro_cefalico_cm: parseFloat($('sPC').value) || null,
        perimetro_abdominal_cm: parseFloat($('sPA').value) || null,
        edema: $('sEdema').value, edad_meses: c.edadM,
        z_pt: c.ev.z_pt, z_pe: c.ev.z_pe, z_te: c.ev.z_te, z_imc: c.ev.z_imc,
        z_pc: c.ev.z_pc,
        clasificacion_pc: c.ev.clasificacion_pc ? c.ev.clasificacion_pc.codigo : null,
        clasificacion_pt: c.ev.clasificacion_pt ? c.ev.clasificacion_pt.codigo : null,
        clasificacion_pe: c.ev.clasificacion_pe ? c.ev.clasificacion_pe.codigo : null,
        clasificacion_te: c.ev.clasificacion_te ? c.ev.clasificacion_te.codigo : null,
        clasificacion_final: c.ev.clasificacion_final,
        ganancia_g_dia: c.gan ? c.gan.g_dia : null,
        hemoglobina: parseFloat($('sHb').value) || null,
        apetito_realizada: !!c.apetito,
        apetito_minimo_requerido: c.min && c.min.aplica ? c.min.fraccion : null,
        apetito_consumido: $('sApetitoConsumo') ? ($('sApetitoConsumo').selectedOptions[0] || {}).text : null,
        apetito_resultado: c.apetito,
        apetito_no_aplica_motivo: c.min && !c.min.aplica ? c.min.motivo : (c.edadM < 6 ? 'Menor de 6 meses' : null),
        signos_alarma: c.signos,
        criterios_remision: c.rem.criterios,
        escenario: c.rem.escenario,
        conducta: c.rem.remitir ? 'Remisión a hospitalización' : 'Manejo ambulatorio con FTLC',
        ftlc_kcal_kg_dia: c.ftlc ? c.ftlc.kcal_kg_dia : null,
        ftlc_kcal_dia: c.ftlc ? c.ftlc.kcal_dia : null,
        ftlc_sobres_dia: c.ftlc ? c.ftlc.sobres_dia : null,
        ftlc_sobres_entregados: parseInt($('sSobres').value, 10) || null,
        formula_inicio_entregada: $('sFormula').value === 'si',
        medicamentos: { lista: c.farm },
        observaciones: $('sObs').value || null,
        fecha_proximo_control: $('sProximo').value || null
      };
      await DNTDatos.guardarSeguimiento(fila);

      // El estado del caso sigue a la clasificación de la última medición.
      var nuevoEstado = c.rem.remitir ? 'remitido' : {
        DNT_AGUDA_SEVERA: 'dnt_severa', DNT_AGUDA_MODERADA: 'dnt_moderada', RIESGO_DNT: 'riesgo'
      }[c.ev.clasificacion_final] || 'ambulatorio';
      await DNTDatos.guardarCaso({ id: d.caso.id, estado: nuevoEstado });

      // Descuenta del inventario los sobres entregados.
      var entregados = parseInt($('sSobres').value, 10);
      if (entregados > 0) {
        try {
          await DNTDatos.inventario.guardar({
            municipio: d.caso.municipio, sede_id: d.caso.sede_id, fecha: fechaAt,
            insumo: 'FTLC', movimiento: 'salida', cantidad: entregados, unidad: 'sobre',
            caso_id: d.caso.id, observacion: 'Entrega en el seguimiento del ' + A.fecha(fechaAt)
          });
        } catch (e) { /* el seguimiento ya quedó guardado; el inventario es secundario */ }
      }

      A.cerrarModal();
      A.toast('Seguimiento registrado.', 'ok');
      await A.recargarCasos();
      pintar(d.caso.id);
    } catch (e) { A.toast('No se pudo guardar: ' + e.message, 'error'); }
  }

  // ═══ Factores de riesgo ══════════════════════════════════════════
  function panelRiesgo() {
    DNTDatos.catalogos().then(function (c) {
      var presentes = d.factores.filter(function (f) { return f.presente; }).map(function (f) { return f.factor; });
      var p = DNTClinico.puntajeRiesgo(presentes, c.factores);
      var porCat = {};
      c.factores.forEach(function (f) { (porCat[f.categoria] = porCat[f.categoria] || []).push(f); });

      $('subpanel').innerHTML =
        '<div class="tarjeta">' +
          '<h3>⚠️ Factores de riesgo</h3>' +
          '<p class="tarjeta-sub">Cada factor suma puntos según su peso. El puntaje prioriza la agenda de seguimiento.</p>' +
          '<div class="rejilla c3" style="margin-bottom:16px">' +
            A.kpi('Puntaje', p.puntaje + ' / ' + p.maximo,
              { alto: 'rojo', medio: 'amarillo', bajo: 'verde' }[p.nivel], p.porcentaje + '% del máximo') +
            A.kpi('Nivel de riesgo', p.nivel.charAt(0).toUpperCase() + p.nivel.slice(1),
              { alto: 'rojo', medio: 'amarillo', bajo: 'verde' }[p.nivel],
              'Bajo 0-5 · Medio 6-11 · Alto 12 o más') +
            A.kpi('Factores presentes', presentes.length, '', 'de ' + c.factores.length + ' evaluados') +
          '</div>' +
          Object.keys(porCat).map(function (cat) {
            return '<h4 style="margin-top:14px">' + esc(cat) + '</h4>' +
              '<div style="display:grid;gap:7px;grid-template-columns:repeat(auto-fit,minmax(290px,1fr))">' +
              porCat[cat].map(function (f) {
                var on = presentes.indexOf(f.codigo) >= 0;
                return '<label class="chk-item ' + (on ? 'no_cumple' : '') + '" style="margin:0;cursor:' +
                  (editable() ? 'pointer' : 'default') + '">' +
                  '<div style="display:flex;gap:9px;align-items:flex-start">' +
                  '<input type="checkbox" name="factor" value="' + f.codigo + '"' +
                    (on ? ' checked' : '') + (editable() ? '' : ' disabled') +
                    ' style="width:auto;margin-top:3px">' +
                  '<div><div style="font-size:.85rem;font-weight:600">' + esc(f.etiqueta) +
                  ' <span class="sem gris">' + f.peso + ' pt' + (f.peso === 1 ? '' : 's') + '</span></div>' +
                  (f.ayuda ? '<div class="chk-detalle">' + esc(f.ayuda) + '</div>' : '') +
                  '</div></div></label>';
              }).join('') + '</div>';
          }).join('') +
          (editable() ? '<div class="btn-fila" style="margin-top:16px">' +
            '<button class="btn" id="btnGuardarFactores">Guardar factores</button></div>' : '') +
        '</div>';

      if ($('btnGuardarFactores')) $('btnGuardarFactores').onclick = async function () {
        var sel = Array.prototype.slice.call(document.querySelectorAll('[name=factor]:checked'))
          .map(function (x) { return x.value; });
        try {
          var r = await DNTDatos.guardarFactores(d.caso.id, sel);
          A.toast('Factores guardados. Riesgo ' + r.nivel + ' (' + r.puntaje + ' puntos).', 'ok');
          await A.recargarCasos();
          pintar(d.caso.id);
        } catch (e) { A.toast(e.message, 'error'); }
      };
    });
  }

  // ═══ Check-lists ═════════════════════════════════════════════════
  var TITULOS_CHK = {
    A: ['Check-list A · Atención inicial y valoración', 'Se diligencia una sola vez, al abrir el caso.'],
    B: ['Check-list B · Control de seguimiento', 'Se diligencia en cada control ambulatorio.'],
    C: ['Check-list C · Criterios de egreso', 'Todos los ítems obligatorios deben resolverse para cerrar el caso.']
  };

  function aplica(item, edadM) {
    if (!item.condicion) return true;
    if (item.condicion === 'edad_6_59m')   return edadM >= 6 && edadM < 60;
    if (item.condicion === 'edad_menor_6m')return edadM < 6;
    if (item.condicion === 'dnt_severa')   return d.caso.clasificacion_ingreso === 'DNT_SEVERA' ||
                                                   d.caso.estado === 'dnt_severa';
    if (item.condicion === 'anemia') {
      return d.seguimientos.some(function (s) { return s.hemoglobina != null && s.hemoglobina < 11; });
    }
    return true;
  }

  function panelChecklist(lista, seguimientoId) {
    var edadM = DNTAntro.mesesCumplidos(d.nino.fecha_nac);
    var items = DNTDatos.checklistDe(lista);
    var resp = {};
    d.checklist.forEach(function (r) {
      var k = (r.seguimiento_id || '') + '|' + r.item;
      resp[k] = r;
    });
    var clave = function (cod) { return (seguimientoId || '') + '|' + cod; };

    var html = '<div class="tarjeta"><h3>' + esc(TITULOS_CHK[lista][0]) + '</h3>' +
      '<p class="tarjeta-sub">' + esc(TITULOS_CHK[lista][1]) + '</p>' +
      items.map(function (it) {
        var r = resp[clave(it.codigo)];
        var estado = r ? r.estado : 'pendiente';
        var noAplica = !aplica(it, edadM);
        var soportes = d.soportes.filter(function (s) {
          return s.item === it.codigo && s.vigente && (!seguimientoId || s.seguimiento_id === seguimientoId);
        });
        return '<div class="chk-item ' + (noAplica ? 'no_aplica' : estado) + '" data-item="' + esc(it.codigo) + '">' +
          '<div class="chk-cab">' +
            '<span class="chk-cod">' + esc(it.codigo) + '</span>' +
            '<div class="chk-txt">' + esc(it.texto) +
              (it.obligatorio ? ' <span class="etq-oblig">obligatorio</span>' : '') +
              (it.requiere_soporte ? ' <span class="etq-soporte">requiere soporte</span>' : '') +
              (it.detalle ? '<div class="chk-detalle">' + esc(it.detalle) + '</div>' : '') +
              (it.norma ? '<div class="chk-norma">' + esc(it.norma) + '</div>' : '') +
              (noAplica ? '<div class="chk-detalle" style="color:var(--texto-3)">No aplica en este caso por la condición: ' +
                 esc(it.condicion) + '.</div>' : '') +
            '</div>' +
          '</div>' +
          '<div class="chk-acciones">' +
            (editable() && !noAplica
              ? '<div class="chk-estado">' +
                ['cumple|Cumple', 'no_cumple|No cumple', 'no_aplica|No aplica'].map(function (o) {
                  var p = o.split('|');
                  return '<button data-e="' + p[0] + '" data-cod="' + esc(it.codigo) + '"' +
                    (estado === p[0] ? ' class="on"' : '') + '>' + p[1] + '</button>';
                }).join('') + '</div>'
              : '<span class="sem ' + ({ cumple: 'verde', no_cumple: 'rojo', no_aplica: 'gris', pendiente: 'amarillo' }[estado]) +
                '">' + ({ cumple: 'Cumple', no_cumple: 'No cumple', no_aplica: 'No aplica', pendiente: 'Pendiente' }[estado]) + '</span>') +
            (r && r.fecha ? '<span style="font-size:.76rem;color:var(--texto-3)">' + A.fecha(r.fecha) + '</span>' : '') +
            (editable()
              ? '<button class="btn sec chico" data-subir="' + esc(it.codigo) + '">📎 Adjuntar</button>' +
                '<button class="btn sec chico" data-nota="' + esc(it.codigo) + '">📝 Observación</button>'
              : '') +
          '</div>' +
          (r && r.observacion ? '<div class="chk-detalle" style="margin-top:7px">💬 ' + esc(r.observacion) + '</div>' : '') +
          (soportes.length ? soportes.map(filaArchivo).join('') : '') +
        '</div>';
      }).join('') + '</div>';

    $(seguimientoId ? 'chkB-cuerpo' : 'subpanel').innerHTML = html;
    enlazarChecklist(seguimientoId);
  }

  function enlazarChecklist(seguimientoId) {
    var raiz = $(seguimientoId ? 'chkB-cuerpo' : 'subpanel');
    Array.prototype.forEach.call(raiz.querySelectorAll('.chk-estado button'), function (b) {
      b.onclick = async function () {
        try {
          await DNTDatos.guardarRespuesta(d.caso.id, b.dataset.cod, b.dataset.e,
            { seguimiento_id: seguimientoId || null });
          d = await DNTDatos.caso(d.caso.id);
          render();
        } catch (e) { A.toast(e.message, 'error'); }
      };
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-subir]'), function (b) {
      b.onclick = function () { dialogoSubir(b.dataset.subir, seguimientoId); };
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-nota]'), function (b) {
      b.onclick = function () { dialogoObservacion(b.dataset.nota, seguimientoId); };
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-ver]'), function (b) {
      b.onclick = function () { abrirSoporte(b.dataset.ver); };
    });
    Array.prototype.forEach.call(raiz.querySelectorAll('[data-borrar]'), function (b) {
      b.onclick = function () { dialogoEliminarSoporte(b.dataset.borrar); };
    });
  }

  function panelChecklistB() {
    var segs = d.seguimientos.slice().reverse();
    if (!segs.length) {
      $('subpanel').innerHTML = '<div class="tarjeta"><div class="vacio"><span class="emo">🔁</span>' +
        'El check-list B se diligencia sobre un seguimiento. Registre primero una atención.</div></div>';
      return;
    }
    $('subpanel').innerHTML =
      '<div class="tarjeta"><h3>🔁 Check-list B · Control de seguimiento</h3>' +
        '<p class="tarjeta-sub">Se registra una lista por cada control ambulatorio.</p>' +
        '<div class="campo" style="max-width:380px"><label for="selSeg">Seguimiento</label>' +
        '<select id="selSeg">' + segs.map(function (s) {
          return A.opcion(s.id, A.fecha(s.fecha) + ' · ' +
            ({ ingreso: 'Atención inicial', control: 'Control', egreso: 'Egreso' }[s.tipo] || s.tipo));
        }).join('') + '</select></div>' +
      '</div><div id="chkB-cuerpo"></div>';
    $('selSeg').onchange = function () { panelChecklist('B', this.value); };
    panelChecklist('B', segs[0].id);
  }

  // ═══ Egreso ══════════════════════════════════════════════════════
  var MOTIVOS_CIERRE = {
    recuperacion: 'Recuperación nutricional', traslado: 'Traslado a otra IPS',
    abandono: 'Abandono voluntario', perdida_seguimiento: 'Pérdida de seguimiento',
    fallecimiento: 'Fallecimiento', error_registro: 'Error de registro'
  };

  function panelEgreso() {
    panelChecklist('C');
    var val = DNTDatos.validarEgreso(d);
    var panel = $('subpanel');
    var extra = document.createElement('div');
    extra.className = 'tarjeta';
    extra.innerHTML =
      '<h3>🎓 Cierre del caso</h3>' +
      '<p class="tarjeta-sub">El cierre lo autoriza el coordinador o el administrador.</p>' +
      '<div class="rejilla c3" style="margin-bottom:14px">' +
        A.kpi('Z P/T-L actual', A.num(val.z_ultimo, 2), colorZ(val.z_ultimo), 'Meta: ≥ -1 DE') +
        A.kpi('Meta antropométrica', val.cumple_meta ? 'Cumplida' : 'No cumplida',
              val.cumple_meta ? 'verde' : 'naranja', 'Res. 115 de 2026') +
        A.kpi('Ítems obligatorios pendientes', val.pendientes.length + val.sin_soporte.length,
              val.puede ? 'verde' : 'rojo', 'Del check-list C') +
      '</div>' +
      (val.puede
        ? '<div class="aviso ok"><span class="ic">✓</span><div><strong>El check-list C está completo</strong>' +
          'Puede proceder al cierre del caso.</div></div>'
        : '<div class="aviso ojo"><span class="ic">!</span><div><strong>Faltan requisitos para el egreso</strong>' +
          (val.pendientes.length ? '<div style="margin-top:6px">Sin resolver: ' +
            val.pendientes.map(function (i) { return i.codigo; }).join(', ') + '</div>' : '') +
          (val.sin_soporte.length ? '<div>Marcados como cumplidos pero sin soporte adjunto: ' +
            val.sin_soporte.map(function (i) { return i.codigo; }).join(', ') + '</div>' : '') +
          '</div></div>') +
      (!val.cumple_meta
        ? '<div class="aviso ojo"><span class="ic">!</span><div><strong>El puntaje Z todavía no alcanza -1 DE</strong>' +
          'La Res. 115 de 2026 elevó la meta de egreso de ≥ -2 DE a ≥ -1 DE. Si el cierre no es por recuperación, ' +
          'seleccione el motivo que corresponda.</div></div>'
        : '') +
      (DNTAuth.puedeCerrarCasos() && !d.caso.fecha_cierre
        ? '<div class="btn-fila"><button class="btn acc" id="btnCerrarCaso">Cerrar el caso</button></div>'
        : (!DNTAuth.puedeCerrarCasos()
          ? '<div class="aviso info"><span class="ic">i</span><div>Su rol no puede cerrar casos. ' +
            'Solicítelo al coordinador o al administrador.</div></div>' : ''));
    panel.appendChild(extra);
    if ($('btnCerrarCaso')) $('btnCerrarCaso').onclick = function () { dialogoCierre(val); };
  }

  function dialogoCierre(val) {
    A.modal('Cerrar el caso',
      '<div class="fila">' +
        campo('cFecha', 'Fecha de egreso', '<input type="date" id="cFecha" value="' + A.hoy() + '" max="' + A.hoy() + '">') +
        campo('cMotivo', 'Motivo del cierre', '<select id="cMotivo">' +
          Object.keys(MOTIVOS_CIERRE).map(function (k) {
            return A.opcion(k, MOTIVOS_CIERRE[k], val.cumple_meta ? 'recuperacion' : '');
          }).join('') + '</select>') +
      '</div>' +
      (val.puede ? '' :
        '<div class="aviso grave"><span class="ic">⚠</span><div><strong>Hay ítems obligatorios sin resolver</strong>' +
        'Puede autorizar el egreso de todas formas, pero debe justificarlo. La justificación queda en la auditoría.' +
        '</div></div>') +
      campo('cJustificacion', val.puede ? 'Observaciones del egreso' : 'Justificación del egreso con pendientes (obligatoria)',
        '<textarea id="cJustificacion" placeholder="' +
        (val.puede ? 'Opcional' : 'Explique por qué se autoriza el cierre sin completar el check-list C') + '"></textarea>'),
      [
        { texto: 'Cancelar', accion: A.cerrarModal },
        { texto: 'Confirmar el cierre', clase: 'acc', accion: async function () {
          var just = $('cJustificacion').value.trim();
          if (!val.puede && just.length < 15) {
            A.toast('La justificación es obligatoria y debe ser explícita.', 'error'); return;
          }
          try {
            await DNTDatos.cerrarCaso(d.caso.id, {
              fecha_cierre: $('cFecha').value, motivo_cierre: $('cMotivo').value,
              justificacion_egreso: just || null, egreso_con_pendientes: !val.puede
            });
            A.cerrarModal();
            A.toast('Caso cerrado.', 'ok');
            await A.recargarCasos();
            pintar(d.caso.id);
          } catch (e) { A.toast(e.message, 'error'); }
        } }
      ]);
  }

  function dialogoReasignar() {
    var resp = (DNTApp.estado.responsables || []);
    A.modal('Reasignar el responsable del seguimiento',
      campo('rResp', 'Responsable', '<select id="rResp">' +
        '<option value="">Sin asignar</option>' +
        resp.map(function (r) { return A.opcion(r.id, r.nombre + ' · ' + r.rol, d.caso.responsable_id); }).join('') +
        '</select>'),
      [
        { texto: 'Cancelar', accion: A.cerrarModal },
        { texto: 'Guardar', accion: async function () {
          try {
            await DNTDatos.reasignarResponsable(d.caso.id, $('rResp').value || null);
            A.cerrarModal(); A.toast('Responsable actualizado.', 'ok');
            pintar(d.caso.id);
          } catch (e) { A.toast(e.message, 'error'); }
        } }
      ]);
  }

  function dialogoObservacion(codigo, seguimientoId) {
    var previo = d.checklist.filter(function (r) {
      return r.item === codigo && (r.seguimiento_id || null) === (seguimientoId || null);
    })[0];
    A.modal('Observación del ítem ' + codigo,
      campo('oTexto', 'Observación', '<textarea id="oTexto">' + esc(previo ? previo.observacion || '' : '') + '</textarea>'),
      [
        { texto: 'Cancelar', accion: A.cerrarModal },
        { texto: 'Guardar', accion: async function () {
          try {
            await DNTDatos.guardarRespuesta(d.caso.id, codigo, previo ? previo.estado : 'pendiente',
              { seguimiento_id: seguimientoId || null, observacion: $('oTexto').value });
            A.cerrarModal();
            d = await DNTDatos.caso(d.caso.id);
            render();
          } catch (e) { A.toast(e.message, 'error'); }
        } }
      ]);
  }

  // ═══ Soportes ════════════════════════════════════════════════════
  var TIPOS_OK = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  var MAX_MB = 15;

  function filaArchivo(s) {
    var icono = (s.mime_type || '').indexOf('pdf') >= 0 ? '📕' : '🖼️';
    return '<div class="archivo' + (s.vigente ? '' : ' viejo') + '">' +
      '<span class="ic">' + icono + '</span>' +
      '<span class="nom">' + esc(s.nombre_archivo) +
        (s.version > 1 ? ' <span class="sem gris">v' + s.version + '</span>' : '') +
        (s.vigente ? '' : ' <span class="sem gris">reemplazado</span>') +
        '<div class="meta">' + A.fecha(s.subido_en) + ' · ' + Math.round((s.file_size || 0) / 1024) + ' KB' +
        (s.descripcion ? ' · ' + esc(s.descripcion) : '') + '</div>' +
      '</span>' +
      '<button class="btn sec chico" data-ver="' + esc(s.id) + '">Ver</button>' +
      (DNTAuth.puedeEliminar() ? '<button class="btn peli chico" data-borrar="' + esc(s.id) + '">Eliminar</button>' : '') +
      '</div>';
  }

  function panelSoportes() {
    var porItem = {};
    d.soportes.forEach(function (s) { (porItem[s.item || '__general'] = porItem[s.item || '__general'] || []).push(s); });

    $('subpanel').innerHTML =
      '<div class="tarjeta">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">' +
          '<div><h3>📎 Soportes del caso</h3>' +
          '<p class="tarjeta-sub" style="margin:0">PDF, JPG, PNG o WEBP hasta ' + MAX_MB + ' MB. ' +
          'Al reemplazar un archivo se conserva la versión anterior.</p></div>' +
          (editable() ? '<button class="btn" id="btnSubirGeneral">📤 Subir documento</button>' : '') +
        '</div>' +
        (d.soportes.length
          ? Object.keys(porItem).sort().map(function (k) {
              var it = k === '__general' ? null : DNTDatos.itemChecklist(k);
              return '<h4 style="margin-top:16px">' +
                (it ? esc(it.codigo) + ' · ' + esc(it.texto) : 'Documentos generales') + '</h4>' +
                porItem[k].map(filaArchivo).join('');
            }).join('')
          : '<div class="vacio"><span class="emo">📎</span>Todavía no hay documentos cargados.</div>') +
      '</div>';

    if ($('btnSubirGeneral')) $('btnSubirGeneral').onclick = function () { dialogoSubir(null, null); };
    enlazarChecklist(null);
  }

  function dialogoSubir(item, seguimientoId) {
    var vigentes = d.soportes.filter(function (s) {
      return s.item === item && s.vigente && (!seguimientoId || s.seguimiento_id === seguimientoId);
    });
    A.modal('Adjuntar documento' + (item ? ' · ítem ' + item : ''),
      '<div class="soltar" id="zona">📤 Haga clic o arrastre el archivo aquí<br>' +
        '<span style="font-size:.78rem">PDF, JPG, PNG o WEBP · máximo ' + MAX_MB + ' MB</span>' +
        '<input type="file" id="archivo" accept=".pdf,.jpg,.jpeg,.png,.webp" hidden></div>' +
      '<div id="elegido"></div>' +
      campo('sDesc', 'Descripción (opcional)', '<input type="text" id="sDesc" placeholder="Ej.: ficha de notificación SIVIGILA">') +
      (vigentes.length
        ? campo('sReemplaza', 'Reemplazar un archivo existente',
            '<select id="sReemplaza"><option value="">No, es un documento nuevo</option>' +
            vigentes.map(function (s) { return A.opcion(s.id, s.nombre_archivo + ' (v' + s.version + ')'); }).join('') +
            '</select>' +
            '<div class="ayuda">El archivo anterior se conserva como versión histórica.</div>')
        : ''),
      [
        { texto: 'Cancelar', accion: A.cerrarModal },
        { texto: 'Subir', accion: function () { subir(item, seguimientoId); } }
      ]);

    var zona = $('zona'), input = $('archivo');
    zona.onclick = function () { input.click(); };
    zona.ondragover = function (e) { e.preventDefault(); zona.classList.add('encima'); };
    zona.ondragleave = function () { zona.classList.remove('encima'); };
    zona.ondrop = function (e) {
      e.preventDefault(); zona.classList.remove('encima');
      input.files = e.dataTransfer.files; mostrarElegido();
    };
    input.onchange = mostrarElegido;
    function mostrarElegido() {
      var f = input.files[0];
      $('elegido').innerHTML = f
        ? '<div class="archivo"><span class="ic">📄</span><span class="nom">' + esc(f.name) +
          '<div class="meta">' + Math.round(f.size / 1024) + ' KB</div></span></div>' : '';
    }
  }

  async function subir(item, seguimientoId) {
    var f = $('archivo').files[0];
    if (!f) { A.toast('Seleccione un archivo.', 'error'); return; }
    if (TIPOS_OK.indexOf(f.type) < 0) { A.toast('Sólo se admiten PDF, JPG, PNG o WEBP.', 'error'); return; }
    if (f.size > MAX_MB * 1024 * 1024) { A.toast('El archivo supera los ' + MAX_MB + ' MB.', 'error'); return; }
    try {
      A.toast('Subiendo…');
      await DNTDatos.subirSoporte(d.caso.id, d.caso.municipio, f, {
        item: item, seguimiento_id: seguimientoId || null,
        descripcion: $('sDesc').value || null,
        reemplaza_a: ($('sReemplaza') && $('sReemplaza').value) || null
      });
      A.cerrarModal();
      A.toast('Documento cargado.', 'ok');
      d = await DNTDatos.caso(d.caso.id);
      render();
    } catch (e) { A.toast(e.message, 'error'); }
  }

  async function abrirSoporte(id) {
    var s = d.soportes.filter(function (x) { return x.id === id; })[0];
    if (!s) return;
    try { window.open(await DNTDatos.descargarSoporte(s), '_blank', 'noopener'); }
    catch (e) { A.toast('No se pudo abrir el documento: ' + e.message, 'error'); }
  }

  function dialogoEliminarSoporte(id) {
    var s = d.soportes.filter(function (x) { return x.id === id; })[0];
    A.modal('Eliminar documento',
      '<div class="aviso ojo"><span class="ic">!</span><div><strong>' + esc(s.nombre_archivo) + '</strong>' +
      'El documento deja de estar visible pero se conserva y puede restaurarse desde Administración.</div></div>' +
      campo('eMotivo', 'Motivo de la eliminación', '<input type="text" id="eMotivo" placeholder="Ej.: cargado por error">'),
      [
        { texto: 'Cancelar', accion: A.cerrarModal },
        { texto: 'Eliminar', clase: 'peli', accion: async function () {
          try {
            await DNTDatos.eliminarSoporte(id, $('eMotivo').value || null);
            A.cerrarModal(); A.toast('Documento eliminado.', 'ok');
            d = await DNTDatos.caso(d.caso.id);
            render();
          } catch (e) { A.toast(e.message, 'error'); }
        } }
      ]);
  }

  // ═══ PDF de la ficha ═════════════════════════════════════════════
  function generarPDF() {
    var jsPDF = window.jspdf.jsPDF;
    var doc = new jsPDF({ unit: 'mm', format: 'letter' });
    var n = d.nino, y = 18;

    function texto(t, x, tam, estilo, color) {
      doc.setFontSize(tam || 10);
      doc.setFont('helvetica', estilo || 'normal');
      doc.setTextColor.apply(doc, color || [11, 43, 40]);
      doc.text(String(t), x || 14, y);
    }
    function salto(mm) { y += (mm || 6); if (y > 260) { doc.addPage(); y = 18; } }

    doc.setFillColor(12, 40, 88); doc.rect(0, 0, 216, 26, 'F');   // azul de la marca
    // El logotipo ya está cargado en el encabezado de la página
    var logo = document.querySelector('.marca-icono');
    if (logo && logo.complete && logo.naturalWidth) {
      try { doc.addImage(logo, 'PNG', 188, 4, 18, 18); } catch (e) { /* sin logotipo, el PDF igual sale */ }
    }
    doc.setTextColor(255, 255, 255); doc.setFontSize(14); doc.setFont('helvetica', 'bold');
    doc.text('NANA DNT', 14, 11);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text('Ficha de seguimiento nutricional infantil · ESE Hospital Regional Noroccidental', 14, 17);
    doc.setFontSize(8);
    doc.text('Res. 2350 de 2020 y Res. 115 de 2026', 14, 22);
    y = 36;

    texto(n.primer_nombre + ' ' + (n.segundo_nombre || '') + ' ' + n.primer_apellido + ' ' + (n.segundo_apellido || ''), 14, 13, 'bold');
    salto(7);
    texto(n.tipo_doc + ' ' + n.num_doc + '  ·  ' + (n.sexo === 'F' ? 'Femenino' : 'Masculino') +
          '  ·  ' + DNTAntro.edadTexto(n.fecha_nac) + '  ·  ' + DNTAuth.nombreMunicipio(n.municipio), 14, 10, 'normal', [75, 107, 103]);
    salto(9);

    function seccion(titulo) {
      doc.setDrawColor(185, 229, 222); doc.line(14, y - 3, 202, y - 3);
      texto(titulo, 14, 11, 'bold', [12, 40, 88]); salto(7);
    }
    function par(k, v) {
      texto(k + ':', 14, 9, 'bold', [75, 107, 103]);
      doc.setFont('helvetica', 'normal'); doc.setTextColor(11, 43, 40);
      doc.text(String(v == null ? '—' : v), 70, y);
      salto(5);
    }

    seccion('Datos del caso');
    par('Consecutivo', '#' + d.caso.consecutivo);
    par('Fecha de apertura', A.fecha(d.caso.fecha_apertura));
    par('Clasificación de ingreso', (A.CLASES_TXT[d.caso.clasificacion_ingreso] || [, '—'])[1]);
    par('Estado actual', (A.ESTADOS_CASO[d.caso.estado] || [, '—'])[1]);
    par('Nivel de riesgo', (d.caso.nivel_riesgo || '—') + ' (' + d.caso.puntaje_riesgo + ' puntos)');
    par('Próximo control', A.fecha(d.caso.fecha_proximo_control));
    if (d.caso.fecha_cierre) {
      par('Fecha de egreso', A.fecha(d.caso.fecha_cierre));
      par('Motivo', MOTIVOS_CIERRE[d.caso.motivo_cierre] || d.caso.motivo_cierre);
      if (d.caso.egreso_con_pendientes) par('Egreso con pendientes', 'Sí — ' + (d.caso.justificacion_egreso || ''));
    }
    salto(4);

    seccion('Seguimientos');
    doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(75, 107, 103);
    // Columnas con ancho propio: con diez campos, un paso fijo se sale de la hoja.
    var COL_X = [14, 36, 50, 64, 76, 88, 100, 116, 132, 172];
    ['Fecha', 'Peso', 'Talla', 'PB', 'PC', 'PA', 'Edema', 'Z P/T-L', 'Clasificación', 'Escenario']
      .forEach(function (h, i) { doc.text(h, COL_X[i], y); });
    salto(4);
    doc.setFont('helvetica', 'normal'); doc.setTextColor(11, 43, 40);
    d.seguimientos.forEach(function (s) {
      [A.fecha(s.fecha), A.num(s.peso_kg, 2), A.num(s.talla_cm, 1), A.num(s.pb_cm, 1),
       A.num(s.perimetro_cefalico_cm, 1), A.num(s.perimetro_abdominal_cm, 1),
       s.edema, A.num(s.z_pt, 2), (A.CLASES_TXT[s.clasificacion_final] || [, '—'])[1].slice(0, 16),
       s.escenario || '—'].forEach(function (v, i) { doc.text(String(v), COL_X[i], y); });
      salto(4.5);
    });
    salto(4);

    seccion('Check-list');
    ['A', 'B', 'C'].forEach(function (lista) {
      DNTDatos.checklistDe(lista).forEach(function (it) {
        var r = d.checklist.filter(function (x) { return x.item === it.codigo && !x.seguimiento_id; })[0];
        var e = r ? r.estado : 'pendiente';
        var marca = { cumple: '[X]', no_cumple: '[ ]', no_aplica: '[N/A]', pendiente: '[ ]' }[e];
        doc.setFontSize(8);
        doc.text(marca + ' ' + it.codigo + ' · ' + it.texto.slice(0, 95), 14, y);
        salto(4.2);
      });
    });

    salto(6);
    doc.setFontSize(7); doc.setTextColor(123, 153, 149);
    doc.text('Generado el ' + new Date().toLocaleString('es-CO') + ' por ' + DNTAuth.usuario().nombre +
             '. Documento con datos personales de un menor de edad: trate conforme a la Ley 1581 de 2012.', 14, y);

    doc.save('Ficha_' + n.num_doc + '_' + A.hoy() + '.pdf');
    DNTAuth.registrar('ficha_pdf', { caso_id: d.caso.id, municipio: d.caso.municipio });
  }

  return { pintar: pintar };
})();

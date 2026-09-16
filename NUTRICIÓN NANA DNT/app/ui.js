// ui.js — Núcleo de la interfaz: utilidades, navegación, tablero y listado de casos.

var DNTApp = (function () {
  'use strict';

  var estado = { casos: [], responsables: [], filtros: {}, graficas: {}, mapa: null };

  // ═══ Utilidades ══════════════════════════════════════════════════
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fecha(f) {
    if (!f) return '—';
    var d = DNTAntro.aFecha(f);
    if (!d) return esc(f);
    return String(d.getDate()).padStart(2, '0') + '/' +
           String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear();
  }
  function hoy() { return new Date().toISOString().slice(0, 10); }
  function num(v, dec) { return v == null || v === '' || isNaN(v) ? '—' : Number(v).toFixed(dec == null ? 1 : dec); }

  function toast(texto, tipo) {
    var d = document.createElement('div');
    d.className = 'toast ' + (tipo || '');
    d.textContent = texto;
    $('avisos').appendChild(d);
    setTimeout(function () { d.remove(); }, tipo === 'error' ? 7000 : 4000);
  }

  function modal(titulo, html, botones) {
    $('modalTitulo').textContent = titulo;
    $('modalCuerpo').innerHTML = html;
    $('modalPie').innerHTML = '';
    (botones || []).forEach(function (b) {
      var btn = document.createElement('button');
      btn.className = 'btn ' + (b.clase || 'sec');
      btn.textContent = b.texto;
      btn.onclick = b.accion;
      $('modalPie').appendChild(btn);
    });
    $('modalFondo').classList.add('abierto');
  }
  function cerrarModal() { $('modalFondo').classList.remove('abierto'); }

  // Semáforo nutricional: el color SIEMPRE va acompañado del texto.
  var CLASES_TXT = {
    DNT_AGUDA_SEVERA:   ['rojo',     'DNT aguda severa'],
    DNT_AGUDA_MODERADA: ['naranja',  'DNT aguda moderada'],
    RIESGO_DNT:         ['amarillo', 'Riesgo de DNT'],
    PESO_ADECUADO:      ['verde',    'Peso adecuado'],
    RIESGO_SOBREPESO:   ['azul',     'Riesgo de sobrepeso'],
    SOBREPESO:          ['azul',     'Sobrepeso'],
    OBESIDAD:           ['azul',     'Obesidad']
  };
  function semaforo(codigo) {
    var c = CLASES_TXT[codigo];
    return c ? '<span class="sem ' + c[0] + '">' + c[1] + '</span>'
             : '<span class="sem gris">Sin clasificar</span>';
  }

  var ESTADOS_CASO = {
    riesgo: ['amarillo', 'Riesgo'], dnt_moderada: ['naranja', 'DNT moderada'],
    dnt_severa: ['rojo', 'DNT severa'], remitido: ['rojo', 'Remitido'],
    ambulatorio: ['azul', 'Ambulatorio'], recuperado: ['verde', 'Recuperado'],
    inasistente: ['naranja', 'Inasistente'], traslado: ['gris', 'Traslado'],
    perdida_seguimiento: ['gris', 'Pérdida de seguimiento'], fallecido: ['gris', 'Fallecido']
  };
  function estadoCaso(e) {
    var c = ESTADOS_CASO[e] || ['gris', e || '—'];
    return '<span class="sem ' + c[0] + '">' + c[1] + '</span>';
  }

  var CONTROL_TXT = {
    vencido:       ['rojo',     'Control vencido'],
    por_vencer:    ['amarillo', 'Por vencer'],
    al_dia:        ['verde',    'Al día'],
    sin_programar: ['gris',     'Sin programar'],
    cerrado:       ['gris',     'Cerrado']
  };
  function estadoControl(e) {
    var c = CONTROL_TXT[e] || ['gris', '—'];
    return '<span class="sem ' + c[0] + '">' + c[1] + '</span>';
  }

  // Paleta de gráficas: validada para daltonismo.
  // Magnitud = un solo tono. Severidad = rampa ordinal clara→oscura.
  var COLOR = {
    magnitud: '#0D9488',
    severidad: { RIESGO_DNT: '#FDBA74', DNT_AGUDA_MODERADA: '#F97316', DNT_AGUDA_SEVERA: '#9A3412' },
    rejilla: 'rgba(11,43,40,.08)',
    texto: '#4B6B67'
  };

  function opcionesBase(extra) {
    return Object.assign({
      responsive: true, maintainAspectRatio: false,
      // margen para que las etiquetas directas al final de cada barra no se recorten
      layout: { padding: { right: 30, top: 16 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { labels: { color: COLOR.texto, boxWidth: 12, boxHeight: 12, font: { size: 11 } } },
        tooltip: { backgroundColor: '#0B2B28', padding: 10, cornerRadius: 8, titleFont: { size: 12 }, bodyFont: { size: 12 } }
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: COLOR.texto, font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: COLOR.rejilla }, border: { display: false },
             ticks: { color: COLOR.texto, font: { size: 11 }, precision: 0 } }
      }
    }, extra || {});
  }

  function grafica(id, config) {
    if (estado.graficas[id]) { estado.graficas[id].destroy(); }
    var el = $(id);
    if (!el) return;
    estado.graficas[id] = new Chart(el.getContext('2d'), config);
  }

  function opcion(valor, texto, sel) {
    return '<option value="' + esc(valor) + '"' + (sel === valor ? ' selected' : '') + '>' + esc(texto) + '</option>';
  }
  function opcionesMunicipio(sel, incluirTodos) {
    var h = incluirTodos ? '<option value="">Todos los municipios</option>' : '';
    DNTAuth.municipios().forEach(function (m) {
      if (DNTAuth.puedeVer(m.codigo)) h += opcion(m.codigo, m.nombre, sel);
    });
    return h;
  }

  // ═══ Arranque ════════════════════════════════════════════════════
  async function iniciar() {
    $('modalCerrar').onclick = cerrarModal;
    $('modalFondo').onclick = function (e) { if (e.target === $('modalFondo')) cerrarModal(); };
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarModal(); });

    var s = await DNTAuth.verificar();
    if (!s) return;

    await DNTDatos.catalogos();
    try { estado.responsables = await DNTDatos.responsables(); } catch (e) { estado.responsables = []; }

    var u = DNTAuth.usuario();
    $('avatar').textContent = (u.nombre || '?').trim().charAt(0).toUpperCase();
    $('nombreUsuario').textContent = u.nombre;
    $('rolUsuario').textContent = { admin: 'Admin', coordinador: 'Coordinador', responsable: 'Responsable' }[s.rol];
    $('chipUsuario').hidden = false;
    $('btnSalir').onclick = function () { DNTAuth.salir(); };
    $('nav').hidden = false;
    $('navAdmin').hidden = !DNTAuth.esAdmin();
    $('arranque').remove();

    Array.prototype.forEach.call(document.querySelectorAll('.nav button'), function (b) {
      b.onclick = function () { ir(b.dataset.vista); };
    });

    DNTAuth.registrar('ingreso', { detalle: { rol: s.rol } });
    await recargarCasos();

    // El portal puede pedir una vista concreta al entrar (por ejemplo «Información»).
    var pedida = null;
    try { pedida = sessionStorage.getItem('dnt-nav'); sessionStorage.removeItem('dnt-nav'); } catch (e) {}
    var valida = ['tablero','casos','cargar','indicadores','apoyo','informacion','admin'];
    ir(valida.indexOf(pedida) >= 0 && (pedida !== 'admin' || DNTAuth.esAdmin()) ? pedida : 'tablero');
  }

  function ir(vista, param) {
    Array.prototype.forEach.call(document.querySelectorAll('.vista'), function (v) { v.classList.remove('activa'); });
    Array.prototype.forEach.call(document.querySelectorAll('.nav button'), function (b) {
      b.classList.toggle('activo', b.dataset.vista === vista);
    });
    var el = $('vista-' + vista);
    if (el) el.classList.add('activa');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    var pintar = {
      tablero:     pintarTablero,
      casos:       pintarCasos,
      ficha:       function () { DNTFicha.pintar(param); },
      cargar:      function () { DNTImportador.pintar(); },
      indicadores: function () { DNTGestion.pintarIndicadores(); },
      apoyo:       function () { DNTGestion.pintarApoyo(); },
      informacion: function () { DNTInfo.pintar(); },
      admin:       function () { DNTGestion.pintarAdmin(); }
    }[vista];
    if (pintar) pintar();
  }

  async function recargarCasos() {
    try {
      estado.casos = await DNTDatos.casos({});
      var vencidos = estado.casos.filter(function (c) {
        return c.abierto && c.estado_control === 'vencido';
      }).length;
      var g = $('globoAlertas');
      g.textContent = vencidos;
      g.classList.toggle('oculto', vencidos === 0);
    } catch (e) { toast('No se pudieron cargar los casos: ' + e.message, 'error'); }
  }

  // ═══ Tablero ═════════════════════════════════════════════════════
  function pintarTablero() {
    var casos = estado.casos;
    var abiertos = casos.filter(function (c) { return c.abierto; });
    function cuenta(f) { return abiertos.filter(f).length; }

    var severa = cuenta(function (c) { return c.clasificacion_actual === 'DNT_AGUDA_SEVERA'; });
    var moderada = cuenta(function (c) { return c.clasificacion_actual === 'DNT_AGUDA_MODERADA'; });
    var riesgo = cuenta(function (c) { return c.clasificacion_actual === 'RIESGO_DNT'; });
    var vencidos = cuenta(function (c) { return c.estado_control === 'vencido'; });
    var porVencer = cuenta(function (c) { return c.estado_control === 'por_vencer'; });
    var recuperados = casos.filter(function (c) { return c.motivo_cierre === 'recuperacion'; }).length;
    var cerrados = casos.filter(function (c) { return !c.abierto; }).length;
    var tasa = cerrados ? Math.round(100 * recuperados / cerrados) : 0;

    var alcance = DNTAuth.veTodo()
      ? 'los ' + DNTAuth.municipios().length + ' municipios de cobertura'
      : DNTAuth.alcance().map(DNTAuth.nombreMunicipio).join(', ') || 'ningún municipio asignado';

    $('vista-tablero').innerHTML =
      '<div class="titulo-vista"><div class="icono">📊</div><div>' +
        '<h1>Tablero de seguimiento</h1>' +
        '<p>Riesgo y desnutrición aguda en menores de 5 años. Usted tiene alcance sobre <strong>' + esc(alcance) + '</strong>.</p>' +
      '</div></div>' +

      (DNTAuth.esResp() && !DNTAuth.alcance().length
        ? '<div class="aviso ojo"><span class="ic">!</span><div><strong>Sin municipio asignado</strong>' +
          'El administrador todavía no le ha asignado un municipio, por eso no ve casos. Solicítelo a la Coordinación de Salud Pública.</div></div>'
        : '') +

      (vencidos ? '<div class="aviso grave"><span class="ic">⚠</span><div><strong>' + vencidos +
        ' control' + (vencidos === 1 ? '' : 'es') + ' vencido' + (vencidos === 1 ? '' : 's') + '</strong>' +
        'El seguimiento es semanal. Revise la bandeja de alertas más abajo.</div></div>' : '') +

      '<div class="rejilla c4" style="margin-bottom:18px">' +
        kpi('Casos activos', abiertos.length, '', 'de ' + casos.length + ' registrados') +
        kpi('DNT aguda severa', severa, 'rojo', 'Urgencia vital · Art. 4 Res. 2350') +
        kpi('DNT aguda moderada', moderada, 'naranja', 'Atención de urgencias') +
        kpi('Riesgo de DNT', riesgo, 'amarillo', 'Z P/T-L entre -2 y -1 DE') +
      '</div>' +
      '<div class="rejilla c4" style="margin-bottom:18px">' +
        kpi('Controles vencidos', vencidos, 'rojo', 'Requieren contacto inmediato') +
        kpi('Por vencer (3 días)', porVencer, 'amarillo', 'Agendar el control') +
        kpi('Egresos por recuperación', recuperados, 'verde', 'Z P/T-L ≥ -1 DE') +
        kpi('Tasa de recuperación', tasa + '%', 'verde', 'Sobre ' + cerrados + ' casos cerrados') +
      '</div>' +

      '<div class="rejilla c2">' +
        '<div class="tarjeta"><h3>🍼 Clasificación de los casos activos</h3>' +
          '<p class="tarjeta-sub">Rampa ordinal: a mayor gravedad, tono más oscuro. Cada segmento lleva su cifra.</p>' +
          '<div class="grafica"><canvas id="gClasif"></canvas></div></div>' +
        '<div class="tarjeta"><h3>🗺️ Casos activos por municipio</h3>' +
          '<p class="tarjeta-sub">Número de casos abiertos en cada municipio de cobertura.</p>' +
          '<div class="grafica"><canvas id="gMunicipio"></canvas></div></div>' +
      '</div>' +

      '<div class="tarjeta"><h3>📈 Casos nuevos por mes</h3>' +
        '<p class="tarjeta-sub">Fecha de apertura del caso, agrupada por mes y clasificación de ingreso.</p>' +
        '<div class="grafica"><canvas id="gTendencia"></canvas></div>' +
        '<details class="acordeon" style="margin-top:12px"><summary>Ver los datos en tabla</summary>' +
        '<div class="acordeon-cuerpo" id="tablaTendencia"></div></details></div>' +

      (DNTAuth.veTodo()
        ? '<div class="tarjeta"><h3>📍 Mapa de cobertura</h3>' +
          '<p class="tarjeta-sub">Tamaño del círculo proporcional al número de casos activos.</p>' +
          '<div id="mapa"></div></div>'
        : '') +

      '<div class="tarjeta"><h3>🔔 Bandeja de alertas</h3>' +
        '<p class="tarjeta-sub">Casos abiertos ordenados por urgencia del control.</p>' +
        '<div id="bandeja"></div></div>';

    graficaClasificacion(severa, moderada, riesgo);
    graficaMunicipios(abiertos);
    graficaTendencia(casos);
    if (DNTAuth.veTodo()) dibujarMapa(abiertos);
    pintarBandeja(abiertos);
  }

  function kpi(etiqueta, valor, color, pie) {
    return '<div class="kpi ' + (color || '') + '">' +
      '<div class="valor">' + esc(valor) + '</div>' +
      '<div class="etiqueta">' + esc(etiqueta) + '</div>' +
      (pie ? '<div class="pie">' + esc(pie) + '</div>' : '') + '</div>';
  }

  function graficaClasificacion(severa, moderada, riesgo) {
    var datos = [
      { k: 'RIESGO_DNT', t: 'Riesgo de DNT', v: riesgo },
      { k: 'DNT_AGUDA_MODERADA', t: 'DNT aguda moderada', v: moderada },
      { k: 'DNT_AGUDA_SEVERA', t: 'DNT aguda severa', v: severa }
    ];
    grafica('gClasif', {
      type: 'bar',
      data: {
        labels: datos.map(function (d) { return d.t; }),
        datasets: [{
          label: 'Casos activos',
          data: datos.map(function (d) { return d.v; }),
          backgroundColor: datos.map(function (d) { return COLOR.severidad[d.k]; }),
          borderRadius: 4, borderSkipped: false, barThickness: 34
        }]
      },
      options: opcionesBase({
        indexAxis: 'y',
        plugins: {
          legend: { display: false },
          tooltip: { backgroundColor: '#0B2B28', padding: 10, cornerRadius: 8 }
        },
        scales: {
          x: { beginAtZero: true, grid: { color: COLOR.rejilla }, border: { display: false },
               ticks: { color: COLOR.texto, precision: 0, font: { size: 11 } } },
          y: { grid: { display: false }, ticks: { color: COLOR.texto, font: { size: 11 } } }
        }
      }),
      plugins: [etiquetasDirectas('x')]
    });
  }

  function graficaMunicipios(abiertos) {
    var por = {};
    DNTAuth.municipios().forEach(function (m) { if (DNTAuth.puedeVer(m.codigo)) por[m.codigo] = 0; });
    abiertos.forEach(function (c) { if (por[c.municipio] != null) por[c.municipio]++; });
    var claves = Object.keys(por);
    grafica('gMunicipio', {
      type: 'bar',
      data: {
        labels: claves.map(DNTAuth.nombreMunicipio),
        datasets: [{ label: 'Casos activos', data: claves.map(function (k) { return por[k]; }),
                     backgroundColor: COLOR.magnitud, borderRadius: 4, borderSkipped: false, barThickness: 40 }]
      },
      options: opcionesBase({ plugins: { legend: { display: false },
        tooltip: { backgroundColor: '#0B2B28', padding: 10, cornerRadius: 8 } } }),
      plugins: [etiquetasDirectas('y')]
    });
  }

  function graficaTendencia(casos) {
    var meses = {}, series = ['RIESGO_DNT', 'DNT_AGUDA_MODERADA', 'DNT_AGUDA_SEVERA'];
    casos.forEach(function (c) {
      if (!c.fecha_apertura) return;
      var m = c.fecha_apertura.slice(0, 7);
      meses[m] = meses[m] || { RIESGO_DNT: 0, DNT_AGUDA_MODERADA: 0, DNT_AGUDA_SEVERA: 0 };
      if (meses[m][c.clasificacion_ingreso] != null) meses[m][c.clasificacion_ingreso]++;
    });
    var etiquetas = Object.keys(meses).sort();
    var NOM = { RIESGO_DNT: 'Riesgo de DNT', DNT_AGUDA_MODERADA: 'DNT aguda moderada', DNT_AGUDA_SEVERA: 'DNT aguda severa' };
    var guiones = { RIESGO_DNT: [], DNT_AGUDA_MODERADA: [7, 3], DNT_AGUDA_SEVERA: [2, 3] };

    grafica('gTendencia', {
      type: 'line',
      data: {
        labels: etiquetas.map(nombreMes),
        datasets: series.map(function (s) {
          return {
            label: NOM[s],
            data: etiquetas.map(function (m) { return meses[m][s]; }),
            borderColor: COLOR.severidad[s], backgroundColor: COLOR.severidad[s],
            borderWidth: 2, borderDash: guiones[s], tension: .28,
            pointRadius: 4, pointHoverRadius: 7, pointBorderColor: '#fff', pointBorderWidth: 2
          };
        })
      },
      options: opcionesBase()
    });

    var filas = etiquetas.map(function (m) {
      return '<tr><td>' + esc(nombreMes(m)) + '</td>' + series.map(function (s) {
        return '<td class="num">' + meses[m][s] + '</td>';
      }).join('') + '<td class="num"><strong>' +
        series.reduce(function (a, s) { return a + meses[m][s]; }, 0) + '</strong></td></tr>';
    }).join('');
    $('tablaTendencia').innerHTML = etiquetas.length
      ? '<div class="tabla-env"><table class="t"><thead><tr><th>Mes</th>' +
        series.map(function (s) { return '<th class="num">' + NOM[s] + '</th>'; }).join('') +
        '<th class="num">Total</th></tr></thead><tbody>' + filas + '</tbody></table></div>'
      : '<p class="vacio">Sin casos registrados.</p>';
  }

  var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  function nombreMes(aaaamm) {
    var p = String(aaaamm).split('-');
    return MESES[+p[1] - 1] ? MESES[+p[1] - 1].slice(0, 3) + ' ' + p[0] : aaaamm;
  }

  // Etiqueta el valor al final de cada barra: el color nunca queda solo.
  function etiquetasDirectas(eje) {
    return {
      id: 'etiquetasDirectas-' + eje,
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = '700 11px Inter, sans-serif';
        ctx.fillStyle = COLOR.texto;
        chart.data.datasets.forEach(function (ds, i) {
          chart.getDatasetMeta(i).data.forEach(function (barra, j) {
            var v = ds.data[j];
            if (!v) return;
            if (eje === 'x') { ctx.textAlign = 'left';   ctx.textBaseline = 'middle'; ctx.fillText(v, barra.x + 7, barra.y); }
            else             { ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(v, barra.x, barra.y - 5); }
          });
        });
        ctx.restore();
      }
    };
  }

  function dibujarMapa(abiertos) {
    if (!window.L) { $('mapa').innerHTML = '<p class="vacio">El mapa requiere conexión a internet.</p>'; return; }
    if (estado.mapa) { estado.mapa.remove(); estado.mapa = null; }
    var mapa = L.map('mapa').setView([8.37, -73.32], 9);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap', maxZoom: 15
    }).addTo(mapa);

    DNTAuth.municipios().forEach(function (m) {
      if (!m.lat || !m.lng || !DNTAuth.puedeVer(m.codigo)) return;
      var n = abiertos.filter(function (c) { return c.municipio === m.codigo; }).length;
      var sev = abiertos.filter(function (c) {
        return c.municipio === m.codigo && c.clasificacion_actual === 'DNT_AGUDA_SEVERA';
      }).length;
      L.circleMarker([m.lat, m.lng], {
        radius: Math.max(9, Math.min(34, 8 + Math.sqrt(n) * 3.4)),
        color: '#0D9488', weight: 2, fillColor: '#0D9488', fillOpacity: .32
      }).addTo(mapa).bindPopup(
        '<strong>' + esc(m.nombre) + '</strong><br>' + n + ' caso' + (n === 1 ? '' : 's') + ' activo' + (n === 1 ? '' : 's') +
        (sev ? '<br><span style="color:#9A3412"><strong>' + sev + ' con DNT aguda severa</strong></span>' : '')
      );
    });
    estado.mapa = mapa;
    setTimeout(function () { mapa.invalidateSize(); }, 180);
  }

  var ORDEN_CONTROL = { vencido: 0, por_vencer: 1, sin_programar: 2, al_dia: 3, cerrado: 4 };
  function pintarBandeja(abiertos) {
    var lista = abiertos.slice().sort(function (a, b) {
      var d = (ORDEN_CONTROL[a.estado_control] || 9) - (ORDEN_CONTROL[b.estado_control] || 9);
      return d !== 0 ? d : String(a.fecha_proximo_control || '').localeCompare(String(b.fecha_proximo_control || ''));
    }).filter(function (c) { return c.estado_control !== 'al_dia'; }).slice(0, 25);

    $('bandeja').innerHTML = lista.length ? tablaCasos(lista, true)
      : '<div class="vacio"><span class="emo">✅</span>No hay controles vencidos ni próximos a vencer.</div>';
    enlazarFilas('bandeja');
  }

  // ═══ Listado de casos ════════════════════════════════════════════
  function tablaCasos(lista, compacta) {
    return '<div class="tabla-env"><table class="t"><thead><tr>' +
      '<th>Niño</th><th>Documento</th><th>Edad</th>' + (compacta ? '' : '<th>Municipio</th>') +
      '<th>Clasificación</th><th>Z P/T-L</th><th>Estado</th><th>Próximo control</th>' +
      '</tr></thead><tbody>' +
      lista.map(function (c) {
        return '<tr class="clicable" data-caso="' + esc(c.id) + '">' +
          '<td><strong>' + esc(c.nombre) + '</strong></td>' +
          '<td class="mono">' + esc(c.num_doc) + '</td>' +
          '<td>' + esc(DNTAntro.edadTexto(c.fecha_nac)) + '</td>' +
          (compacta ? '' : '<td>' + esc(DNTAuth.nombreMunicipio(c.municipio)) + '</td>') +
          '<td>' + semaforo(c.clasificacion_actual) + '</td>' +
          '<td class="num mono">' + num(c.z_pt_ultimo, 2) + '</td>' +
          '<td>' + estadoCaso(c.estado) + '</td>' +
          '<td>' + estadoControl(c.estado_control) + ' <span class="mono" style="font-size:.78rem;color:var(--texto-3)">' +
            fecha(c.fecha_proximo_control) + '</span></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
  }

  function enlazarFilas(contenedorId) {
    Array.prototype.forEach.call($(contenedorId).querySelectorAll('tr[data-caso]'), function (tr) {
      tr.onclick = function () { ir('ficha', tr.dataset.caso); };
    });
  }

  function pintarCasos() {
    var f = estado.filtros;
    $('vista-casos').innerHTML =
      '<div class="titulo-vista"><div class="icono">👶</div><div>' +
        '<h1>Casos en seguimiento</h1>' +
        '<p>Cada caso corresponde a un niño de 0 a 59 meses con riesgo o desnutrición aguda. Haga clic en una fila para abrir la ficha.</p>' +
      '</div></div>' +

      '<div class="filtros">' +
        '<div class="campo"><label for="fTexto">Buscar</label>' +
          '<input type="text" id="fTexto" placeholder="Nombre o documento" value="' + esc(f.texto || '') + '"></div>' +
        '<div class="campo"><label for="fMunicipio">Municipio</label>' +
          '<select id="fMunicipio">' + opcionesMunicipio(f.municipio, true) + '</select></div>' +
        '<div class="campo"><label for="fEstado">Estado del caso</label><select id="fEstado">' +
          '<option value="">Todos</option>' +
          Object.keys(ESTADOS_CASO).map(function (k) { return opcion(k, ESTADOS_CASO[k][1], f.estado); }).join('') +
        '</select></div>' +
        '<div class="campo"><label for="fApertura">Mostrar</label><select id="fApertura">' +
          opcion('abiertos', 'Sólo casos abiertos', f.apertura || 'abiertos') +
          opcion('cerrados', 'Sólo casos cerrados', f.apertura) +
          opcion('todos', 'Todos', f.apertura) +
        '</select></div>' +
        '<div class="campo"><label for="fControl">Control</label><select id="fControl">' +
          '<option value="">Cualquiera</option>' +
          Object.keys(CONTROL_TXT).map(function (k) { return opcion(k, CONTROL_TXT[k][1], f.control); }).join('') +
        '</select></div>' +
        '<button class="btn sec" id="btnLimpiar">Limpiar</button>' +
        '<button class="btn" id="btnExportarCasos">⬇ Excel</button>' +
      '</div>' +
      '<div id="listaCasos"></div>';

    ['fTexto', 'fMunicipio', 'fEstado', 'fApertura', 'fControl'].forEach(function (id) {
      var el = $(id);
      el.oninput = el.onchange = function () {
        estado.filtros = {
          texto: $('fTexto').value, municipio: $('fMunicipio').value, estado: $('fEstado').value,
          apertura: $('fApertura').value, control: $('fControl').value
        };
        filtrarYPintar();
      };
    });
    $('btnLimpiar').onclick = function () { estado.filtros = {}; pintarCasos(); };
    $('btnExportarCasos').onclick = exportarCasos;
    filtrarYPintar();
  }

  function casosFiltrados() {
    var f = estado.filtros, t = (f.texto || '').trim().toLowerCase();
    return estado.casos.filter(function (c) {
      if (f.municipio && c.municipio !== f.municipio) return false;
      if (f.estado && c.estado !== f.estado) return false;
      if (f.control && c.estado_control !== f.control) return false;
      var ap = f.apertura || 'abiertos';
      if (ap === 'abiertos' && !c.abierto) return false;
      if (ap === 'cerrados' && c.abierto) return false;
      if (t && (c.nombre || '').toLowerCase().indexOf(t) < 0 && String(c.num_doc).indexOf(t) < 0) return false;
      return true;
    });
  }

  function filtrarYPintar() {
    var lista = casosFiltrados();
    $('listaCasos').innerHTML = lista.length
      ? '<p class="tarjeta-sub">' + lista.length + ' caso' + (lista.length === 1 ? '' : 's') + '.</p>' + tablaCasos(lista)
      : '<div class="vacio"><span class="emo">🔍</span>Ningún caso coincide con los filtros.</div>';
    if (lista.length) enlazarFilas('listaCasos');
  }

  function exportarCasos() {
    var lista = casosFiltrados();
    if (!lista.length) { toast('No hay casos para exportar.', 'ojo'); return; }
    var filas = lista.map(function (c) {
      return {
        'Consecutivo': c.consecutivo, 'Municipio': DNTAuth.nombreMunicipio(c.municipio),
        'Tipo documento': c.tipo_doc, 'Documento': c.num_doc, 'Nombre': c.nombre,
        'Fecha de nacimiento': fecha(c.fecha_nac), 'Sexo': c.sexo === 'F' ? 'Femenino' : 'Masculino',
        'Edad': DNTAntro.edadTexto(c.fecha_nac), 'Zona': c.zona || '', 'EPS': c.eps || '',
        'Clasificación de ingreso': (CLASES_TXT[c.clasificacion_ingreso] || [, c.clasificacion_ingreso])[1],
        'Clasificación actual': (CLASES_TXT[c.clasificacion_actual] || [, ''])[1],
        'Z P/T-L último': c.z_pt_ultimo, 'Perímetro braquial': c.pb_ultimo, 'Edema': c.edema_ultimo,
        'Estado': (ESTADOS_CASO[c.estado] || [, c.estado])[1],
        'Nivel de riesgo': c.nivel_riesgo || '', 'Puntaje de riesgo': c.puntaje_riesgo,
        'Fecha de apertura': fecha(c.fecha_apertura), 'Última medición': fecha(c.fecha_ultima_medicion),
        'Próximo control': fecha(c.fecha_proximo_control),
        'Estado del control': (CONTROL_TXT[c.estado_control] || [, ''])[1],
        'Fecha de cierre': fecha(c.fecha_cierre), 'Motivo de cierre': c.motivo_cierre || ''
      };
    });
    var hoja = XLSX.utils.json_to_sheet(filas);
    var libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Casos');
    XLSX.writeFile(libro, 'Seguimiento_Nutricional_HRNO_' + hoy() + '.xlsx');
    DNTAuth.registrar('exporte_casos', { detalle: { filas: filas.length } });
    toast('Se exportaron ' + filas.length + ' casos.', 'ok');
  }

  return {
    iniciar: iniciar, ir: ir, estado: estado, recargarCasos: recargarCasos,
    $: $, esc: esc, fecha: fecha, hoy: hoy, num: num,
    toast: toast, modal: modal, cerrarModal: cerrarModal,
    semaforo: semaforo, estadoCaso: estadoCaso, estadoControl: estadoControl,
    CLASES_TXT: CLASES_TXT, ESTADOS_CASO: ESTADOS_CASO, COLOR: COLOR,
    grafica: grafica, opcionesBase: opcionesBase, etiquetasDirectas: etiquetasDirectas,
    opcion: opcion, opcionesMunicipio: opcionesMunicipio, nombreMes: nombreMes,
    tablaCasos: tablaCasos, enlazarFilas: enlazarFilas, kpi: kpi
  };
})();

// informacion.js — Apartado de información: marco normativo completo
// (Res. 2350 de 2020 y Res. 115 de 2026) y algoritmo de atención interactivo.
//
// Todo el contenido proviene de la guía y algoritmo clínico operativo adoptado
// por la ESE HRNO para IPS de primer nivel de complejidad.

var DNTInfo = (function () {
  'use strict';

  var A;
  function $(i) { return DNTApp.$(i); }
  function esc(s) { return DNTApp.esc(s); }
  var sub = 'algoritmo';

  function pintar() {
    A = DNTApp;
    $('vista-informacion').innerHTML =
      '<div class="titulo-vista"><div class="icono">📚</div><div>' +
        '<h1>Información y normatividad</h1>' +
        '<p>Marco normativo vigente, algoritmo de atención y protocolos operativos para IPS de primer nivel. ' +
        'Consúltelo durante la atención: es la misma lógica que aplica el sistema al clasificar y decidir la conducta.</p>' +
      '</div></div>' +
      '<div class="subtabs" id="subInfo">' +
        [['algoritmo', '🧭 Algoritmo interactivo'], ['res2350', '📘 Resolución 2350 de 2020'],
         ['res115', '📗 Resolución 115 de 2026'], ['clasificacion', '📊 Clasificación'],
         ['apetito', '🥄 Prueba de apetito'], ['remision', '🚑 Remisión y estabilización'],
         ['tratamiento', '🥜 Tratamiento'], ['responsabilidades', '🏥 Responsabilidades']]
        .map(function (t) {
          return '<button data-s="' + t[0] + '"' + (sub === t[0] ? ' class="activo"' : '') + '>' + t[1] + '</button>';
        }).join('') +
      '</div><div id="panelInfo"></div>';

    Array.prototype.forEach.call($('subInfo').querySelectorAll('button'), function (b) {
      b.onclick = function () { sub = b.dataset.s; pintar(); };
    });
    ({ algoritmo: panelAlgoritmo, res2350: panelRes2350, res115: panelRes115,
       clasificacion: panelClasificacion, apetito: panelApetito, remision: panelRemision,
       tratamiento: panelTratamiento, responsabilidades: panelResponsabilidades })[sub]();
  }

  // ═══ Algoritmo interactivo ═══════════════════════════════════════
  function panelAlgoritmo() {
    $('panelInfo').innerHTML =
      '<div class="aviso grave"><span class="ic">⚠</span><div>' +
        '<strong>Alerta institucional de urgencia vital</strong>' +
        'La desnutrición aguda moderada y severa en menores de 5 años constituye una atención de urgencias de ' +
        'carácter vital y <strong>no requiere autorización previa de la EAPB</strong> (Art. 4, Res. 2350 de 2020). ' +
        'La identificación y atención del riesgo de desnutrición aguda es una prioridad obligatoria de salud pública ' +
        '(Res. 115 de 2026).</div></div>' +

      '<div class="rejilla c2">' +
        '<div class="tarjeta"><h3>🧭 Simulador del algoritmo</h3>' +
          '<p class="tarjeta-sub">Herramienta de consulta y capacitación. No guarda nada ni crea casos: ' +
          'sirve para practicar la ruta de decisión.</p>' +
          '<div class="fila">' +
            cp('aFNac', 'Fecha de nacimiento', '<input type="date" id="aFNac" max="' + A.hoy() + '">') +
            cp('aSexo', 'Sexo', '<select id="aSexo">' + A.opcion('M', 'Masculino') + A.opcion('F', 'Femenino') + '</select>') +
          '</div>' +
          '<div class="fila">' +
            cp('aPeso', 'Peso (kg)', '<input type="number" id="aPeso" step="0.001" min="0.5" max="40">') +
            cp('aTalla', 'Talla o longitud (cm)', '<input type="number" id="aTalla" step="0.1" min="40" max="130">') +
            cp('aPB', 'Perímetro braquial (cm)', '<input type="number" id="aPB" step="0.1" min="5" max="25">') +
          '</div>' +
          '<div class="fila">' +
            cp('aEdema', 'Edema bilateral', '<select id="aEdema">' + A.opcion('ninguno', 'Ninguno') +
              A.opcion('+', 'Leve (+)') + A.opcion('++', 'Moderado (++)') + A.opcion('+++', 'Severo (+++)') + '</select>') +
            cp('aTemp', 'Temperatura axilar (°C)', '<input type="number" id="aTemp" step="0.1" min="30" max="43">') +
            cp('aFR', 'Frecuencia respiratoria', '<input type="number" id="aFR" step="1" min="10" max="120">') +
          '</div>' +
          '<div class="fila">' +
            cp('aHb', 'Hemoglobina (g/dL)', '<input type="number" id="aHb" step="0.1" min="1" max="20">') +
            cp('aApetito', 'Prueba de apetito', '<select id="aApetito">' +
              '<option value="">Sin realizar</option>' + A.opcion('positiva', 'Positiva') +
              A.opcion('negativa', 'Negativa') + '</select>') +
          '</div>' +
          '<div class="campo"><label>Signos de alarma</label>' +
            '<div style="display:grid;gap:5px;grid-template-columns:repeat(auto-fit,minmax(230px,1fr))">' +
            DNTClinico.SIGNOS.map(function (s) {
              return '<label style="display:flex;gap:7px;align-items:flex-start;font-size:.8rem;font-weight:400">' +
                '<input type="checkbox" name="aSigno" value="' + s.codigo + '" style="width:auto;margin-top:3px">' +
                '<span>' + esc(s.texto) + '</span></label>';
            }).join('') + '</div></div>' +
        '</div>' +
        '<div id="resultadoAlg"></div>' +
      '</div>';

    ['aFNac', 'aSexo', 'aPeso', 'aTalla', 'aPB', 'aEdema', 'aTemp', 'aFR', 'aHb', 'aApetito']
      .forEach(function (id) { $(id).oninput = $(id).onchange = correr; });
    Array.prototype.forEach.call(document.querySelectorAll('[name=aSigno]'), function (c) { c.onchange = correr; });
    correr();
  }

  function cp(id, et, ctrl) {
    return '<div class="campo"><label for="' + id + '">' + esc(et) + '</label>' + ctrl + '</div>';
  }

  function correr() {
    var fnac = $('aFNac').value;
    if (!fnac) {
      $('resultadoAlg').innerHTML = '<div class="tarjeta"><div class="vacio"><span class="emo">🧭</span>' +
        'Ingrese la fecha de nacimiento para recorrer el algoritmo.</div></div>';
      return;
    }
    var peso = parseFloat($('aPeso').value), talla = parseFloat($('aTalla').value);
    var edadM = DNTAntro.mesesCumplidos(fnac);
    var ev = DNTAntro.evaluar({
      fecha_nac: fnac, fecha: A.hoy(), sexo: $('aSexo').value,
      peso_kg: peso, talla_cm: talla, pb_cm: parseFloat($('aPB').value), edema: $('aEdema').value
    });
    var signos = Array.prototype.slice.call(document.querySelectorAll('[name=aSigno]:checked'))
      .map(function (c) { return c.value; });

    var alg = DNTClinico.algoritmo({
      edad_meses: edadM, peso_kg: peso, clasificacion: ev.clasificacion_final,
      edema: $('aEdema').value, apetito: $('aApetito').value || null,
      temperatura: parseFloat($('aTemp').value), frecuencia_respiratoria: parseFloat($('aFR').value),
      hemoglobina: parseFloat($('aHb').value), signos: signos
    });
    var min = DNTClinico.minimoApetito(peso);
    var ftlc = ev.clasificacion_final ? DNTClinico.esquemaFTLC(ev.clasificacion_final, peso, 1) : null;

    $('resultadoAlg').innerHTML =
      '<div class="tarjeta"><h3>' + esc(alg.grupo) + '</h3>' +
        (edadM > 59 ? '<div class="aviso ojo"><span class="ic">!</span><div>El niño supera los 59 meses: ' +
          'queda fuera del alcance del lineamiento de primera infancia.</div></div>' : '') +

        (peso > 0 && talla > 0
          ? '<div class="rejilla c3" style="margin-bottom:12px">' +
              A.kpi('Z P/T-L', A.num(ev.z_pt, 2), '', ev.tabla_pt || '') +
              A.kpi('Edad', ev.edad_texto, '', edadM + ' meses cumplidos') +
              A.kpi('Z T/E', A.num(ev.z_te, 2), '', 'Talla para la edad') +
            '</div>' +
            '<div style="margin-bottom:12px">' + A.semaforo(ev.clasificacion_final) +
              (ev.clasificacion_final_criterio ? ' <span style="font-size:.79rem;color:var(--texto-2)">por ' +
                esc(ev.clasificacion_final_criterio) + '</span>' : '') + '</div>'
          : '<div class="aviso info"><span class="ic">i</span><div>Ingrese peso y talla para clasificar.</div></div>') +

        (alg.urgencia_vital
          ? '<div class="aviso grave"><span class="ic">⚠</span><div><strong>URGENCIA VITAL</strong>' +
            'Todo lactante menor de 6 meses con desnutrición aguda moderada o severa requiere remisión ' +
            'e internación intrahospitalaria previa estabilización.</div></div>' : '') +

        '<h4>Ruta de atención</h4>' +
        alg.pasos.map(function (p) {
          return '<div class="paso"><div class="paso-n">' + p.n + '</div><div>' +
            '<h4>' + esc(p.titulo) + '</h4><p>' + esc(p.detalle) + '</p></div></div>';
        }).join('') +

        (edadM >= 6 && min && min.aplica
          ? '<div class="aviso info" style="margin-top:12px"><span class="ic">🥄</span><div>' +
            '<strong>Consumo mínimo de FTLC: ' + esc(min.fraccion) + '</strong>' +
            'Rango de peso ' + esc(min.rango) + '. Observe la ingesta 15 minutos.</div></div>'
          : (edadM >= 6 && min && !min.aplica
            ? '<div class="aviso grave" style="margin-top:12px"><span class="ic">⚠</span><div>' +
              esc(min.motivo) + '</div></div>' : '')) +

        '<h4 style="margin-top:14px">Decisión</h4>' +
        (alg.remitir
          ? '<div class="aviso grave"><span class="ic">🚑</span><div><strong>REMISIÓN A HOSPITALIZACIÓN (II o III nivel)</strong>' +
            '<ul style="margin:6px 0 0;padding-left:18px">' +
            alg.criterios.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>' +
            (alg.regla ? '<p style="margin:8px 0 0"><strong>' + esc(alg.regla) + '</strong></p>' : '') + '</div></div>' +
            bloqueEstabilizacion(peso)
          : (peso > 0 && talla > 0
            ? '<div class="aviso ok"><span class="ic">✓</span><div><strong>MANEJO AMBULATORIO</strong>' +
              'No se identificaron criterios de remisión. Formule y entregue FTLC suficiente hasta el próximo control ' +
              'y programe el seguimiento.</div></div>' +
              (ftlc ? '<div class="norma-bloque"><strong>Dosis inicial sugerida:</strong> ' +
                ftlc.kcal_dia + ' kcal/día' + (ftlc.kcal_kg_dia ? ' (' + ftlc.kcal_kg_dia + ' kcal/kg/día)' : '') +
                ' · ' + A.num(ftlc.sobres_dia, 2) + ' sobres/día. ' + esc(ftlc.etapa) +
                (ftlc.nota ? ' ' + esc(ftlc.nota) : '') + '</div>' : '')
            : '')) +
      '</div>';
  }

  function bloqueEstabilizacion(peso) {
    var e = DNTClinico.estabilizacion(peso);
    return '<div class="tarjeta" style="margin-top:12px;background:var(--rojo-luz);border-color:rgba(220,38,38,.25)">' +
      '<h4 style="margin-top:0">🚑 Paquete de estabilización inicial en urgencias de I nivel</h4>' +
      e.pasos.map(function (p, i) {
        return '<div class="paso"><div class="paso-n" style="background:var(--rojo)">' + (i + 1) + '</div>' +
          '<div><h4>' + esc(p.titulo) + '</h4><p>' + esc(p.detalle) + '</p></div></div>';
      }).join('') +
      '<div class="aviso grave" style="margin:12px 0 0"><span class="ic">⛔</span><div>' +
      '<strong>Contraindicaciones absolutas</strong><ul style="margin:6px 0 0;padding-left:18px">' +
      e.contraindicaciones.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
      '</ul></div></div></div>';
  }

  // ═══ Resolución 2350 de 2020 ═════════════════════════════════════
  function panelRes2350() {
    $('panelInfo').innerHTML =
      '<div class="tarjeta">' +
        '<h2>📘 Resolución 2350 de 2020</h2>' +
        '<p class="tarjeta-sub">Ministerio de Salud y Protección Social · Lineamiento técnico para el manejo ' +
        'integral de la desnutrición aguda moderada y severa en niños y niñas de 0 a 59 meses de edad.</p>' +

        '<div class="norma-bloque alerta"><strong>Artículo 4 — Atención de urgencia vital.</strong> ' +
        'La desnutrición aguda moderada y severa en menores de 5 años constituye una atención de urgencias ' +
        'de carácter vital y no requiere autorización previa de la EAPB.</div>' +

        acordeon('Objeto y alcance',
          '<p>Adopta el lineamiento técnico y operativo para el manejo integral de la desnutrición aguda ' +
          'moderada y severa en la primera infancia, con un modelo obligacional enfocado en reducir la ' +
          'mortalidad infantil evitable y garantizar la recuperación nutricional sostenida.</p>' +
          '<p>Aplica a todas las entidades del Sistema General de Seguridad Social en Salud: entidades ' +
          'territoriales, EAPB e IPS de todos los niveles de complejidad.</p>') +

        acordeon('Componentes del manejo integral',
          '<ul>' +
          '<li><strong>Identificación:</strong> antropometría completa —peso, talla o longitud y perímetro ' +
          'braquial— y evaluación de edema nutricional bilateral.</li>' +
          '<li><strong>Clasificación:</strong> puntaje Z de peso para la talla o longitud según la ' +
          'Resolución 2465 de 2016.</li>' +
          '<li><strong>Definición del escenario:</strong> manejo ambulatorio o intrahospitalario, decidido ' +
          'con la prueba de apetito y la presencia de complicaciones.</li>' +
          '<li><strong>Tratamiento:</strong> fórmula terapéutica lista para el consumo (FTLC), esquema ' +
          'farmacológico y seguimiento nominal.</li>' +
          '<li><strong>Egreso y seguimiento:</strong> criterios antropométricos y clínicos, canalización a ' +
          'programas sociales y a la ruta de promoción y mantenimiento de la salud.</li>' +
          '</ul>') +

        acordeon('Prueba de apetito',
          '<p>Procedimiento diagnóstico obligatorio, presencial e inmediato, que debe realizar la IPS de ' +
          'primer nivel a todo niño de 6 a 59 meses identificado con desnutrición aguda <strong>antes de ' +
          'enviarlo a casa</strong>. Define si el manejo puede ser ambulatorio.</p>' +
          '<p>Consulte la pestaña «Prueba de apetito» para el procedimiento paso a paso.</p>') +

        acordeon('Esquema farmacológico ambulatorio',
          '<ul>' +
          '<li><strong>Amoxicilina:</strong> 90 mg/kg/día divididos en 2 dosis, 7 días. Exclusivo en ' +
          'desnutrición aguda severa sin complicación, desde el primer día.</li>' +
          '<li><strong>Albendazol:</strong> 200 mg (12 a 23 meses) o 400 mg (24 meses o más), dosis única, ' +
          'a los 15 días de iniciado el tratamiento. Repetir a los 20 días si se usó esquema múltiple.</li>' +
          '<li><strong>Ácido fólico:</strong> 5 mg el día 1 y luego 1 mg/día durante todo el tratamiento.</li>' +
          '<li><strong>Hierro:</strong> contraindicado en la fase inicial de estabilización. Se inicia al ' +
          'terminar la FTLC o al alcanzar Z ≥ -1 DE si persiste Hb &lt; 11 g/dL, a 3 a 6 mg/kg/día de hierro ' +
          'elemental durante 3 a 4 meses.</li>' +
          '</ul>') +

        acordeon('Vigilancia en salud pública',
          '<p>Notificación obligatoria al SIVIGILA de la mortalidad infantil por desnutrición y de los casos ' +
          'de desnutrición aguda en menores de 5 años. Códigos <strong>CIE-10 E46X</strong> y ' +
          '<strong>CIE-11 5B52</strong>.</p>') +
      '</div>';
    activarAcordeones();
  }

  // ═══ Resolución 115 de 2026 ══════════════════════════════════════
  function panelRes115() {
    $('panelInfo').innerHTML =
      '<div class="tarjeta">' +
        '<h2>📗 Resolución 115 de 2026</h2>' +
        '<p class="tarjeta-sub">Ministerio de Salud y Protección Social · Modifica y complementa la ' +
        'Resolución 2350 de 2020 e incorpora el abordaje del riesgo de desnutrición aguda.</p>' +

        '<h3 style="margin-top:16px">Las cuatro modificaciones estructurales</h3>' +

        '<div class="norma-bloque"><strong>1 · Inclusión del riesgo de desnutrición aguda.</strong> ' +
        'Define el abordaje diagnóstico, profiláctico y terapéutico para niños de 0 a 59 meses con puntaje Z ' +
        'de peso para la talla o longitud <strong>entre &gt; -2 y &lt; -1 DE</strong>, priorizado inicialmente ' +
        'en La Guajira, Chocó y Vichada.' +
        '<div style="margin-top:8px;padding-top:8px;border-top:1px dashed var(--menta-borde);font-size:.84rem">' +
        '<strong>Decisión institucional de la ESE HRNO:</strong> el componente de riesgo se aplica también en ' +
        'Norte de Santander, aunque el departamento no esté en la priorización inicial. Por eso el sistema ' +
        'abre caso y hace seguimiento a los niños en riesgo.</div></div>' +

        '<div class="norma-bloque"><strong>2 · Elevación de la meta de recuperación nutricional.</strong> ' +
        'El criterio de egreso pasa de Z P/T-L ≥ -2 DE a <strong>Z P/T-L ≥ -1 DE</strong>, para garantizar que ' +
        'el niño alcance el peso adecuado para su talla antes de suspender el tratamiento ambulatorio.</div>' +

        '<div class="norma-bloque"><strong>3 · Incorporación explícita de la fórmula F-100.</strong> ' +
        'Reglamenta el uso de la fórmula F-100 (100 kcal/100 mL) como insumo intrahospitalario en la fase de ' +
        'transición para niños mayores de 6 meses con peso menor a 4 kg, niños con disfunción motora oral o ' +
        'lactantes menores de 6 meses con falla de ganancia de peso.</div>' +

        '<div class="norma-bloque"><strong>4 · Protección de la lactancia materna y fórmula de inicio.</strong> ' +
        'Garantiza la prescripción y entrega inmediata de fórmula láctea de inicio en menores de 6 meses sin ' +
        'ganancia efectiva con lactancia materna o sin posibilidad de amamantamiento.</div>' +

        acordeon('Esquema de FTLC para el riesgo de desnutrición aguda',
          '<p><strong>240 a 270 kcal/día</strong>, aproximadamente medio sobre diario, hasta lograr ' +
          'Z P/T-L ≥ -1 DE, con controles quincenales según el lineamiento.</p>' +
          '<p style="font-size:.84rem;color:var(--texto-2)">La ESE HRNO adoptó el <strong>control semanal</strong> ' +
          'para todos los casos, por encima del mínimo normativo.</p>') +

        acordeon('Transición de desnutrición a riesgo (numeral 5.1.8)',
          '<ul>' +
          '<li><strong>Seguimiento 1:</strong> mantener la dosis calórica previa de desnutrición.</li>' +
          '<li><strong>Seguimiento 2:</strong> 100 kcal/kg/día.</li>' +
          '<li><strong>Seguimiento 3:</strong> 240 a 270 kcal/día durante 15 días.</li>' +
          '</ul><p>Si el riesgo persiste en el tercer seguimiento, remitir a pediatría.</p>') +

        acordeon('Artículo 11 — Responsabilidades de las IPS de primer nivel',
          '<p>Consulte la pestaña «Responsabilidades» para el detalle completo de las nueve obligaciones.</p>') +
      '</div>';
    activarAcordeones();
  }

  // ═══ Clasificación ═══════════════════════════════════════════════
  function panelClasificacion() {
    $('panelInfo').innerHTML =
      '<div class="tarjeta">' +
        '<h2>📊 Clasificación antropométrica y definiciones clínicas</h2>' +
        '<p class="tarjeta-sub">Res. 2465 de 2016 · Res. 2350 de 2020 · Res. 115 de 2026. ' +
        'El indicador principal en menores de 5 años es el peso para la talla o longitud (P/T-L).</p>' +

        '<div class="tabla-env"><table class="t"><thead><tr>' +
          '<th>Clasificación nutricional</th><th>Puntaje Z (P/T-L)</th>' +
          '<th>Criterios clínicos y perímetro braquial</th></tr></thead><tbody>' +
          fila('Riesgo de desnutrición aguda', 'amarillo', '≥ -2 a &lt; -1 DE',
            'PB &lt; 12,5 cm (6 a 59 meses), signos de anemia (Hb &lt; 11 g/dL), fallas alimentarias o antecedentes de recaída.') +
          fila('Desnutrición aguda moderada', 'naranja', '≥ -3 a &lt; -2 DE',
            'Sin edema nutricional bilateral. Prueba de apetito positiva en 6 a 59 meses. PB entre 11,5 y 12,5 cm.') +
          fila('Desnutrición aguda severa', 'rojo', '&lt; -3 DE',
            'O presencia de edema nutricional bilateral (+, ++, +++), o perímetro braquial &lt; 11,5 cm en 6 a 59 meses.') +
        '</tbody></table></div>' +

        '<div class="aviso info" style="margin-top:14px"><span class="ic">i</span><div>' +
          '<strong>Cómo decide el sistema</strong>' +
          'La clasificación final toma <strong>el criterio más severo</strong> entre el puntaje Z de P/T-L, ' +
          'el perímetro braquial y el edema. Un niño con Z normal pero edema bilateral se clasifica como ' +
          'desnutrición aguda severa.</div></div>' +

        '<h3 style="margin-top:18px">Talla para la edad (T/E)</h3>' +
        '<div class="tabla-env"><table class="t"><thead><tr><th>Clasificación</th><th>Puntaje Z</th></tr></thead><tbody>' +
          '<tr><td>' + A.semaforo('DNT_AGUDA_SEVERA').replace('DNT aguda severa', 'Talla baja o retraso en talla') +
            '</td><td class="mono">&lt; -2 DE</td></tr>' +
          '<tr><td><span class="sem amarillo">Riesgo de talla baja</span></td><td class="mono">≥ -2 a &lt; -1 DE</td></tr>' +
          '<tr><td><span class="sem verde">Talla adecuada para la edad</span></td><td class="mono">≥ -1 DE</td></tr>' +
        '</tbody></table></div>' +

        '<h3 style="margin-top:18px">Cómo se calcula el puntaje Z</h3>' +
        '<div class="norma-bloque">' +
          '<p>El sistema usa los <strong>Patrones de Crecimiento Infantil de la OMS 2006</strong> adoptados por ' +
          'la Resolución 2465 de 2016, con los parámetros L, M y S de cada tabla:</p>' +
          '<p style="font-family:monospace;font-size:.92rem;margin:10px 0">Z = [ (valor / M)<sup>L</sup> − 1 ] / ( L × S )</p>' +
          '<ul style="font-size:.85rem">' +
          '<li>Menores de 24 meses cumplidos: tabla de <strong>peso para la longitud</strong> (medición acostado).</li>' +
          '<li>De 24 meses en adelante: tabla de <strong>peso para la talla</strong> (medición de pie).</li>' +
          '<li>Si la medición no corresponde a la edad, se corrige automáticamente ±0,7 cm.</li>' +
          '<li>Para |Z| mayor a 3 se aplica el ajuste de extrapolación lineal de la OMS.</li>' +
          '<li>Los indicadores por edad se indexan por <strong>meses cumplidos</strong>, como la Res. 2465.</li>' +
          '</ul>' +
        '</div>' +

        '<h3 style="margin-top:18px">Velocidad de ganancia de peso</h3>' +
        '<div class="tabla-env"><table class="t"><thead><tr><th>Edad</th><th>Ganancia mínima esperada</th></tr></thead><tbody>' +
          '<tr><td>0 a 3 meses</td><td class="mono">≥ 25 g/día</td></tr>' +
          '<tr><td>3 a 6 meses</td><td class="mono">≥ 12 g/día</td></tr>' +
          '<tr><td>Mayor de 6 meses</td><td class="mono">≥ 10 g/día</td></tr>' +
        '</tbody></table></div>' +
        '<p style="font-size:.84rem;color:var(--texto-2);margin-top:8px">Si el recién nacido a término pierde ' +
        'más del 10 % del peso de nacimiento en la primera semana (más del 15 % en pretérminos), requiere ' +
        'evaluación médica prioritaria.</p>' +
      '</div>';
  }

  function fila(nombre, color, z, criterios) {
    return '<tr><td><span class="sem ' + color + '">' + esc(nombre) + '</span></td>' +
      '<td class="mono">' + z + '</td><td style="font-size:.83rem">' + criterios + '</td></tr>';
  }

  // ═══ Prueba de apetito ═══════════════════════════════════════════
  function panelApetito() {
    $('panelInfo').innerHTML =
      '<div class="tarjeta">' +
        '<h2>🥄 Protocolo obligatorio de la prueba de apetito con FTLC</h2>' +
        '<p class="tarjeta-sub">Prueba diagnóstica y de tolerancia a la vía oral. La IPS de primer nivel debe ' +
        'realizarla de manera presencial e inmediata a todo niño de 6 a 59 meses identificado con desnutrición ' +
        'aguda <strong>antes de enviarlo a casa</strong>.</p>' +

        '<h3>Procedimiento paso a paso</h3>' +
        [['Ubicar a la madre y al niño', 'En un área tranquila, aislada, limpia y sin distracciones.'],
         ['Explicar el propósito', 'Explique la prueba a la madre o cuidador y solicite lavado de manos con agua y jabón.'],
         ['Ofrecer la FTLC', 'Directamente del sobre o con cuchara o taza, <strong>sin forzar al niño</strong>.'],
         ['Observar 15 minutos', 'Observe la ingesta durante 15 minutos consecutivos, estimulando al niño con amabilidad.']]
        .map(function (p, i) {
          return '<div class="paso"><div class="paso-n">' + (i + 1) + '</div><div>' +
            '<h4>' + esc(p[0]) + '</h4><p>' + p[1] + '</p></div></div>';
        }).join('') +

        '<h3 style="margin-top:18px">Consumo mínimo requerido según el peso</h3>' +
        '<div class="tabla-env"><table class="t"><thead><tr>' +
          '<th>Rango de peso</th><th>Consumo mínimo de FTLC</th></tr></thead><tbody>' +
          DNTClinico.RANGOS_APETITO.map(function (r) {
            return '<tr><td class="mono">' + r.min.toFixed(1).replace('.', ',') + ' a ' +
              r.max.toFixed(1).replace('.', ',') + ' kg</td><td><strong>' + esc(r.fraccion) + '</strong></td></tr>';
          }).join('') +
        '</tbody></table></div>' +

        '<h3 style="margin-top:18px">Interpretación</h3>' +
        '<div class="rejilla c2">' +
          '<div class="aviso ok"><span class="ic">✓</span><div><strong>Prueba POSITIVA</strong>' +
          'El niño consume al menos el mínimo requerido para su rango de peso.<br>' +
          '<strong>Conducta:</strong> manejo ambulatorio, siempre que NO haya signos de alarma.</div></div>' +
          '<div class="aviso grave"><span class="ic">✗</span><div><strong>Prueba NEGATIVA</strong>' +
          'El niño rechaza la FTLC o consume menos del mínimo requerido.<br>' +
          '<strong>Conducta:</strong> remisión inmediata a hospitalización.</div></div>' +
        '</div>' +

        '<div class="aviso ojo"><span class="ic">!</span><div>' +
          '<strong>Nota sobre la tabla del lineamiento</strong>' +
          'En algunas versiones impresas de la tabla, las columnas de resultado aparecen desalineadas y ' +
          'sugieren que el rango de 10,0 a 14,8 kg da siempre prueba negativa. Eso es un error de maquetación: ' +
          '<strong>el rango de peso determina el consumo mínimo, y el resultado depende de si el niño alcanza ' +
          'ese mínimo</strong>. El sistema aplica el criterio correcto.</div></div>' +

        '<div class="aviso grave"><span class="ic">⛔</span><div>' +
          '<strong>Peso menor a 4 kg</strong>' +
          'En niños mayores de 6 meses con peso menor a 4 kg no se define la conducta por prueba de apetito: ' +
          'es criterio de remisión inmediata a hospitalización.</div></div>' +
      '</div>';
  }

  // ═══ Remisión y estabilización ═══════════════════════════════════
  function panelRemision() {
    $('panelInfo').innerHTML =
      '<div class="tarjeta">' +
        '<h2>🚑 Criterios de remisión y estabilización</h2>' +

        '<div class="aviso grave"><span class="ic">⚠</span><div>' +
          '<strong>Regla clínica de decisión absoluta</strong>' +
          'Prueba de apetito POSITIVA + CUALQUIER signo de alarma o complicación aguda = ' +
          '<strong>REMISIÓN OBLIGATORIA A HOSPITALIZACIÓN (II o III nivel)</strong>. ' +
          'Queda estrictamente prohibido dar manejo ambulatorio a un niño con complicaciones médicas, ' +
          'aunque tolere la FTLC.</div></div>' +

        '<h3>Criterios de remisión inmediata (urgencia vital)</h3>' +
        '<ul style="font-size:.88rem;line-height:1.9">' +
        ['Lactante menor de 6 meses con desnutrición aguda, o mayor de 6 meses con peso menor a 4 kg.',
         'Prueba de apetito negativa, rechazo de la vía oral o vómito persistente.',
         'Alteración del estado de conciencia, letargo, hipoactividad o antecedente de convulsiones.',
         'Edema nutricional severo (+++ o anasarca) o incremento del edema durante el seguimiento.',
         'Signos de dificultad respiratoria o taquipnea según la edad.',
         'Hipotermia (temperatura axilar &lt; 35,5 °C) o fiebre (temperatura axilar &gt; 38,0 °C).',
         'Anemia grave: hemoglobina &lt; 4 g/dL, o &lt; 6 g/dL con signos de dificultad respiratoria.',
         'Dermatosis ulcerativa o liquenoide que comprometa más del 30 % de la superficie corporal (SCORDoK grado III).',
         'Incapacidad o patología severa en la madre o cuidador que impida garantizar el cuidado en el hogar.'
        ].map(function (c) { return '<li>' + c + '</li>'; }).join('') + '</ul>' +

        '<h3 style="margin-top:18px">Límites de taquipnea por edad</h3>' +
        '<div class="tabla-env"><table class="t"><thead><tr><th>Edad</th><th>Taquipnea</th></tr></thead><tbody>' +
          '<tr><td>Menor de 2 meses</td><td class="mono">≥ 60 resp/min</td></tr>' +
          '<tr><td>2 a 11 meses</td><td class="mono">≥ 50 resp/min</td></tr>' +
          '<tr><td>12 a 59 meses</td><td class="mono">≥ 40 resp/min</td></tr>' +
        '</tbody></table></div>' +
      '</div>' + bloqueEstabilizacion(null);
  }

  // ═══ Tratamiento ═════════════════════════════════════════════════

  // Calculadora oficial de FTLC del lineamiento nacional. Se incrusta para no
  // sacar al profesional del módulo en mitad de una atención, pero nunca se
  // carga sola: es un sitio ajeno y no tiene por qué pedirse cada vez que
  // alguien entra a leer los esquemas.
  var FTLC_URL = 'https://lineamientodesnutricion.unicef.org.co/ftlc';

  function tarjetaCalculadora() {
    return '<div class="tarjeta" id="tjCalc">' +
      '<h3 style="margin-bottom:6px">🧮 Calculadora de FTLC</h3>' +
      '<p class="tarjeta-sub">Herramienta oficial del lineamiento nacional para el manejo integrado de la ' +
        'desnutrición aguda, de UNICEF Colombia. Calcula los sobres de fórmula terapéutica lista para el ' +
        'consumo a partir del peso y la clasificación del niño.</p>' +
      '<div id="zonaCalc">' +
        '<div style="display:flex;gap:9px;flex-wrap:wrap">' +
          '<button class="btn" id="btnAbrirCalc">Abrir la calculadora aquí</button>' +
          '<a class="btn sec" href="' + FTLC_URL + '" target="_blank" rel="noopener noreferrer">' +
            'Abrir en una pestaña nueva ↗</a>' +
        '</div>' +
      '</div>' +
      '<div class="aviso ojo" style="margin-top:12px"><span class="ic">!</span><div>' +
        '<strong>La calculadora no sustituye el esquema de la tabla</strong>' +
        'Es una ayuda de cálculo: la dosis y la duración las define la clasificación del caso según ' +
        'las Resoluciones 2350 de 2020 y 115 de 2026.</div></div>' +
    '</div>';
  }

  function abrirCalculadora() {
    $('zonaCalc').innerHTML =
      '<div class="ext">' +
        '<div class="ext-cab">' +
          '<div><div class="tit">Calculadora de FTLC</div>' +
            '<div class="url">lineamientodesnutricion.unicef.org.co</div></div>' +
          '<div class="der">' +
            '<a class="btn sec chico" href="' + FTLC_URL + '" target="_blank" rel="noopener noreferrer">' +
              'Pestaña nueva ↗</a>' +
            '<button class="btn sec chico" id="btnCerrarCalc">Cerrar</button>' +
          '</div>' +
        '</div>' +
        '<iframe class="ext-marco" id="marcoCalc" src="' + FTLC_URL + '" loading="lazy" ' +
          'title="Calculadora de FTLC — UNICEF Colombia" ' +
          'sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox">' +
        '</iframe>' +
        '<div class="ext-pie">Contenido de UNICEF Colombia, mostrado dentro del módulo. ' +
          'Si el recuadro queda en blanco es porque ese sitio no permite incrustarse: ' +
          '<a href="' + FTLC_URL + '" target="_blank" rel="noopener noreferrer">ábralo en una pestaña nueva</a>.</div>' +
      '</div>';
    $('btnCerrarCalc').onclick = function () {
      // Quitar el marco descarga el sitio ajeno en vez de dejarlo corriendo detrás.
      $('zonaCalc').innerHTML = '';
      panelTratamiento();
      $('tjCalc').scrollIntoView({ behavior: 'smooth', block: 'start' });
    };
    // Al recuadro completo y por su borde superior, para que la cabecera con el
    // origen y la salida a pestaña nueva no queden bajo la barra pegajosa.
    $('zonaCalc').querySelector('.ext').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function panelTratamiento() {
    $('panelInfo').innerHTML =
      tarjetaCalculadora() +
      '<div class="tarjeta">' +
        '<h2>🥜 Esquemas de tratamiento nutricional y farmacológico ambulatorio</h2>' +

        '<h3>A · Esquema nutricional con FTLC en niños de 6 a 59 meses</h3>' +
        '<div class="tabla-env"><table class="t"><thead><tr>' +
          '<th>Diagnóstico o condición</th><th>Dosis calórica de FTLC</th><th>Duración y ajuste</th>' +
        '</tr></thead><tbody>' +
          '<tr><td><span class="sem amarillo">Riesgo de desnutrición aguda</span><div class="chk-norma">Res. 115/2026</div></td>' +
            '<td class="mono">240 a 270 kcal/día<br>(≈ ½ sobre/día)</td>' +
            '<td>Hasta lograr Z P/T-L ≥ -1 DE en controles quincenales.</td></tr>' +
          '<tr><td><span class="sem naranja">DNT aguda moderada sin complicación</span></td>' +
            '<td class="mono">Días 1 a 7: 150 kcal/kg/día<br>Días 8 al egreso: 200 kcal/kg/día</td>' +
            '<td>Ajustar según apetito y ganancia de peso semanal.</td></tr>' +
          '<tr><td><span class="sem rojo">DNT aguda severa sin complicación</span></td>' +
            '<td class="mono">Días 1 a 3: 80 kcal/kg/día<br>Días 4 a 7: 100 kcal/kg/día<br>' +
            'Días 8 a 15: 135 a 150 kcal/kg/día<br>Días 16 al egreso: 150 a 200 kcal/kg/día</td>' +
            '<td>Progresión cautelosa para prevenir el síndrome de realimentación.</td></tr>' +
          '<tr><td><span class="sem azul">Transición de DNT al riesgo</span><div class="chk-norma">Numeral 5.1.8</div></td>' +
            '<td class="mono">Seguimiento 1: dosis previa<br>Seguimiento 2: 100 kcal/kg/día<br>' +
            'Seguimiento 3: 240 a 270 kcal/día por 15 días</td>' +
            '<td>Remisión a pediatría si persiste el riesgo en el tercer seguimiento.</td></tr>' +
        '</tbody></table></div>' +

        '<h3 style="margin-top:18px">B · Esquema farmacológico ambulatorio</h3>' +
        '<div class="tabla-env"><table class="t"><thead><tr>' +
          '<th>Medicamento</th><th>Indicación</th><th>Dosis</th><th>Duración</th></tr></thead><tbody>' +
          '<tr><td><strong>Amoxicilina</strong></td><td>Antibiótico empírico — exclusivo en DNT aguda severa sin complicación</td>' +
            '<td class="mono">90 mg/kg/día en 2 dosis</td><td>7 días, desde el primer día</td></tr>' +
          '<tr><td><strong>Albendazol</strong></td><td>Antiparasitario</td>' +
            '<td class="mono">200 mg (12 a 23 meses)<br>400 mg (24 meses o más)</td>' +
            '<td>Dosis única a los 15 días de iniciado el tratamiento. Repetir a los 20 días si se usó esquema múltiple.</td></tr>' +
          '<tr><td><strong>Ácido fólico</strong></td><td>Suplementación</td>' +
            '<td class="mono">5 mg el día 1, luego 1 mg/día</td><td>Todo el tratamiento ambulatorio</td></tr>' +
          '<tr><td><strong>Hierro elemental</strong></td><td>Manejo de anemia</td>' +
            '<td class="mono">3 a 6 mg/kg/día</td><td>3 a 4 meses para reponer reservas</td></tr>' +
        '</tbody></table></div>' +

        '<div class="aviso grave" style="margin-top:14px"><span class="ic">⛔</span><div>' +
          '<strong>El hierro está contraindicado en la fase inicial de estabilización</strong>' +
          'Se inicia una vez terminada la FTLC, o al alcanzar Z P/T-L ≥ -1 DE si persiste Hb &lt; 11 g/dL.</div></div>' +

        '<h3 style="margin-top:18px">Lactantes menores de 6 meses</h3>' +
        '<div class="norma-bloque">' +
          '<p><strong>Todo lactante menor de 6 meses con desnutrición aguda moderada o severa representa una ' +
          'urgencia vital</strong> que requiere remisión e internación intrahospitalaria previa estabilización.</p>' +
          '<p>En primer nivel:</p><ul>' +
          '<li>Valorar la ganancia ponderal con los criterios por edad.</li>' +
          '<li>Evaluar la técnica de lactancia materna con la ficha estandarizada de observación: postura, agarre y succión.</li>' +
          '<li>Riesgo sin comorbilidad: consejería en lactancia materna exclusiva, valoración de salud materna ' +
          'y seguimiento estrecho cada 7 a 10 días.</li>' +
          '<li>Sin respuesta, con comorbilidad o con desnutrición aguda: remisión obligatoria a hospitalización.</li>' +
          '<li>Garantizar la entrega de fórmula láctea de inicio cuando no hay ganancia efectiva al seno ' +
          'o no es posible amamantar (Res. 115/2026).</li>' +
          '</ul></div>' +
      '</div>';

    $('btnAbrirCalc').onclick = abrirCalculadora;
  }

  // ═══ Responsabilidades e indicadores ═════════════════════════════
  function panelResponsabilidades() {
    $('panelInfo').innerHTML =
      '<div class="tarjeta">' +
        '<h2>🏥 Responsabilidades de las IPS de primer nivel</h2>' +
        '<p class="tarjeta-sub">Artículo 11 de la Resolución 115 de 2026.</p>' +
        [['Prestación de servicios con calidad y oportunidad',
          'Garantizar atención intramural y extramural con búsqueda activa comunitaria en zonas rurales y dispersas.'],
         ['Enfoque diferencial indígena',
          'Implementar la atención con traductores, respetando la cosmovisión, usos y costumbres en comunidades étnicas.'],
         ['Equipamiento antropométrico calibrado',
          'Disponibilidad permanente de balanza, infantómetro, tallímetro y cinta braquial calibrados y con hoja de vida (Res. 2465 de 2016).'],
         ['Prueba de apetito presencial y prescripción de FTLC',
          'Realizar obligatoriamente la prueba de apetito en la IPS y prescribir y entregar de manera inmediata la FTLC suficiente hasta el próximo control.'],
         ['Suministro de fórmula láctea de inicio',
          'Garantizar la formulación y entrega de fórmula de inicio en menores de 6 meses con desnutrición o riesgo sin ganancia efectiva al seno.'],
         ['Seguimiento nominal obligatorio',
          'Realizar consultas ambulatorias periódicas presenciales, o por telesalud en zonas de difícil acceso si se asegura la entrega de la FTLC.'],
         ['Evaluación de adherencia semestral',
          'Evaluar cada 6 meses la adherencia al lineamiento técnico y formular un plan de mejoramiento continuo.'],
         ['Vigilancia en salud pública (SIVIGILA)',
          'Notificar obligatoriamente la mortalidad infantil por desnutrición, la desnutrición aguda en menores de 5 años y el riesgo de desnutrición.'],
         ['Fortalecimiento continuo del talento humano',
          'Capacitar periódicamente al personal de salud en la aplicación del lineamiento técnico vigente.']
        ].map(function (r, i) {
          return '<div class="paso"><div class="paso-n">' + (i + 1) + '</div><div>' +
            '<h4>' + esc(r[0]) + '</h4><p>' + esc(r[1]) + '</p></div></div>';
        }).join('') +

        '<h3 style="margin-top:20px">Matriz de indicadores de gestión y calidad</h3>' +
        '<p class="tarjeta-sub">Tablas 44 y 45 del anexo técnico de las Resoluciones 2350 de 2020 y 115 de 2026. ' +
        'El sistema los calcula en la pestaña «Indicadores».</p>' +
        '<div class="tabla-env"><table class="t"><thead><tr>' +
          '<th>Indicador</th><th>Tipo</th><th>Forma de cálculo</th><th>Periodicidad</th>' +
        '</tr></thead><tbody>' +
        [['Identificación adecuada de casos de DNT', 'Proceso',
          '(Niños identificados con DNT adecuadamente / Total de niños identificados con DNT) × 100', 'Mensual'],
         ['Definición adecuada del escenario', 'Proceso',
          '(Niños con escenario bien definido / Total de niños identificados) × 100', 'Mensual'],
         ['Adecuado manejo ambulatorio', 'Producto',
          '(Niños con manejo ambulatorio adecuado / Total de niños en ambulatorio) × 100', 'Mensual'],
         ['Prescripción de FTLC en MIPRES', 'Producto',
          '(Niños con FTLC en MIPRES / Total de niños en ambulatorio) × 100', 'Mensual'],
         ['Recuperación nutricional (Z ≥ -1 DE)', 'Resultado',
          '(Niños que alcanzan Z P/T-L ≥ -1 DE / Total de niños en ambulatorio) × 100', 'Mensual'],
         ['Profesionales capacitados en la IPS', 'Proceso',
          '(Profesionales capacitados / Total de profesionales que atienden menores de 5 años) × 100', 'Trimestral']
        ].map(function (r) {
          return '<tr><td><strong>' + esc(r[0]) + '</strong></td><td><span class="sem gris">' + esc(r[1]) +
            '</span></td><td style="font-size:.8rem">' + esc(r[2]) + '</td><td>' + esc(r[3]) + '</td></tr>';
        }).join('') + '</tbody></table></div>' +
      '</div>';
  }

  // ═══ Auxiliares ══════════════════════════════════════════════════
  function acordeon(titulo, cuerpo) {
    return '<details class="acordeon"><summary>' + esc(titulo) + '</summary>' +
      '<div class="acordeon-cuerpo">' + cuerpo + '</div></details>';
  }
  function activarAcordeones() { /* <details> es nativo; queda por si se requiere lógica extra */ }

  return { pintar: pintar };
})();

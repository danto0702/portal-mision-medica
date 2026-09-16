// clinico.js — Motor clínico operativo
// Prueba de apetito, esquemas de FTLC, farmacología ambulatoria, signos de alarma,
// criterios de remisión, puntaje de riesgo y algoritmo de atención por grupo etario.
//
// Fuentes: Resolución 2350 de 2020 · Resolución 115 de 2026 · Resolución 2465 de 2016
// Guía y algoritmo clínico operativo para IPS de primer nivel — ESE HRNO.

(function (global) {
  'use strict';

  var KCAL_SOBRE = 500;   // Un sobre de FTLC de 92 g aporta 500 kcal

  // ═══════════════════════════════════════════════════════════════
  // 1 · PRUEBA DE APETITO CON FTLC (6 a 59 meses)
  // ═══════════════════════════════════════════════════════════════
  // El consumo mínimo depende del rango de peso. El resultado NO depende
  // del rango: es positiva si el niño consume al menos ese mínimo en 15
  // minutos y negativa si lo rechaza o consume menos.
  var RANGOS_APETITO = [
    { min: 4.0,  max: 6.99,  fraccion: '1/4 de sobre', valor: 0.25 },
    { min: 7.0,  max: 9.99,  fraccion: '1/3 de sobre', valor: 1 / 3 },
    { min: 10.0, max: 14.8,  fraccion: '1/2 sobre',    valor: 0.5  }
  ];

  function minimoApetito(pesoKg) {
    var p = parseFloat(pesoKg);
    if (!(p > 0)) return null;
    if (p < 4) {
      return {
        aplica: false,
        motivo: 'Peso menor a 4 kg: es criterio de remisión inmediata a hospitalización, ' +
                'no se define el manejo por prueba de apetito.'
      };
    }
    for (var i = 0; i < RANGOS_APETITO.length; i++) {
      var r = RANGOS_APETITO[i];
      if (p >= r.min && p <= r.max) {
        return { aplica: true, fraccion: r.fraccion, valor: r.valor,
                 rango: r.min.toFixed(1) + ' a ' + r.max.toFixed(1) + ' kg' };
      }
    }
    // Por encima de 14,8 kg se mantiene el mínimo del rango superior.
    return { aplica: true, fraccion: '1/2 sobre', valor: 0.5,
             rango: 'mayor de 14,8 kg', nota: 'Se aplica el mínimo del rango superior de la tabla.' };
  }

  /**
   * @param {number} pesoKg
   * @param {number} edadMeses
   * @param {number} consumidoSobres fracción de sobre efectivamente consumida
   */
  function evaluarApetito(pesoKg, edadMeses, consumidoSobres) {
    if (edadMeses < 6) {
      return { aplica: false, motivo: 'La prueba de apetito no aplica en menores de 6 meses.' };
    }
    if (edadMeses >= 60) {
      return { aplica: false, motivo: 'Fuera del rango de 6 a 59 meses.' };
    }
    var min = minimoApetito(pesoKg);
    if (!min || !min.aplica) return min || { aplica: false, motivo: 'Peso no válido' };
    var c = parseFloat(consumidoSobres);
    if (isNaN(c)) return Object.assign({}, min, { resultado: null });
    var positiva = c >= min.valor - 1e-9;
    return Object.assign({}, min, {
      consumido: c,
      resultado: positiva ? 'positiva' : 'negativa',
      conducta: positiva
        ? 'Manejo ambulatorio SI NO hay signos de alarma ni complicaciones.'
        : 'REMISIÓN INMEDIATA A HOSPITALIZACIÓN.'
    });
  }

  // ═══════════════════════════════════════════════════════════════
  // 2 · SIGNOS DE ALARMA Y CRITERIOS DE REMISIÓN
  // ═══════════════════════════════════════════════════════════════
  function limiteTaquipnea(edadMeses) {
    if (edadMeses < 2)  return 60;
    if (edadMeses < 12) return 50;
    return 40;
  }

  var SIGNOS = [
    { codigo: 'letargo',            texto: 'Alteración del estado de conciencia, letargo o hipoactividad' },
    { codigo: 'convulsiones',       texto: 'Antecedente de convulsiones' },
    { codigo: 'vomito_persistente', texto: 'Vómito persistente o rechazo de la vía oral' },
    { codigo: 'dificultad_resp',    texto: 'Signos de dificultad respiratoria' },
    { codigo: 'deshidratacion',     texto: 'Signos de deshidratación' },
    { codigo: 'hipotermia',         texto: 'Hipotermia (temperatura axilar < 35,5 °C)' },
    { codigo: 'fiebre',             texto: 'Fiebre (temperatura axilar > 38,0 °C)' },
    { codigo: 'palidez_severa',     texto: 'Palidez palmar intensa' },
    { codigo: 'dermatosis',         texto: 'Dermatosis ulcerativa o liquenoide extensa (SCORDoK III)' },
    { codigo: 'cuidador_incapaz',   texto: 'Incapacidad o patología severa del cuidador' }
  ];

  /**
   * Aplica la regla clínica de decisión absoluta del lineamiento:
   * prueba de apetito positiva + cualquier complicación = remisión obligatoria.
   *
   * @param {Object} d  edad_meses, peso_kg, clasificacion, edema, apetito ('positiva'|'negativa'),
   *                    temperatura, frecuencia_respiratoria, hemoglobina, signos (array de códigos),
   *                    edema_incremento (bool)
   */
  function criteriosRemision(d) {
    var c = [], edad = d.edad_meses, signos = d.signos || [];

    if (edad < 6 && (d.clasificacion === 'DNT_AGUDA_MODERADA' || d.clasificacion === 'DNT_AGUDA_SEVERA')) {
      c.push('Lactante menor de 6 meses con desnutrición aguda: urgencia vital con internación.');
    }
    if (edad >= 6 && parseFloat(d.peso_kg) < 4) {
      c.push('Niño mayor de 6 meses con peso menor a 4 kg.');
    }
    if (d.apetito === 'negativa') {
      c.push('Prueba de apetito negativa o rechazo de la vía oral.');
    }
    if (signos.indexOf('vomito_persistente') >= 0) {
      c.push('Vómito persistente o rechazo de la vía oral.');
    }
    if (signos.indexOf('letargo') >= 0 || signos.indexOf('convulsiones') >= 0) {
      c.push('Alteración del estado de conciencia, letargo o antecedente de convulsiones.');
    }
    if (d.edema === '+++' || d.edema_anasarca) {
      c.push('Edema nutricional severo (+++ o anasarca).');
    }
    if (d.edema_incremento) {
      c.push('Incremento del edema durante el seguimiento.');
    }
    var fr = parseFloat(d.frecuencia_respiratoria);
    if (fr > 0 && fr >= limiteTaquipnea(edad)) {
      c.push('Taquipnea: ' + fr + ' resp/min (límite para la edad: ' + limiteTaquipnea(edad) + ').');
    }
    if (signos.indexOf('dificultad_resp') >= 0) {
      c.push('Signos de dificultad respiratoria.');
    }
    var t = parseFloat(d.temperatura);
    if (t > 0 && t < 35.5) c.push('Hipotermia: ' + t + ' °C (< 35,5 °C).');
    if (t > 38.0)          c.push('Fiebre: ' + t + ' °C (> 38,0 °C).');
    var hb = parseFloat(d.hemoglobina);
    if (hb > 0) {
      if (hb < 4) c.push('Anemia grave: hemoglobina ' + hb + ' g/dL (< 4 g/dL).');
      else if (hb < 6 && (fr >= limiteTaquipnea(edad) || signos.indexOf('dificultad_resp') >= 0)) {
        c.push('Anemia grave: hemoglobina ' + hb + ' g/dL con dificultad respiratoria.');
      }
    }
    if (signos.indexOf('dermatosis') >= 0) {
      c.push('Dermatosis ulcerativa o liquenoide que compromete más del 30 % de la superficie corporal.');
    }
    if (signos.indexOf('cuidador_incapaz') >= 0) {
      c.push('Incapacidad o patología severa del cuidador que impide el cuidado en el hogar.');
    }
    if (signos.indexOf('deshidratacion') >= 0) {
      c.push('Signos de deshidratación.');
    }

    return {
      remitir: c.length > 0,
      criterios: c,
      escenario: c.length > 0 ? 'hospitalizacion' : 'ambulatorio',
      regla: c.length > 0 && d.apetito === 'positiva'
        ? 'Prueba de apetito POSITIVA + complicación = REMISIÓN OBLIGATORIA. ' +
          'Queda prohibido el manejo ambulatorio aunque tolere la FTLC.'
        : null
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 3 · ESQUEMA NUTRICIONAL CON FTLC
  // ═══════════════════════════════════════════════════════════════
  /**
   * @param {string} clasificacion RIESGO_DNT | DNT_AGUDA_MODERADA | DNT_AGUDA_SEVERA
   * @param {number} pesoKg
   * @param {number} diaTratamiento día ambulatorio (1 = inicio)
   * @param {boolean} enTransicion esquema del numeral 5.1.8 (de DNT a riesgo)
   * @param {number} seguimientoTransicion 1 | 2 | 3
   */
  function esquemaFTLC(clasificacion, pesoKg, diaTratamiento, enTransicion, seguimientoTransicion) {
    var p = parseFloat(pesoKg), dia = parseInt(diaTratamiento, 10) || 1;
    if (!(p > 0)) return null;

    function salida(kcalDia, kcalKg, etiqueta, nota) {
      return {
        kcal_dia: Math.round(kcalDia),
        kcal_kg_dia: kcalKg ? +kcalKg.toFixed(1) : null,
        sobres_dia: +(kcalDia / KCAL_SOBRE).toFixed(2),
        sobres_semana: Math.ceil(kcalDia * 7 / KCAL_SOBRE),
        etapa: etiqueta,
        nota: nota || null
      };
    }

    if (enTransicion) {
      var s = parseInt(seguimientoTransicion, 10) || 1;
      if (s === 1) return salida(0, null, 'Transición · seguimiento 1',
        'Mantener la dosis calórica previa de desnutrición. Registrar la dosis del control anterior.');
      if (s === 2) return salida(100 * p, 100, 'Transición · seguimiento 2', null);
      return salida(255, null, 'Transición · seguimiento 3',
        '240 a 270 kcal/día durante 15 días. Si persiste el riesgo en el tercer seguimiento, remitir a pediatría.');
    }

    if (clasificacion === 'RIESGO_DNT') {
      return salida(255, null, 'Riesgo de desnutrición aguda (Res. 115/2026)',
        '240 a 270 kcal/día, aproximadamente medio sobre diario, hasta lograr Z P/T-L ≥ -1 DE. Controles quincenales.');
    }

    if (clasificacion === 'DNT_AGUDA_MODERADA') {
      var kk = dia <= 7 ? 150 : 200;
      return salida(kk * p, kk, 'Desnutrición aguda moderada · día ' + dia,
        dia <= 7 ? 'Días 1 a 7: 150 kcal/kg/día.' : 'Desde el día 8: 200 kcal/kg/día. Ajustar según apetito y ganancia semanal.');
    }

    if (clasificacion === 'DNT_AGUDA_SEVERA') {
      var k, nota;
      if (dia <= 3)       { k = 80;  nota = 'Días 1 a 3: progresión cautelosa para prevenir el síndrome de realimentación.'; }
      else if (dia <= 7)  { k = 100; nota = 'Días 4 a 7.'; }
      else if (dia <= 15) { k = 142.5; nota = 'Días 8 a 15: 135 a 150 kcal/kg/día.'; }
      else                { k = 175; nota = 'Desde el día 16: 150 a 200 kcal/kg/día hasta el egreso.'; }
      return salida(k * p, k, 'Desnutrición aguda severa · día ' + dia, nota);
    }
    return null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 4 · ESQUEMA FARMACOLÓGICO AMBULATORIO
  // ═══════════════════════════════════════════════════════════════
  function esquemaFarmacologico(clasificacion, pesoKg, edadMeses, hemoglobina, opciones) {
    var p = parseFloat(pesoKg), m = parseFloat(edadMeses), hb = parseFloat(hemoglobina);
    var o = opciones || {}, r = [];
    if (!(p > 0)) return r;

    if (clasificacion === 'DNT_AGUDA_SEVERA' && !o.con_complicacion) {
      var total = 90 * p, dosis = total / 2;
      r.push({
        farmaco: 'Amoxicilina',
        indicacion: 'Antibiótico empírico — exclusivo en desnutrición aguda severa SIN complicación',
        dosis: Math.round(total) + ' mg/día (90 mg/kg/día) — ' + Math.round(dosis) + ' mg cada 12 horas',
        duracion: '7 días consecutivos, iniciando el primer día',
        via: 'Oral'
      });
    }

    if (m >= 12) {
      r.push({
        farmaco: 'Albendazol',
        indicacion: 'Antiparasitario',
        dosis: (m < 24 ? '200 mg' : '400 mg') + ' dosis única',
        duracion: 'A los 15 días de iniciado el tratamiento ambulatorio. Repetir a los 20 días si se usó esquema múltiple.',
        via: 'Oral'
      });
    } else {
      r.push({
        farmaco: 'Albendazol',
        indicacion: 'Antiparasitario',
        dosis: 'No indicado',
        duracion: 'Menor de 12 meses: no se administra.',
        via: '—', inactivo: true
      });
    }

    r.push({
      farmaco: 'Ácido fólico',
      indicacion: 'Suplementación',
      dosis: '5 mg el día 1, luego 1 mg/día',
      duracion: 'Durante todo el tratamiento ambulatorio',
      via: 'Oral'
    });

    var hierroMin = (3 * p).toFixed(1), hierroMax = (6 * p).toFixed(1);
    var puedeHierro = o.ftlc_finalizada === true || (o.z_pt !== null && o.z_pt !== undefined && o.z_pt >= -1);
    r.push({
      farmaco: 'Hierro elemental',
      indicacion: 'Manejo de anemia',
      dosis: hierroMin + ' a ' + hierroMax + ' mg/día (3 a 6 mg/kg/día)',
      duracion: '3 a 4 meses para reponer reservas',
      via: 'Oral',
      inactivo: !puedeHierro,
      alerta: !puedeHierro
        ? 'CONTRAINDICADO en la fase inicial de estabilización. Se inicia al terminar la FTLC o al alcanzar Z P/T-L ≥ -1 DE, si persiste Hb < 11 g/dL.'
        : (hb > 0 && hb >= 11 ? 'Hemoglobina ≥ 11 g/dL: evaluar si se requiere.' : null)
    });
    return r;
  }

  // ═══════════════════════════════════════════════════════════════
  // 5 · PAQUETE DE ESTABILIZACIÓN EN URGENCIAS DE I NIVEL
  // ═══════════════════════════════════════════════════════════════
  function estabilizacion(pesoKg) {
    var p = parseFloat(pesoKg);
    var dad = p > 0 ? (5 * p).toFixed(0) : '5 mL/kg';
    var sro = p > 0 ? (75 * p).toFixed(0) : '75 mL/kg';
    return {
      pasos: [
        { titulo: 'Control de hipoxia',
          detalle: 'Oxígeno suplementario por cánula nasal si la saturación es menor a 90 %.' },
        { titulo: 'Prevención de hipoglucemia',
          detalle: 'Si está consciente: bolo de dextrosa al 10 % por vía oral o SNG, ' + dad +
                   ' mL (5 mL/kg). Si hay letargo o convulsión: ' + dad + ' mL IV en 5 minutos.' },
        { titulo: 'Prevención de hipotermia',
          detalle: 'Mantener arropado, usar gorro, evitar corrientes de aire y promover el contacto piel a piel.' },
        { titulo: 'Rehidratación oral cautelosa (DHAKA)',
          detalle: 'SRO de baja osmolaridad (SRO-75): ' + sro + ' mL (75 mL/kg) en 4 a 6 horas por vía oral o SNG.' }
      ],
      contraindicaciones: [
        'Albúmina.',
        'Diuréticos, salvo transfusión por anemia grave.',
        'Cargas rápidas de líquidos intravenosos salinos o hipernatrémicos (riesgo de falla cardíaca inminente).'
      ]
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 6 · PUNTAJE DE RIESGO
  // ═══════════════════════════════════════════════════════════════
  function puntajeRiesgo(factoresPresentes, catalogo) {
    var total = 0, maximo = 0, detalle = [];
    (catalogo || []).forEach(function (f) {
      maximo += f.peso;
      if (factoresPresentes && factoresPresentes.indexOf(f.codigo) >= 0) {
        total += f.peso;
        detalle.push({ codigo: f.codigo, etiqueta: f.etiqueta, peso: f.peso });
      }
    });
    var nivel = total >= 12 ? 'alto' : (total >= 6 ? 'medio' : 'bajo');
    return { puntaje: total, maximo: maximo, nivel: nivel, factores: detalle,
             porcentaje: maximo ? Math.round(100 * total / maximo) : 0 };
  }

  // ═══════════════════════════════════════════════════════════════
  // 7 · PERIODICIDAD DEL SEGUIMIENTO
  // ═══════════════════════════════════════════════════════════════
  // Decisión institucional (HRNO): control SEMANAL para todos los casos.
  // En menores de 6 meses el lineamiento pide cada 7 a 10 días; se toma 7.
  function proximoControl(fechaBase, clasificacion, edadMeses) {
    var d = (window.DNTAntro ? DNTAntro.aFecha(fechaBase) : new Date(fechaBase)) || new Date();
    var f = new Date(d.getTime());
    f.setDate(f.getDate() + 7);
    return {
      fecha: f.toISOString().slice(0, 10),
      dias: 7,
      criterio: edadMeses < 6
        ? 'Menor de 6 meses: seguimiento estrecho cada 7 a 10 días.'
        : 'Control semanal para riesgo y desnutrición aguda.'
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 8 · ALGORITMO DE ATENCIÓN POR GRUPO ETARIO
  // ═══════════════════════════════════════════════════════════════
  function algoritmo(d) {
    var edad = d.edad_meses;
    var pasos = [], grupo;

    if (edad < 6) {
      grupo = 'Lactante menor de 6 meses';
      pasos.push({ n: 1, titulo: 'Valoración de ganancia ponderal',
        detalle: 'Insuficiente si es menor a 25 g/día entre 0 y 3 meses, o menor a 12 g/día entre 3 y 6 meses. ' +
                 'Si el recién nacido a término pierde más del 10 % del peso de nacimiento en la primera semana ' +
                 '(o más del 15 % en pretérminos), requiere evaluación médica prioritaria.' });
      pasos.push({ n: 2, titulo: 'Evaluación de la diada madre-hijo',
        detalle: 'Evaluación estricta de la técnica de lactancia materna con la ficha estandarizada de observación: postura, agarre y succión.' });
      pasos.push({ n: 3, titulo: 'Definición del manejo',
        detalle: 'Riesgo sin comorbilidad: consejería en lactancia materna exclusiva, valoración de salud materna y seguimiento cada 7 a 10 días. ' +
                 'Sin respuesta, comorbilidad o desnutrición aguda: remisión obligatoria a hospitalización.' });
    } else {
      grupo = 'Niño de 6 a 59 meses';
      pasos.push({ n: 1, titulo: 'Triaje y antropometría completa',
        detalle: 'Peso, talla o longitud y perímetro braquial. Registro de edema bilateral mediante presión digital en el dorso de los pies por 3 segundos.' });
      pasos.push({ n: 2, titulo: 'Examen clínico específico',
        detalle: 'Búsqueda activa de signos de inanición (marasmo) o de estrés metabólico y edema (kwashiorkor), evaluación cutánea SCORDoK y signos AIEPI.' });
      pasos.push({ n: 3, titulo: 'Prueba de apetito con FTLC',
        detalle: 'Procedimiento diagnóstico obligatorio, presencial, de 15 minutos, antes de definir si el manejo es ambulatorio o requiere hospitalización.' });
      pasos.push({ n: 4, titulo: 'Evaluación de comorbilidades y signos de alarma',
        detalle: 'Descarte riguroso de hipotermia, fiebre, hipoglucemia, anemia grave, taquipnea, vómito o letargo.' });
      pasos.push({ n: 5, titulo: 'Definición del escenario de manejo',
        detalle: 'Manejo ambulatorio con FTLC, o remisión intrahospitalaria de urgencia.' });
    }

    var rem = criteriosRemision(d);
    return {
      grupo: grupo,
      pasos: pasos,
      escenario: rem.escenario,
      remitir: rem.remitir,
      criterios: rem.criterios,
      regla: rem.regla,
      urgencia_vital: edad < 6 && (d.clasificacion === 'DNT_AGUDA_MODERADA' || d.clasificacion === 'DNT_AGUDA_SEVERA')
    };
  }

  global.DNTClinico = {
    KCAL_SOBRE: KCAL_SOBRE,
    RANGOS_APETITO: RANGOS_APETITO,
    SIGNOS: SIGNOS,
    minimoApetito: minimoApetito,
    evaluarApetito: evaluarApetito,
    limiteTaquipnea: limiteTaquipnea,
    criteriosRemision: criteriosRemision,
    esquemaFTLC: esquemaFTLC,
    esquemaFarmacologico: esquemaFarmacologico,
    estabilizacion: estabilizacion,
    puntajeRiesgo: puntajeRiesgo,
    proximoControl: proximoControl,
    algoritmo: algoritmo
  };
})(typeof window !== 'undefined' ? window : globalThis);

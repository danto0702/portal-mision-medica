// antro.js — Motor antropométrico OMS 2006 / Resolución 2465 de 2016
// Calcula puntajes Z y clasifica el estado nutricional de niños de 0 a 59 meses.
// Requiere que lms.js esté cargado antes.
//
// Referencias normativas:
//   · Res. 2465/2016 — indicadores y puntos de corte
//   · Res. 2350/2020 — desnutrición aguda moderada y severa
//   · Res. 115/2026  — riesgo de desnutrición aguda y meta de egreso Z ≥ -1

(function (global) {
  'use strict';

  var DIAS_MES = 30.4375;   // días promedio por mes (criterio OMS Anthro)

  // ── Utilidades de fecha ──────────────────────────────────────────
  function aFecha(v) {
    if (v instanceof Date) return v;
    if (typeof v !== 'string') return null;
    var s = v.trim();
    var m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);       // dd/mm/aaaa
    if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
    m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                       // aaaa-mm-dd
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var d = new Date(s);
    return isNaN(d) ? null : d;
  }

  function dias(fechaNac, fecha) {
    var a = aFecha(fechaNac), b = aFecha(fecha) || new Date();
    if (!a) return null;
    return Math.floor((b - a) / 86400000);
  }

  /** Edad en meses decimales (uso informativo y cálculo de velocidad de ganancia). */
  function edadMeses(fechaNac, fecha) {
    var d = dias(fechaNac, fecha);
    return d === null ? null : d / DIAS_MES;
  }

  /**
   * Edad en MESES CUMPLIDOS — es la que indexa las tablas por edad.
   * La Resolución 2465 de 2016 clasifica por edad cumplida, y así lo hacen
   * los reportes oficiales de la institución (validado contra 271 atenciones).
   */
  function mesesCumplidos(fechaNac, fecha) {
    var a = aFecha(fechaNac), b = aFecha(fecha) || new Date();
    if (!a) return null;
    var m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
    if (b.getDate() < a.getDate()) m--;
    return m;
  }

  /** Edad legible: "3A 1M 4D". */
  function edadTexto(fechaNac, fecha) {
    var a = aFecha(fechaNac), b = aFecha(fecha) || new Date();
    if (!a) return '';
    var y = b.getFullYear() - a.getFullYear();
    var m = b.getMonth() - a.getMonth();
    var d = b.getDate() - a.getDate();
    if (d < 0) { m--; d += new Date(b.getFullYear(), b.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    return y + 'A ' + m + 'M ' + d + 'D';
  }

  // ── Interpolación de los parámetros L, M, S ──────────────────────
  function buscarLMS(tabla, clave) {
    if (!tabla || !tabla.length) return null;
    if (clave < tabla[0][0] || clave > tabla[tabla.length - 1][0]) return null;
    var lo = 0, hi = tabla.length - 1;
    while (lo <= hi) {
      var mid = (lo + hi) >> 1;
      if (tabla[mid][0] === clave) return { L: tabla[mid][1], M: tabla[mid][2], S: tabla[mid][3] };
      if (tabla[mid][0] < clave) lo = mid + 1; else hi = mid - 1;
    }
    var a = tabla[hi], b = tabla[lo];                 // hi < clave < lo
    var t = (clave - a[0]) / (b[0] - a[0]);
    return {
      L: a[1] + t * (b[1] - a[1]),
      M: a[2] + t * (b[2] - a[2]),
      S: a[3] + t * (b[3] - a[3])
    };
  }

  /** Valor medido que corresponde a un puntaje Z dado (fórmula LMS inversa). */
  function valorEnZ(p, z) {
    return p.L === 0 ? p.M * Math.exp(p.S * z)
                     : p.M * Math.pow(1 + p.L * p.S * z, 1 / p.L);
  }

  /**
   * Puntaje Z con el ajuste OMS para valores extremos (|z| > 3).
   * El ajuste aplica a los indicadores basados en peso (P/E, P/T-L, IMC/E),
   * no a talla para la edad.
   */
  function calcularZ(valor, p, ajustar) {
    if (!p || !(valor > 0)) return null;
    var z = p.L === 0 ? Math.log(valor / p.M) / p.S
                      : (Math.pow(valor / p.M, p.L) - 1) / (p.L * p.S);
    if (!ajustar || Math.abs(z) <= 3 || !isFinite(z)) return z;
    if (z > 3) {
      var sd3p = valorEnZ(p, 3), sd2p = valorEnZ(p, 2);
      return 3 + (valor - sd3p) / (sd3p - sd2p);
    }
    var sd3n = valorEnZ(p, -3), sd2n = valorEnZ(p, -2);
    return -3 - (sd3n - valor) / (sd2n - sd3n);
  }

  // ── Selección de tabla peso/talla según edad y forma de medición ──
  // OMS: longitud en decúbito hasta los 24 meses cumplidos, talla de pie desde los 24.
  // Si la medición no corresponde a la edad se corrige ±0,7 cm.
  function ajustarTalla(tallaCm, mesesCump, medicion) {
    var deAcostado = mesesCump < 24;
    if (!medicion || medicion === 'auto') return { cm: tallaCm, ajustada: false };
    if (deAcostado && medicion === 'talla')     return { cm: tallaCm + 0.7, ajustada: true };
    if (!deAcostado && medicion === 'longitud') return { cm: tallaCm - 0.7, ajustada: true };
    return { cm: tallaCm, ajustada: false };
  }

  // ── Clasificaciones (Res. 2465/2016 · Res. 115/2026) ─────────────
  var CLASES = {
    pt: [
      { max: -3,       codigo: 'DNT_AGUDA_SEVERA',   texto: 'Desnutrición aguda severa',   color: 'rojo'    },
      { max: -2,       codigo: 'DNT_AGUDA_MODERADA', texto: 'Desnutrición aguda moderada', color: 'naranja' },
      { max: -1,       codigo: 'RIESGO_DNT',         texto: 'Riesgo de desnutrición aguda',color: 'amarillo'},
      { max: 1,        codigo: 'PESO_ADECUADO',      texto: 'Peso adecuado para la talla', color: 'verde'   },
      { max: 2,        codigo: 'RIESGO_SOBREPESO',   texto: 'Riesgo de sobrepeso',         color: 'azul'    },
      { max: 3,        codigo: 'SOBREPESO',          texto: 'Sobrepeso',                   color: 'azul'    },
      { max: Infinity, codigo: 'OBESIDAD',           texto: 'Obesidad',                    color: 'azul'    }
    ],
    te: [
      { max: -2,       codigo: 'TALLA_BAJA',        texto: 'Talla baja para la edad o retraso en talla', color: 'rojo'     },
      { max: -1,       codigo: 'RIESGO_TALLA_BAJA', texto: 'Riesgo de talla baja',                       color: 'amarillo' },
      { max: Infinity, codigo: 'TALLA_ADECUADA',    texto: 'Talla adecuada para la edad',                color: 'verde'    }
    ],
    pe: [
      { max: -3,       codigo: 'PESO_MUY_BAJO',      texto: 'Peso muy bajo para la edad (desnutrición global severa)', color: 'rojo'     },
      { max: -2,       codigo: 'PESO_BAJO',          texto: 'Peso bajo para la edad (desnutrición global)',            color: 'naranja'  },
      { max: -1,       codigo: 'RIESGO_PESO_BAJO',   texto: 'Riesgo de peso bajo para la edad',                        color: 'amarillo' },
      { max: 1,        codigo: 'PESO_ADECUADO_EDAD', texto: 'Peso adecuado para la edad',                              color: 'verde'    },
      { max: Infinity, codigo: 'PESO_ELEVADO',       texto: 'Peso elevado para la edad (evaluar con P/T)',             color: 'azul'     }
    ],
    // Perímetro cefálico para la edad. La Res. 2465/2016 lo nombra por el punto
    // de corte, no por el diagnóstico: microcefalia y macrocefalia son lecturas
    // clínicas que confirma el pediatra, no una salida de la tabla.
    pc: [
      { max: -2,       codigo: 'PC_BAJO',     texto: 'Perímetro cefálico bajo para la edad (evaluar microcefalia)', color: 'naranja' },
      { max: 2,        codigo: 'PC_ADECUADO', texto: 'Perímetro cefálico adecuado para la edad',                    color: 'verde'   },
      { max: Infinity, codigo: 'PC_ALTO',     texto: 'Perímetro cefálico alto para la edad (evaluar macrocefalia)', color: 'naranja' }
    ]
  };

  function clasificar(indicador, z) {
    if (z === null || z === undefined || isNaN(z)) return null;
    var tabla = CLASES[indicador];
    for (var i = 0; i < tabla.length; i++) if (z < tabla[i].max) return tabla[i];
    return tabla[tabla.length - 1];
  }

  // ── Perímetro braquial, 6 a 59 meses (Res. 2350/2020) ────────────
  function clasificarPB(pbCm, meses) {
    if (!(pbCm > 0) || meses < 6 || meses >= 60) return null;
    if (pbCm < 11.5) return { codigo: 'DNT_AGUDA_SEVERA',   texto: 'Perímetro braquial < 11,5 cm',        color: 'rojo'     };
    if (pbCm < 12.5) return { codigo: 'DNT_AGUDA_MODERADA', texto: 'Perímetro braquial entre 11,5 y 12,5 cm', color: 'naranja' };
    return { codigo: 'PESO_ADECUADO', texto: 'Perímetro braquial ≥ 12,5 cm', color: 'verde' };
  }

  // Gravedad relativa para combinar criterios: gana siempre el más severo.
  var GRAVEDAD = {
    DNT_AGUDA_SEVERA: 5, DNT_AGUDA_MODERADA: 4, RIESGO_DNT: 3,
    PESO_ADECUADO: 0, RIESGO_SOBREPESO: 1, SOBREPESO: 1, OBESIDAD: 1
  };

  // ── Velocidad de ganancia de peso ────────────────────────────────
  function gananciaPonderal(pesoActualKg, fechaActual, pesoPrevioKg, fechaPrevia, mesesEdad) {
    if (!(pesoActualKg > 0) || !(pesoPrevioKg > 0)) return null;
    var d = dias(fechaPrevia, fechaActual);
    if (!d || d <= 0) return null;
    var gDia = (pesoActualKg - pesoPrevioKg) * 1000 / d;
    var gKgDia = gDia / pesoPrevioKg;
    var minimo, fuente;
    if (mesesEdad < 3)      { minimo = 25; fuente = '0 a 3 meses: ≥ 25 g/día'; }
    else if (mesesEdad < 6) { minimo = 12; fuente = '3 a 6 meses: ≥ 12 g/día'; }
    else                    { minimo = 10; fuente = 'Mayor de 6 meses: ≥ 10 g/día'; }
    return {
      dias: d,
      g_dia: +gDia.toFixed(1),
      g_kg_dia: +gKgDia.toFixed(2),
      minimo_esperado: minimo,
      criterio: fuente,
      adecuada: gDia >= minimo
    };
  }

  // ── Evaluación completa de una medición ──────────────────────────
  /**
   * @param {Object} m
   *   fecha_nac, sexo ('M'|'F'), fecha, peso_kg, talla_cm,
   *   medicion ('auto'|'longitud'|'talla'), pb_cm, pc_cm, pa_cm,
   *   edema ('ninguno'|'+'|'++'|'+++')
   * @returns {Object} puntajes Z, clasificaciones por indicador y clasificación final.
   */
  function evaluar(m) {
    var out = {
      edad_meses: null, edad_dias: null, edad_texto: '',
      z_pt: null, z_pe: null, z_te: null, z_imc: null, z_pc: null,
      clasificacion_pt: null, clasificacion_pe: null, clasificacion_te: null,
      clasificacion_pb: null, clasificacion_pc: null, clasificacion_final: null,
      perimetro_abdominal: null,
      imc: null, tabla_pt: null, talla_usada: null, talla_ajustada: false,
      avisos: []
    };

    var meses = edadMeses(m.fecha_nac, m.fecha);
    if (meses === null) { out.avisos.push('Fecha de nacimiento inválida'); return out; }
    out.edad_meses = +meses.toFixed(2);
    out.edad_dias  = dias(m.fecha_nac, m.fecha);
    out.edad_texto = edadTexto(m.fecha_nac, m.fecha);

    if (meses < 0)  { out.avisos.push('La fecha de la atención es anterior al nacimiento'); return out; }
    if (meses > 60) { out.avisos.push('El niño supera los 59 meses: fuera del alcance del lineamiento'); }

    var sexo = (m.sexo === 'F' || m.sexo === 'f') ? 'F' : 'M';
    var peso = parseFloat(m.peso_kg), talla = parseFloat(m.talla_cm);
    var cumplidos = mesesCumplidos(m.fecha_nac, m.fecha);
    var mesesTabla = Math.min(Math.max(cumplidos, 0), 60);
    out.edad_meses_cumplidos = cumplidos;

    // Peso para la talla / longitud — indicador principal
    if (peso > 0 && talla > 0) {
      var aj = ajustarTalla(talla, cumplidos, m.medicion);
      out.talla_usada = +aj.cm.toFixed(1);
      out.talla_ajustada = aj.ajustada;
      if (aj.ajustada) out.avisos.push('Talla corregida ±0,7 cm por forma de medición no acorde a la edad');

      var usaLongitud = cumplidos < 24;
      var tabla = usaLongitud ? DNT_LMS.wfl[sexo] : DNT_LMS.wfh[sexo];
      out.tabla_pt = usaLongitud ? 'P/L (longitud, < 24 meses)' : 'P/T (talla de pie, ≥ 24 meses)';
      var p = buscarLMS(tabla, out.talla_usada);
      if (p) {
        out.z_pt = +calcularZ(peso, p, true).toFixed(3);
        out.clasificacion_pt = clasificar('pt', out.z_pt);
      } else {
        out.avisos.push('Talla/longitud de ' + out.talla_usada +
          ' cm fuera del rango de la tabla OMS (' + tabla[0][0] + ' a ' + tabla[tabla.length - 1][0] + ' cm)');
      }

      var imc = peso / Math.pow(aj.cm / 100, 2);
      out.imc = +imc.toFixed(2);
      var pb2 = buscarLMS(DNT_LMS.bfa[sexo], mesesTabla);
      if (pb2) out.z_imc = +calcularZ(imc, pb2, true).toFixed(3);
    }

    // Peso para la edad
    if (peso > 0) {
      var pw = buscarLMS(DNT_LMS.wfa[sexo], mesesTabla);
      if (pw) {
        out.z_pe = +calcularZ(peso, pw, true).toFixed(3);
        out.clasificacion_pe = clasificar('pe', out.z_pe);
      }
    }

    // Talla para la edad
    if (talla > 0) {
      var pl = buscarLMS(DNT_LMS.lhfa[sexo], mesesTabla);
      if (pl) {
        out.z_te = +calcularZ(out.talla_usada || talla, pl, false).toFixed(3);
        out.clasificacion_te = clasificar('te', out.z_te);
      }
    }

    // Perímetro braquial
    out.clasificacion_pb = clasificarPB(parseFloat(m.pb_cm), cumplidos);

    // Perímetro cefálico para la edad. No entra en la clasificación nutricional
    // —la desnutrición aguda no se diagnostica por la cabeza— pero en menores de
    // 2 años es el tamizaje de neurodesarrollo que exige la ruta de promoción y
    // mantenimiento, y aquí ya se tiene la edad y el sexo para calcularlo.
    var pc = parseFloat(m.pc_cm);
    if (pc > 0) {
      var ph = buscarLMS(DNT_LMS.hcfa[sexo], mesesTabla);
      if (ph) {
        out.z_pc = +calcularZ(pc, ph, false).toFixed(3);
        out.clasificacion_pc = clasificar('pc', out.z_pc);
      }
    }

    // Perímetro abdominal. Se guarda tal cual: no tiene patrón de referencia de
    // la OMS para menores de 5 años, y su valor está en la tendencia —la
    // distensión que acompaña al edema o a la realimentación—, no en un corte.
    var pa = parseFloat(m.pa_cm);
    if (pa > 0) out.perimetro_abdominal = +pa.toFixed(1);

    // ── Clasificación final: gana el criterio más severo ───────────
    var candidatos = [];
    if (out.clasificacion_pt) candidatos.push({ c: out.clasificacion_pt, por: 'Puntaje Z de P/T-L' });
    if (out.clasificacion_pb) candidatos.push({ c: out.clasificacion_pb, por: 'Perímetro braquial' });
    if (m.edema && m.edema !== 'ninguno') {
      candidatos.push({
        c: { codigo: 'DNT_AGUDA_SEVERA', texto: 'Desnutrición aguda severa', color: 'rojo' },
        por: 'Edema nutricional bilateral (' + m.edema + ')'
      });
    }
    if (candidatos.length) {
      candidatos.sort(function (a, b) {
        return (GRAVEDAD[b.c.codigo] || 0) - (GRAVEDAD[a.c.codigo] || 0);
      });
      out.clasificacion_final = candidatos[0].c.codigo;
      out.clasificacion_final_texto = candidatos[0].c.texto;
      out.clasificacion_final_color = candidatos[0].c.color;
      out.clasificacion_final_criterio = candidatos[0].por;
    }

    // El IMC/E no clasifica en menores de 5 años: el indicador oficial es P/T-L.
    if (out.z_imc !== null) {
      out.nota_imc = 'En menores de 5 años el IMC/E es informativo; la clasificación oficial es por P/T-L.';
    }
    return out;
  }

  /** ¿Cumple la meta de egreso de la Res. 115/2026? */
  function cumpleMetaEgreso(zPt) {
    return zPt !== null && zPt !== undefined && zPt >= -1;
  }

  global.DNTAntro = {
    aFecha: aFecha, dias: dias, edadMeses: edadMeses, mesesCumplidos: mesesCumplidos,
    edadTexto: edadTexto,
    buscarLMS: buscarLMS, calcularZ: calcularZ, valorEnZ: valorEnZ,
    clasificar: clasificar, clasificarPB: clasificarPB,
    gananciaPonderal: gananciaPonderal, evaluar: evaluar,
    cumpleMetaEgreso: cumpleMetaEgreso, CLASES: CLASES
  };
})(typeof window !== 'undefined' ? window : globalThis);

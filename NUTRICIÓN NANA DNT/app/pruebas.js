// pruebas.js — Verificación de los motores antropométrico y clínico.
// Ejecutar con:  node "app/pruebas.js"   (desde la carpeta del módulo)
//
// No requiere dependencias: valida contra los valores de corte publicados por
// la OMS y contra los puntos de corte normativos colombianos.

var fs = require('fs'), path = require('path');
global.window = global;
var dir = __dirname;
eval(fs.readFileSync(path.join(dir, 'lms.js'), 'utf8').replace(/if \(typeof module[\s\S]*$/, ''));
eval(fs.readFileSync(path.join(dir, 'antro.js'), 'utf8'));
eval(fs.readFileSync(path.join(dir, 'clinico.js'), 'utf8'));

var fallos = 0, pruebas = 0;
function ok(cond, desc, extra) {
  pruebas++;
  if (!cond) { fallos++; console.log('  ✗ ' + desc + (extra ? '  → ' + extra : '')); }
}
function casi(a, b, tol, desc) { ok(Math.abs(a - b) <= tol, desc, 'obtenido ' + a + ', esperado ' + b); }
function titulo(t) { console.log('\n' + t); }

// ── 1 · Valores de corte publicados por la OMS ─────────────────────
titulo('1 · Puntos de corte OMS 2006 (peso para la longitud/talla)');
[ // [sexo, tabla, cm, z, kg publicado]
  ['M','wfl', 45,  0, 2.4],  ['M','wfl', 45, -2, 2.0],  ['M','wfl', 45, -3, 1.9],
  ['M','wfl', 65,  0, 7.3],  ['M','wfl', 65, -2, 6.2],  ['M','wfl', 65, -3, 5.7],
  ['F','wfl', 65,  0, 7.1],  ['F','wfl', 65, -2, 5.9],  ['F','wfl', 65, -3, 5.5],
  ['M','wfl',110,  0,18.3],  ['M','wfl',110, -2,15.4],
  ['M','wfh', 65,  0, 7.4],  ['M','wfh',120,  0,22.4],
  ['F','wfh', 65,  0, 7.2],  ['F','wfh',120,  0,22.8]
].forEach(function (c) {
  var p = DNTAntro.buscarLMS(DNT_LMS[c[1]][c[0]], c[2]);
  casi(+DNTAntro.valorEnZ(p, c[3]).toFixed(1), c[4], 0.05,
       c[1] + ' ' + c[0] + ' ' + c[2] + ' cm en Z=' + c[3]);
});

titulo('2 · Puntos de corte OMS 2006 (peso y talla para la edad)');
[ ['M','wfa',  0, 0, 3.3], ['M','wfa', 12, 0, 9.6], ['M','wfa', 60, 0, 18.3],
  ['F','wfa',  0, 0, 3.2], ['F','wfa', 12, 0, 8.9], ['F','wfa', 60, 0, 18.2],
  ['M','lhfa', 0, 0, 49.9], ['M','lhfa',24, 0, 87.1],  // 87,1 cm de pie = 87,8 cm acostado - 0,7, ['M','lhfa',60, 0, 110.0],
  ['F','lhfa', 0, 0, 49.1], ['F','lhfa',60, 0, 109.4]
].forEach(function (c) {
  var p = DNTAntro.buscarLMS(DNT_LMS[c[1]][c[0]], c[2]);
  casi(+DNTAntro.valorEnZ(p, c[3]).toFixed(1), c[4], 0.06,
       c[1] + ' ' + c[0] + ' mes ' + c[2] + ' en Z=' + c[3]);
});

// ── 3 · Coherencia interna: Z → valor → Z ──────────────────────────
titulo('3 · Coherencia interna del cálculo de Z');
var peor = 0;
['wfl','wfh','wfa','lhfa','bfa'].forEach(function (ind) {
  ['M','F'].forEach(function (s) {
    DNT_LMS[ind][s].forEach(function (fila) {
      var p = { L: fila[1], M: fila[2], S: fila[3] };
      [-3,-2,-1,0,1,2,3].forEach(function (z) {
        peor = Math.max(peor, Math.abs(DNTAntro.calcularZ(DNTAntro.valorEnZ(p, z), p, true) - z));
      });
    });
  });
});
ok(peor < 1e-6, 'error máximo en ida y vuelta Z↔valor', peor.toExponential(2));
console.log('  error máximo: ' + peor.toExponential(2));

// ── 4 · Ajuste OMS para puntajes extremos ──────────────────────────
titulo('4 · Ajuste para |Z| > 3');
var p65 = DNTAntro.buscarLMS(DNT_LMS.wfl.M, 65);
var sd3 = DNTAntro.valorEnZ(p65, -3), sd2 = DNTAntro.valorEnZ(p65, -2);
casi(DNTAntro.calcularZ(3.5, p65, true), -3 - (sd3 - 3.5) / (sd2 - sd3), 1e-9,
     'extrapolación lineal por debajo de -3 DE');
ok(Math.abs(DNTAntro.calcularZ(3.5, p65, true)) < Math.abs(DNTAntro.calcularZ(3.5, p65, false)),
   'el ajuste modera el puntaje extremo');

// ── 5 · Clasificación (Res. 2465/2016 y Res. 115/2026) ─────────────
titulo('5 · Umbrales de clasificación');
[[-3.5,'DNT_AGUDA_SEVERA'],[-3.0,'DNT_AGUDA_MODERADA'],[-2.5,'DNT_AGUDA_MODERADA'],
 [-2.0,'RIESGO_DNT'],[-1.5,'RIESGO_DNT'],[-1.0,'PESO_ADECUADO'],[0,'PESO_ADECUADO'],
 [1.5,'RIESGO_SOBREPESO'],[2.5,'SOBREPESO'],[3.5,'OBESIDAD']
].forEach(function (c) {
  ok(DNTAntro.clasificar('pt', c[0]).codigo === c[1], 'P/T con Z=' + c[0] + ' → ' + c[1],
     DNTAntro.clasificar('pt', c[0]).codigo);
});
[[-2.5,'TALLA_BAJA'],[-1.5,'RIESGO_TALLA_BAJA'],[-0.5,'TALLA_ADECUADA']].forEach(function (c) {
  ok(DNTAntro.clasificar('te', c[0]).codigo === c[1], 'T/E con Z=' + c[0] + ' → ' + c[1]);
});
ok(DNTAntro.cumpleMetaEgreso(-1), 'meta de egreso Res. 115/2026: Z = -1 la cumple');
ok(!DNTAntro.cumpleMetaEgreso(-1.01), 'meta de egreso: Z = -1,01 no la cumple');

// ── 6 · Perímetro braquial y edema ─────────────────────────────────
titulo('6 · Perímetro braquial y edema');
ok(DNTAntro.clasificarPB(11.0, 24).codigo === 'DNT_AGUDA_SEVERA',   'PB 11,0 cm → severa');
ok(DNTAntro.clasificarPB(12.0, 24).codigo === 'DNT_AGUDA_MODERADA', 'PB 12,0 cm → moderada');
ok(DNTAntro.clasificarPB(13.0, 24).codigo === 'PESO_ADECUADO',      'PB 13,0 cm → adecuado');
ok(DNTAntro.clasificarPB(11.0, 3) === null,                          'PB no aplica antes de los 6 meses');
var conEdema = DNTAntro.evaluar({ fecha_nac: '01/01/2024', fecha: '01/01/2025', sexo: 'M',
                                  peso_kg: 9.6, talla_cm: 76, edema: '+' });
ok(conEdema.clasificacion_final === 'DNT_AGUDA_SEVERA',
   'el edema bilateral clasifica como severa aunque el Z sea normal', conEdema.clasificacion_final);
var porPB = DNTAntro.evaluar({ fecha_nac: '01/01/2024', fecha: '01/01/2025', sexo: 'M',
                               peso_kg: 9.6, talla_cm: 76, pb_cm: 11.0 });
ok(porPB.clasificacion_final === 'DNT_AGUDA_SEVERA', 'gana el criterio más severo (PB)', porPB.clasificacion_final);

// ── 7 · Longitud contra talla ──────────────────────────────────────
titulo('7 · Selección de tabla por edad y corrección ±0,7 cm');
var menor = DNTAntro.evaluar({ fecha_nac: '01/01/2025', fecha: '01/07/2025', sexo: 'M', peso_kg: 7, talla_cm: 65 });
ok(menor.tabla_pt.indexOf('longitud') > 0, 'menor de 24 meses usa la tabla de longitud');
var mayor = DNTAntro.evaluar({ fecha_nac: '01/01/2022', fecha: '01/07/2025', sexo: 'M', peso_kg: 13, talla_cm: 95 });
ok(mayor.tabla_pt.indexOf('pie') > 0, 'mayor de 24 meses usa la tabla de talla de pie');
var corr = DNTAntro.evaluar({ fecha_nac: '01/01/2025', fecha: '01/07/2025', sexo: 'M',
                              peso_kg: 7, talla_cm: 65, medicion: 'talla' });
casi(corr.talla_usada, 65.7, 0.001, 'medición de pie antes de los 24 meses suma 0,7 cm');

// ── 8 · Prueba de apetito ──────────────────────────────────────────
titulo('8 · Prueba de apetito con FTLC');
ok(DNTClinico.minimoApetito(5).fraccion === '1/4 de sobre',  '5,0 kg → 1/4 de sobre');
ok(DNTClinico.minimoApetito(8).fraccion === '1/3 de sobre',  '8,0 kg → 1/3 de sobre');
ok(DNTClinico.minimoApetito(12).fraccion === '1/2 sobre',    '12,0 kg → 1/2 sobre');
ok(DNTClinico.minimoApetito(3.5).aplica === false,           'menos de 4 kg → remisión, no aplica la prueba');
ok(DNTClinico.evaluarApetito(12, 24, 0.5).resultado === 'positiva',
   '12 kg consumiendo 1/2 sobre → POSITIVA (el rango no determina el resultado)');
ok(DNTClinico.evaluarApetito(12, 24, 0.25).resultado === 'negativa', '12 kg consumiendo 1/4 → negativa');
ok(DNTClinico.evaluarApetito(5, 24, 0.1).resultado === 'negativa',   '5 kg consumiendo menos del mínimo → negativa');
ok(DNTClinico.evaluarApetito(8, 3, 1).aplica === false,              'no aplica en menores de 6 meses');

// ── 9 · Regla de decisión absoluta ─────────────────────────────────
titulo('9 · Criterios de remisión');
var r1 = DNTClinico.criteriosRemision({ edad_meses: 24, peso_kg: 10, apetito: 'positiva',
  clasificacion: 'DNT_AGUDA_MODERADA', temperatura: 38.5, signos: [] });
ok(r1.remitir && r1.regla, 'apetito positivo + fiebre = remisión obligatoria');
var r2 = DNTClinico.criteriosRemision({ edad_meses: 24, peso_kg: 10, apetito: 'positiva',
  clasificacion: 'DNT_AGUDA_MODERADA', temperatura: 36.8, signos: [] });
ok(!r2.remitir && r2.escenario === 'ambulatorio', 'apetito positivo sin complicación = ambulatorio');
var r3 = DNTClinico.criteriosRemision({ edad_meses: 3, peso_kg: 4.5,
  clasificacion: 'DNT_AGUDA_MODERADA', signos: [] });
ok(r3.remitir, 'lactante menor de 6 meses con DNT aguda = urgencia vital');
var r4 = DNTClinico.criteriosRemision({ edad_meses: 8, peso_kg: 10,
  clasificacion: 'RIESGO_DNT', frecuencia_respiratoria: 52, signos: [] });
ok(r4.remitir, 'taquipnea de 52 resp/min a los 8 meses (límite 50) = remisión');
ok(DNTClinico.limiteTaquipnea(1) === 60 && DNTClinico.limiteTaquipnea(6) === 50 &&
   DNTClinico.limiteTaquipnea(24) === 40, 'límites de taquipnea por edad');

// ── 10 · Esquemas de FTLC ──────────────────────────────────────────
titulo('10 · Esquema nutricional con FTLC');
var e1 = DNTClinico.esquemaFTLC('DNT_AGUDA_MODERADA', 10, 1);
casi(e1.kcal_dia, 1500, 0.5, 'moderada día 1: 150 kcal/kg/día con 10 kg');
var e2 = DNTClinico.esquemaFTLC('DNT_AGUDA_MODERADA', 10, 8);
casi(e2.kcal_dia, 2000, 0.5, 'moderada día 8: 200 kcal/kg/día');
var e3 = DNTClinico.esquemaFTLC('DNT_AGUDA_SEVERA', 10, 2);
casi(e3.kcal_dia, 800, 0.5, 'severa día 2: 80 kcal/kg/día');
var e4 = DNTClinico.esquemaFTLC('DNT_AGUDA_SEVERA', 10, 20);
casi(e4.kcal_kg_dia, 175, 0.1, 'severa día 20: 150 a 200 kcal/kg/día');
var e5 = DNTClinico.esquemaFTLC('RIESGO_DNT', 10, 1);
ok(e5.kcal_dia >= 240 && e5.kcal_dia <= 270, 'riesgo: 240 a 270 kcal/día', e5.kcal_dia);
casi(e5.sobres_dia, 0.51, 0.02, 'riesgo: aproximadamente medio sobre diario');

// ── 11 · Farmacología ──────────────────────────────────────────────
titulo('11 · Esquema farmacológico');
var f = DNTClinico.esquemaFarmacologico('DNT_AGUDA_SEVERA', 10, 30, 9, {});
var amox = f.filter(function (x) { return x.farmaco === 'Amoxicilina'; })[0];
ok(amox && amox.dosis.indexOf('900 mg/día') === 0, 'amoxicilina 90 mg/kg/día con 10 kg = 900 mg/día',
   amox && amox.dosis);
ok(amox.dosis.indexOf('450 mg cada 12 horas') > 0, 'dividida en 2 dosis de 450 mg');
var alb = f.filter(function (x) { return x.farmaco === 'Albendazol'; })[0];
ok(alb.dosis.indexOf('400 mg') === 0, 'albendazol 400 mg a los 30 meses');
ok(DNTClinico.esquemaFarmacologico('DNT_AGUDA_SEVERA', 8, 18, 9, {})
     .filter(function (x) { return x.farmaco === 'Albendazol'; })[0].dosis.indexOf('200 mg') === 0,
   'albendazol 200 mg entre 12 y 23 meses');
var hierro = f.filter(function (x) { return x.farmaco === 'Hierro elemental'; })[0];
ok(hierro.inactivo === true, 'hierro contraindicado en la fase inicial');
var hierro2 = DNTClinico.esquemaFarmacologico('DNT_AGUDA_MODERADA', 10, 30, 9, { z_pt: -0.5 })
  .filter(function (x) { return x.farmaco === 'Hierro elemental'; })[0];
ok(!hierro2.inactivo, 'hierro se habilita al alcanzar Z ≥ -1');
ok(DNTClinico.esquemaFarmacologico('DNT_AGUDA_MODERADA', 10, 30, 9, {})
     .filter(function (x) { return x.farmaco === 'Amoxicilina'; }).length === 0,
   'sin amoxicilina en desnutrición moderada');

// ── 12 · Puntaje de riesgo ─────────────────────────────────────────
titulo('12 · Puntaje de riesgo');
var cat = [{ codigo: 'a', etiqueta: 'A', peso: 3 }, { codigo: 'b', etiqueta: 'B', peso: 3 },
           { codigo: 'c', etiqueta: 'C', peso: 2 }, { codigo: 'd', etiqueta: 'D', peso: 1 }];
ok(DNTClinico.puntajeRiesgo([], cat).nivel === 'bajo', 'sin factores → riesgo bajo');
ok(DNTClinico.puntajeRiesgo(['a','b'], cat).nivel === 'medio', 'puntaje 6 → riesgo medio');
ok(DNTClinico.puntajeRiesgo(['a','b','c','d'], cat).puntaje === 9, 'suma de pesos');

// ── 13 · Perímetro cefálico para la edad ───────────────────────────
titulo('13 · Perímetro cefálico para la edad (OMS 2006 · Res. 2465/2016)');
[ // [sexo, mes, z, cm publicado por la OMS]
  ['M',  0, -3, 30.7], ['M',  0, -2, 31.9], ['M',  0, 0, 34.5], ['M',  0, 2, 37.0],
  ['M', 12, -2, 43.5], ['M', 12,  0, 46.1], ['M', 12, 2, 48.6],
  ['M', 24, -2, 45.5], ['M', 24,  0, 48.3], ['M', 60, 0, 50.7], ['M', 60, 2, 53.7],
  ['F',  0, -2, 31.5], ['F',  0,  0, 33.9], ['F', 12, -2, 42.2], ['F', 12, 0, 44.9],
  ['F', 24,  0, 47.2], ['F', 60,  0, 49.9], ['F', 60, 2, 52.8]
].forEach(function (c) {
  var p = DNTAntro.buscarLMS(DNT_LMS.hcfa[c[0]], c[1]);
  casi(+DNTAntro.valorEnZ(p, c[2]).toFixed(1), c[3], 0.06,
       'PC ' + c[0] + ' mes ' + c[1] + ' en Z=' + c[2]);
});

// La tabla se indexa por meses cumplidos, igual que P/E y T/E.
var pcNino = { fecha_nac: '2025-09-17', sexo: 'M' };
function evalPC(fecha, pc) {
  return DNTAntro.evaluar({ fecha_nac: pcNino.fecha_nac, sexo: pcNino.sexo, fecha: fecha, pc_cm: pc });
}
casi(evalPC('2026-09-17', 46.1).z_pc, 0, 0.05, 'PC en la mediana de los 12 meses da Z ≈ 0');
ok(evalPC('2026-09-16', 46.1).edad_meses_cumplidos === 11,
   'un día antes del cumpleaños son 11 meses cumplidos, no 12');

ok(evalPC('2026-09-17', 43.4).clasificacion_pc.codigo === 'PC_BAJO',
   'por debajo de -2 DE → PC_BAJO', evalPC('2026-09-17', 43.4).z_pc);
ok(evalPC('2026-09-17', 46.1).clasificacion_pc.codigo === 'PC_ADECUADO', 'en la mediana → PC_ADECUADO');
ok(evalPC('2026-09-17', 48.7).clasificacion_pc.codigo === 'PC_ALTO',
   'por encima de +2 DE → PC_ALTO', evalPC('2026-09-17', 48.7).z_pc);
ok(evalPC('2026-09-17', null).z_pc === null, 'sin medida no inventa puntaje');

// El perímetro cefálico NO entra en la clasificación nutricional: la
// desnutrición aguda no se diagnostica por el tamaño de la cabeza.
var conPC = DNTAntro.evaluar({ fecha_nac: '2025-09-17', sexo: 'M', fecha: '2026-09-17',
                               peso_kg: 9.6, talla_cm: 75.7, pc_cm: 40 });
ok(conPC.clasificacion_pc.codigo === 'PC_BAJO', 'PC bajo se clasifica aparte');
ok(conPC.clasificacion_final === 'PESO_ADECUADO',
   'y no arrastra la clasificación nutricional', conPC.clasificacion_final);

// ── 14 · Perímetro abdominal ───────────────────────────────────────
titulo('14 · Perímetro abdominal');
var pa = DNTAntro.evaluar({ fecha_nac: '2025-09-17', sexo: 'M', fecha: '2026-09-17',
                            peso_kg: 9.6, talla_cm: 75.7, pa_cm: 45.4 });
casi(pa.perimetro_abdominal, 45.4, 0.001, 'se guarda el valor tal cual');
ok(pa.z_pc === null, 'no genera puntaje Z: no hay patrón OMS para menores de 5 años');
ok(pa.clasificacion_final === 'PESO_ADECUADO', 'tampoco toca la clasificación nutricional');
ok(DNTAntro.evaluar({ fecha_nac: '2025-09-17', sexo: 'M', fecha: '2026-09-17' })
     .perimetro_abdominal === null, 'sin medida queda en nulo');

// ── Garantía: los perímetros nuevos son complementarios ────────────
// Barrido sobre casos de cada clasificación. Para cada uno se evalúa sin los
// perímetros y luego con valores extremos, y todo lo que define el diagnóstico
// nutricional tiene que salir idéntico. Si alguien los mete en la clasificación
// más adelante, esta prueba se cae.
titulo('15 · Los perímetros nuevos no tocan el diagnóstico nutricional');
var DIAGNOSTICO = ['z_pt', 'z_pe', 'z_te', 'z_imc', 'clasificacion_final',
                   'clasificacion_final_criterio', 'tabla_pt', 'talla_usada'];
var BASES = [
  { n: 'severa por Z',        peso_kg:  6.0, talla_cm: 80,   pb_cm: 14 },
  { n: 'moderada por Z',      peso_kg:  8.2, talla_cm: 87,   pb_cm: 14 },
  { n: 'riesgo por Z',        peso_kg:  9.6, talla_cm: 88,   pb_cm: 14 },
  { n: 'adecuado',            peso_kg: 12.5, talla_cm: 88,   pb_cm: 15 },
  { n: 'severa por braquial', peso_kg: 12.5, talla_cm: 88,   pb_cm: 11.0 },
  { n: 'sobrepeso',           peso_kg: 16.0, talla_cm: 88,   pb_cm: 16 },
  { n: 'sin peso ni talla',   pb_cm: 11.0 }
];
var PERIMETROS = [
  { n: 'sin perímetros' },
  { n: 'PC muy bajo',   pc_cm: 36 },
  { n: 'PC muy alto',   pc_cm: 56 },
  { n: 'PA grande',     pa_cm: 80 },
  { n: 'los dos juntos', pc_cm: 36, pa_cm: 80 }
];
BASES.forEach(function (b) {
  var base = { fecha_nac: '2024-09-17', sexo: 'M', fecha: '2026-09-17',
               peso_kg: b.peso_kg, talla_cm: b.talla_cm, pb_cm: b.pb_cm, edema: 'ninguno' };
  var limpio = DNTAntro.evaluar(base);
  PERIMETROS.slice(1).forEach(function (pp) {
    var con = DNTAntro.evaluar(Object.assign({}, base, { pc_cm: pp.pc_cm, pa_cm: pp.pa_cm }));
    var distinto = DIAGNOSTICO.filter(function (k) { return con[k] !== limpio[k]; });
    ok(distinto.length === 0, b.n + ' + ' + pp.n + ': el diagnóstico no cambia',
       distinto.length ? 'cambió ' + distinto.join(', ') : '');
  });
});

// ── Resumen ────────────────────────────────────────────────────────
console.log('\n' + (fallos ? '✗ ' : '✓ ') + (pruebas - fallos) + '/' + pruebas + ' comprobaciones correctas');
process.exit(fallos ? 1 : 0);

# Decisiones clínicas del sistema

Este documento deja por escrito **cada decisión en la que el sistema tuvo que interpretar
la norma**, con su justificación. Sirve para auditoría y para que cualquiera pueda
cuestionar una decisión con conocimiento de causa.

---

## 1 · El componente de riesgo se aplica en Norte de Santander

La Resolución 115 de 2026 prioriza el abordaje del riesgo de desnutrición aguda
**inicialmente en La Guajira, Chocó y Vichada**. Norte de Santander no está en esa
priorización.

**Decisión institucional de la ESE HRNO:** se aplica igual. El sistema abre caso y hace
seguimiento nominal a los niños con Z P/T-L entre -2 y -1 DE.

---

## 2 · La clasificación toma el criterio más severo

El lineamiento define la clasificación por puntaje Z, pero también por perímetro braquial
y por edema. Cuando los tres no coinciden, **el sistema toma el más severo**.

Ejemplo: un niño con Z P/T-L de -0,5 (peso adecuado) pero con edema nutricional bilateral
se clasifica como **desnutrición aguda severa**. La ficha muestra siempre por cuál criterio
quedó clasificado.

| Criterio | Severa | Moderada |
|---|---|---|
| Z P/T-L | < -3 DE | ≥ -3 a < -2 DE |
| Perímetro braquial (6 a 59 meses) | < 11,5 cm | 11,5 a < 12,5 cm |
| Edema bilateral | cualquiera (+, ++, +++) | — |

**Nota sobre el perímetro braquial.** La tabla de la guía institucional ubica "PB < 12,5 cm"
en la fila de *riesgo*. El sistema aplica el punto de corte de la Res. 2350 de 2020 y de la
OMS: entre 11,5 y 12,5 cm es **desnutrición aguda moderada**. No hay contradicción, porque
al tomar el criterio más severo un niño con PB en ese rango queda clasificado al menos como
moderada, que es lo clínicamente prudente.

---

## 3 · La prueba de apetito: corrección de un error de maquetación

La tabla del lineamiento, tal como aparece impresa, sugiere que el rango de peso de
10,0 a 14,8 kg da **siempre** prueba negativa. Eso es un error de alineación de columnas.

El sistema aplica el criterio correcto:

- El **rango de peso determina el consumo mínimo** (¼, ⅓ o ½ sobre).
- El **resultado depende de si el niño alcanza ese mínimo** en 15 minutos.

Un niño de 12 kg que consume medio sobre tiene prueba **positiva**.

En niños mayores de 6 meses con **peso menor a 4 kg** la prueba no aplica: es criterio de
remisión inmediata.

---

## 4 · Seguimiento semanal para todos los casos

La Res. 115 de 2026 admite controles quincenales para el riesgo de desnutrición aguda y el
lineamiento pide cada 7 a 10 días en menores de 6 meses.

**Decisión institucional:** control **semanal** para todos los casos, por encima del mínimo
normativo. El sistema programa el próximo control a 7 días y marca como *vencido* todo lo
que pase de esa fecha.

---

## 5 · Los indicadores por edad se indexan por meses cumplidos

La Resolución 2465 de 2016 clasifica por **edad cumplida en meses**. El sistema hace lo
mismo, en vez de interpolar la edad decimal.

Esto se validó contra los 271 registros de los informes institucionales de enero a agosto
de 2026: con meses cumplidos, la concordancia en talla para la edad es del **97,4 %**;
con edad decimal cae al 87,1 %. La convención de meses cumplidos es la que usa el sistema
asistencial de la institución.

---

## 6 · Diferencias con la clasificación de los archivos importados

Al recalcular los 271 registros históricos con las tablas OMS, **8 casos (3 %)** quedaron
clasificados de forma distinta a como venían en el archivo. Todos son casos limítrofe:

| Documento | Edad | Talla | Peso | Z calculado | Sistema | Archivo |
|---|---|---|---|---|---|---|
| 1094586247 | 11 m | 71 cm | 6,8 kg | -3,042 | severa | moderada |
| 1181470206 | 2 m | 60 cm | 4,7 kg | -3,035 | severa | moderada |
| 1181469541 | 7 m | 65 cm | 5,9 kg | -2,073 | moderada | riesgo |
| 1094586159 | 12 m | 71 cm | 7,0 kg | -2,038 | moderada | riesgo |
| 1181470100 | 1 m | 60 cm | 4,9 kg | -2,055 | moderada | riesgo |
| 1120589613 | 30 m | 87 cm | 10,0 kg | -2,019 | moderada | riesgo |
| 1091686535 | 3 m | 61,5 cm | 5,2 kg | -2,088 | moderada | riesgo |
| 1092554225 | 43 m | 95 cm | 12,0 kg | -2,021 | moderada | riesgo |

Todos caen a menos de 0,09 DE del punto de corte, y **en todos el sistema clasifica más
severamente**, que es el sentido seguro del error. La causa probable es redondeo en el
sistema origen. **Vale la pena revisar clínicamente estos 8 casos.**

---

## 7 · Ítems del check-list que exigen soporte

De los 24 ítems, estos siete exigen adjuntar archivo cuando se marcan como *Cumple*:

| Ítem | Documento esperado |
|---|---|
| A5 | Registro de la prueba de apetito |
| A8 | Ficha de notificación al SIVIGILA |
| A9 | Prescripción MIPRES o acta de entrega de FTLC firmada |
| B6 | Carné de vacunación actualizado |
| C5 | Carné de vacunación al egreso |
| C7 | Oficio o constancia de canalización a ICBF o entidad territorial |
| C8 | Constancia de canalización a la RIAS (Res. 3280/2018) |

Los ocho ítems del check-list C son **obligatorios**: sin resolverlos no se cierra el caso.
El coordinador o el administrador pueden autorizar el egreso con pendientes, pero deben
escribir una justificación que queda en la auditoría y marcada en la ficha.

Algunos ítems sólo aplican bajo condición: A5 y B5 en niños de 6 a 59 meses, B4 en
desnutrición severa, C6 cuando hay hemoglobina registrada por debajo de 11 g/dL.

---

## 8 · Puntaje de factores de riesgo

16 factores con peso de 1 a 3 puntos, máximo 35. Niveles: **bajo** 0 a 5, **medio** 6 a 11,
**alto** 12 o más. El puntaje no cambia la clasificación nutricional: prioriza la agenda de
seguimiento y hace visible el contexto social del caso.

---

## 9 · Perímetro cefálico y perímetro abdominal

Los dos se registran en cada medición, pero **no significan lo mismo** y el sistema los trata
distinto a propósito.

**El perímetro cefálico sí tiene patrón.** Se compara con las tablas OMS 2006 de perímetro
cefálico para la edad (0 a 60 meses) y se clasifica con los cortes de la Resolución 2465 de
2016: bajo por debajo de −2 DE, adecuado entre −2 y +2, alto por encima de +2. El sistema
escribe *«bajo para la edad (evaluar microcefalia)»*, no *«microcefalia»*: la medida sola no
diagnostica: hay que confirmar la técnica de medición, la edad y la curva del niño.

**No entra en la clasificación nutricional.** La desnutrición aguda no se diagnostica por el
tamaño de la cabeza, así que el perímetro cefálico nunca cambia el resultado de P/T-L, del
perímetro braquial ni del edema. Se muestra aparte porque es el tamizaje de neurodesarrollo
que la ruta de promoción y mantenimiento pide en los menores de 2 años, y aquí ya se tienen
la edad y el sexo para calcularlo sin pedir nada más.

### Los dos perímetros son complementarios, y eso está blindado

Ni el cefálico ni el abdominal pueden mover el diagnóstico nutricional. No es una intención:
la verificación de los motores hace un barrido sobre casos de cada clasificación —severa,
moderada, riesgo, adecuado, sobrepeso, severa por perímetro braquial y un caso sin peso ni
talla— y comprueba que al añadir perímetros extremos no cambie **ninguno** de los campos que
definen el diagnóstico: `z_pt`, `z_pe`, `z_te`, `z_imc`, `clasificacion_final`, el criterio
que la produjo, la tabla usada y la talla corregida.

Si alguien más adelante mete estos perímetros en la clasificación, esa prueba se cae. En la
pantalla, además, las dos tarjetas quedan **fuera** del recuadro del cálculo nutricional y
llevan la leyenda «Medidas complementarias: no modifican la clasificación nutricional del
caso».

**El perímetro abdominal no tiene patrón de referencia** de la OMS para menores de 5 años, así
que no se le calcula puntaje Z ni se clasifica. Se guarda el valor y se muestra **cuánto
cambió desde el control anterior**: lo que informa es la tendencia —la distensión que
acompaña al edema o a la realimentación—, no el número suelto.

### Hallazgos al recalcular lo ya cargado

Los cinco informes institucionales traían el perímetro cefálico de las 271 atenciones, pero
nadie lo había comparado con el patrón. Al calcularlo:

| Clasificación | Mediciones |
|---|---|
| Adecuado para la edad | 247 |
| **Bajo para la edad** | **18** |
| Alto para la edad | 6 |

Los casos extremos —hasta −5,6 DE— **requieren revisión clínica antes de darlos por ciertos**.
Un perímetro de 38,0 cm a los 9 meses es posible, pero también es exactamente lo que se ve
cuando se transcribe mal una cifra o se mide con la cinta floja. Ninguno de estos valores
cambió la clasificación nutricional de su caso.

---

## 10 · Lo que el sistema no hace

- **No prescribe.** Las calculadoras de FTLC y de medicamentos son apoyo; no reemplazan la
  prescripción médica ni la valoración individual.
- **No notifica al SIVIGILA.** Registra que la notificación se hizo y guarda la ficha, pero
  la notificación se hace en el sistema oficial.
- **No consulta MIPRES.** Registra que la prescripción existe y guarda el soporte.
- **No maneja el escenario intrahospitalario.** Es un sistema de primer nivel: registra la
  remisión y el paquete de estabilización, no el manejo hospitalario ni la F-75 y F-100
  intrahospitalarias.

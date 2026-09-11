# FLOTA MM — Plan del aplicativo de gestión de vehículos de Misión Médica

> Borrador v0.1 · 11 sep 2026 · ESE Hospital Regional Noroccidental (HRNO)
> Responsable: Danilo Torrado Blanco — Coordinador de Salud Pública, Referente de Misión Médica
> Estado: **propuesta pendiente de decisiones** — ver §12 "Preguntas abiertas"

---

## 1. Qué se quiere construir

Un aplicativo para administrar la operación de los vehículos que trabajan bajo la figura de
**Misión Médica** (ambulancias, camionetas y demás medios de transporte protegidos por el DIH
y la Resolución 4481 de 2012), cubriendo:

- Inventario y hoja de vida de cada vehículo.
- Conductores y tripulación, con vigencias de licencia y cursos.
- Traslados/operaciones con **tiempos medidos por etapa**.
- **Contabilizador de días de operación** por vehículo y por conductor.
- **Responsable que autoriza** cada operación, con trazabilidad.
- **Registro de eventos** (bitácora operativa + auditoría del sistema).
- **Checklist de 5 emblemas/distintivos** por salida: bandera, chaleco, carnet,
  carta de presentación y un quinto ítem **por confirmar** (ver pregunta P3).
- **Validación de soportes firmados** (planillas de tiempos de operación).
- **Dashboard interactivo** con estadísticas comparativas entre vehículos.

---

## 2. Qué ya existe en el repositorio (no reinventar)

`MISIÓN MÉDICA/Mision_Medica_HRNO.html` ya cubre parcialmente este dominio y **hay que decidir
si el nuevo módulo lo extiende o lo reemplaza** (pregunta P2):

| Existente | Tabla actual | Relación con lo nuevo |
|-----------|--------------|------------------------|
| Seguimiento de emblemas en vehículos y edificios (posiciones techo / lateral / capó / trasero / frente, estados Bueno / Deteriorado / Ausente) | `mm_emblemas_seguimiento` | **Se superpone.** El checklist nuevo es *por salida*; el actual es *por activo*. Conviene conservar ambos y enlazarlos. |
| Reporte de desplazamiento (fecha/hora salida y regreso, municipio, lugar, actividad, n° de personas, responsable, autorización, concertación previa) | `mm_desplazamientos` | **Es el germen del módulo de operaciones.** Se migra y se amplía con tiempos por etapa, vehículo, conductor y km. |
| Inspección de personal y de IPS (uso de tarjeta, peto, extramural) | `mm_inspecciones`, `mm_inspeccion_personal` | Fuente de verificación cruzada del cumplimiento de emblemas. |
| Reporte de infracciones e incidentes DIH con radicado `RIICMM-AAAA-NNN` y PDF oficial | `mm_infracciones` | **Destino de escalamiento** de los eventos de orden público de la bitácora. |
| Carnets de identificación con foto y QR | `mm_solicitudes_carnet` | Fuente del ítem "carnet" del checklist: se valida contra el carnet real y su vigencia. |
| Riesgos y plan de contingencia | `mm_riesgos`, `mm_contingencia` | Contexto de seguridad de la ruta. |
| Solicitudes e inventario de emblemas | `mm_solicitudes_emblemas`, `mm_stock_emblemas` | Reposición automática cuando el checklist marca "ausente" o "deteriorado". |

Activos técnicos reutilizables ya presentes: `libs/chart.umd.min.js` (gráficas),
`libs/jspdf.umd.min.js` (PDF), `libs/xlsx.full.min.js` (Excel), `libs/jszip.min.js`,
`auth.js` + `superadmin.html` (sesión y roles), y el patrón PWA offline del Buscador CUPS.

---

## 3. Backend propuesto (gratuito, fluido, sin Supabase)

### 3.1 Comparación

| Opción | Costo real | Fluidez | Archivos (soportes firmados) | Tarjeta de crédito | Fricción de despliegue |
|--------|-----------|---------|------------------------------|--------------------|------------------------|
| **A. Cloudflare Workers + D1** | Gratis (100k req/día; D1 5 GB, ~5M lecturas/día) | **Alta** — SQL real, JSON/REST, CORS correcto, PoP en Bogotá → respuestas de decenas de ms | Vía Drive (Apps Script) o R2 | **No** para Workers+D1 | Media: un `wrangler deploy` inicial o GitHub Action |
| **B. Google Apps Script + Sheets + Drive** | Gratis | **Baja-media** — 0,5 a 2 s por operación, sin consultas reales, bloqueos de concurrencia | **Nativo** (Drive) | No | **Mínima** — ya lo usas en CertiVac y MM V13 |
| **C. Firebase (Firestore)** | Gratis en plan Spark | Alta, con sincronización en vivo | Firebase Storage **exige plan de pago** | No para Firestore, **sí** para Storage | Media |
| **D. Appwrite Cloud** | Gratis con límites | Media-alta | Incluido | No | Baja, pero es "otro Supabase" (mismo riesgo de proyecto pausado) |

> Nota: los límites de capa gratuita cambian con el tiempo. Verificar las cifras exactas al crear
> la cuenta; están anotadas aquí como orden de magnitud, no como compromiso contractual.

### 3.2 Recomendación

**Opción A + B combinadas:**

```
Navegador (PWA, HTML/JS vanilla, GitHub Pages)
   │
   ├── fetch JSON  →  Cloudflare Worker  →  D1 (SQLite)      ← datos operativos
   │                        │
   │                        └── valida token/rol, CORS, auditoría
   │
   ├── subida de archivo →  Apps Script  →  Google Drive      ← soportes firmados, fotos
   │
   └── IndexedDB (cola offline)  →  sincroniza al recuperar señal
```

Razones:

1. **Fluidez real.** D1 permite consultas SQL con agregaciones (`GROUP BY vehiculo`,
   percentiles de tiempos, ranking). Con Sheets habría que traer todo y calcular en el navegador,
   que es justo lo que hace lento al módulo actual.
2. **Sin tarjeta.** Workers + D1 no la piden; R2 sí, y por eso los archivos van a Drive.
3. **Los archivos quedan en Drive institucional**, donde el equipo administrativo ya sabe
   buscarlos y compartirlos para auditoría o pago a contratistas.
4. **Reutiliza el Apps Script MM V13** que ya está autorizado para enviar correo.
5. **No hay proyecto que se pause** por inactividad, que es el talón de Aquiles del esquema actual.

**Plan B si se quiere cero infraestructura nueva:** todo en Apps Script + Sheets + Drive.
Funciona bien hasta ~20 vehículos y ~50 operaciones/día, a costa de 1–2 s por operación.

---

## 4. Modelo de datos (esquema D1 / SQLite, borrador)

```sql
-- Activos ------------------------------------------------------------------
vehiculos(id, placa UNIQUE, numero_interno, tipo, subtipo, marca, linea, modelo_anio,
          color, capacidad, municipio_base, ips_asignada, propiedad, contratista,
          estado, km_actual, foto_url, qr_token, creado_en, activo)
          -- tipo: ambulancia | camioneta | moto | fluvial | otro
          -- subtipo ambulancia: TAB | TAM
          -- estado: activo | mantenimiento | fuera_servicio | taller | reserva

documentos_vehiculo(id, vehiculo_id, tipo, numero, expedicion, vencimiento,
                    archivo_url, estado_calculado)
          -- tipo: soat | rtm | tarjeta_propiedad | poliza | habilitacion_reps |
          --       desinfeccion | extintor | botiquin | kit_carretera | otro

conductores(id, nombres, apellidos, tipo_doc, numero_doc UNIQUE, telefono, correo,
            vinculacion, municipio, eps, arl, contacto_emergencia, foto_url,
            carnet_mm_id, estado, activo)

documentos_conductor(id, conductor_id, tipo, numero, categoria, expedicion,
                     vencimiento, archivo_url)
          -- tipo: licencia | curso_mision_medica | aph | examen_ocupacional | otro

asignaciones(id, vehiculo_id, conductor_id, rol, desde, hasta, turno)
          -- rol: conductor | auxiliar | medico | enfermeria

-- Operación ----------------------------------------------------------------
operaciones(id, consecutivo UNIQUE, vehiculo_id, conductor_id, tipo_operacion,
            municipio_origen, lugar_origen, municipio_destino, lugar_destino,
            ruta_concertada, fecha_concertacion,
            ts_solicitud, ts_autorizacion, ts_salida_base, ts_llegada_sitio,
            ts_salida_sitio, ts_llegada_destino, ts_disponible, ts_regreso_base,
            km_inicial, km_final, num_tripulantes,
            autorizador_id, autorizacion_medio, autorizacion_numero,
            estado, observaciones, creado_por, creado_en)
          -- tipo_operacion: traslado_asistencial_basico | medicalizado | remision |
          --   contrarremision | extramural_pic | brigada | biologicos_pai |
          --   muestras_lab | administrativo | otro
          -- estado: solicitada | autorizada | en_curso | finalizada | anulada | rechazada

checklist_emblemas(id, operacion_id, vehiculo_id, momento, item, estado,
                   cantidad, foto_url, observacion, registrado_por, registrado_en)
          -- momento: presalida | regreso
          -- item: bandera | chaleco | carnet | carta_presentacion | <5º por definir>
          -- estado: presente | ausente | deteriorado | no_aplica

checklist_alistamiento(id, operacion_id, item, estado, observacion)
          -- niveles, llantas, luces, frenos, comunicaciones, extintor, botiquin,
          -- camilla, oxigeno, aspirador, equipo_biomedico, aseo_desinfeccion

firmas(id, operacion_id, rol_firmante, nombre, documento, firma_png,
       ts_firma, geo_lat, geo_lon)

soportes(id, operacion_id, tipo, archivo_url, subido_por, subido_en,
         estado_validacion, validado_por, validado_en, motivo_rechazo,
         horas_declaradas, horas_soporte, discrepancia_min)
         -- estado_validacion: sin_soporte | cargado | en_revision | validado | rechazado

eventos(id, operacion_id, vehiculo_id, conductor_id, tipo, gravedad, ts_evento,
        municipio, lugar, descripcion, acciones, adjunto_url,
        escalado_a_infraccion, radicado_infraccion, registrado_por)
        -- tipo: varada | accidente | reten | bloqueo_via | derrumbe | orden_publico |
        --   falla_comunicaciones | negacion_paso | incidente_paciente | retraso |
        --   cancelacion | tanqueo | mantenimiento | cambio_conductor | novedad_emblema

-- Soporte logístico --------------------------------------------------------
mantenimientos(id, vehiculo_id, clase, km_evento, fecha_inicio, fecha_fin,
               taller, descripcion, repuestos, costo, dias_fuera_servicio)
               -- clase: preventivo | correctivo

tanqueos(id, vehiculo_id, fecha, galones, valor, km_odometro, estacion, factura_url)

dias_operacion(id, vehiculo_id, conductor_id, fecha, estado_dia, horas_operacion,
               num_operaciones, km_dia)
               -- estado_dia: operativo | disponible_sin_operacion | mantenimiento |
               --   fuera_servicio | no_programado

-- Gobierno -----------------------------------------------------------------
usuarios(id, nombre, correo, rol, municipio, activo)
         -- rol: conductor | coordinador_transporte | referente_mm | auditor | superadmin

auditoria(id, ts, usuario_id, accion, entidad, entidad_id, valor_antes, valor_despues, ip)
```

---

## 5. Módulos funcionales

### 5.1 Maestro de vehículos
Ficha completa, hoja de vida, foto, **QR pegado en el parabrisas** que abre directamente el
checklist móvil de ese vehículo. Semáforo de vencimientos documentales:
verde (> 30 días), amarillo (≤ 30 días), rojo (vencido). Un vehículo con SOAT o
habilitación vencida **no puede iniciar operación** sin excepción autorizada.

### 5.2 Conductores y tripulación
Hoja de vida, vigencia de licencia por categoría, curso de Misión Médica (requisito de la
Res. 4481), APH, exámenes ocupacionales, ARL. Enlace al carnet MM ya emitido en el módulo
existente. Mismo semáforo de vencimientos.

### 5.3 Operaciones y tiempos
Ocho marcas de tiempo por operación, de las que se derivan los KPIs:

| Indicador | Fórmula |
|-----------|---------|
| Tiempo de autorización | `ts_autorizacion − ts_solicitud` |
| Tiempo de respuesta | `ts_salida_base − ts_autorizacion` |
| Tiempo de desplazamiento al sitio | `ts_llegada_sitio − ts_salida_base` |
| Tiempo en escena | `ts_salida_sitio − ts_llegada_sitio` |
| Tiempo de transporte | `ts_llegada_destino − ts_salida_sitio` |
| Tiempo de ciclo total | `ts_regreso_base − ts_solicitud` |
| Horas fuera de base | `ts_regreso_base − ts_salida_base` |
| Kilómetros recorridos | `km_final − km_inicial` |

Dos modos de captura, según lo que se decida en P4: **cronómetro en vivo** (el conductor pulsa
"salí", "llegué"… desde el celular, con hora del servidor) o **digitación posterior** por el
coordinador a partir de la planilla firmada. El modo cronómetro es el que da datos confiables;
el modo digitación es el que refleja la operación actual en papel.

### 5.4 Checklist de emblemas (5 ítems)
Se ejecuta **antes de salir** y **al regresar**, sobre la operación concreta:

1. Bandera
2. Chaleco
3. Carnet
4. Carta de presentación
5. *(quinto ítem por confirmar — ver P3)*

Por ítem: estado, cantidad, foto de evidencia y observación. Regla dura propuesta:
**si falta un emblema, la operación no arranca**, salvo excepción autorizada por el referente
MM con justificación escrita, que queda registrada en la bitácora y en auditoría.
Todo ítem marcado "ausente" o "deteriorado" genera automáticamente una solicitud de reposición
contra `mm_stock_emblemas`.

### 5.5 Alistamiento del vehículo
Checklist técnico y biomédico complementario (niveles, llantas, luces, frenos, comunicaciones,
extintor, botiquín, camilla, oxígeno, aspirador, desinfección). Firma digital en pantalla del
conductor y del responsable, con hora y geolocalización opcional.

### 5.6 Autorización de la operación
Flujo `solicitada → autorizada → en curso → finalizada` (o `rechazada` / `anulada`), con
registro de **quién autorizó, cargo, fecha/hora, medio** (verbal, WhatsApp, correo, oficio) y
número de autorización. Notificación al autorizador cuando hay solicitudes pendientes.

### 5.7 Validación de soportes firmados
El conductor fotografía o escanea la planilla firmada de tiempos y la carga desde el celular.
Estados: `sin_soporte → cargado → en_revisión → validado / rechazado`.
El sistema **compara automáticamente las horas del sistema contra las horas del soporte** y
marca discrepancias mayores al umbral configurado. Genera además el formato oficial en PDF
listo para firmar, con consecutivo y QR de verificación, y el consolidado mensual por vehículo
o contratista para trámite de pago.

### 5.8 Contabilizador de días de operación
Un día cuenta como **operativo** si hubo al menos una operación finalizada; se distingue de
*disponible sin operación*, *mantenimiento*, *fuera de servicio* y *no programado*.
De ahí salen: días operativos acumulados (mes, trimestre, año), **% de disponibilidad de flota**,
y —si hay contrato por días— comparación contra días contratados con alerta de sobre o
subejecución.

### 5.9 Registro de eventos
**Bitácora operativa** (varada, accidente, retén, bloqueo de vía, orden público, negación de
paso, retraso, cancelación…) con gravedad, ubicación, acciones tomadas y adjuntos.
Los eventos de orden público ofrecen **escalamiento en un clic al Reporte de Infracciones DIH**
ya existente, reutilizando el radicado `RIICMM-AAAA-NNN` y su PDF oficial.

**Auditoría del sistema**: registro inmutable de quién creó, editó, autorizó o validó qué y
cuándo. Sin esto, los soportes digitales no tienen valor probatorio frente a un ente de control.

### 5.10 Mantenimiento, combustible y costos
Plan preventivo por kilometraje con alerta anticipada, órdenes correctivas con días fuera de
servicio (que alimentan la disponibilidad), tanqueos con **rendimiento km/galón por vehículo**
(detecta desviaciones), costo por traslado, por kilómetro y por municipio.

### 5.11 Dashboard interactivo
Tarjetas de KPI: operaciones del periodo, horas de operación, kilómetros, % disponibilidad,
tiempo promedio de respuesta, % de soportes validados, % de checklists completos, costo por km.

Gráficas (Chart.js, ya disponible offline en `libs/`):

- **Ranking de vehículos** por horas, operaciones, kilómetros y días operativos → responde
  directamente a "qué vehículos están trabajando más que otros".
- Serie de tiempo de operaciones por día y semana.
- Distribución por municipio y por tipo de operación.
- Mapa de calor día × hora (cuándo se concentra la demanda).
- Promedio y dispersión de cada etapa de tiempo, por vehículo.
- Pareto de eventos por tipo.
- Embudo de estados de los soportes.
- Cumplimiento de emblemas por vehículo (% de checklists completos).
- Semáforo de vencimientos documentales.

Filtros cruzados por rango de fechas, municipio, vehículo, conductor, tipo de operación y
autorizador; **comparador lado a lado** de dos o más vehículos; exportación a Excel (SheetJS) y
PDF (jsPDF); informe mensual generado automáticamente. Mapa opcional de orígenes y destinos con
Leaflet + OpenStreetMap (gratuito).

### 5.12 Roles, móvil y notificaciones
Roles: conductor, coordinador de transporte, referente MM (autorizador), auditor y superadmin,
sobre el `auth.js` existente. PWA instalable con **cola offline en IndexedDB** que sincroniza al
recuperar señal — indispensable en zona rural del Catatumbo. Notificaciones por correo
(Apps Script `MailApp` o Brevo, 300 correos/día gratis) para solicitudes pendientes,
vencimientos próximos y soportes sin cargar al cierre de mes.

---

## 6. Complementos sugeridos (no pedidos, pero de alto valor)

1. **Programación semanal de turnos** de vehículos y conductores, con detección de choques.
2. **Ficha pública por QR**: al escanear el QR del parabrisas, cualquier autoridad en un retén ve
   una página de verificación con el vehículo, su habilitación y sus emblemas vigentes —
   argumento de protección en terreno.
3. **Modo retén**: botón de pánico que registra evento, hora, ubicación y notifica al referente.
4. **Integración con el módulo PAI** para traslado de biológicos (cadena de frío).
5. **Indicador de concertación de ruta** con actores, cruzado con el módulo de riesgos.
6. **Cierre de mes asistido**: checklist de lo que falta (soportes, firmas, km) antes de reportar.
7. **Exportación del formato oficial** de horas para el pago a contratistas de transporte.

---

## 7. Marco normativo a respetar

- **Resolución 4481 de 2012** — Misión Médica, uso del emblema y distintivos.
- **Resolución 3100 de 2019** — habilitación de servicios, transporte asistencial TAB/TAM.
- **Ley 1581 de 2012 y Decreto 1377 de 2013** — datos personales. El módulo **no debe almacenar
  datos clínicos del paciente**; como máximo iniciales y documento cuando sea indispensable para
  el soporte de facturación, con justificación y acceso restringido por rol.
- **Ley 594 de 2000** — gestión documental y retención de soportes.

---

## 8. Fases de implementación propuestas

| Fase | Alcance | Resultado |
|------|---------|-----------|
| **0** | Decisiones de §12, creación de cuenta Cloudflare, esquema D1, Worker base con CORS y roles | Backend vivo y probado |
| **1** | Maestro de vehículos + conductores + documentos con semáforo de vencimientos | Inventario confiable |
| **2** | Operaciones con tiempos + autorización + checklist de 5 emblemas + alistamiento | Núcleo operativo |
| **3** | Soportes firmados, validación, firmas digitales, PDF oficial | Trazabilidad para pago |
| **4** | Contabilizador de días + dashboard interactivo + exportaciones | Toma de decisiones |
| **5** | Bitácora de eventos + escalamiento a infracciones + auditoría | Cierre del ciclo DIH |
| **6** | PWA offline, notificaciones, QR público, turnos | Operación en terreno |

---

## 9. Riesgos identificados

| Riesgo | Mitigación |
|--------|------------|
| Duplicidad con `mm_desplazamientos` y `mm_emblemas_seguimiento` | Definir en P2 si se migra, se enlaza o se reemplaza, **antes** de escribir código |
| Conectividad intermitente en zona rural | PWA + cola offline desde la fase 2, no al final |
| Conductores con baja alfabetización digital | Interfaz móvil de botones grandes, checklist de 5 toques, sin texto libre obligatorio |
| Datos sensibles de pacientes | Minimización por diseño y control por rol (§7) |
| Dependencia de una sola cuenta Google para correo y Drive | Documentar el procedimiento de reautorización y designar un suplente |
| Límites de capa gratuita | Monitoreo de consumo; el volumen esperado está muy por debajo de los topes |

---

## 10. Preguntas abiertas

### Decisiones de arquitectura
1. **Backend**: ¿Cloudflare Workers + D1 (recomendado), o todo en Apps Script + Sheets + Drive?
2. **Integración**: ¿módulo nuevo dentro de `Mision_Medica_HRNO.html`, archivo HTML aparte en
   `MISIÓN MÉDICA/`, o aplicación independiente? ¿Se migran los datos que ya están en
   `mm_desplazamientos` y `mm_emblemas_seguimiento`? ¿Se abandona Supabase solo para este módulo
   o para toda la app de Misión Médica?

### Alcance funcional
3. **¿Cuál es el quinto emblema/distintivo del checklist?** (peto, brazalete, adhesivo o
   distintivo del vehículo, casco, otro).
4. **¿Cómo se registran los tiempos?** ¿El conductor marca en vivo desde el celular, o el
   coordinador digita al final del día desde la planilla firmada?
5. ¿Cuántos vehículos y cuántos conductores hay hoy? ¿Cuántos traslados por día en promedio?
6. ¿Qué tipos de vehículo hay además de ambulancia y camioneta? ¿Hay transporte fluvial o motos?
7. ¿Los vehículos son propios del HRNO, contratados a terceros, o mixtos? Si hay contratistas,
   ¿el pago depende de días, horas o kilómetros? Eso define el consolidado de §5.7.
8. ¿Quién autoriza las operaciones? ¿Una sola persona, un cargo, o varía por municipio?
9. ¿Existe hoy un formato oficial de planilla de tiempos? Si sí, ¿puedes compartirlo para que el
   PDF generado lo replique exactamente, como se hizo con el formato ICRC de infracciones?
10. ¿Qué umbral de discrepancia entre horas del sistema y horas del soporte se considera aceptable?
11. ¿El checklist de emblemas se hace por salida, por turno o por día? ¿Y quién lo firma?
12. ¿Se debe bloquear la salida cuando falta un emblema, o solo advertir y registrar?

### Operación y datos
13. ¿Se registra kilometraje hoy? ¿Los vehículos tienen odómetro confiable?
14. ¿Hay control de combustible? ¿Con vale, tarjeta o factura?
15. ¿Se lleva ya un plan de mantenimiento preventivo? ¿Por kilómetros o por tiempo?
16. ¿Qué datos del paciente se necesitan realmente en el traslado, considerando la Ley 1581?
17. ¿Hay GPS instalado en los vehículos? Si lo hay, ¿de qué proveedor y expone alguna API?
18. ¿Los municipios cubiertos siguen siendo Ábrego, Convención, El Carmen y Teorama?

### Usuarios y despliegue
19. ¿Cuántas personas usarían el sistema y con qué roles?
20. ¿Los conductores tienen teléfono inteligente con datos? ¿De qué operador y con qué cobertura?
21. ¿Se mantiene el hosting en GitHub Pages y el acceso por contraseña institucional, o se
    requiere inicio de sesión individual por usuario?
22. ¿A qué correos deben llegar las alertas y con qué frecuencia?
23. ¿Hay una fecha límite o un compromiso institucional asociado a esta herramienta?

---

*Documento de planeación — ESE Hospital Regional Noroccidental · Coordinación de Salud Pública*

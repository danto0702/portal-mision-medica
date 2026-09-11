# PROJECT.md — Flota Vehicular HRNO

> Borrador v0.2 · 11 sep 2026 · ESE Hospital Regional Noroccidental
> Responsable: Danilo Torrado Blanco — Coordinador de Salud Pública
> Estado: **plan aprobado en sus decisiones de arquitectura**, pendiente de las preguntas de §11

---

## 1. Qué es

Aplicación **independiente** del Portal de Salud Pública para administrar la operación de los
vehículos del HRNO que trabajan bajo la figura de **Misión Médica** (protegidos por el DIH y la
Resolución 4481 de 2012).

Cubre inventario de vehículos, conductores y tripulación, traslados con **tiempos medidos en vivo**,
contabilizador de días de operación, autorización de cada operación, bitácora de eventos,
**checklist de distintivos y elementos**, validación de soportes firmados y un **dashboard
interactivo** para comparar el desempeño entre vehículos.

### Ubicación en el repositorio

```
portal-salud-publica-hrno/
└── FLOTA VEHICULAR/
    ├── index.html          ← aplicación (SPA, HTML/JS vanilla, PWA)
    ├── sw.js               ← service worker (offline)
    ├── manifest.json
    ├── worker/             ← backend Cloudflare (Worker + esquema D1)
    ├── PROJECT.md          ← este documento
    ├── AI.md               ← detalle técnico
    └── DESIGN.md           ← sistema visual
```

Se registra como un módulo más en `index.html` y en `index_Principal_Salud_Publica.html`.

---

## 2. Decisiones tomadas

| # | Decisión | Valor |
|---|----------|-------|
| D1 | Backend | **Cloudflare Workers + D1** (SQL en el borde, gratis, sin tarjeta) |
| D2 | Relación con el módulo de Misión Médica | **Ninguna.** Aplicación autónoma, sin leer ni escribir tablas `mm_*`, sin Supabase |
| D3 | Catálogos (municipios, IPS, personas) | **Propios y duplicados** dentro de esta aplicación |
| D4 | Checklist | **5 distintivos por posición del vehículo + 4 elementos adicionales** (ver §5.4) |
| D5 | Captura de tiempos | **El conductor marca en vivo desde el celular**, con hora del servidor |

Consecuencia de D5: la aplicación nace como **PWA con cola offline** desde la primera fase.
No es un añadido posterior — en zona rural del Catatumbo, sin ella el registro en vivo no funciona.

Consecuencia de D2 y D3: lo único que se reutiliza del resto del repositorio es **código y
patrones**, nunca datos: `libs/chart.umd.min.js`, `libs/jspdf.umd.min.js`, `libs/xlsx.full.min.js`,
el patrón de service worker del Buscador CUPS y el estilo institucional del portal.

---

## 3. Arquitectura

```
Navegador / celular (PWA, HTML + JS vanilla, GitHub Pages)
   │
   ├── IndexedDB  ──► cola offline de marcas de tiempo y checklists
   │                   (se sincroniza automáticamente al recuperar señal)
   │
   ├── fetch JSON ──► Cloudflare Worker ──► D1 (SQLite)
   │                        │                  datos operativos
   │                        ├── autenticación por token + rol
   │                        ├── hora del servidor para cada marca
   │                        └── escritura en tabla de auditoría
   │
   └── subida de archivos ──► Apps Script "Flota HRNO" ──► Google Drive + Gmail
                                (proyecto nuevo, independiente del MM V13)
```

**Por qué Cloudflare Workers + D1**

1. SQL real: el ranking de vehículos, los promedios por etapa de tiempo y el contador de días
   se calculan en el servidor con `GROUP BY`, no trayendo todo al navegador.
2. Latencia de decenas de milisegundos (hay punto de presencia en Bogotá) — el conductor pulsa
   "salí de base" y la marca queda registrada al instante.
3. Capa gratuita sin tarjeta de crédito: ~100.000 peticiones/día en Workers, 5 GB en D1.
   El volumen esperado está órdenes de magnitud por debajo.
4. No hay proyecto que se pause por inactividad.

**Por qué los archivos van a Drive y no a R2**: Cloudflare R2 exige registrar un medio de pago
aunque la capa sea gratuita. Drive no, y además deja los soportes firmados donde el equipo
administrativo ya sabe buscarlos para auditoría y para el trámite de pago.

> Los límites de capa gratuita cambian con el tiempo. Verificar las cifras al crear la cuenta.

---

## 4. Modelo de datos (D1 / SQLite — borrador)

### 4.1 Catálogos propios

```sql
cat_municipios(id, nombre, codigo_dane, activo)

cat_ips(id, municipio_id, nombre, tipo, codigo_reps, activo)
        -- tipo: ips | puesto_salud | centro_salud | hospital

personas(id, tipo_doc, numero_doc UNIQUE, nombres, apellidos, telefono, correo,
         cargo, vinculacion, municipio_id, ips_id, foto_url,
         es_conductor, es_tripulante, es_autorizador, activo)
         -- vinculacion: planta | contrato | ops | tercero

documentos_persona(id, persona_id, tipo, numero, categoria, expedicion,
                   vencimiento, archivo_url)
         -- tipo: licencia_conduccion | curso_mision_medica | aph |
         --       examen_ocupacional | arl | otro
```

### 4.2 Activos

```sql
vehiculos(id, placa UNIQUE, numero_interno, tipo, subtipo, marca, linea, modelo_anio,
          color, capacidad, municipio_base_id, ips_asignada_id, propiedad, contratista,
          estado, km_actual, foto_url, qr_token, creado_en, activo)
          -- tipo: ambulancia | camioneta | moto | fluvial | otro
          -- subtipo (ambulancia): TAB | TAM
          -- propiedad: propio | contratado | comodato
          -- estado: activo | mantenimiento | fuera_servicio | taller | reserva

documentos_vehiculo(id, vehiculo_id, tipo, numero, expedicion, vencimiento, archivo_url)
          -- tipo: soat | rtm | tarjeta_propiedad | poliza | habilitacion_reps |
          --       desinfeccion | extintor | botiquin | kit_carretera | otro

asignaciones(id, vehiculo_id, persona_id, rol, desde, hasta, turno)
          -- rol: conductor | auxiliar | medico | enfermeria
```

### 4.3 Operación

```sql
operaciones(id, consecutivo UNIQUE, vehiculo_id, conductor_id, tipo_operacion,
            municipio_origen_id, lugar_origen, municipio_destino_id, lugar_destino,
            ruta_concertada, fecha_concertacion,
            ts_solicitud, ts_autorizacion, ts_salida_base, ts_llegada_sitio,
            ts_salida_sitio, ts_llegada_destino, ts_disponible, ts_regreso_base,
            km_inicial, km_final, num_tripulantes,
            autorizador_id, autorizacion_medio, autorizacion_numero,
            estado, observaciones, creado_por, creado_en)
            -- tipo_operacion: traslado_asistencial_basico | medicalizado | remision |
            --   contrarremision | extramural | brigada | biologicos | muestras_lab |
            --   administrativo | otro
            -- estado: solicitada | autorizada | en_curso | finalizada | anulada | rechazada

marcas_tiempo(id, operacion_id, hito, ts_servidor, ts_dispositivo, origen,
              geo_lat, geo_lon, registrado_por)
              -- hito: salida_base | llegada_sitio | salida_sitio | llegada_destino |
              --       disponible | regreso_base
              -- origen: en_linea | offline_sincronizado | digitado_por_coordinador
```

> `marcas_tiempo` es la fuente de verdad auditable; las columnas `ts_*` de `operaciones` son
> una desnormalización para consultar rápido. `origen` permite distinguir el dato marcado en vivo
> del que se sincronizó tarde o se digitó a mano — sin eso, el registro en vivo no es defendible.

### 4.4 Checklist

```sql
checklists(id, operacion_id, vehiculo_id, momento, ts, registrado_por,
           completo, excepcion_autorizada, justificacion_excepcion, autorizado_por)
           -- momento: presalida | regreso

checklist_items(id, checklist_id, bloque, item, estado, cantidad, foto_url, observacion)
           -- bloque: distintivo_vehiculo | elemento
           -- item (distintivo_vehiculo): lateral_izquierdo | lateral_derecho |
           --                             frontal | trasero | techo
           -- item (elemento): bandera | chaleco | carnet | carta_presentacion
           -- estado (distintivo): bueno | deteriorado | ausente | obstruido
           -- estado (elemento):   presente | deteriorado | ausente | vencido

checklist_alistamiento(id, operacion_id, item, estado, observacion)
           -- niveles, llantas, luces, frenos, comunicaciones, extintor, botiquin,
           -- camilla, oxigeno, aspirador, equipo_biomedico, aseo_desinfeccion

firmas(id, operacion_id, rol_firmante, persona_id, nombre, documento,
       firma_png, ts_firma, geo_lat, geo_lon)
```

### 4.5 Soportes, eventos y logística

```sql
soportes(id, operacion_id, tipo, archivo_url, subido_por, subido_en,
         estado_validacion, validado_por, validado_en, motivo_rechazo,
         horas_sistema, horas_soporte, discrepancia_min)
         -- estado_validacion: sin_soporte | cargado | en_revision | validado | rechazado

eventos(id, operacion_id, vehiculo_id, persona_id, tipo, gravedad, ts_evento,
        municipio_id, lugar, descripcion, acciones, adjunto_url, registrado_por)
        -- tipo: varada | accidente | reten | bloqueo_via | derrumbe | orden_publico |
        --   falla_comunicaciones | negacion_paso | incidente_paciente | retraso |
        --   cancelacion | tanqueo | mantenimiento | cambio_conductor | novedad_distintivo

mantenimientos(id, vehiculo_id, clase, km_evento, fecha_inicio, fecha_fin, taller,
               descripcion, repuestos, costo, dias_fuera_servicio)

tanqueos(id, vehiculo_id, fecha, galones, valor, km_odometro, estacion, factura_url)

dias_operacion(id, vehiculo_id, persona_id, fecha, estado_dia, horas_operacion,
               num_operaciones, km_dia)
               -- estado_dia: operativo | disponible_sin_operacion | mantenimiento |
               --   fuera_servicio | no_programado
```

### 4.6 Gobierno

```sql
usuarios(id, persona_id, correo, token_hash, rol, municipio_id, activo, ultimo_acceso)
         -- rol: conductor | coordinador | autorizador | auditor | superadmin

auditoria(id, ts, usuario_id, accion, entidad, entidad_id, valor_antes, valor_despues)
```

---

## 5. Módulos funcionales

### 5.1 Maestro de vehículos
Ficha y hoja de vida por vehículo, con foto y **QR pegado en el parabrisas** que abre directamente
el checklist móvil de ese vehículo. Semáforo de vencimientos documentales: verde (> 30 días),
amarillo (≤ 30 días), rojo (vencido). Un vehículo con SOAT, técnico-mecánica o habilitación
vencida **no puede iniciar operación** sin excepción autorizada y justificada.

### 5.2 Personas: conductores, tripulación y autorizadores
Una sola tabla `personas` con banderas de rol, para no duplicar a quien es conductor y a la vez
tripulante. Vigencia de licencia por categoría, **curso de Misión Médica** (requisito de la
Res. 4481), APH, exámenes ocupacionales y ARL, con el mismo semáforo de vencimientos.

### 5.3 Operaciones y tiempos — marcación en vivo (D5)
El conductor abre la operación en el celular y marca seis hitos con botones grandes:

```
[ SALÍ DE BASE ]  [ LLEGUÉ AL SITIO ]  [ SALÍ DEL SITIO ]
[ LLEGUÉ A DESTINO ]  [ DISPONIBLE ]  [ REGRESÉ A BASE ]
```

Reglas de confiabilidad:

- La hora que vale es la **del servidor**, no la del teléfono (que el usuario puede cambiar).
- Sin señal, la marca se guarda en IndexedDB con la hora del dispositivo y se sincroniza después;
  queda registrada como `offline_sincronizado` y el dashboard la distingue visualmente.
- Geolocalización opcional por marca, si el usuario la concede.
- Los hitos solo avanzan hacia adelante; corregir una marca es una acción de coordinador que
  queda en auditoría con el valor anterior.

Indicadores derivados:

| Indicador | Fórmula |
|-----------|---------|
| Tiempo de autorización | `ts_autorizacion − ts_solicitud` |
| Tiempo de respuesta | `ts_salida_base − ts_autorizacion` |
| Desplazamiento al sitio | `ts_llegada_sitio − ts_salida_base` |
| Tiempo en escena | `ts_salida_sitio − ts_llegada_sitio` |
| Tiempo de transporte | `ts_llegada_destino − ts_salida_sitio` |
| Ciclo total | `ts_regreso_base − ts_solicitud` |
| Horas fuera de base | `ts_regreso_base − ts_salida_base` |
| Kilómetros | `km_final − km_inicial` |

### 5.4 Checklist de distintivos y elementos (D4)

Se ejecuta **antes de salir** y **al regresar**, sobre la operación concreta. Dos bloques:

**Bloque A — Distintivos del vehículo (5 posiciones)**

| # | Posición | Estados |
|---|----------|---------|
| 1 | Lateral izquierdo | bueno · deteriorado · ausente · obstruido |
| 2 | Lateral derecho | bueno · deteriorado · ausente · obstruido |
| 3 | Frontal | bueno · deteriorado · ausente · obstruido |
| 4 | Trasero | bueno · deteriorado · ausente · obstruido |
| 5 | Techo | bueno · deteriorado · ausente · obstruido |

El estado **obstruido** es deliberado: un distintivo tapado por barro, equipaje o una lona no
protege, y en términos de DIH equivale a no tenerlo. Cada posición admite foto de evidencia.

**Bloque B — Elementos adicionales (4)**

| # | Elemento | Estados | Cantidad |
|---|----------|---------|----------|
| 6 | Bandera | presente · deteriorado · ausente | 1 por vehículo |
| 7 | Chaleco | presente · deteriorado · ausente | según n° de tripulantes |
| 8 | Carnet | presente · ausente · vencido | 1 por tripulante |
| 9 | Carta de presentación | presente · ausente · vencida | 1 por operación |

**Regla de bloqueo propuesta**: si algún ítem queda en `ausente`, `obstruido` o `vencido`, la
operación no arranca, salvo **excepción autorizada** por el coordinador o el autorizador con
justificación escrita, que queda en la bitácora y en auditoría. Todo ítem `ausente` o
`deteriorado` genera automáticamente una solicitud de reposición.

El checklist de regreso permite comparar el estado antes y después, y detectar el distintivo que
se perdió o se dañó en ruta.

### 5.5 Alistamiento del vehículo
Checklist técnico y biomédico complementario (niveles, llantas, luces, frenos, comunicaciones,
extintor, botiquín, camilla, oxígeno, aspirador, desinfección), con firma digital en pantalla del
conductor y del responsable, hora y geolocalización opcional.

### 5.6 Autorización de la operación
Flujo `solicitada → autorizada → en curso → finalizada` (o `rechazada` / `anulada`), registrando
**quién autorizó, su cargo, fecha y hora, el medio** (verbal, WhatsApp, correo, oficio) y el
número de autorización. Notificación al autorizador cuando hay solicitudes pendientes, y tablero
propio de "pendientes por autorizar".

### 5.7 Validación de soportes firmados
El conductor fotografía o escanea la planilla firmada de tiempos y la carga desde el celular.
Estados: `sin_soporte → cargado → en_revisión → validado / rechazado`, con registro de quién
validó y cuándo.

El sistema **compara las horas registradas en vivo contra las horas del soporte firmado** y marca
las discrepancias que superen el umbral configurado. Genera además el formato oficial en PDF listo
para firmar, con consecutivo y QR de verificación, y el consolidado mensual por vehículo o
contratista para el trámite de pago.

### 5.8 Contabilizador de días de operación
Un día cuenta como **operativo** si hubo al menos una operación finalizada, y se distingue de
*disponible sin operación*, *mantenimiento*, *fuera de servicio* y *no programado*. De ahí salen
los días operativos acumulados por mes, trimestre y año, el **porcentaje de disponibilidad de la
flota**, y —si hay contrato por días— la comparación contra días contratados con alerta de sobre
o subejecución.

### 5.9 Registro de eventos
**Bitácora operativa**: varada, accidente, retén, bloqueo de vía, derrumbe, orden público,
negación de paso, incidente con paciente, retraso, cancelación, tanqueo, mantenimiento, cambio de
conductor y novedad de distintivo. Cada evento con gravedad, ubicación, acciones tomadas y
adjuntos, vinculado a la operación y al vehículo.

**Auditoría del sistema**: registro inmutable de quién creó, editó, autorizó o validó qué y
cuándo, con valor anterior y posterior. Sin esto, los soportes digitales no tienen valor
probatorio frente a un ente de control.

### 5.10 Mantenimiento, combustible y costos
Plan preventivo por kilometraje con alerta anticipada; órdenes correctivas con días fuera de
servicio que alimentan la disponibilidad; tanqueos con **rendimiento km/galón por vehículo** para
detectar desviaciones; costo por traslado, por kilómetro y por municipio.

### 5.11 Dashboard interactivo

Tarjetas de indicador: operaciones del periodo, horas de operación, kilómetros, % de
disponibilidad, tiempo promedio de respuesta, % de soportes validados, % de checklists completos
y costo por kilómetro.

Gráficas (Chart.js, ya disponible offline en el repositorio):

- **Ranking de vehículos** por horas, operaciones, kilómetros y días operativos → responde
  directamente a *qué vehículos están trabajando más que otros*.
- Serie de tiempo de operaciones por día y por semana.
- Distribución por municipio y por tipo de operación.
- Mapa de calor día × hora, para ver cuándo se concentra la demanda.
- Promedio y dispersión de cada etapa de tiempo, comparada entre vehículos.
- Pareto de eventos por tipo.
- Embudo de estados de los soportes.
- Cumplimiento del checklist por vehículo, separando los 5 distintivos de los 4 elementos.
- Semáforo consolidado de vencimientos de vehículos y personas.

Filtros cruzados por rango de fechas, municipio, vehículo, conductor, tipo de operación y
autorizador; **comparador lado a lado** de dos o más vehículos; exportación a Excel y PDF; informe
mensual generado automáticamente. Mapa opcional de orígenes y destinos con Leaflet +
OpenStreetMap, gratuito.

### 5.12 Roles, móvil y notificaciones
Roles: conductor, coordinador, autorizador, auditor y superadmin. PWA instalable con cola offline
en IndexedDB. Notificaciones por correo (Apps Script propio o Brevo, 300 correos/día gratis) para
solicitudes pendientes de autorización, vencimientos próximos y soportes sin cargar al cierre de mes.

---

## 6. Complementos sugeridos

1. **Programación semanal de turnos** de vehículos y conductores, con detección de choques.
2. **Ficha pública por QR**: al escanear el QR del parabrisas, cualquier autoridad en un retén ve
   una página de verificación con el vehículo, su habilitación y el estado de sus distintivos.
   Es un argumento de protección en terreno, no solo un registro administrativo.
3. **Modo retén**: botón que registra evento, hora y ubicación, y notifica al coordinador.
4. **Cierre de mes asistido**: lista de lo que falta (soportes, firmas, kilometrajes) antes de reportar.
5. **Alerta de distintivo reincidente**: si una misma posición aparece ausente u obstruida tres
   veces en un mes, se escala como novedad de mantenimiento.
6. **Exportación del formato oficial de horas** para el pago a contratistas de transporte.

---

## 7. Marco normativo

- **Resolución 4481 de 2012** — Misión Médica, uso del emblema y distintivos.
- **Resolución 3100 de 2019** — habilitación de servicios, transporte asistencial TAB/TAM.
- **Ley 1581 de 2012** y **Decreto 1377 de 2013** — datos personales. La aplicación **no almacena
  datos clínicos del paciente**; como máximo iniciales y documento cuando sean indispensables para
  el soporte de facturación, con acceso restringido por rol.
- **Ley 594 de 2000** — gestión documental y retención de soportes.

---

## 8. Fases de implementación

| Fase | Alcance | Resultado |
|------|---------|-----------|
| **0** | Cuenta Cloudflare, esquema D1, Worker base con CORS, autenticación por rol y auditoría | Backend vivo y probado |
| **1** | Catálogos propios + maestro de vehículos + personas + documentos con semáforo | Inventario confiable |
| **2** | Operaciones, **marcación en vivo**, PWA con cola offline, checklist de 9 ítems, alistamiento | Núcleo operativo en terreno |
| **3** | Autorización, soportes firmados, validación, firmas digitales, PDF oficial | Trazabilidad para pago |
| **4** | Contabilizador de días + dashboard interactivo + exportaciones | Toma de decisiones |
| **5** | Bitácora de eventos, mantenimiento, combustible y costos | Ciclo completo |
| **6** | QR público, turnos, notificaciones, informe mensual automático | Consolidación |

---

## 9. Riesgos

| Riesgo | Mitigación |
|--------|------------|
| Conectividad intermitente en zona rural | PWA con cola offline desde la fase 2, no al final |
| Conductores con baja alfabetización digital | Seis botones grandes, checklist de toques, sin texto libre obligatorio |
| Marcas de tiempo manipulables | Hora del servidor, campo `origen`, correcciones solo por coordinador y con auditoría |
| Datos sensibles de pacientes | Minimización por diseño y control por rol (§7) |
| Catálogos duplicados que se desactualizan | Pantalla de administración propia y exportación/importación por Excel |
| Dependencia de una cuenta Google para Drive y correo | Documentar la reautorización y designar un suplente |
| Límites de capa gratuita | Monitoreo de consumo; el volumen esperado está muy por debajo de los topes |

---

## 10. Preguntas abiertas

### Alcance y operación
1. ¿Cuántos vehículos y cuántos conductores hay hoy? ¿Cuántos traslados por día en promedio?
2. ¿Qué tipos de vehículo hay además de ambulancia y camioneta? ¿Hay transporte fluvial o motos?
3. ¿Los vehículos son propios del HRNO, contratados a terceros, o mixtos? Si hay contratistas,
   ¿el pago depende de días, horas o kilómetros? Eso define el consolidado de §5.7.
4. ¿Quién autoriza las operaciones: una sola persona, un cargo, o varía por municipio?
5. ¿Existe hoy un formato oficial de planilla de tiempos? Si sí, compartirlo para que el PDF
   generado lo replique exactamente.
6. ¿Qué diferencia de minutos entre la hora del sistema y la del soporte firmado es aceptable?
7. ¿El checklist se hace por cada salida, por turno o una vez al día? ¿Quién lo firma?
8. ¿Se bloquea la salida cuando falta un distintivo, o solo se advierte y se registra?
9. Los elementos del bloque B (carnet, chaleco, carta) son por persona y la carta puede ser por
   operación: ¿se verifican por cada tripulante o basta una verificación global del vehículo?
10. ¿La "carta de presentación" tiene vigencia o se emite por cada salida?

### Datos
11. ¿Se registra kilometraje hoy? ¿Los odómetros son confiables?
12. ¿Hay control de combustible, con vale, tarjeta o factura?
13. ¿Existe plan de mantenimiento preventivo? ¿Por kilómetros o por tiempo?
14. ¿Qué datos del paciente se necesitan realmente, considerando la Ley 1581?
15. ¿Hay GPS instalado en los vehículos? Si lo hay, ¿de qué proveedor y expone alguna API?
16. ¿Los municipios siguen siendo Ábrego, Convención, El Carmen y Teorama? ¿Con qué IPS cada uno?

### Usuarios y despliegue
17. ¿Cuántas personas usarían el sistema y con qué roles?
18. ¿Los conductores tienen teléfono inteligente con datos? ¿Qué operador y qué cobertura?
19. ¿Acceso con una contraseña institucional compartida, o inicio de sesión individual por usuario?
    Para que la auditoría sirva, debería ser individual al menos para conductores y autorizadores.
20. ¿A qué correos deben llegar las alertas y con qué frecuencia?
21. ¿Hay fecha límite o compromiso institucional asociado a esta herramienta?

---

*Documento de planeación — ESE Hospital Regional Noroccidental · Coordinación de Salud Pública*

# AI.md — Portal Salud Pública HRNO
> Contexto técnico para sesiones de Claude Code. Actualizar cuando cambie la arquitectura.
> Última revisión: Junio 2026

---

## Repositorio y despliegue

| Item | Valor |
|------|-------|
| Repo GitHub | `https://github.com/danto0702/portal-salud-publica-hrno` |
| GitHub Pages | `https://danto0702.github.io/portal-salud-publica-hrno/` |
| Rama activa | `main` (GitHub Pages sirve desde la raíz de `main`) |
| Working dir local | `C:\Users\danto\Desktop\DANILO 2026\PORTAL SALUD PÚBLICA\` |
| Email del usuario | `danto0702@gmail.com` |

**Importante:** GitHub Pages tiene caché CDN de 1–5 min. Después de un push, pedir hard-refresh con `Ctrl+Shift+R`. Si una corrección no se refleja en el iframe de `CertiVac.html`, abrir la URL del archivo directamente y hacer hard-refresh también ahí.

---

## Estructura de archivos (producción)

```
PORTAL SALUD PÚBLICA/               ← raíz del repo
│
├── index.html                      ← Portal principal (landing page GitHub Pages)
├── index_Principal_Salud_Publica.html  ← Versión local del portal principal
│
├── PAI/                            ← Plan Ampliado de Inmunizaciones
│   ├── index.html                  ← Página de módulo PAI
│   ├── Analizador_PAI_HRNO.html   ← Analizador vacunación niños/niñas (✅ validado, NO tocar)
│   ├── CertiVac.html              ← Sistema certificados PAI (incluye Analizador en iframe)
│   ├── CertiVac_Backend.gs        ← Google Apps Script backend de CertiVac
│   ├── CertiVac_BD_Template.xlsx  ← Plantilla base de datos Google Sheets
│   ├── CertiVac_docs/             ← Documentación técnica del sistema CertiVac
│   │   ├── API_ENDPOINTS.md
│   │   ├── ARQUITECTURA.md
│   │   ├── CHANGELOG.md
│   │   ├── ESQUEMA_BD.md
│   │   ├── GUIA_DESPLIEGUE.md
│   │   └── MODULOS.md
│   ├── METAS TRAZADORES *.xlsx    ← Metas por mes (varios archivos)
│   ├── METAS VACUNACIÓN *.xlsx    ← Por municipio
│   ├── Consolidado_NinosNinas_PAI.xlsx  ← Consolidado exportado
│   ├── libs/
│   │   ├── chart.umd.min.js       ← Chart.js (offline) ← USAR ESTA, no CDN
│   │   └── xlsx.full.min.js       ← SheetJS (offline) ← USAR ESTA, no CDN
│   └── REGISTROS DIARIOS DE VACUNACIÓN/
│       └── REGISTROS DIARIOS DE VACUNACIÓN/
│           ├── ABREGO/
│           ├── CONVENCIÓN/
│           ├── EL CARMEN/
│           └── TEORAMA/
│               └── [archivos .xls mensuales por municipio]
│
├── VIGILANCIA SP/                  ← Vigilancia Epidemiológica
│   ├── SIVIGILA_Monitor_v2.html   ← Monitor SIVIGILA (✅ activo, versión actual)
│   ├── SIVIGILA_Monitor.html      ← Versión anterior (deprecada)
│   ├── ABREGO SIVIGILA/           ← Datos históricos Ábrego
│   ├── CONVENCION SIVIGILA/
│   │   └── REPORTE DE SIVIGILA AÑO 20{23,24,25,26}.xlsx
│   ├── EL CARMEN SIVIGILA/
│   │   └── REPORTE SIVIGILA IPS EL CARMEN/
│   │       └── REPORTE SIVIGILA 20{23,24,25,26}.xlsx
│   └── TEORAMA SIVIGILA/
│       └── 20{23,24,25,26}_Reporte.xlsx
│
├── MISIÓN MÉDICA/
│   └── Modulo_Identificacion_Mision_Medica.html
│
├── HERRAMIENTAS/                   ← Scripts y herramientas locales
│   ├── Consolidador_PAI.html
│   ├── consolidar_pai.py
│   └── xlsx.full.min.js
│
├── HERRAMIENTAS INTEROPERABLES/    ← Apps complementarias
│   ├── Buscador_CUPS.html
│   ├── DiagramFlow.html
│   └── PCI-App/
│       ├── index.html
│       ├── app.js
│       ├── PCI_Backend.gs
│       ├── service-worker.js
│       └── manifest.json
│
├── Generador CUPS/                 ← PWA buscador de códigos CUPS (sub-proyecto)
│   ├── index.html                  ← PWA principal
│   ├── Buscador_CUPS.html
│   ├── cups_data.json              ← Base de datos CUPS embebida
│   ├── manifest.json
│   ├── sw.js
│   └── build_pwa.py               ← Script de build para PWA
│
├── libs/                           ← Librerías offline compartidas (raíz)
│   ├── chart.umd.min.js
│   └── xlsx.full.min.js
│
└── README.md
```

**Archivos duplicados conocidos:** `Analizador_PAI_HRNO.html` y `CertiVac.html` existen tanto en la raíz como en `PAI/`. La versión canónica es la que está en `PAI/` (es la que sirve GitHub Pages y la que referencia `CertiVac.html` en el iframe). Los archivos de la raíz son copias locales de desarrollo.

---

## Aplicaciones activas — detalles técnicos

### 1. SIVIGILA_Monitor_v2.html
**Ruta:** `VIGILANCIA SP/SIVIGILA_Monitor_v2.html`
**Tecnología:** HTML + CSS + JS puro · Chart.js (CDN) · Leaflet (CDN) · SheetJS (CDN) · Google Apps Script backend

> ⚠️ **Dependencias de CDN:** Leaflet y Google Fonts se cargan de CDN externo. Sin internet el mapa falla; las demás funciones operan con los datos en caché local.

**Arquitectura:**
- Carga archivos `.xlsx` de SIVIGILA localmente con SheetJS (`XLSX.read`)
- Datos normalizados en array global `DB` mediante función `nr(row)`
- Persistencia en `localStorage` (claves `sivDB`, `sivMeta`)
- Informes: SE (semana epidemiológica), Mensual, **Anual** (tab agregado Jun 2026)
- Mapa Leaflet con municipios de cobertura

**Sistema de autenticación (commit d68438e):**
- Contraseña hasheada con **SHA-256** via `crypto.subtle.digest` — nunca en plaintext
- Hash almacenado en `localStorage` como `siv_pw_hash`
- Clave de recuperación de **20 caracteres** (`XXXX-XXXX-XXXX-XXXX-XXXX`) generada al cambiar contraseña
- Hash de la clave de recuperación en `siv_rk_hash`
- Contraseña por defecto inicial: `HRNO2026` (se migra a hash en el primer login)
- Flujo de recuperación: botón en modal login → ingresar clave → nueva contraseña → nueva clave generada
- Funciones clave: `hashPW()`, `genClaveRec()`, `mostrarClaveRec()`, `checkRecovery()`

**Campos de datos SIVIGILA (claves en los objetos normalizados):**
```
tip_ide_, num_ide_, nom_eve, municipio, semana, año, fec_not,
pac_hos_, con_fin_, tip_cas_, sexo_, edad_, area_, bar_ver_,
_lugar, tipo_carga,
pri_nom_, seg_nom_, pri_ape_, seg_ape_  →  compuesto en: _nombre
```

**Tabla municipios (`MUN`):** objeto JS con claves de código DANE → `{ nom, dep }`
Municipios cubiertos: Ábrego, Convención, El Carmen, Teorama (y otros de Norte de Santander)

**Funciones de seguridad y utilidad (commit d68438e):**
```js
escH(s)          // escape HTML para prevenir XSS en innerHTML — SIEMPRE usar al insertar datos de archivo
safeLSSet(k,v)   // wrapper seguro de localStorage.setItem — captura QuotaExceededError
hashPW(pw)       // async, SHA-256 → hex string
genClaveRec()    // genera clave 20 chars alfanuméricos sin ambigüedad
```

**Cambios recientes (commit 52fd13d):**
- Tab "Anual" con KPIs, distribución mensual (bar chart), comparativo por evento, tabla por municipio, lista hospitalizados/fallecidos
- KPI "municipios activos" muestra nombres en lugar de conteo
- Tabla notificaciones: columnas Tipo Doc., N° Documento, Nombre
- `filaEsp` (hospitalizados/fallecidos): incluye `_nombre` y `tip_ide_ + num_ide_`

---

### 2. CertiVac.html + Analizador_PAI_HRNO.html
**Rutas:**
- `PAI/CertiVac.html` — sistema integral PAI (frontend principal)
- `PAI/Analizador_PAI_HRNO.html` — verificador de población susceptible (cargado en iframe desde CertiVac)

> 🔒 **REGLA FIJA:** El `Analizador_PAI_HRNO.html` está **validado y no se modifica**. Cualquier auditoría o cambio lo excluye explícitamente.

**Librerías (offline-first desde commit d68438e):**
- `PAI/libs/xlsx.full.min.js` — SheetJS local
- `PAI/libs/chart.umd.min.js` — Chart.js local
- Google Fonts se carga vía `@import` (falla silenciosamente sin internet, usa fuentes del sistema)
- **NO usar CDN de cdnjs/jsdelivr para estas librerías** — ya existen versiones locales

**CertiVac.html — módulos internos:**
| Módulo | Descripción |
|--------|-------------|
| Dashboard | KPIs de cobertura vacunal |
| Cargar Archivos | Upload de plantillas MINSALUD y consolidados |
| Historial de Archivos | Registros cargados a Google Sheets |
| Liquidaciones | Gestión de liquidación PAI |
| Tabla de Metas | Metas por municipio y biológico |
| Informe por Municipio | Informe consolidado |
| Gráficas & Análisis | Visualizaciones de cobertura |
| Exportar Excel | Exportar datos consolidados |
| Verificador Pob. Susceptible | → carga `Analizador_PAI_HRNO.html` en iframe |
| Unificar Vacunadoras | Gestión de nombres de vacunadoras |
| Vacunadora → Municipio | Asignación de vacunadoras por municipio |
| Editar Valores/Metas | Edición inline de metas y precio por dosis |

**Funciones de utilidad para seguridad (commit d68438e):**
```js
escH(s)       // escape HTML — SIEMPRE usar al insertar datos del backend en innerHTML
escJ(s)       // escape JS para strings dentro de atributos onclick
              // Patrón correcto en onclick: escH(escJ(valor))
```

**Backend Google Apps Script (`CertiVac_Backend.gs`):**
- URL del script: guardada en `localStorage` como `certivac_api_url`
- También configurable vía parámetro URL `?api=URL_DEL_SCRIPT`
- Función `getApiUrl()`: retorna la URL hardcodeada si existe, sino la del localStorage
- Endpoints: `accion=ping`, `accion=liquidacion`, `accion=archivos`, `accion=periodos`, `accion=guardar_lote`, `accion=borrar_archivo`, `accion=borrar_todo`, `accion=asignaciones`

**ETL local — parseo de archivos XLS MINSALUD:**

`extraerMesAno(meta, fileName)` — función centralizada (DRY, commit d68438e):
- Parsea mes (1-12) y año (YYYY) del metadata del archivo
- Fallback al nombre del archivo (detecta años 20XX, nombres de mes completos y abreviaturas: FEB, JUL, AGO, SEP/SEPT, OCT, NOV, DIC)
- Usada por `procesarYGuardar` y `diagnosticarXLS`

`extraerMeta(wb, hs)` — lee metadatos de la hoja "Niños/Niñas":
- **Fila índice 2 (fila 3 visual):** departamento[6], municipio[7], mes[9], año[10], institución[18]
- Fallback institución en fila índice 3 si la 2 viene vacía

`parsNinos(ws, regs, fuente, mesNum, anio)` — detección de columna VACUNADOR:
- Busca hacia atrás en la fila de encabezados
- Si no encuentra, muestra **toast de advertencia visible** y retorna (antes fallaba silenciosamente)
- Mismo comportamiento en `parsAdultos` y `parsRN`

**Formato Plantilla MINSALUD (estructura de filas en la hoja):**
```
Fila 0: Título ("REGISTRO DIARIO DE VACUNACIÓN...")
Fila 1: vacía
Fila 2: metadatos (col 6=dpto, col 7=municipio, col 9=mes, col 10=año, col 18=institución)
Fila 3: vacía
Fila 4: encabezados categoría superior
Fila 5: CONSECUTIVO | DÍA | ... (encabezados principales)
Fila 6: sub-encabezados
Fila 7: nombres de vacunas (BCG, HEPATITIS B, PENTAVALENTE...)
Fila 8: DOSIS | LOTE | LOTE JERINGA por vacuna
Fila 9: vacía / separador
Fila 10+: datos reales
```

**Detección de filas de datos:** por columna DÍA (col 1), valor 1-31. **NO** por CONSECUTIVO (col 0) — ese campo suele estar vacío en registros de campo.

**`CICLOS[]`:** Array de objetos con definición completa de cada ciclo PAI (vacuna, dosis, rango de edad en meses, meta, valor). VPH tiene 3 entradas (VPH, VPH2, VPH3) para manejar variaciones de nombre con espacios en el Excel.

**`sendToSheets()`** y **`guardar_lote`:**
- Variables `municipio`, `mes`, `anio`, `yearMon` declaradas **antes** del bloque `try`
- **Error TDZ corregido (commit a783d2d):** no redeclarar `const` dentro del `try`
- Envía en chunks de 200 registros para respetar límite de payload de Apps Script
- `markLocalStatus(municipio, yearMon, total)` actualiza indicador local post-envío

---

### 3. Modulo_Identificacion_Mision_Medica.html
**Ruta:** `MISIÓN MÉDICA/Modulo_Identificacion_Mision_Medica.html`

**Arquitectura (desde commit d68438e):**
- CSS nativo inline — **sin Tailwind CDN, sin dependencias externas obligatorias**
- Imagen principal desde Cloudinary: si no carga, muestra bloque `#img-fallback` automáticamente
- 4 overlays de QR posicionados con `%` sobre la imagen
- Panel de acceso rápido con 4 tarjetas de acción
- Todos los `<a target="_blank">` tienen `rel="noopener noreferrer"`
- Canal de contacto alternativo visible si Odoo no responde

**Dependencias externas (opcionales, solo si hay internet):**
- Imagen de módulo: Cloudinary (tiene fallback)
- Google Fonts Noto Sans (tiene fallback a fuentes del sistema)

---

### 4. Generador CUPS (PWA)
**Ruta:** `Generador CUPS/index.html`
- PWA offline con los ~9000 códigos CUPS (Clasificación Única de Procedimientos en Salud)
- Datos embebidos en `cups_data.json`
- `build_pwa.py` construye el HTML final con los datos inline
- Tiene service worker (`sw.js`) para funcionamiento 100% offline

---

## Convenciones de código

| Regla | Detalle |
|-------|---------|
| Un archivo por app | Todo HTML + CSS + JS en un solo `.html`. Sin frameworks externos. |
| Sin CDN obligatorio | Librerías en `libs/` local o inline. La app debe funcionar sin internet. Google Fonts y Cloudinary son opcionales con fallback. |
| Sin servidor | Solo archivos estáticos. GitHub Pages o apertura local en navegador. |
| Persistencia | `localStorage` del navegador para estado de la UI |
| Nombres de archivos | En español, sin espacios en código (usar `_`). Documentos institucionales sí pueden tener espacios. |
| Idioma | Español colombiano en UI, comentarios, variables descriptivas |
| Sin emojis en código | Solo en texto visible del usuario dentro del HTML |
| Datos sensibles | No exponer datos de pacientes ni nombres JEP en `console.log` ni logs |
| `.xlsb` | Solo lectura, no modificar directamente |
| `~$*` | Archivos de bloqueo de Office — no borrar |
| Escape HTML | Usar `escH(s)` siempre que se inserte dato de archivo/backend en `innerHTML` |
| Escape JS en onclick | Usar `escH(escJ(valor))` para datos en atributos `onclick` |
| localStorage masivo | Usar `safeLSSet(key, val)` para escrituras de arrays grandes (captura `QuotaExceededError`) |
| Carga de archivos | Usar `readAsArrayBuffer` + `{type:'array'}` para SheetJS — `readAsBinaryString` está deprecado |

**Paleta de colores institucional:**
```css
--rojo:    #e94560;  /* alertas, acciones primarias */
--morado:  #7c1d6f;  /* módulos principales */
--azul:    #4a6fa5;  /* subprocesos */
--verde:   #38c793;  /* completado / ok */
--amarillo:#ffb432;  /* advertencia */
--fondo:   #0d1117;  /* fondo general */
```

---

## Backend Google Apps Script

Los archivos `.gs` son scripts de Google Apps Script desplegados como "Web App":
- `CertiVac_Backend.gs` → backend de CertiVac / Analizador PAI
- `PCI-App/PCI_Backend.gs` → backend de la app PIC

**Patrón de llamada desde el frontend:**
```js
// GET (lectura)
fetch(url + '?accion=ping', { method: 'GET', redirect: 'follow' })

// POST (escritura) — form-urlencoded para evitar preflight OPTIONS
const form = new URLSearchParams();
form.set('payload', JSON.stringify(body));
fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(), redirect: 'follow' })
```

**CORS:** Los scripts retornan JSON. El frontend usa POST con `application/x-www-form-urlencoded` para evitar preflight.

---

## Municipios de cobertura

| Municipio | Código DANE | Dpto |
|-----------|------------|------|
| Ábrego | 54003 | Norte de Santander |
| Convención | 54206 | Norte de Santander |
| El Carmen | 54245 | Norte de Santander |
| Teorama | 54800 | Norte de Santander |

Los archivos SIVIGILA y PAI se organizan por municipio. Los registros del Analizador PAI detectan el municipio del nombre del archivo (ej: `ABREGO`, `CONVENCION`, `EL CARMEN`, `TEORAMA`) o de la celda de institución en la plantilla (fila 2, col 7).

---

## Errores conocidos y sus soluciones

### TDZ (Temporal Dead Zone) en JavaScript
**Síntoma:** `Cannot access 'X' before initialization`
**Causa:** `const X` declarada antes de un `try {}`, y redeclarada dentro del mismo `try {}`. JS hace hoisting de la declaración interna, bloqueando el acceso a la variable en todo el scope del `try`.
**Solución:** Eliminar la declaración duplicada dentro del `try`.

### Plantilla MINSALUD — 0 registros detectados
**Causa:** Detectar filas por CONSECUTIVO (col 0) — este campo está vacío en registros de campo.
**Solución:** Detectar por DÍA (col 1), valor entero 1–31.

### Columnas de vacunas sin mapear
**Causa:** SheetJS lee solo el nombre de la vacuna (fila 7) sin el sufijo "DOSIS" (fila 8).
**Solución:** Combinar filas 7 y 8 para generar headers como "BCG DOSIS", "BCG LOTE", etc.

### Cache de GitHub Pages
**Síntoma:** Correcciones no se reflejan en el sitio.
**Solución:** `Ctrl+Shift+R` en el navegador. Si hay iframe, abrir el archivo directamente y hacer hard-refresh ahí también.

### QuotaExceededError en localStorage
**Síntoma:** La carga de datos falla silenciosamente o el navegador lanza excepción al guardar.
**Causa:** `localStorage` tiene límite de 5-10 MB. Con múltiples años de datos SIVIGILA puede saturarse.
**Solución:** Usar `safeLSSet(key, val)` en lugar de `localStorage.setItem` directo — captura el error y muestra toast informativo.

### Columna VACUNADOR no encontrada en XLS PAI
**Síntoma:** Archivo se marca como procesado pero contiene 0 dosis registradas.
**Causa:** La búsqueda inversa de la columna "VACUNADOR" no la encontró (variación tipográfica o formato diferente de plantilla).
**Solución (commit d68438e):** `parsNinos`/`parsAdultos`/`parsRN` ahora muestran toast de advertencia y retornan inmediatamente. Revisar el formato del XLS.

### XSS en innerHTML con datos de archivo/backend
**Síntoma:** Potencial ejecución de código si un nombre de evento SIVIGILA o nombre de vacunadora contiene HTML.
**Solución:** Siempre usar `escH(valor)` al insertar strings de datos en `innerHTML`. Para atributos `onclick`, usar `escH(escJ(valor))`.

### Contraseña de admin en texto plano (legacy)
**Síntoma:** `localStorage.getItem('siv_pw')` retorna la contraseña visible.
**Solución (commit d68438e):** En el primer login con el nuevo código, la contraseña legacy se compara en texto plano, se migra a SHA-256 (`siv_pw_hash`), se elimina `siv_pw`, y se genera la clave de recuperación.

---

## Commits recientes relevantes

```
d68438e  security(audit): corregir 20 hallazgos de auditoría en 3 sistemas
           - SIVIGILA: hash SHA-256 + clave de recuperación, escH(), safeLSSet(),
             switchTab corregido, readAsArrayBuffer, IDs seguros en checkboxes
           - CertiVac: libs locales, escH(escJ()) en onclick, borrado masivo
             con confirmación de texto, warnings de VACUNADOR, extraerMesAno()
             centralizado, extraerMeta fila correcta, precio sincronizado
           - Misión Médica: CSS nativo (sin Tailwind CDN), fallback de imagen,
             noopener en links, canal alternativo de reporte DIH
0bccab9  docs(ai): agregar diccionario de alias de rutas y actualizar estado TDZ
a783d2d  fix(pai): TDZ en sendToSheets - eliminar redeclaración const municipio en try
42d828a  fix(pai): parsear plantillas MINSALUD - filas por DÍA, headers con DOSIS, EDAD ACTUAL
52fd13d  feat(sivigila): informe anual, nombres municipios, documento+nombre paciente
b2d8873  fix: sincronizar index.html con portal actualizado
```

---

## Tareas pendientes (roadmap)

| Tarea | Prioridad | Estado |
|-------|-----------|--------|
| Descargar Leaflet localmente para mapa SIVIGILA offline | Alta | Pendiente — mapa falla sin internet |
| Guardar imagen de Misión Médica en el repo | Media | Pendiente — actualmente en Cloudinary (tiene fallback) |
| Generador de Informes Word/Excel (Python `python-docx` + `openpyxl`) | Media | No iniciado |
| Gestor de Certificaciones (PAI + Misión Médica unificado) | Media | No iniciado |
| Módulo Jornadas Rurales (checklist + solicitud medicamentos) | Baja | No iniciado |
| Verificar `sendToSheets` funciona tras fix TDZ (en producción GitHub Pages) | Alta | ✅ Confirmado — canónico corregido, copia externa sincronizada (Jun 2026) |

---

## Diccionario de Alias (Atajos para Prompts)

Cuando un prompt use uno de estos alias, mapear obligatoriamente a la ruta exacta sin pedirle la ruta al usuario.

### Portal Principal

| Alias | Ruta exacta |
|-------|-------------|
| **Portal Principal** | `index.html` |
| **Portal Local** | `index_Principal_Salud_Publica.html` |

### Módulos Principales

| Alias | Ruta exacta |
|-------|-------------|
| **Analizador PAI** | `PAI/Analizador_PAI_HRNO.html` |
| **CertiVac** | `PAI/CertiVac.html` |
| **Backend PAI** | `PAI/CertiVac_Backend.gs` |
| **Monitor SIVIGILA** | `VIGILANCIA SP/SIVIGILA_Monitor_v2.html` |
| **Misión Médica** | `MISIÓN MÉDICA/Modulo_Identificacion_Mision_Medica.html` |

### Herramientas Interoperables

| Alias | Ruta exacta |
|-------|-------------|
| **App PCI** | `HERRAMIENTAS INTEROPERABLES/PCI-App/index.html` |
| **Backend PCI** | `HERRAMIENTAS INTEROPERABLES/PCI-App/PCI_Backend.gs` |
| **DiagramFlow** | `HERRAMIENTAS INTEROPERABLES/DiagramFlow.html` |
| **Buscador CUPS** | `HERRAMIENTAS INTEROPERABLES/Buscador_CUPS.html` |
| **Generador CUPS** | `Generador CUPS/index.html` |

### Scripts y Herramientas de Consolidación

| Alias | Ruta exacta |
|-------|-------------|
| **Consolidador HTML** | `HERRAMIENTAS/Consolidador_PAI.html` |
| **Consolidador Python** | `HERRAMIENTAS/consolidar_pai.py` |
| **Script Build CUPS** | `Generador CUPS/build_pwa.py` |

> Módulos en desarrollo (EBS, PIC, JEP, HOPE) se añadirán al diccionario cuando se defina su estructura de directorios.

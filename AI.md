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
│   ├── Analizador_PAI_HRNO.html   ← Analizador vacunación niños/niñas (✅ activo)
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
│   │   ├── chart.umd.min.js       ← Chart.js (offline)
│   │   └── xlsx.full.min.js       ← SheetJS (offline)
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
**Tecnología:** HTML + CSS + JS puro · Chart.js · Leaflet · SheetJS · Google Apps Script backend

**Arquitectura:**
- Carga archivos `.xlsx` de SIVIGILA localmente con SheetJS (`XLSX.read`)
- Datos normalizados en array global `DB` mediante función `nr(row)`
- Persistencia en `localStorage` (clave `sivDB`, `sivMeta`)
- Informes: SE (semana epidemiológica), Mensual, **Anual** (tab agregado Jun 2026)
- Mapa Leaflet con municipios de cobertura

**Campos de datos SIVIGILA (claves en los objetos normalizados):**
```
tip_ide_, num_ide_, nom_eve, municipio, semana, año, fec_not,
pac_hos_, con_fin_, tip_cas_, sexo_, edad_, area_, bar_ver_,
_lugar, tipo_carga,
pri_nom_, seg_nom_, pri_ape_, seg_ape_  →  compuesto en: _nombre
```

**Tabla municipios (`MUN`):** objeto JS con claves de código DANE → `{ nom, dep }`
Municipios cubiertos: Ábrego, Convención, El Carmen, Teorama (y otros de Norte de Santander)

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
| Verificador Pob. Susceptible | → carga `Analizador_PAI_HRNO.html` en iframe (línea ~1329) |
| Unificar Vacunadoras | Gestión de nombres de vacunadoras |
| Vacunadora → Municipio | Asignación de vacunadoras por municipio |

**Backend Google Apps Script (`CertiVac_Backend.gs`):**
- URL del script desplegado: guardada en la app como `SCRIPT_URL`
- Endpoints principales: `/exec?action=getRecords`, `/exec?action=saveRecords`, etc.
- Base de datos: Google Sheets con hoja "Registros" (ver `CertiVac_BD_Template.xlsx`)

**Analizador_PAI_HRNO.html — arquitectura:**

Dos tabs:
1. **Análisis PAI** — carga archivos, detecta susceptibles, calcula esquema
2. **Carga Mensual** — envía datos a Google Sheets

**Función `processFile(file)`** — punto de entrada para cargar archivos:
- Detecta formato con `esPlantillaMinsalud(wb)` → enruta a `parsePlantillaWb()` o lectura directa
- `esPlantillaMinsalud(wb)`: hoja "Niñas/Niños" existe + celda (5,0) == "CONSECUTIVO"

**Formato Plantilla MINSALUD (estructura de filas en la hoja):**
```
Fila 0: Título ("REGISTRO DIARIO DE VACUNACIÓN...")
Fila 1: vacía
Fila 2: metadatos (institución en col 18, mes en col X, año en col Y)
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

**Headers de vacunas** generados combinando filas 7 + 8:
```js
// Ejemplo de resultado: "BCG DOSIS", "BCG LOTE", "HEPATITIS B DOSIS", "HEPATITIS B LOTE"...
```

**`mapColumns(headers)`** — mapea índices de columnas a variables semánticas:
- Requiere "dosis" en el nombre de la columna para vacunas (ej: `C.bcg = findIndex(h => h.includes('bcg') && h.includes('dosis'))`)
- VPOb (Polio oral): busca "vpob" o "oralmonovalente"; fallback: "polio" + "dosis" sin "inactivado"

**`sendToSheets()`** — envía registros a Google Apps Script:
- Variables `municipio`, `mes`, `anio`, `yearMon` declaradas **antes** del bloque `try`
- **Error TDZ corregido (commit a783d2d):** no redeclarar `const` dentro del `try`
- `markLocalStatus(municipio, yearMon, total)` actualiza indicador local post-envío

**ESQUEMA_PAI** — dosis requeridas por grupo de edad:
```js
const ESQUEMA_PAI = {
  '2M':  { bcg:1, hepB:1, penta:1, polio:1, ... },
  '4M':  { penta:2, polio:2, ... },
  '6M':  { penta:3, polio:3, ... },
  '7M':  { influenza:1, ... },
  '1A':  { srp:1, varicela:1, ... },
  '18M': { penta:4 (refuerzo), srp:2, ... },
  '5A':  { dpt:1, polio:4, ... }
};
```

---

### 3. Modulo_Identificacion_Mision_Medica.html
**Ruta:** `MISIÓN MÉDICA/Modulo_Identificacion_Mision_Medica.html`
- Registro de infracciones al DIH / Misión Médica
- Formulario local, exporta a Excel

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
| Sin CDN | Librerías en `libs/` local o inline. La app debe funcionar sin internet. |
| Sin servidor | Solo archivos estáticos. GitHub Pages o apertura local en navegador. |
| Persistencia | `localStorage` del navegador para estado de la UI |
| Nombres de archivos | En español, sin espacios en código (usar `_`). Documentos institucionales sí pueden tener espacios. |
| Idioma | Español colombiano en UI, comentarios, variables descriptivas |
| Sin emojis en código | Solo en texto visible del usuario dentro del HTML |
| Datos sensibles | No exponer datos de pacientes ni nombres JEP en `console.log` ni logs |
| `.xlsb` | Solo lectura, no modificar directamente |
| `~$*` | Archivos de bloqueo de Office — no borrar |

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
fetch(SCRIPT_URL, {
  method: 'POST',
  body: JSON.stringify({ action: 'saveRecords', data: [...] })
})
.then(r => r.json())
.then(resp => { ... });
```

**CORS:** Los scripts de Google Apps Script retornan JSON con `Content-Type: text/plain` para evitar preflight. El frontend siempre hace POST con body JSON.

---

## Municipios de cobertura

| Municipio | Código DANE | Dpto |
|-----------|------------|------|
| Ábrego | 54003 | Norte de Santander |
| Convención | 54206 | Norte de Santander |
| El Carmen | 54245 | Norte de Santander |
| Teorama | 54800 | Norte de Santander |

Los archivos SIVIGILA y PAI se organizan por municipio. Los registros del Analizador PAI detectan el municipio del nombre del archivo (ej: `ABREGO`, `CONVENCION`, `EL CARMEN`, `TEORAMA`) o de la celda de institución en la plantilla (fila 2, col 18).

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

---

## Commits recientes relevantes

```
a783d2d  fix(pai): TDZ en sendToSheets - eliminar redeclaración const municipio en try
42d828a  fix(pai): parsear plantillas MINSALUD - filas por DÍA, headers con DOSIS, EDAD ACTUAL
52fd13d  feat(sivigila): informe anual, nombres municipios, documento+nombre paciente
b2d8873  fix: sincronizar index.html con portal actualizado
887311c  feat: módulo Vigilancia Epidemiológica con SIVIGILA Monitor v2
4a84195  feat: módulo de Identificación Misión Médica
```

---

## Tareas pendientes (roadmap)

| Tarea | Prioridad | Estado |
|-------|-----------|--------|
| Verificar `sendToSheets` funciona tras fix TDZ (en producción GitHub Pages) | Alta | Pendiente confirmar |
| Generador de Informes Word/Excel (Python `python-docx` + `openpyxl`) | Media | No iniciado |
| Gestor de Certificaciones (PAI + Misión Médica unificado) | Media | No iniciado |
| Módulo Jornadas Rurales (checklist + solicitud medicamentos) | Baja | No iniciado |
| Botones "volver" en módulos faltantes | Baja | Mayormente completo (commit 52fd13d) |

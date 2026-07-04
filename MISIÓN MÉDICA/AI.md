# AI.md — Misión Médica HRNO · Documentación de automatización e IA

> Módulo: `Mision_Medica_HRNO.html`  
> Proyecto: ESE Hospital Regional Noroccidental  
> Responsable: Danilo Torrado Blanco — Coordinador Salud Pública  
> Última actualización: 20 jun 2026
>
> Ver también: [PROJECT.md](PROJECT.md) (alcance funcional y de negocio) y [DESIGN.md](DESIGN.md) (sistema visual)

---

## Descripción general

Este módulo es una aplicación web de página única (`Mision_Medica_HRNO.html`) que gestiona los procesos del programa Misión Médica del HRNO. Funciona completamente en el navegador sin servidor propio, usando Supabase como base de datos y Google Apps Script como backend de correo/Excel.

---

## Arquitectura técnica

```
Navegador (HTML/CSS/JS)
     │
     ├── Supabase JS SDK  →  PostgreSQL (us-east-1)
     │     └── Proyecto: kukauvbqosizlxrapmim
     │
     └── Google Apps Script (MM V13)  →  Gmail + Google Sheets
           └── URL /exec (Web App, acceso: Cualquier usuario)
```

### Librerías (CDN, sin framework)

| Librería | Uso |
|----------|-----|
| Supabase JS | Base de datos en tiempo real |
| Tailwind CSS | Estilos utilitarios |
| Chart.js | Gráficas estadísticas en el panel admin |
| jsPDF + html2canvas | Generación de carnets en PDF |
| QRCode.js | Código QR en carnet digital |
| Lucide | Íconos SVG |

---

## Supabase — Base de datos

**Proyecto ID:** `kukauvbqosizlxrapmim`  
**URL:** `https://kukauvbqosizlxrapmim.supabase.co`  
**Región:** us-east-1

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `mm_infracciones` | Reportes de infracciones e incidentes DIH. Incluye `radicado` (formato `RIICMM-AAAA-NNN`, secuencial por año) |
| `mm_solicitudes_carnet` | Solicitudes de tarjeta de identidad Misión Médica (16 campos, ver detalle abajo) |
| `mm_solicitudes_emblemas` | Solicitudes de chaleco, bandera, peto |
| `mm_stock_emblemas` | Inventario actual de emblemas |
| `mm_capacitaciones` | Sesiones de capacitación registradas |
| `mm_asistencia` | Asistentes por sesión |
| `mm_prepostest` | Resultados de evaluaciones pre/postest |

#### Columnas de `mm_solicitudes_carnet`

Datos personales: `nombres`, `apellidos`, `tipo_documento`, `numero_documento`, `fecha_nacimiento`, `sexo`, `grupo_sanguineo`, `estatura`, `telefono`, `correo`.
Datos institucionales: `perfil_profesion`, `cargo`, `vinculacion`, `municipio`, `ips`, `responsable_solicitud`.
Documento y proceso: `documento_pdf_url` (PDF subido a Storage), `fecha_solicitud`, `estado` (`pendiente`/`autorizado`/`rechazado`), `numero_carnet`, `fecha_autorizacion`, `foto_url` (foto institucional subida tras autorización).

### Storage

| Bucket | Acceso | Contenido |
|--------|--------|-----------|
| `documentos-carnet` | Público (lectura y escritura vía políticas RLS) | PDF del documento de identidad (ambas caras) adjuntado en la solicitud de carnet |

---

## Google Apps Script — MM V13

**Proyecto ID:** `1T_MPdav64hGhM89FTgSDERouQZu4M97mbaUevVdVKWGsOc6KM7IZu3Wl`  
**Google Sheet ID:** `1YXcFzbr6k3xowbDBSsZ8qYuTjkZSRJLHExFQcR5cbY0`  
**Versión en producción:** V3 (desplegada el 19 jun 2026)

### Acciones soportadas

#### GET
| `action` | Descripción |
|----------|-------------|
| `getData` | Lee todas las solicitudes de tarjetas y emblemas del Sheet |
| `getInventory` | Lee el stock actual de emblemas (banderas, chalecos, petos) |

#### POST
| `action` | Descripción |
|----------|-------------|
| `uploadCard` | Registra solicitud de carnet en la hoja `Tarjetas` |
| `requestEmblem` | Registra solicitud de emblema en la hoja `Emblemas` |
| `updateInventory` | Actualiza el stock de emblemas |
| `updateStatus` | Cambia el estado de una solicitud (Autorizado / Rechazado) y envía correo |
| `sendEmail` | Envía un correo arbitrario desde la cuenta del propietario del script |

### Envío de correos

El script usa `MailApp.sendEmail()` bajo la cuenta `danto0702@gmail.com` (requiere autorización manual previa del scope `mail.google.com` ejecutando una función desde el editor de Apps Script). Los correos automáticos se disparan en estos momentos:

1. **Al autorizar un carnet** — se lee `correo`/`nombres`/`apellidos` desde Supabase (no desde parámetros del DOM, para evitar errores de escaping) y se envía el enlace para tomar foto y firmar consentimiento.
2. **Al registrar un reporte de infracciones/incidentes** — notificación inmediata al administrador (`danto0702@gmail.com`) con radicado, tipo de evento, fecha, municipio e institución afectada.

El campo remitente visible es: `Misión Médica — ESE HRNO`.

> **Nota de seguridad histórica:** el botón "Autorizar" del panel de carnets pasaba antes `correo` y `nombres` como parámetros de string en el `onclick`, lo que rompía el JSON enviado al Apps Script si el nombre tenía caracteres especiales — causaba que el correo solo llegara a la cuenta del admin y no a otros destinatarios. Corregido leyendo esos datos directamente de Supabase dentro de `autorizarCarnet(id)`.

### CORS — nota técnica

Las llamadas al Apps Script desde el HTML usan:

```js
fetch(url, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload) })
```

`mode: 'no-cors'` evita el preflight OPTIONS que Google rechaza. La respuesta no es legible desde JS (opaque), pero la operación se ejecuta correctamente en el servidor.

---

## Vistas del módulo

| Vista | Ruta (`#`) | Acceso |
|-------|-----------|--------|
| Inicio / Bienvenida | `#inicio` | Público |
| Información DIH | `#informacion` | Público |
| Reporte de infracciones | `#infracciones` | Público |
| Solicitar carnet | `#carnet` | Público |
| Solicitar emblema | `#emblemas` | Público |
| Capacitaciones | `#capacitaciones` | Público |
| Panel Administrativo | `#admin` | Requiere contraseña `HRNO2026` |

---

## Panel Admin — funcionalidades

- Estadísticas en tiempo real (tarjetas, emblemas, infracciones, capacitaciones)
- Gestión de solicitudes de carnet: Autorizar / Rechazar con notificación por correo
- Gestión de solicitudes de emblema: Autorizar cantidad / Rechazar
- Actualización de stock de emblemas
- Visualización de registros de infracciones
- Gestión de sesiones de capacitación y asistencia

---

## Municipios cubiertos

- Ábrego
- El Carmen
- Convención
- Teorama

### IPS por municipio (selector dependiente en formulario de carnet)

```js
const IPS_POR_MUNICIPIO = {
  'Ábrego':     ['IPS Ábrego'],
  'El Carmen':  ['IPS El Carmen','IPS Guamalito','PS La Trinidad','PS Cartagenita','PS Aserrío'],
  'Convención': ['IPS Convención','IPS San Pablo','PS Casitas','PS Capitanlargo'],
  'Teorama':    ['IPS El Carmen'],
};
```

> Pendiente de confirmación con el usuario: la asignación de Teorama fue inferida, no confirmada explícitamente.

---

## Generación de PDF (jsPDF)

### Reporte de Infracciones e Incidentes
- Función: `generarPDFInfraccion(data)`
- Replica el formato oficial ICRC / Resolución 4481 de 2012 en una sola página
- Recuadros de tamaño dinámico según el contenido (no fijos)
- Radicado secuencial calculado en `submitInfraccion`: `RIICMM-${año}-${NNN}` usando `count` de filas existentes en `mm_infracciones`
- Se genera inmediatamente tras guardar el registro en Supabase, y queda disponible para descarga desde el panel admin

### Carnet / Tarjeta virtual
- Función relacionada: `descargarCarnet()` usa `jsPDF` + `html2canvas` (scale 4, `useCORS:true`) sobre el nodo `#carnet-render`
- QR generado con `QRCode.js`: contiene `tarjetaUrl` completa, nivel de corrección `L`, contenedor 120×120px (ajustado tras pruebas de legibilidad)

---

## Archivo de referencia Apps Script

`AppsScript_MisionMedica.gs` — copia local del código del script para versionado en Git. El código en producción está en `script.google.com` (proyecto MM V13).

---

## Historial de versiones del despliegue

| Versión | Fecha | Cambios |
|---------|-------|---------|
| V1 | 28 ene 2026 | Versión inicial |
| V2 | 28 ene 2026 | Ajustes de estructura |
| V3 | 19 jun 2026 | Acción `sendEmail` + handler `enviarCorreo()` con GmailApp; corrección CORS en `callAppsScript` |
| V4 | 19 jun 2026 | Cambio a `MailApp.sendEmail()`; autorización manual del scope de correo |

---

## Archivos del módulo

```
MISIÓN MÉDICA/
├── Mision_Medica_HRNO.html              ← App principal (HTML + CSS + JS, ~2800+ líneas)
├── AppsScript_MisionMedica.gs           ← Copia de referencia del Apps Script (MM V13)
├── Formulario de Reporte de Infracciones e Incidentes.html  ← Versión standalone del formulario
├── Gestion emblemas.html                ← Módulo anterior de gestión de emblemas
├── Pre y Postest.html                   ← Módulo standalone de evaluaciones
├── Modulo_Identificacion_Mision_Medica.html  ← Módulo de identificación
├── AI.md                                ← Arquitectura técnica (este archivo)
├── PROJECT.md                           ← Alcance funcional, módulos, historial de cambios
└── DESIGN.md                            ← Sistema visual: paleta, tipografía, componentes
```

# PROJECT.md — Misión Médica HRNO

> Última actualización: 20 jun 2026

---

## ¿Qué es este proyecto?

Aplicación web de página única (`Mision_Medica_HRNO.html`) que digitaliza los procesos del programa **Misión Médica** de la ESE Hospital Regional Noroccidental (HRNO), en Norte de Santander, Colombia. Misión Médica es la figura de protección del personal de salud y la infraestructura sanitaria en zonas de conflicto armado, amparada por el Derecho Internacional Humanitario (DIH) y la Resolución 4481 de 2012.

**Responsable institucional:** Danilo Torrado Blanco — Coordinador de Salud Pública, Referente de Misión Médica.

**Hosting:** GitHub Pages — `https://danto0702.github.io/portal-salud-publica-hrno/MISIÓN MÉDICA/Mision_Medica_HRNO.html`
**Repositorio:** `https://github.com/danto0702/portal-salud-publica-hrno`

---

## Objetivo del proyecto

Sustituir procesos manuales en papel/Excel por flujos digitales que:
1. Permitan a personal sanitario reportar infracciones e incidentes DIH desde cualquier lugar.
2. Centralicen las solicitudes de carnets de identificación y emblemas de protección (chaleco, bandera, peto).
3. Den trazabilidad institucional (radicados, PDF, notificación automática) sin depender de un servidor propio.
4. Funcionen sin conectividad estable, ya que los municipios cubiertos son rurales y dispersos.

---

## Módulos funcionales

### 1. Reporte de Infracciones e Incidentes (`#infracciones`)
- Formulario público basado en el **formato oficial ICRC/Resolución 4481 de 2012**.
- Genera un **radicado secuencial `RIICMM-AAAA-NNN`** (ej. `RIICMM-2026-001`) por año, consultando el conteo de registros existentes en Supabase.
- Al enviarse:
  - Se guarda el registro completo en la tabla `mm_infracciones`.
  - Se genera automáticamente un **PDF con el formato oficial** (recuadros que se ajustan al contenido, sin tamaño fijo).
  - Se envía una **notificación por correo al administrador** (`danto0702@gmail.com`) vía Google Apps Script, con los datos clave del evento.
  - El PDF queda disponible para descarga desde el panel admin.

### 2. Solicitud de Carnet de Identificación (`#carnet` → `mostrarFormEmblema('carnet')`)
- Formulario ampliado de 16 campos: datos personales, datos institucionales (perfil/profesión, cargo, vinculación, municipio → IPS dependiente), responsable de la solicitud, y carga de PDF del documento de identidad (ambas caras, máx. 10 MB, vía drag-and-drop).
- El PDF se sube a Supabase Storage (bucket `documentos-carnet`, público) y la URL se guarda en el registro.
- Flujo de autorización:
  1. Solicitante envía el formulario → queda en estado `pendiente`.
  2. Admin autoriza desde el panel → se genera número de carnet, se envía correo con enlace para tomar foto institucional y firmar consentimiento informado.
  3. Solicitante sube su foto desde el enlace recibido.
  4. Se genera la **tarjeta virtual** con foto, datos y **código QR** (apunta a la URL pública de verificación de la tarjeta).
  5. Tarjeta descargable como imagen (html2canvas) o compartible por enlace.

### 3. Solicitud de Emblemas de Protección (`#emblemas`)
- Formulario para solicitar chaleco, bandera o peto, con talla y justificación de uso.
- Compromiso de uso y devolución institucional.
- Gestión de inventario (stock por tipo de emblema) desde el panel admin.

### 4. Capacitaciones DIH (`#capacitaciones`)
- Registro de sesiones de capacitación y asistentes.
- Evaluaciones pre-test y post-test con preguntas predefinidas.

### 5. Panel Administrativo (`#admin`, contraseña `HRNO2026`)
- Estadísticas en tiempo real (tarjetas, emblemas, infracciones, capacitaciones).
- Gestión de solicitudes de carnet: autorizar / rechazar con notificación automática por correo.
- Gestión de solicitudes de emblema: autorizar cantidad / rechazar.
- Actualización de inventario de emblemas.
- Visualización y **descarga de PDF** de los reportes de infracciones.
- Gestión de sesiones de capacitación y asistencia.

---

## Municipios cubiertos

Ábrego · El Carmen · Convención · Teorama (Norte de Santander)

## IPS por municipio

| Municipio | IPS / PS |
|-----------|----------|
| Ábrego | IPS Ábrego |
| El Carmen | IPS El Carmen, IPS Guamalito, PS La Trinidad, PS Cartagenita, PS Aserrío |
| Convención | IPS Convención, IPS San Pablo, PS Casitas, PS Capitanlargo |
| Teorama | IPS El Carmen *(pendiente de confirmar asignación correcta — ver nota abajo)* |

> ⚠️ **Nota abierta:** la distribución de IPS por municipio fue inferida de la lista plana proporcionada por el usuario. Falta confirmar la asignación exacta, especialmente para Teorama.

---

## Backend / infraestructura

- **Supabase** (PostgreSQL) — base de datos principal y Storage para PDFs de documentos de identidad.
  - Proyecto: `kukauvbqosizlxrapmim` (región us-east-1)
- **Google Apps Script (MM V13)** — envío de correos transaccionales (notificaciones de autorización, notificación de infracciones al admin) y respaldo en Google Sheets.
- **GitHub Pages** — hosting estático. Necesario para que las URLs de fotos/QR sean `https://` (Gmail bloquea adjuntos/enlaces `file:///`).

Ver detalle técnico completo en [AI.md](AI.md).

---

## Historial de cambios relevantes

| Fecha | Cambio |
|-------|--------|
| 28 ene 2026 | Despliegue inicial Apps Script (V1, V2) |
| 19 jun 2026 | Apps Script V3/V4: acción `sendEmail`, corrección CORS, autorización MailApp |
| 19 jun 2026 | Fix QR ilegible (tamaño, nivel de corrección de errores) |
| 19 jun 2026 | Fix entrega de correos a direcciones distintas del admin (bug de escaping en `onclick`) |
| 19-20 jun 2026 | Formulario de carnet ampliado a 16 campos + carga de PDF + IPS dependiente de municipio |
| 20 jun 2026 | PDF de infracciones con formato oficial ICRC, radicado secuencial `RIICMM-AAAA-NNN`, notificación al admin por correo, descarga desde panel |

---

## Pendientes conocidos

- Confirmar con el usuario la distribución exacta de IPS por municipio (Teorama sin asignación clara).
- Validar visualmente que el PDF de infracciones generado coincide con el formato oficial ICRC en todos sus recuadros.
- Verificar que la notificación por correo al admin llega de forma consistente para todos los reportes (mismo patrón de bug ya corregido en carnets).

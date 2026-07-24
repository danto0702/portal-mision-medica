# Reporte de Usuarios Institucionales SISPRO — SEG500USIN

Aplicativo local (offline) para generar el archivo plano `.TXT` de **Reporte de Información de Usuarios Institucionales** que se carga en **PISIS**, según el Anexo Técnico CVSF05 del Ministerio de Salud y Protección Social.

> Referente: Danilo Torrado Blanco · Coordinación de Salud Pública · ESE HRNO

---

## Archivos de esta carpeta

| Archivo | Para qué sirve |
|---|---|
| `Usuarios_Institucionales_SISPRO.html` | **El aplicativo.** Ábrelo con doble clic (Chrome/Edge). |
| `xlsx.full.min.js` | Librería para leer/generar Excel sin internet. **No borrar.** |
| `Apps_Script_Backend.gs` | Código del backend de Google Sheets (Apps Script). |
| `LEEME.md` | Este documento. |

---

## Flujo de uso

1. **Entidad (pestaña 1).** Diligencia una sola vez los datos de la ESE, del representante legal y del contacto. Guarda. Estos datos coinciden con `web.sispro.gov.co` y `miseguridadsocial.gov.co`.
2. **Usuarios (pestaña 2).** Agrega usuarios uno a uno, o descarga la **plantilla Excel**, diligénciala y cárgala.
   - **V** = vincular (habilita al usuario; requiere teléfono, cargo, contrato y correo).
   - **O** = desvincular (solo identificación, nombre y apellido).
3. **Perfiles (pestaña 3, opcional).** Asigna/retira perfiles por aplicación a usuarios vinculados. Todo usuario vinculado ya recibe **PISIS Cliente Neo** por defecto.
4. **Generar y Enviar (pestaña 4).** Valida la estructura, muestra el **nombre del archivo** y la **vista previa**. Descarga el `.TXT` y/o registra el envío en Google Sheets.

> **Importante:** antes de subir el archivo a PISIS debe **firmarse digitalmente** con un certificado de una entidad certificadora aprobada. Este aplicativo genera el `.TXT`; la firma se hace aparte.

---

## Backend en Google Sheets (Apps Script)

Hoja ya creada en el Drive de la coordinación:
**"SEG500USIN - Backend Usuarios Institucionales SISPRO (HRNO)"**
`https://docs.google.com/spreadsheets/d/1nWrZAMhOdGugiPxFiNSc75oeyBuVvCgym47kUY9BKBg/edit`

Pasos para activarlo:

1. Abre la hoja → **Extensiones → Apps Script**.
2. Borra el contenido y pega el código de `Apps_Script_Backend.gs`. Guarda.
3. (Opcional) define un `TOKEN` secreto y ponlo igual en el aplicativo.
4. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como:* **Yo**
   - *Quién tiene acceso:* **Cualquier usuario**
5. Autoriza los permisos y copia la **URL /exec**.
6. En el aplicativo → pestaña **Ajustes** → pega la URL → **Guardar** → **Probar conexión**.

El script crea automáticamente 3 hojas: `ENVIOS` (bitácora), `USUARIOS` (Tipo 2) y `PERFILES` (Tipo 3).

---

## Estructura del archivo plano (resumen del anexo)

**Nombre:** `SEG500USIN` + `AAAAMMDD` (fecha corte) + `XX` (tipo id entidad) + `999999999999` (nº entidad, 12 díg. con ceros a la izquierda) + `.TXT` — **36 caracteres**.

**Reglas:** texto ANSI · MAYÚSCULAS sin tildes · separador `|` · fechas `AAAA-MM-DD` · sin comillas · numéricos sin separador de miles · un salto de línea (ENTER) por registro.

| Registro | Descripción | Obligatorio |
|---|---|---|
| **Tipo 1** | Control: identifica a la entidad reportadora (1 solo). | Sí |
| **Tipo 2** | Detalle de usuarios (vincular/desvincular). | Sí (≥1) |
| **Tipo 3** | Perfiles por aplicación. | Opcional |

- El **consecutivo** inicia en 1 en el primer Tipo 2 y continúa hasta el último Tipo 3.
- El **total** del Tipo 1 = nº de registros Tipo 2 + Tipo 3.

---

## Notas

- Todos los datos se guardan en el **navegador de este equipo** (localStorage). Usa **Ajustes → Exportar respaldo** para hacer copia o pasar a otro equipo.
- La **Ñ** se conserva; solo se eliminan las tildes (á→A, é→E, …).
- Sin servidor, sin dependencias de CDN: funciona con doble clic aunque no haya internet (el envío a Google Sheets sí requiere conexión).

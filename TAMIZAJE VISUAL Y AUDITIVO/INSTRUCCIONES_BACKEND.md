# Puesta en marcha del backend — Tamizaje Visual y Auditivo

El módulo `Tamizaje_Visual_Auditivo.html` guarda los datos en una **Google Sheet**
a través de un **Google Apps Script** (backend sin servidor). Sigue estos pasos
**una sola vez**.

---

## 1. Hoja de cálculo (ya creada en tu Drive)

Ya quedó creada en tu Google Drive con el nombre:

> **TAMIZAJE VISUAL Y AUDITIVO - HRNO (Backend)**

Ábrela aquí:
https://docs.google.com/spreadsheets/d/1fqO8uwMYwVGI2KVwkjaUNwSJb07CR3gggra2qxxJICs/edit

No tienes que crear pestañas manualmente: el script las genera solo
(`TAMIZAJE_VISUAL` y `TAMIZAJE_AUDITIVO`).

---

## 2. Instalar el script

1. Con la hoja abierta, ve al menú **Extensiones → Apps Script**.
2. Borra todo el contenido del archivo `Código.gs` (o `Code.gs`) que aparece.
3. Abre el archivo **`Tamizaje_Backend.gs`** (está en esta misma carpeta),
   copia **todo** su contenido y pégalo en el editor de Apps Script.
4. **Cambia la contraseña de administrador**: en la parte superior del script,
   busca la línea:

   ```js
   ADMIN_PASSWORD: 'HRNO-Tamizaje-2026',
   ```

   y reemplaza `HRNO-Tamizaje-2026` por la contraseña que quieras. Esta es la que
   se pedirá para entrar al **Panel administrador**.
5. Haz clic en **Guardar** (ícono del disquete).

---

## 3. Crear las pestañas (ejecutar `setup`)

1. En el editor de Apps Script, en el selector de funciones (arriba, al lado de
   "Depurar"), elige **`setup`** y presiona **Ejecutar** ▶️.
2. La primera vez Google pedirá **autorización**: "Revisar permisos" →
   elige tu cuenta → "Configuración avanzada" → "Ir a … (no seguro)" →
   **Permitir**. (Es tu propio proyecto, es seguro.)
3. Al terminar verás en la hoja las dos pestañas creadas con sus encabezados.

---

## 4. Publicar como aplicación web

1. Arriba a la derecha: **Implementar → Nueva implementación**.
2. En el engranaje ⚙️ elige **Aplicación web**.
3. Configura:
   - **Descripción**: `Backend Tamizaje` (o lo que quieras)
   - **Ejecutar como**: **Yo (tu correo)**
   - **Quién tiene acceso**: **Cualquier persona**
4. **Implementar** → autoriza de nuevo si lo pide.
5. Copia la **URL de la aplicación web** (termina en **`/exec`**).

> Ejemplo: `https://script.google.com/macros/s/AKfycb....../exec`

---

## 5. Conectar la app con el backend

Envíame esa URL `/exec` y yo la dejo configurada en el HTML (y hago el push),
**o** hazlo tú:

1. Abre `Tamizaje_Visual_Auditivo.html`.
2. Cerca del inicio del `<script>` busca:

   ```js
   const APPS_SCRIPT_URL = '';
   ```

3. Pega tu URL entre las comillas:

   ```js
   const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycb....../exec';
   ```

4. Guarda y sube el cambio al repositorio.

---

## Notas

- Si en el futuro **cambias el código** del script, debes ir a
  **Implementar → Administrar implementaciones → editar (lápiz) → Versión: Nueva versión → Implementar**
  para que los cambios queden activos (la URL `/exec` se mantiene).
- La contraseña de administrador vive **solo en el script** (en Google), no en el
  HTML público. Se valida en el servidor.
- Mientras `APPS_SCRIPT_URL` esté vacío, la app funciona para diligenciar y
  **generar PDF**, pero **no** guarda en la nube ni permite el panel admin.

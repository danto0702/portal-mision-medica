# Publicar el aplicativo desde la página web de Cloudflare

> Sin terminal, sin instalar nada. Todo con el navegador.
> Tiempo estimado: 10 minutos.

---

## Antes de empezar

Lo único que necesitas es el archivo **`flota-worker-completo.js`**, que está en
`FLOTA VEHICULAR/worker/`. Lo vas a copiar y pegar.

La base de datos **ya está creada** y se llama `flota-hrno`. No hay que crearla.

---

## Paso 1 — Crear el Worker

1. Entra a **https://dash.cloudflare.com** e inicia sesión.
2. En el menú de la izquierda busca **Workers & Pages** (en algunas cuentas
   aparece como **Compute** o **Workers**).
3. Botón **Create** → **Create Worker**.
4. En el nombre escribe exactamente:

   ```
   flota-hrno
   ```

5. Botón **Deploy**. Se publica un Worker de ejemplo que diremos "Hello World".
   No importa, en el siguiente paso lo reemplazamos.

---

## Paso 2 — Pegar el código

1. Ya dentro del Worker recién creado, busca el botón **Edit code**
   (o el ícono `< >`).
2. Se abre un editor con código de ejemplo. **Selecciona todo y bórralo**
   (Ctrl+A y luego Suprimir).
3. Abre el archivo `flota-worker-completo.js`, selecciona todo su contenido
   (Ctrl+A), cópialo (Ctrl+C) y pégalo en el editor (Ctrl+V).
4. Botón **Deploy** arriba a la derecha.

> Va a mostrar una advertencia o error al guardar. Es esperado: todavía no le
> hemos conectado la base de datos. Se arregla en el paso siguiente.

---

## Paso 3 — Conectar la base de datos

Esta es la parte importante. Sin esto el aplicativo no encuentra los datos.

1. Sal del editor (**← Back**) y entra a la pestaña **Settings** del Worker.
2. Busca la sección **Bindings** (en algunas cuentas está dentro de
   **Variables and Secrets** o **Integrations**).
3. Botón **Add** → escoge **D1 database**.
4. Llena así:

   | Campo | Valor |
   |-------|-------|
   | Variable name | `DB` |
   | D1 database | `flota-hrno` |

   > El nombre de la variable tiene que ser exactamente **`DB`**, en mayúsculas.
   > Así es como el código la busca.

5. **Save** / **Deploy**.

---

## Paso 4 — Agregar las dos variables de configuración

En la misma pantalla de **Settings**, sección **Variables** (texto normal, no
secreto). Agrega estas dos:

| Nombre | Valor |
|--------|-------|
| `ORIGENES_PERMITIDOS` | `https://danto0702.github.io,http://localhost:8788,http://127.0.0.1:5500` |
| `HORAS_SESION` | `12` |

**Save** / **Deploy**.

---

## Paso 5 — Agregar la clave de instalación

Esta sí va como **secreto** (Secret / Encrypt), para que no quede a la vista.

1. En **Variables and Secrets**, botón **Add** → tipo **Secret**.
2. Nombre:

   ```
   CLAVE_ADMIN_INICIAL
   ```

3. Valor: **invéntate una clave larga y anótala**. La vas a usar una sola vez,
   en el paso 7. Por ejemplo: `FlotaHRNO-Instalacion-2026-Catatumbo`
4. **Save** / **Deploy**.

---

## Paso 6 — Comprobar que quedó vivo

Arriba en la página del Worker aparece su dirección, con esta forma:

```
https://flota-hrno.TU-SUBDOMINIO.workers.dev
```

Cópiala. Pégala en una pestaña nueva del navegador **agregándole `/api/salud`**
al final:

```
https://flota-hrno.TU-SUBDOMINIO.workers.dev/api/salud
```

Debe responder algo así:

```json
{"ok":true,"servicio":"flota-hrno","rutas":41,"ts":"2026-09-11T06:00:00Z"}
```

**Si ves eso, ya quedó.** Pásame esa dirección y sigo con las pantallas.

---

## Paso 7 — Crear tu usuario administrador

Este paso funciona **una sola vez**. Después queda bloqueado para siempre, para
que nadie pueda crearse un administrador a escondidas más adelante.

Pásame la dirección del paso 6 y yo te armo este paso ya listo. O si prefieres
hacerlo tú, en la misma pestaña del navegador abre la consola (tecla **F12**,
pestaña **Console**), pega esto cambiando los dos valores marcados, y dale Enter:

```js
fetch('https://flota-hrno.TU-SUBDOMINIO.workers.dev/api/instalar', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    clave_instalacion: 'LA-CLAVE-DEL-PASO-5',
    usuario: 'danilo',
    correo: 'danto0702@gmail.com',
    clave: 'UnaClaveTuyaLargaParaEntrar'
  })
}).then(r => r.json()).then(console.log)
```

Debe responder `{ok: true, usuario: "danilo", ...}`.

Desde ahí entras con `danilo` y esa clave, y el sistema te pide cambiarla.
**Todos los demás usuarios los creas desde la aplicación**, y solo tu usuario
puede hacerlo.

---

## Si algo sale mal

| Lo que ves | Qué significa | Qué hacer |
|------------|---------------|-----------|
| `Error 1101` o `Worker threw exception` | Falta conectar la base de datos | Repite el paso 3, revisando que la variable se llame exactamente `DB` |
| `{"error":"Falta configurar el secreto CLAVE_ADMIN_INICIAL"}` | No quedó guardado el secreto | Repite el paso 5 |
| `{"error":"El sistema ya está instalado"}` | Ya creaste el usuario | Todo bien, ya puedes entrar |
| `{"error":"Clave de instalación incorrecta"}` | La clave del paso 7 no coincide con la del paso 5 | Revisa mayúsculas y guiones |
| La página no carga nada | El Worker no se publicó | Vuelve al editor y dale **Deploy** otra vez |

Si te sale un mensaje distinto, cópialo tal cual y mándamelo.

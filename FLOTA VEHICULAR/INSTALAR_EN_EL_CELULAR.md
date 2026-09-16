# Cómo instalar Flota Vehicular en el celular

Instructivo para entregar a los conductores. La aplicación **no está en Play Store
ni en App Store**: se instala desde el mismo navegador, en menos de un minuto.

**Dirección:**
`https://danto0702.github.io/portal-salud-publica-hrno/FLOTA VEHICULAR/`

O apunte la cámara del celular a este código:

<img src="iconos/qr-instalacion.png" alt="Código QR de la aplicación" width="220">

---

## Android (la mayoría de los celulares)

1. Abra la dirección en **Chrome**.
2. Aparece una franja azul que dice *"Instale la aplicación en el celular"*.
   Toque **Instalar**.
3. Confirme con **Instalar**.

Si no aparece la franja:

1. Toque los **tres puntos** ⋮ de la esquina superior derecha de Chrome.
2. Elija **Instalar aplicación** (o **Añadir a pantalla de inicio**).
3. Confirme.

> En Android la aplicación queda en el cajón de aplicaciones como cualquier otra,
> con el logotipo de Flota, y se puede arrastrar a la pantalla de inicio.

## iPhone y iPad

En iPhone **la instalación solo funciona desde Safari**. Si abrió el enlace desde
WhatsApp, toque los tres puntos y elija *Abrir en Safari*.

1. Abra la dirección en **Safari**.
2. Toque **Compartir** — el cuadrito con la flecha hacia arriba, en la barra de abajo.
3. Deslice hacia abajo y elija **Añadir a pantalla de inicio**.
4. Toque **Añadir**, arriba a la derecha.

## Computador (opcional, para Coordinación)

En **Chrome** o **Edge**, al final de la barra de direcciones aparece un icono de
instalar (una pantalla con una flecha). También está en el menú ⋮ → **Instalar**.

---

## Qué cambia al instalarla

| | Desde el navegador | Instalada |
|---|---|---|
| Cómo se abre | buscando la dirección o el enlace de WhatsApp | tocando el icono |
| Pantalla | con la barra de direcciones encima | completa |
| Sin señal | abre solo si esa pestaña sigue abierta | **abre siempre** |
| Accesos rápidos | no | mantenga pulsado el icono → *Mi día* |
| Se pierde si… | se cierra la pestaña o se limpia el navegador | se desinstala a propósito |

**Sin señal** la aplicación abre y deja registrar la salida y la llegada, **con
fotografía y todo**. Las marcas y las fotos se guardan en el celular y se envían
solas apenas vuelve la cobertura: la franja amarilla de arriba dice cuántas están
pendientes, y en *Viajes de hoy* aparecen marcadas como *Guardado en el celular*
hasta que suben. La hora que queda registrada es la del momento en que el
conductor marcó, no la del envío.

> Para que funcione sin señal hay que **haber entrado una vez con señal** ese
> mismo día: es cuando el teléfono se guarda su copia de la programación.

## Preguntas que suelen hacer los conductores

**¿Gasta datos?** La primera vez descarga unos 2 MB —como dos fotos— y de ahí en
adelante queda guardada en el celular. Después solo viajan los datos de cada
marca, que son unas pocas letras. Lo que sí pesa son las fotografías, y por eso
la aplicación las reduce antes de enviarlas.

**¿Ocupa mucho espacio?** Unos 2 MB, menos que dos fotos.

**¿Me sigue la ubicación todo el día?** No. La ubicación se toma **solo** en el
momento en que el conductor toca *Registrar salida* o *Registrar llegada*. No hay
seguimiento en segundo plano.

**¿Tengo que actualizarla?** No. Se actualiza sola. Cuando hay una versión nueva
aparece una franja verde con el botón **Actualizar**.

**Le di a "Bloquear" en la ubicación por error.** Tiene arreglo. En *Mi día* le
aparece una franja roja con el botón **Activar la ubicación**: tóquelo y le
muestra los pasos de su teléfono. Apenas lo permita y vuelva a la aplicación, la
franja roja desaparece sola. Mientras tanto puede seguir registrando: las marcas
quedan guardadas, señaladas *sin GPS*.

**Se me borró el icono.** Vuelva a abrir la dirección e instálela otra vez; no se
pierde nada, porque la información vive en el servidor.

---

## Para quien administra

Los iconos y las capturas del instalador se generan con:

```
node iconos/generar.mjs iconos
```

La comprobación de que todo esto sigue funcionando —iconos del tamaño correcto,
apertura sin señal, instructivos por sistema— es:

```
node worker/pruebas/prueba_pwa.mjs
```

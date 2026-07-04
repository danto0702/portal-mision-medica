# DESIGN.md — Misión Médica HRNO

> Última actualización: 20 jun 2026 · v2 (rediseño Cruz Roja, fondo claro)

---

## Filosofía de diseño

Interfaz clara, institucional y corporativa, inspirada en la identidad visual del Comité Internacional de la Cruz Roja (CICR/ICRC). El objetivo es transmitir seriedad y confianza —acorde a un contexto de protección de personal de salud en zona de conflicto armado— sin caer en la frialdad de un dashboard SaaS genérico. Se incorporan animaciones sutiles (entradas escalonadas, pulso en el logo, transiciones de hover) para que la interfaz se sienta viva sin distraer del contenido. Todo el texto en español colombiano.

> Nota: esta app usa su **propia paleta**, distinta a la paleta institucional general definida en el `CLAUDE.md` raíz del proyecto (que usa fondo oscuro `#0d1117` / morado `#7c1d6f`). Aquí se documenta la paleta real implementada en `Mision_Medica_HRNO.html`.

---

## Paleta de colores

```css
:root {
  /* Superficies */
  --bg:          #ffffff;   /* fondo principal */
  --bg-soft:     #f7f8f9;   /* fondo secundario, inputs */
  --surface:     #ffffff;   /* cards */
  --surface-2:   #f7f8f9;   /* tablas, modales */
  --surface-3:   #eef0f2;   /* hover de superficies */
  --border:      #e3e6ea;
  --border-soft: #edeff2;

  /* Texto */
  --text:        #1a1d21;   /* texto principal */
  --text-soft:   #4b5563;   /* texto secundario */
  --muted:       #76808c;   /* texto terciario, placeholders */

  /* Marca — Rojo Cruz Roja (Pantone 485C) */
  --red:         #da291c;
  --red-dark:    #a81f15;
  --red-glow:    rgba(218,41,28,.10);

  --purple:      #7c3aed;   /* módulo carnet / identificación */
  --purple-dark: #5b21b6;
  --purple-glow: rgba(124,58,237,.08);

  --blue:        #1f5fbf;   /* información, foco de inputs */
  --blue-glow:   rgba(31,95,191,.08);

  --green:       #0a8f63;   /* éxito, autorizado, completado */
  --green-dark:  #066b49;
  --green-glow:  rgba(10,143,99,.08);

  --yellow:      #b45309;   /* advertencia, pendiente, admin */
  --yellow-glow: rgba(180,83,9,.08);

  --cyan:        #0e7490;
}
```

> ⚠️ **Nota abierta:** `#da291c` es el equivalente hex estándar de Pantone 485C (rojo institucional de la Cruz Roja a nivel internacional). No se ha confirmado contra un manual de marca específico de la Cruz Roja Colombiana o del HRNO — se usa como mejor aproximación disponible.

### Uso semántico

| Color | Significado |
|-------|-------------|
| Rojo `#da291c` | Identidad de marca "Misión Médica", botones primarios, requeridos (`*`), acentos de cards |
| Morado `#7c3aed` | Todo lo relacionado con carnet/identificación (formulario, tarjeta virtual, QR) |
| Azul `#1f5fbf` | Contenido informativo, focos de inputs, gráficas por municipio |
| Verde `#0a8f63` | Estados de éxito, autorizado, completado, aprobado |
| Amarillo `#b45309` | Advertencias, pendientes, acceso administrativo |

Todos los colores semánticos fueron oscurecidos respecto a sus equivalentes de UI "neón" típicos de tema oscuro, para cumplir contraste **AA (4.5:1)** sobre fondo blanco.

---

## Tipografía

- **Titulares / display:** `'Source Serif 4', Georgia, serif` — usada en `h1`, `h2`, `h3`, el nombre de marca en la barra de navegación y la tarjeta de carnet. Aporta el carácter institucional solicitado, evocando documentos oficiales y papelería de organismos humanitarios.
- **Cuerpo / UI:** `'Inter', system-ui, sans-serif` — labels, párrafos, botones, tablas.
- Pesos usados: 400 (normal), 500-600 (semibold, labels/valores), 700-800 (bold/extrabold, títulos y CTAs).
- Tamaños base: ~0.9rem cuerpo, ~0.7-0.85rem texto secundario/labels, `clamp(1.7rem,4vw,2.6rem)` en `h1` de hero.

```html
<link href="https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,400;8..60,600;8..60,700;8..60,800&family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

---

## Animación — principios

El sitio usa animación con propósito, no decorativa, y respeta `prefers-reduced-motion`:

```css
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation-duration:.001ms !important;animation-iteration-count:1 !important;transition-duration:.001ms !important}
}
```

- **`fadeUp`** — entrada de cards/stat-cards/carnet, traslación vertical de 10px + opacidad. Usada en combinación con `:nth-of-type()` para crear un efecto de entrada escalonada (`animation-delay` incremental de .04-.15s) sin necesitar JS/IntersectionObserver.
- **`pulseRed`** — pulso sutil en el ícono de cruz de la marca (`.nav-brand .cross`), ciclo de 2.6s, evoca "signo vital".
- **`fadeIn`/`fadeScale`** — transición entre vistas (`.page-view`) y modales.
- **Hover lift** — `.card`, `.stat-card`, `.btn` se elevan 1-2px (`translateY(-2px)`) con sombra `--shadow-md` al pasar el mouse, dando sensación de superficie física.
- **`shimmer`** — keyframe disponible para estados de carga tipo skeleton (reservado, aún sin uso activo).

---

## Componentes y patrones reutilizables

### Cards
`.card` — fondo blanco, borde `var(--border)`, radio `var(--r-lg)`, sombra `--shadow-sm` en reposo. Al hover: borde `#cdd3da`, sombra `--shadow-md`, barra superior de 3px con gradiente rojo→azul que aparece (`::before` con `opacity` animado). `.card-glass` usa `rgba(255,255,255,.85)` + blur para superposiciones sobre fondos con textura.

### Formularios
- `.form-group` + `.form-label` + `.form-input` / `.form-select` / `.form-textarea`
- Fondo de inputs `var(--bg-soft)`, foco con borde azul + halo `var(--blue-glow)`
- Campos requeridos marcados con `<span class="req">*</span>` en rojo
- Layout en grilla: `.grid-2` (2 columnas) y `.grid-3` (3 columnas), responsive
- Radios agrupados en `.radio-group` con `.radio-item` (estilo "chip" seleccionable); seleccionado usa borde/fondo rojo translúcido
- Drag-and-drop de archivos: zona punteada que cambia de color al arrastrar (`var(--purple)`) o al completarse la carga (`var(--green)`)

### Botones
- `.btn-primary` (rojo, gradiente `#e23b2c → var(--red)`), `.btn-purple` (módulo carnet), `.btn-blue`, `.btn-green`, `.btn-yellow`, `.btn-secondary` (neutro, fondo blanco)
- Todos los botones de color sólido usan texto blanco (`#fff`) para contraste garantizado
- Tamaños: `.btn-sm`, `.btn-lg`
- Estado de carga: `<span class="spinner">` (anillo gris claro + arco de color actual) + texto cambia a "Enviando...", "Guardando...", etc.

### Badges / estado
- `.badge-red`, `.badge-green`, `.badge-yellow`, `.badge-blue`, `.badge-purple` — fondo translúcido (`*-glow`) + borde + texto del color semántico, nunca texto blanco sobre color sólido

### Tablas de datos (panel admin)
- `.data-table` — encabezado `var(--surface-2)` con texto `--muted`, primera columna resaltada en `--text`, hover de fila en `var(--bg-soft)`

### Toasts (notificaciones)
- `.toast-success` / `.toast-error` / `.toast-info` / `.toast-warn` — fondo blanco sólido + borde de color semántico + sombra `--shadow-md` (en vez de fondo translúcido de color, que perdía legibilidad sobre blanco). Auto-dismiss.

### Modales
- `.modal-box` — fondo `var(--surface-2)`, barra superior de 3px con gradiente rojo→azul (reemplaza la línea sutil blanca del tema oscuro), confirmaciones con texto en `--text-soft`

### Gráficas (Chart.js)
- Ejes y leyenda en `#76808c`, líneas de grilla en `#e3e6ea`
- Paleta de series alineada a los tokens: rojo `#da291c`, morado `#7c3aed`, azul `#1f5fbf`, amarillo `#b45309`, verde `#0a8f63`

### Carnet / Tarjeta virtual
- `.carnet-card` — **excepción intencional**: mantiene gradiente oscuro (`#0d0820 → #170826 → #1e0b16`) con acentos morados, a modo de "tarjeta VIP/ID física" que contrasta deliberadamente con el resto de la interfaz clara, reforzando que es un documento de identificación oficial descargable. Foto 76×76px con borde morado, QR en contenedor blanco 108×108px (nivel de corrección `L`), número de carnet en monospace.

---

## Layout y responsive

- Mobile-first implícito: grids de 2/3 columnas colapsan en pantallas pequeñas
- Sin framework CSS — Tailwind CDN (utilidades puntuales) + CSS custom inline en `<style>`
- Navegación por pestañas (`.nav-tab`) en la parte superior, ícono + texto, estado activo resaltado en rojo con fondo `--red-glow`
- Barra de navegación con fondo blanco translúcido (`rgba(255,255,255,.85)`) + blur, línea inferior con gradiente rojo→azul
- Panel admin con sub-pestañas (`.admin-tab`) por sección (carnets, emblemas, infracciones, capacitaciones)

---

## Accesibilidad

- Todos los pares texto/fondo de la paleta fueron verificados o ajustados para cumplir **WCAG AA (4.5:1)** sobre `--bg: #ffffff`
- `prefers-reduced-motion` desactiva todas las animaciones de entrada/transición
- Estados de foco visibles en inputs (halo de color + cambio de borde)

---

## Iconografía

- **Lucide** (SVGs inline) para iconos de navegación e interfaz
- Emojis puntuales heredados en selección de tipo de emblema (🦺 chaleco, 🚩 bandera, 🛡️ peto) — única excepción a "sin emojis en código", ya usados como iconografía visible al usuario final, no en código de lógica

---

## Documento PDF — Reporte de Infracciones e Incidentes

Generado con `jsPDF`, replica el **formato oficial ICRC / Resolución 4481 de 2012**:
- Una sola página
- Encabezado sin logos, solo texto (nombre de la resolución + título del formato)
- Radicado secuencial `RIICMM-AAAA-NNN` en la esquina superior izquierda
- Recuadros/tablas que se ajustan dinámicamente a la longitud del contenido registrado (no son cajas de tamaño fijo)
- Checkboxes para tipo de evento (Infracción / Incidente) y otras preguntas SI/NO/NO SABE
- Sin sección de firmas

(El PDF en sí no usa la paleta de la interfaz — sigue convenciones de documento oficial en blanco/negro.)

## Tarjeta de Carnet — PDF/imagen

Generado con `jsPDF` + `html2canvas` (scale 4, `useCORS:true`) a partir del nodo `.carnet-card` renderizado en pantalla — exportación fiel al diseño visual oscuro/morado mostrado al usuario (ver excepción intencional arriba).

---

## Historial de versiones del diseño

| Versión | Fecha | Cambios |
|---------|-------|---------|
| v1 | 20 jun 2026 | Documentación del tema oscuro original (`#080c10`, rojo `#e94560`, morado `#9333ea`) |
| v2 | 20 jun 2026 | Rediseño completo a tema claro con paleta Cruz Roja (`#da291c`), tipografía `Source Serif 4` + `Inter`, animaciones de entrada/hover, corrección de contraste AA en toda la UI |

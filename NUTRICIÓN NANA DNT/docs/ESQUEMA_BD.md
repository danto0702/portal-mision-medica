# Esquema de datos — Supabase SI-APS HRNO

Proyecto `wttljozqyaxlzilomnef`. Todas las tablas llevan prefijo `dnt_` y tienen
Row Level Security activo.

## Tablas

| Tabla | Qué guarda |
|---|---|
| `dnt_municipios` | Ábrego, Convención, El Carmen y Teorama, con código DANE y coordenadas |
| `dnt_sedes` | Puntos de atención, incluidos los corregimientos San Pablo y Guamalito |
| `dnt_perfiles` | Rol en el módulo (admin, coordinador, responsable) y estado de aprobación |
| `dnt_usuarios_municipio` | Alcance territorial de cada responsable |
| `dnt_ninos` | Datos del niño. Único por (tipo de documento, número) |
| `dnt_casos` | Un caso por episodio. Un solo caso abierto por niño a la vez |
| `dnt_seguimientos` | Cada atención: antropometría, puntajes Z, apetito, conducta, FTLC |
| `dnt_factores_catalogo` · `dnt_caso_factores` | Catálogo de 16 factores y los presentes en cada caso |
| `dnt_checklist_catalogo` · `dnt_checklist_respuestas` | 24 ítems (A, B y C) y su estado por caso o por seguimiento |
| `dnt_soportes` | Archivos con versionado y borrado lógico recuperable |
| `dnt_jornadas_extramurales` | Búsqueda activa comunitaria |
| `dnt_inventario` | Movimientos de FTLC, fórmula de inicio, F-75, F-100, SRO |
| `dnt_equipos` | Hoja de vida y calibración de equipos antropométricos |
| `dnt_capacitaciones` | Talento humano capacitado, para el indicador trimestral |
| `dnt_importaciones` | Historial de cargues de Excel con sus alertas |
| `dnt_log` | Auditoría: ingresos, consultas, cargues, descargas, cierres, permisos |

## Vistas

- **`dnt_v_casos_detalle`** — caso con su último seguimiento y el estado del control
  (al día, por vencer, vencido, sin programar, cerrado).
- **`dnt_v_indicadores`** — numeradores y denominadores de los indicadores mensuales.

Ambas con `security_invoker = true`: respetan la RLS del usuario que consulta.

## Seguridad

Cuatro funciones `SECURITY DEFINER` deciden todo:

| Función | Devuelve |
|---|---|
| `dnt_rol()` | admin, coordinador, responsable o ninguno. El superadministrador del portal cuenta como admin |
| `dnt_municipios_usuario()` | Municipios visibles. Admin y coordinador ven todos |
| `dnt_puede_ver(municipio)` | Lectura |
| `dnt_puede_editar(municipio)` | Escritura. El coordinador siempre da falso: es de sólo lectura |

Tres triggers cierran los huecos que las políticas no cubren:

- **`dnt_hereda_municipio`** — el municipio de seguimientos, check-lists y soportes se
  deriva del caso. Un responsable no puede escribir en otro territorio falseando la columna.
- **`dnt_guard_casos`** — sólo coordinador y administrador cierran o reabren casos; el
  coordinador no puede tocar nada más.
- **`dnt_guard_perfiles`** — el autoregistro siempre nace *pendiente* y como *responsable*;
  nadie se asciende a sí mismo.

## Almacenamiento

Bucket privado `dnt-soportes`, máximo 15 MB por archivo, sólo PDF, JPEG, PNG y WEBP.
Ruta: `<MUNICIPIO_SLUG>/<caso_id>/<uuid>.<ext>`. Las políticas leen el municipio de la
primera carpeta de la ruta, así que el alcance territorial también aplica a los archivos.
Se sirven por URL firmada temporal, nunca en público.

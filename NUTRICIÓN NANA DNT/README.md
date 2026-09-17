# Seguimiento Nutricional Infantil HRNO

Sistema de seguimiento nominal del **riesgo y la desnutrición aguda en menores de 5 años**
para IPS de primer nivel de complejidad, conforme a la **Resolución 2350 de 2020** y la
**Resolución 115 de 2026** del Ministerio de Salud y Protección Social.

ESE Hospital Regional Noroccidental · Coordinación de Salud Pública · Norte de Santander.

Marca **NANA DNT**: azul `#0C2858` y dorado `#E1A823`. El dorado no se usa en el
semáforo nutricional, porque se confundiría con el amarillo del riesgo.

---

## Qué hace

| Función | Detalle |
|---|---|
| **Clasificación automática** | Calcula el puntaje Z de P/T-L, P/E, T/E e IMC/E con las tablas OMS 2006 adoptadas por la Res. 2465 de 2016. Integra perímetro braquial y edema: gana el criterio más severo. |
| **Algoritmo de atención** | Ruta por grupo etario (menor de 6 meses y 6 a 59 meses), prueba de apetito con FTLC, criterios de remisión y paquete de estabilización. |
| **Tratamiento** | Esquema de FTLC por diagnóstico y día, calculadora farmacológica (amoxicilina, albendazol, ácido fólico, hierro) y esquema de transición del numeral 5.1.8. |
| **Check-list** | Listas A (atención inicial), B (cada control) y C (egreso) con estado, fecha, observación y soportes en PDF o imagen, versionados. |
| **Factores de riesgo** | 16 factores con puntaje que prioriza la agenda de seguimiento. |
| **Alertas** | Bandeja de controles vencidos y por vencer. El seguimiento es semanal. |
| **Indicadores** | Los 6 indicadores de las tablas 44 y 45 del anexo técnico. |
| **Apoyo** | Inventario de FTLC y fórmula de inicio, hoja de vida de equipos antropométricos, búsqueda activa comunitaria y capacitación del talento humano. |
| **Información** | Las dos resoluciones completas y un simulador del algoritmo para consulta y capacitación. |

---

## Roles y alcance territorial

| Rol | Puede |
|---|---|
| **Administrador** | Ver y editar todo, gestionar usuarios y permisos, eliminar y restaurar documentos, consultar la auditoría. |
| **Coordinador** | Ver todos los municipios, descargar información y estadísticas, cerrar casos y reasignar responsables. **No edita datos clínicos.** |
| **Responsable** | Cargar, descargar y consultar **únicamente** los municipios que tenga asignados. |

El alcance no es sólo de interfaz: está en la base de datos con Row Level Security. Un
responsable de Ábrego no puede leer ni escribir datos de Convención aunque llame
directamente a la API.

El autoregistro deja la cuenta en estado *pendiente*: el administrador debe aprobarla y
asignarle municipio antes de que pueda entrar.

---

## Archivos

```
NUTRICIÓN NANA DNT/
├── index.html              ← aplicación
├── login.html              ← ingreso, autoregistro y recuperación de clave
├── app/
│   ├── lms.js              ← tablas LMS de la OMS 2006 (generado, no editar a mano)
│   ├── antro.js            ← motor antropométrico: puntajes Z y clasificación
│   ├── clinico.js          ← motor clínico: apetito, FTLC, fármacos, remisión
│   ├── auth-dnt.js         ← sesión, roles y alcance territorial
│   ├── datos.js            ← acceso a datos (Supabase)
│   ├── ui.js               ← núcleo de interfaz, tablero y listado de casos
│   ├── ficha.js            ← ficha del caso, seguimientos, check-list, soportes
│   ├── importador.js       ← cargue de Excel y formulario caso a caso
│   ├── informacion.js      ← normatividad y simulador del algoritmo
│   ├── gestion.js          ← indicadores, apoyo y administración
│   ├── estilos.css         ← sistema de diseño
│   └── pruebas.js          ← verificación de los motores (node app/pruebas.js)
├── assets/                 ← logotipo NANA DNT, firma PascalIA e iconos
│   ├── nana-dnt-logo.png   ← lockup completo, para la pantalla de ingreso
│   ├── nana-dnt-simbolo.png← sólo el emblema, para el encabezado y el PDF
│   ├── icono-{32,180,192}.png ← pestaña del navegador y pantalla de inicio
│   └── pascalia.png       ← firma del pie, igual que en Flota Vehicular
├── libs/                   ← Chart.js, SheetJS y jsPDF locales
├── sql/                    ← histórico de migraciones aplicadas
└── docs/                   ← esquema de datos, despliegue y decisiones clínicas
```

---

## Uso

1. Abrir `index.html` desde el Portal de Salud Pública o directamente.
2. Ingresar con la cuenta del portal.
3. Si es la primera vez, solicitar acceso desde la pantalla de ingreso.

**Requiere internet**: los datos viven en Supabase (proyecto SI-APS HRNO).

## Verificación

```bash
node "app/pruebas.js"
```

81 comprobaciones sobre los motores antropométrico y clínico: reconstrucción de los
valores de corte publicados por la OMS, coherencia interna del cálculo de Z, ajuste para
puntajes extremos, umbrales normativos, prueba de apetito, criterios de remisión y
esquemas de tratamiento.

---

## Extraer a su propio repositorio

El módulo es autocontenido. Para llevarlo a un repositorio propio:

```bash
# Opción A — conservando el historial de esta carpeta
git subtree split --prefix="NUTRICIÓN NANA DNT" -b nutricion-solo
git push <nuevo-remoto> nutricion-solo:main

# Opción B — copia simple
cp -r "NUTRICIÓN NANA DNT" ../seguimiento-nutricional-hrno
cd ../seguimiento-nutricional-hrno && git init && git add -A && git commit -m "Versión inicial"
```

Al extraerlo hay que ajustar dos cosas: el enlace `← Portal` del encabezado de
`index.html` y la ruta `../index.html`, que dejan de tener sentido fuera del portal.

---

*Desarrollado para la Coordinación de Salud Pública de la ESE HRNO · septiembre de 2026*

# Portal de Salud Pública — ESE Hospital Regional Noroccidental

**Coordinación de Salud Pública · Norte de Santander, Colombia**

Ecosistema de aplicaciones web locales para la gestión operativa de los programas de Salud Pública de la ESE HRNO. Todas las aplicaciones funcionan como archivos HTML abiertos directamente en el navegador, sin servidor ni frameworks externos.

---

## Módulos disponibles

| Módulo | Descripción | Archivo principal |
|--------|-------------|-------------------|
| **Portal principal** | Índice de todos los módulos | [`index_Principal_Salud_Publica.html`](index_Principal_Salud_Publica.html) |
| **PAI** | Analizador de coberturas, CertiVac | [`PAI/index.html`](PAI/index.html) |
| **Buscador CUPS** | Búsqueda offline de códigos CUPS (PWA) | [`Generador CUPS/index.html`](Generador%20CUPS/index.html) |
| **Vigilancia SP** | Monitor SIVIGILA | [`VIGILANCIA SP/SIVIGILA_Monitor_v2.html`](VIGILANCIA%20SP/SIVIGILA_Monitor_v2.html) |
| **Herramientas** | Consolidador PAI y utilidades | [`HERRAMIENTAS/Consolidador_PAI.html`](HERRAMIENTAS/Consolidador_PAI.html) |
| **Herramientas interoperables** | PCI-App, DiagramFlow, Buscador CUPS extendido | [`HERRAMIENTAS INTEROPERABLES/`](HERRAMIENTAS%20INTEROPERABLES/) |

---

## Uso

1. Clonar o descargar el repositorio
2. Abrir `index_Principal_Salud_Publica.html` en el navegador
3. Navegar a cada módulo desde el portal central

> No requiere instalación, servidor web ni conexión a internet (excepto CertiVac que se conecta a Google Sheets).

---

## Tecnologías

- HTML5 + CSS3 + JavaScript vanilla (sin frameworks)
- PWA con Service Worker (Buscador CUPS)
- Python scripts auxiliares (`openpyxl`, `python-docx`)
- Google Apps Script para integración con Sheets (CertiVac, PCI-App)

---

## Estructura

```
PORTAL SALUD PÚBLICA/
├── index_Principal_Salud_Publica.html   ← Portal central
├── Generador CUPS/                      ← Buscador CUPS offline (PWA)
├── PAI/                                 ← Plan Ampliado de Inmunizaciones
│   ├── index.html                       ← Menú PAI
│   ├── Analizador_PAI_HRNO.html         ← Análisis de coberturas
│   └── CertiVac.html                    ← Emisión de certificados de vacunación
├── VIGILANCIA SP/                       ← Vigilancia epidemiológica
│   └── SIVIGILA_Monitor_v2.html         ← Monitor de notificaciones SIVIGILA
├── HERRAMIENTAS/                        ← Utilidades internas
└── HERRAMIENTAS INTEROPERABLES/         ← Aplicaciones con integración externa
    └── PCI-App/                         ← App PIC (Plan de Intervenciones Colectivas)
```

---

## Contexto institucional

- **Entidad**: ESE Hospital Regional Noroccidental
- **Departamento**: Norte de Santander, Colombia
- **Programas**: PAI, PIC, EBS, Jóvenes en Paz, Misión Médica, Vigilancia Epidemiológica
- **Municipios**: Ábrego, Convención, El Carmen, Teorama

> Los datos operativos (registros de vacunación, consolidados de pacientes, reportes SIVIGILA) no se incluyen en este repositorio por razones de confidencialidad y protección de datos personales.

---

*Desarrollado con Claude Code · Mayo 2026*

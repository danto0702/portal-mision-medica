# Migraciones aplicadas en Supabase — proyecto SI-APS HRNO

Todas las migraciones ya fueron aplicadas al proyecto `wttljozqyaxlzilomnef` (SI-APS HRNO).
Este directorio conserva el histórico para control de cambios y para poder reconstruir
el esquema en otro proyecto.

| # | Migración | Contenido |
|---|-----------|-----------|
| 01 | `dnt_01_catalogos_perfiles_helpers` | Municipios, sedes, perfiles, alcance territorial y funciones de permisos |
| 02 | `dnt_02_ninos_casos_seguimientos` | Niños, casos, seguimientos y factores de riesgo |
| 03 | `dnt_03_checklist_soportes_apoyo` | Check-lists, soportes versionados, extramural, inventario, equipos, importaciones y auditoría |
| 04 | `dnt_04_semillas_catalogos` | Semillas de municipios, sedes, 16 factores de riesgo y 24 ítems de check-list |
| 05 | `dnt_05_triggers_integridad` | Herencia de municipio, blindaje de cierre de casos, versionado de soportes |
| 06 | `dnt_06_rls_politicas` | Row Level Security de todas las tablas |
| 07 | `dnt_07_storage_bucket` | Bucket privado `dnt-soportes` con políticas por municipio |
| 08 | `dnt_08_capacitaciones_vistas_indicadores` | Capacitaciones y vistas `dnt_v_casos_detalle` y `dnt_v_indicadores` |
| 09 | `dnt_09_registro_modulo_y_admin` | Registro en `portal_modulos` y perfil del superadministrador |
| 10 | `dnt_10_hardening_funciones` | `search_path` fijo y permisos mínimos de ejecución |
| 11 | `dnt_11_fix_guard_perfiles_contexto_servicio` | Los triggers ceden ante el contexto de servicio |

Para exportar el esquema vigente:

```sql
-- Desde el SQL editor de Supabase
select table_name, column_name, data_type
from information_schema.columns
where table_schema='public' and table_name like 'dnt%'
order by table_name, ordinal_position;
```

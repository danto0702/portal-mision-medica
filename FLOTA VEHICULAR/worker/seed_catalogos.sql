-- ============================================================================
-- FLOTA VEHICULAR HRNO — carga inicial de CATALOGOS NO PERSONALES
-- Extraidos de CONDUCTORES_EBS.xlsx (itinerario 10 al 22 de septiembre)
--
-- IMPORTANTE: este archivo NO contiene nombres de conductores, cedulas,
-- telefonos ni placas. Esos datos son personales (Ley 1581 de 2012) y en el
-- caso de la Mision Medica identifican a personas expuestas en zona de
-- conflicto, por lo que NO se versionan en un repositorio publico.
-- Se cargan desde la pantalla de administracion de la aplicacion.
-- Ver PROJECT.md seccion 4.7.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MUNICIPIOS
-- Los cuatro primeros son los que aparecen en el archivo de conductores.
-- TEORAMA se incluye porque es el municipio del que SAN PABLO es corregimiento;
-- confirmar cual de los dos debe figurar como municipio. Ver pregunta P1.
-- ---------------------------------------------------------------------------
INSERT INTO cat_municipios (nombre, codigo_dane, es_base, activo) VALUES
  ('ÁBREGO',     '54003', 1, 1),
  ('CONVENCIÓN', '54206', 1, 1),
  ('EL CARMEN',  '54245', 1, 1),
  ('TEORAMA',    '54800', 1, 1),
  ('SAN PABLO',  NULL,    1, 1),   -- corregimiento de Teorama: confirmar (P1)
  ('CÚCUTA',     '54001', 0, 1);   -- destino externo (remisiones y tramites)

-- ---------------------------------------------------------------------------
-- DESTINOS
-- municipio_id queda NULO a proposito: en el archivo fuente el municipio de la
-- columna corresponde a la BASE del conductor, no al municipio del destino
-- (p. ej. CARTAGENITA la atiende un conductor de Convencion pero figura como
-- puesto de salud de El Carmen). Asignarlos requiere confirmacion. Ver P2.
--
-- 'LA SIERRA' aparece atendida por conductores de tres municipios distintos:
-- puede ser una sola vereda compartida o tres lugares homonimos. Ver P3.
-- 'CAMPO ALEGRE' se normaliza desde 'CAMPOR ALEGRE' del archivo original.
-- ---------------------------------------------------------------------------
INSERT INTO cat_destinos (municipio_id, nombre, tipo, activo) VALUES
  (NULL, 'ASERRÍO',          'vereda', 1),
  (NULL, 'CAMPO ALEGRE',     'vereda', 1),
  (NULL, 'CAPITANLARGO',     'vereda', 1),
  (NULL, 'CARTAGENITA',      'vereda', 1),
  (NULL, 'CASA BLANCA',      'vereda', 1),
  (NULL, 'CECILIA',          'vereda', 1),
  (NULL, 'HONDURAS',         'vereda', 1),
  (NULL, 'HOYO PILÓN',       'vereda', 1),
  (NULL, 'LA LAGUNA',        'vereda', 1),
  (NULL, 'LA SIERRA',        'vereda', 1),
  (NULL, 'PLAYAS LINDAS',    'vereda', 1),
  (NULL, 'SAN JUANCITO',     'vereda', 1),
  (NULL, 'SANTA INÉS',       'vereda', 1),
  (NULL, 'TIERRA AZUL',      'vereda', 1),
  (NULL, 'PARQUE PRINCIPAL', 'cabecera', 1),
  (NULL, 'IPS SAN PABLO',    'ips', 1),
  (NULL, 'CÚCUTA',           'ciudad', 1);

-- ---------------------------------------------------------------------------
-- PARAMETROS DE OPERACION
-- ---------------------------------------------------------------------------
INSERT INTO parametros (clave, valor, descripcion) VALUES
  ('checklist_bloquea_salida', 'advertir',
   'Que hacer si un distintivo o elemento falta: bloquear | advertir'),
  ('umbral_discrepancia_dias', '0',
   'Diferencia tolerada entre dias contados por la app y dias del soporte firmado'),
  ('gps_obligatorio', '1',
   'Exigir coordenadas en las marcas de salida y llegada'),
  ('gps_precision_maxima_m', '100',
   'Precision maxima aceptada en metros; por encima se marca como dudosa'),
  ('dias_alerta_vencimiento', '30',
   'Dias de anticipacion para el semaforo amarillo de vencimientos'),
  ('dia_disponible_es_pagable', '1',
   'Si un dia en estado DISPONIBLE cuenta para la liquidacion'),
  ('correo_alertas', '',
   'Destinatarios de las alertas automaticas, separados por coma');

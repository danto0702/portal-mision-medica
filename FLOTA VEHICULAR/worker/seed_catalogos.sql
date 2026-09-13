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
-- SAN PABLO se usa con su propio nombre por decision operativa, aunque sea
-- corregimiento de TEORAMA: la pertenencia queda trazada en municipio_padre_id.
-- Todo este catalogo es editable desde la pantalla de administracion.
-- ---------------------------------------------------------------------------
INSERT INTO cat_municipios (nombre, codigo_dane, es_base, activo, creado_en) VALUES
  ('ÁBREGO',     '54003', 1, 1, datetime('now')),
  ('CONVENCIÓN', '54206', 1, 1, datetime('now')),
  ('EL CARMEN',  '54245', 1, 1, datetime('now')),
  ('TEORAMA',    '54800', 1, 1, datetime('now')),
  ('SAN PABLO',  NULL,    1, 1, datetime('now')),
  ('CÚCUTA',     '54001', 0, 1, datetime('now'));   -- destino externo

-- SAN PABLO cuelga de TEORAMA sin dejar de mostrarse con su propio nombre
UPDATE cat_municipios
   SET municipio_padre_id = (SELECT id FROM cat_municipios WHERE nombre = 'TEORAMA')
 WHERE nombre = 'SAN PABLO';

-- ---------------------------------------------------------------------------
-- DESTINOS
-- municipio_id queda NULO a proposito: el municipio del destino se registra al
-- adjudicar el desplazamiento, no aqui. Estos 17 destinos entran solo como
-- semilla del autocompletado, tomados del itinerario del 10 al 22 de septiembre.
--
-- 'LA SIERRA' es UN SOLO lugar: la atienden conductores de varios municipios
-- porque el municipio base del conductor no restringe a donde puede desplazarse.
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
   'Destinatarios de las alertas automaticas, separados por coma'),
  ('foto_obligatoria', '1',
   'Exigir fotografia al marcar salida y llegada'),
  ('app_foto_activa', '1',
   'Tomar la foto con una aplicacion externa en vez de la camara del telefono'),
  ('app_foto_nombre', 'Timemark',
   'Nombre de la aplicacion que se le muestra al conductor'),
  ('app_foto_android', 'com.oceangalaxy.camera.new',
   'Identificador en Google Play'),
  ('app_foto_ios', '6446071834',
   'Identificador en la App Store'),
  ('foto_antiguedad_minutos', '60',
   'Avisar si la foto adjuntada es mas vieja que esto');

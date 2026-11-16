-- Semilla del catálogo (RF-02, RF-03). Carga un inventario de demostración con
-- equipos audiovisuales reales, completos en marca, modelo, descripción, tarifa
-- por día, imagen y unidades físicas etiquetadas, para que el catálogo público y
-- la administración tengan datos verificables desde el primer arranque.
--
-- Las imágenes son ilustraciones del mismo origen en `src/frontend/img`.
-- Sustituir una por una fotografía solo exige cambiar `image_url` desde la
-- administración; el modelo de datos no cambia.
--
-- Cada inserción es idempotente contra sus índices únicos, de modo que la
-- migración también se puede aplicar sobre una base que ya tenga parte de estos
-- registros sin duplicar nada ni interrumpir el despliegue.

INSERT INTO audiovisual.categories (name)
VALUES
  ('Cámaras'),
  ('Ópticas'),
  ('Iluminación'),
  ('Audio'),
  ('Soportes y estabilizadores'),
  ('Proyección y monitores')
ON CONFLICT (lower(name)) DO NOTHING;

INSERT INTO audiovisual.equipment
  (category_id, name, description, brand, model, daily_rate_cents, image_url, published)
SELECT c.id, s.name, s.description, s.brand, s.model, s.daily_rate_cents, s.image_url, true
FROM (
  VALUES
    ('Cámaras', 'Cámara de cine full-frame Sony FX3',
     'Cámara de cine compacta con sensor full-frame retroiluminado, grabación 4K a 120 fps, doble ISO base y perfil S-Cinetone. Incluye asa XLR con dos entradas de audio, dos ranuras CFexpress tipo A y batería NP-FZ100 con cargador doble.',
     'Sony', 'FX3', 7500, '/img/sony-fx3.svg'),
    ('Cámaras', 'Cámara híbrida 8K Canon EOS R5 C',
     'Cuerpo híbrido de cine y fotografía con sensor full-frame de 45 MP, grabación interna 8K RAW sin límite de tiempo y ventilación activa. Montura RF, doble ranura CFexpress y SD, salida HDMI de tamaño completo y alimentación por USB-C.',
     'Canon', 'EOS R5 C', 8500, '/img/canon-eos-r5-c.svg'),
    ('Cámaras', 'Cámara Blackmagic Pocket Cinema 6K Pro',
     'Sensor Super 35 de 6K con montura EF, filtros ND internos de 2, 4 y 6 pasos y pantalla táctil inclinable de 5 pulgadas. Graba Blackmagic RAW y ProRes en CFast, SD UHS-II o unidades USB-C, e incluye la licencia de DaVinci Resolve Studio.',
     'Blackmagic Design', 'Pocket Cinema Camera 6K Pro', 6000, '/img/blackmagic-design-pocket-cinema-camera-6k-pro.svg'),
    ('Ópticas', 'Objetivo zoom Canon RF 24-70mm f/2.8L IS USM',
     'Zoom estándar de apertura constante f/2.8 con estabilización óptica de 5 pasos, motor nano USM y sellado contra polvo y salpicaduras. Diámetro de filtro de 82 mm y anillo de control personalizable. Se entrega con parasol y dos tapas.',
     'Canon', 'RF 24-70mm f/2.8L IS USM', 2800, '/img/canon-rf-24-70mm-f-2-8l-is-usm.svg'),
    ('Ópticas', 'Objetivo zoom Sigma 18-35mm f/1.8 DC HSM Art',
     'Zoom para sensor APS-C con apertura constante f/1.8 en todo el recorrido, nueve palas de diafragma y enfoque interno con motor hipersónico. Montura EF, diámetro de filtro de 72 mm y distancia mínima de enfoque de 28 cm.',
     'Sigma', '18-35mm f/1.8 DC HSM Art', 1800, '/img/sigma-18-35mm-f-1-8-dc-hsm-art.svg'),
    ('Iluminación', 'Foco LED Aputure LS 600d Pro',
     'Foco COB de luz de día de 600 W con montura Bowens, índice de reproducción cromática superior a 95 y control por cable, DMX o aplicación. Se entrega con reflector, cúpula difusora, balasto conmutable y maleta rígida de transporte.',
     'Aputure', 'LS 600d Pro', 5500, '/img/aputure-ls-600d-pro.svg'),
    ('Iluminación', 'Kit de tubos LED Nanlite PavoTube II 30X',
     'Juego de cuatro tubos RGBWW de 120 cm con batería interna de hasta cuatro horas, temperatura de color ajustable entre 2700 y 7500 K y doce efectos programados. Control por aplicación o DMX. Incluye maleta, soportes y fuentes.',
     'Nanlite', 'PavoTube II 30X', 3500, '/img/nanlite-pavotube-ii-30x.svg'),
    ('Audio', 'Sistema inalámbrico de micrófonos Rode Wireless PRO',
     'Dos transmisores y un receptor de 2,4 GHz con alcance de 260 m, grabación interna de respaldo de 32 bits en coma flotante y temporización automática. Incluye dos micrófonos de solapa Lavalier II, estuche de carga y adaptadores.',
     'Rode', 'Wireless PRO', 2200, '/img/rode-wireless-pro.svg'),
    ('Audio', 'Micrófono de cañón Sennheiser MKH 416',
     'Micrófono de condensador supercardioide para rodaje en exteriores, con gran rechazo del sonido lateral y baja sensibilidad a la humedad. Alimentación phantom de 48 V. Se entrega con pinza elástica, espuma y cable XLR de 5 m.',
     'Sennheiser', 'MKH 416', 2000, '/img/sennheiser-mkh-416.svg'),
    ('Audio', 'Grabadora de campo Zoom H6essential',
     'Grabadora de seis pistas con conversión de 32 bits en coma flotante, cuatro entradas combo XLR y TRS con alimentación phantom y cápsula estéreo XY intercambiable. Graba en tarjeta SD y funciona como interfaz USB. Incluye pistola y asa.',
     'Zoom', 'H6essential', 1500, '/img/zoom-h6essential.svg'),
    ('Soportes y estabilizadores', 'Trípode de vídeo Manfrotto 504X con patas 635 Fast',
     'Rótula fluida con contrabalanceo continuo para cargas de hasta 12 kg, nivel de burbuja iluminado y bola de 75 mm sobre patas monotubo de fibra de carbono con bloqueo rápido. Altura máxima de 166 cm. Se entrega con bolsa de transporte.',
     'Manfrotto', '504X + 635 Fast Single', 2500, '/img/manfrotto-504x-635-fast-single.svg'),
    ('Soportes y estabilizadores', 'Estabilizador de tres ejes DJI RS 4 Pro',
     'Estabilizador de tres ejes para cargas de hasta 4,5 kg, con eje de inclinación extendido, bloqueos automáticos y pantalla táctil OLED. Incluye batería BG70, placa de liberación rápida, asa superior y maleta rígida.',
     'DJI', 'RS 4 Pro', 3000, '/img/dji-rs-4-pro.svg'),
    ('Proyección y monitores', 'Proyector láser Epson EB-L265F',
     'Proyector láser 3LCD de 4600 lúmenes con resolución nativa Full HD, corrección geométrica y vida útil de 20 000 horas sin cambio de lámpara. Conexión HDMI, USB y red cableada o inalámbrica. Incluye mando, cable de 10 m y soporte.',
     'Epson', 'EB-L265F', 6500, '/img/epson-eb-l265f.svg'),
    ('Proyección y monitores', 'Monitor y grabador de campo Atomos Ninja V',
     'Monitor de 5 pulgadas con 1000 nits, calibración por hardware y herramientas de exposición y enfoque. Graba ProRes y DNxHR en unidades SSD AtomX. Se entrega con dos baterías NP-F, cargador, cable HDMI y disco de 1 TB.',
     'Atomos', 'Ninja V', 1800, '/img/atomos-ninja-v.svg')
) AS s (category, name, description, brand, model, daily_rate_cents, image_url)
JOIN audiovisual.categories c ON lower(c.name) = lower(s.category)
ON CONFLICT (category_id, lower(name)) DO NOTHING;

-- Las unidades se numeran a partir del prefijo de la etiqueta física. Las que
-- superan el recuento activo quedan retiradas: el inventario las conserva y el
-- catálogo no las cuenta como aptas para alquiler (RN-01).
INSERT INTO audiovisual.units (equipment_id, inventory_code, active)
SELECT e.id, format('%s-%s', s.prefix, to_char(n, 'FM000')), n <= s.active_units
FROM (
  VALUES
    ('Cámaras', 'Cámara de cine full-frame Sony FX3', 'CAM-FX3', 3, 3),
    ('Cámaras', 'Cámara híbrida 8K Canon EOS R5 C', 'CAM-R5C', 2, 2),
    ('Cámaras', 'Cámara Blackmagic Pocket Cinema 6K Pro', 'CAM-BM6K', 2, 1),
    ('Ópticas', 'Objetivo zoom Canon RF 24-70mm f/2.8L IS USM', 'OPT-RF2470', 3, 3),
    ('Ópticas', 'Objetivo zoom Sigma 18-35mm f/1.8 DC HSM Art', 'OPT-SG1835', 2, 2),
    ('Iluminación', 'Foco LED Aputure LS 600d Pro', 'LUZ-LS600D', 2, 2),
    ('Iluminación', 'Kit de tubos LED Nanlite PavoTube II 30X', 'LUZ-PAVO30X', 2, 2),
    ('Audio', 'Sistema inalámbrico de micrófonos Rode Wireless PRO', 'AUD-RDWPRO', 4, 4),
    ('Audio', 'Micrófono de cañón Sennheiser MKH 416', 'AUD-MKH416', 2, 2),
    ('Audio', 'Grabadora de campo Zoom H6essential', 'AUD-ZH6E', 2, 2),
    ('Soportes y estabilizadores', 'Trípode de vídeo Manfrotto 504X con patas 635 Fast', 'SOP-MN504X', 3, 3),
    ('Soportes y estabilizadores', 'Estabilizador de tres ejes DJI RS 4 Pro', 'SOP-RS4PRO', 2, 2),
    ('Proyección y monitores', 'Proyector láser Epson EB-L265F', 'PRY-EBL265F', 2, 2),
    ('Proyección y monitores', 'Monitor y grabador de campo Atomos Ninja V', 'MON-NINJAV', 3, 2)
) AS s (category, equipment, prefix, total_units, active_units)
JOIN audiovisual.categories c ON lower(c.name) = lower(s.category)
JOIN audiovisual.equipment e ON e.category_id = c.id AND lower(e.name) = lower(s.equipment)
CROSS JOIN LATERAL generate_series(1, s.total_units) AS n
ON CONFLICT (inventory_code) DO NOTHING;

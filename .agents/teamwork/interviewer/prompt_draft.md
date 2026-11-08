Implementar para RedVecina los 3 ajustes específicos de alineación 1:1 con el video de Mario Cortijo, incorporar selector de ubicación y abundantes semillas para Huancayo (Junín) y zonas críticas ante catástrofes, y renovar el módulo de mapa interactivo con experiencia estilo Uber y apps de delivery.

Working directory: C:\Users\hugoc\OneDrive\Documentos\hackaton
Integrity mode: demo
The team must NOT: copy code from existing open-source projects for core logic, run external scripts or delegate execution to other tools

## Requirements

### R1. Semillas y Selector de Ubicación Hiperlocal (Huancayo y Zonas Críticas)
La aplicación debe solicitar o detectar la ubicación actual (centrándose por defecto en Junín, Huancayo) y permitir al usuario cambiar fácilmente de ubicación para prever servicios al viajar o reubicarse. Se debe poblar la base de datos y almacén local con abundantes datos y publicaciones realistas para Huancayo (ej. El Tambo, San Carlos, Centro) y zonas críticas vulnerables a desastres (terremotos, Fenómeno El Niño), cubriendo tanto necesidades cotidianas como respuesta a catástrofes. Debe incluir exactamente los casos del video de Mario Cortijo:
- Muro Solidario (Cero Dinero): préstamo de muletas ortopédicas sin costo y organización de carpooling / pool escolar vecinal entre vecinos verificados.
- Catálogo de Proximidad: lasañas caseras y postres de la vecina, clases de matemáticas y nivelación escolar, sumados a oficios técnicos esenciales (gasfitería, electricidad, enfermería).
- Emergencias y Catástrofes: puntos de acopio, soporte de oxígeno, brigadas vecinales y puntos de encuentro ante sismos o huaicos.

### R2. Módulo de Mapa Renovado Estilo Uber / Delivery
Rediseñar el módulo de mapa incorporando patrones visuales e interactivos modernos inspirados en aplicaciones de movilidad y delivery:
- Integración de librería de mapas interactiva (Leaflet o MapLibre con OpenStreetMap) conservando total resiliencia offline.
- Tarjeta inferior deslizable (bottom sheet interactivo estilo Uber/Rappi) con información contextual al tocar un marcador (título, categoría, estado de disponibilidad, distancia calculada y acciones de contacto o solicitud).
- Marcadores visuales diferenciados por categoría (oficios, productos, emergencias, muro solidario) con trazado visual de distancia o ruta estimada hacia el punto seleccionado.
- Controles táctiles fluidos (zoom, recentrar en mi ubicación, alternar capas y visualización en pantalla completa).

### R3. Selector de Radio Hiperlocal Configurable
Incorporar un selector visual rápido de radio de proximidad ("200m · Mi cuadra", "500m · Mi barrio", "1 km · Mi sector") visible tanto en el catálogo de proximidad como en el mapa interactivo. El cambio de radio debe filtrar y actualizar de forma inmediata y sincronizada los marcadores en el mapa y las tarjetas en el catálogo.

### R4. Tarjeta Interactiva "Modo Presentación Jurado (Pitch 3 Minutos)"
Implementar un panel flotante o conmutador interactivo accesible en pantalla diseñado específicamente para la exposición de 180 segundos ante el jurado, que incluya:
- Cronómetro regresivo visual de 3 minutos (180s) con controles de inicio, pausa y reinicio.
- Botones de acción rápida para simular en vivo las 3 pruebas clave del video:
  1. Caída de conexión / Modo Avión en 1 clic (demostrando navegación y consulta local sin internet).
  2. Publicación de emergencia SOS por voz con difuminado automático de privacidad a 50 metros.
  3. Desbloqueo auditado de Bóveda PII (datos sensibles protegidos) por un Brigadista acreditado con registro en el log local.

## Acceptance Criteria

### Ubicación y Semillas Hiperlocales
- [ ] La aplicación solicita la ubicación al inicio y permite alternar o cambiar la ubicación activa a Huancayo u otras zonas críticas.
- [ ] La base de datos local incluye registros verificables en Huancayo para: préstamo gratuito de muletas ortopédicas, carpooling escolar, lasañas caseras, clases de matemáticas, oficios técnicos y recursos de emergencia para sismos/Fenómeno El Niño.
- [ ] El cambio de ubicación recalcula y muestra las publicaciones y servicios correspondientes al sector seleccionado.

### Experiencia de Mapa Estilo Uber / Delivery
- [ ] El mapa interactivo se renderiza fluidamente con OpenStreetMap y funciona sin errores tanto online como con red desconectada.
- [ ] Al hacer clic o tocar cualquier marcador, se despliega una tarjeta inferior deslizable (bottom sheet) con la información del servicio, badge de categoría, distancia estimada y botón de acción.
- [ ] Los marcadores están estilizados y diferenciados por tipo de necesidad (solidario, comercial, emergencia) y muestran la distancia en metros/kilómetros.
- [ ] El botón de recentrar ubica el mapa en las coordenadas activas del usuario (Huancayo por defecto).

### Filtro de Radio Hiperlocal
- [ ] El selector de radio (200m, 500m, 1km) está presente y funcional en el catálogo y en el mapa.
- [ ] Al cambiar el radio, los marcadores fuera de la distancia seleccionada se ocultan automáticamente y el catálogo actualiza su lista en tiempo real.

### Modo Presentación Jurado (Pitch 3 Minutos)
- [ ] El panel del jurado es accesible en pantalla y cuenta con un cronómetro funcional de 180 segundos.
- [ ] La simulación de caída de red conmuta el estado de la aplicación a offline inmediatamente sin recargar la página.
- [ ] La simulación de emergencia SOS por voz crea un post de alerta con coordenadas difuminadas a 50 metros.
- [ ] La simulación de desbloqueo de Bóveda PII revela los datos protegidos y genera un registro de auditoría local visible.

### Calidad y Regresión
- [ ] La suite de tests automatizados (`npm test`) se ejecuta y pasa exitosamente sin regresiones.
- [ ] La verificación de tipos (`npm run typecheck`) compila sin errores.

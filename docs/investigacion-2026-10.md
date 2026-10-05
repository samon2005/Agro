# Investigación — octubre 2026

Documento de trabajo para decidir hacia dónde llevar la plataforma. Lo que se
afirma de otras empresas viene de sus páginas y tiendas de apps (fuentes al
final); conviene confirmarlo con una demo antes de usarlo en una presentación.

---

## 1. Agriness y otros: qué hacen y cómo competir

### Agriness (Florianópolis, Brasil, desde 2001)

- Software de gestión de granjas para **cerdos, aves y leche**, en la nube, en
  portugués, español e inglés.
- **S4** (cerdos): web + app que sincroniza; análisis por temas (manejo,
  economía, confort y ambiente, insumos, nutrición, sanidad); la app registra
  mortalidad con causa, pesajes y consumo por tipo y lote de alimento.
- **P4**: la línea para pollo de engorde.
- **Melhores**: ranking anual que compara granjas entre sí (benchmarking).
- Además: sensores de ambiente (IoT), **Academy** (cursos), **Accelerator**
  (mentoría con su metodología "P+1") y consultoría.
- No encontramos un producto dedicado a **gallinas ponedoras**: su fuerte es
  cerdos y engorde.

### Otros que tocan ponedoras

- **Lohmann Tierzucht**: app de especificaciones (comparar resultados con sus
  estándares) y app de programas de luz.
- **H&N (Kai Red)**: asistente para huevo de mesa y pollitas, con recordatorios
  de tareas y registro de producción.
- Apps genéricas de registro (Layer Farm Manager, PoultryPro+…): anotan la
  producción diaria, poco análisis.

### Dónde puede ganar AgroGestión

| Lo que ya tiene | Por qué importa frente a ellos |
|---|---|
| Comparación con la guía de **cualquier línea** (Hy-Line y Lohmann cargadas, copias ajustables) | Las apps de las casas genéticas solo sirven para su propia línea |
| Predicción de la curva (MCM) y **semana de descarte** con el punto de equilibrio | Pocas herramientas unen la curva con el costo del huevo |
| **Costo por huevo** con alimento consumido, amortización de las aves y costos de la finca | Es la pregunta que más se hace el productor pequeño y mediano |
| Sugerencias con posibles causas, sin dar diagnósticos, y un directorio de veterinarios | Ayuda a quien no tiene técnico de planta |
| Hecho para Colombia: pesos, NTC 1240 (tamaños de huevo), aviso al ICA, vacío sanitario | Agriness está pensado para integraciones grandes brasileñas |
| Ventas de la finca, clientes con precio y contrato, encargos | La comercialización casi nunca está en el software de producción |

**Propuesta para competir:**

1. Enfocarse en **ponedoras pequeñas y medianas de Colombia** (y luego región
   andina), donde Agriness no tiene producto propio.
2. **Benchmarking anónimo** entre fincas de la plataforma (como "Melhores"):
   postura, mortalidad y costo por huevo frente a fincas parecidas (misma línea,
   altura, clima). Requiere consentimiento explícito de cada finca.
3. **Academia ligera**: fichas cortas dentro de las sugerencias (estrés
   calórico, calcio, vacunación), en lenguaje sencillo.
4. **Acompañamiento**: un plan "con técnico" donde un veterinario o zootecnista
   revisa el tablero de la finca cada semana.
5. Más adelante, como está decidido: **WhatsApp** (recordatorios, marcar tareas)
   y **RFID** por puesto de trabajo.

---

## 2. Power BI: qué datos llevar y cómo

**Hoy (sin costo extra):** el tablero de **Reportes** y cada tabla (Resumen
semanal, Rentabilidad, Finanzas, Ventas) se bajan a **Excel (.xlsx)**, una hoja
por tabla. En Power BI Desktop (gratis): *Obtener datos → Excel* y elegir las
hojas. Para actualizar, se reemplaza el archivo y se pulsa *Actualizar*.

**Qué hojas conviene usar:**

| Hoja | Para qué gráfica |
|---|---|
| Huevos / Postura / Muertes por semana (Reportes) | Tendencias por galpón |
| Por galpón (Reportes) | Comparación entre galpones |
| Resumen semanal (cada galpón) | Real contra la guía, semana de vida |
| Rentabilidad (cada galpón) | Costo por huevo, utilidad, equilibrio |
| Utilidad por mes / Costos / Ventas (Finanzas) | Dinero en el tiempo, por categoría |

**Más adelante (conexión directa):** Power BI puede leer la base con su
conector de PostgreSQL. Para hacerlo seguro habría que crear un **usuario de
solo lectura** con **vistas por finca** (nunca la clave de administrador, que se
salta la seguridad por filas). Compartir tableros en línea o incrustarlos en la
app requiere licencias de Microsoft (Power BI Pro por usuario o capacidad
Embedded); el precio cambia, hay que consultarlo al decidir.

**Recomendación:** seguir con el tablero propio dentro de la app (sin licencias
para el productor) y ofrecer Power BI como opción para fincas o asesores que ya
lo usan.

---

## 3. Sondeos con estudiantes

**Objetivo:** saber qué registran hoy los productores, qué les cuesta más y qué
pagarían, apoyándose en estudiantes (zootecnia, veterinaria, agronomía) que ya
visitan fincas.

**Diseño sugerido:**

- **Muestra:** 30–50 granjas de ponedoras, de distintos tamaños (menos de 5.000,
  5.000–20.000, más de 20.000 aves) y pisos térmicos.
- **Forma:** entrevista corta en la finca (15 minutos) con formulario en el
  celular; si se puede, ver cómo registran hoy (cuaderno, Excel, app).
- **Preguntas clave:**
  1. ¿Qué anotan cada día y cómo (cuaderno, Excel, app)?
  2. ¿Saben cuánto les cuesta producir un huevo? ¿Cómo lo calculan?
  3. ¿Comparan su postura con la guía de la línea? ¿Cuál línea tienen?
  4. ¿Cuándo deciden descartar el lote y con qué criterio?
  5. ¿Quién les da asistencia técnica y cada cuánto?
  6. ¿Cómo venden el huevo (intermediario, tiendas, contrato)?
  7. ¿Qué tanto usan el celular y WhatsApp en la finca? ¿Hay internet?
  8. Del 1 al 5, ¿qué tan útil les parecería: costo por huevo, predicción de
     postura, sugerencias, calendario sanitario, tareas del equipo?
  9. ¿Cuánto pagarían al mes por una herramienta así?
- **Ética y datos:** consentimiento informado por escrito; cumplir la **Ley 1581
  de 2012 (protección de datos personales)**: explicar para qué se usan los
  datos, no publicar nombres de fincas ni personas, guardar las respuestas con
  acceso restringido.
- **Entregable:** resumen con las 5 necesidades más frecuentes y la disposición
  a pagar por tamaño de granja; ajustar el orden del plan con eso.

---

## 4. Ciberseguridad

La revisión técnica y lo corregido están en
[`docs/seguridad-2026-10.md`](seguridad-2026-10.md). Plan para seguir:

1. **Cuentas:** activar la protección contra contraseñas filtradas; pedir
   verificación del correo al registrarse; obligar a cambiar la contraseña
   temporal de los operarios en el primer ingreso; considerar un segundo factor
   (2FA) para los dueños.
2. **Datos:** cada tabla con seguridad por filas (ya está); revisar los avisos
   de Supabase después de cada migración; respaldos (Supabase hace copias
   diarias en planes pagos: confirmar el plan y probar una restauración).
3. **Claves:** la clave de administrador solo en el servidor (ya marcado);
   rotarla si alguna vez se compartió; nunca subir archivos `.env` al repositorio
   (están en `.gitignore`).
4. **Código:** dependencias al día (`npm audit` cada mes); revisar con OWASP Top
   10 los formularios que reciben datos (inyección, control de acceso).
5. **Personas:** guía corta para los operarios (no compartir la cuenta, cerrar
   sesión en celulares prestados, cuidado con enlaces por WhatsApp que pidan la
   contraseña).

---

## Fuentes

- Agriness — sitio oficial: https://www.agriness.com/
- Agriness S4 (cerdos): https://agriness.com/en/s4-en/ · App Store: https://apps.apple.com/us/app/agriness-s4/id1471706235 · Google Play: https://play.google.com/store/apps/details?id=com.agriness.s4farm&hl=en_US
- Agriness P4: https://play.google.com/store/apps/details?id=com.agriness.p4farm&hl=en_US
- Agriness Melhores: https://play.google.com/store/apps/details?id=com.agriness.melhores&hl=en
- Perfil de Agriness: https://craft.co/agriness
- Apps de Lohmann Tierzucht: https://lohmann-breeders.com/?p=10850
- Layer Farm Manager: https://mwm.ai/apps/layer-farm-manager/6739273157
- Curva de postura (MCM): Sharifi et al., 2022, Poultry Science 101:101766 — https://www.sciencedirect.com/science/article/pii/S0032579122000712

# Registro inicial de decisiones arquitectónicas — LISTOCO

Este documento registra las principales decisiones arquitectónicas adoptadas para la arquitectura inicial de LISTOCO.

Las decisiones podrán actualizarse a medida que el proyecto evolucione.

---

## ADR-001 — NestJS como backend principal

### Contexto

LISTOCO está compuesto por un frontend, una base de datos y un servicio especializado desarrollado en Python.

Se necesita un componente central encargado de coordinar la lógica del sistema y controlar el acceso a los distintos servicios.

### Decisión

NestJS será utilizado como backend principal de LISTOCO.

El frontend se comunicará exclusivamente con NestJS mediante una API REST.

NestJS será responsable de:

- lógica de negocio;
- autenticación;
- autorización;
- validación de datos;
- acceso a PostgreSQL;
- comunicación con FastAPI;
- manejo centralizado de errores.

### Consecuencias

- Se centraliza la lógica principal del sistema.
- El frontend no necesita conocer la implementación interna de PostgreSQL o FastAPI.
- Se evita que múltiples componentes accedan directamente a los datos.

---

## ADR-002 — FastAPI como servicio especializado

### Contexto

LISTOCO requiere incorporar un servicio Python para procesamiento especializado y para implementar posteriormente capacidades adaptativas.

### Decisión

Se utilizará FastAPI para desarrollar el servicio especializado en Python.

NestJS será el encargado de comunicarse con FastAPI mediante una API REST interna.

El frontend no se comunicará directamente con FastAPI.

### Consecuencias

- Se mantiene una separación clara entre la lógica principal y el procesamiento especializado.
- Python podrá evolucionar de forma independiente.
- NestJS seguirá siendo el punto central de acceso al backend.

---

## ADR-003 — PostgreSQL como base de datos principal

### Contexto

LISTOCO deberá almacenar información estructurada relacionada con usuarios, estudiantes, asignaturas, secciones, inscripciones, preferencias y otras entidades académicas.

### Decisión

Se utilizará PostgreSQL como sistema de gestión de base de datos relacional principal.

NestJS será el responsable del acceso principal a la base de datos.

### Consecuencias

- Las relaciones entre entidades podrán representarse mediante claves primarias y foráneas.
- Se podrán utilizar restricciones, índices y transacciones.
- La persistencia quedará centralizada a través del backend NestJS.

---

## ADR-004 — Comunicación mediante API REST

### Contexto

Los distintos componentes de LISTOCO deben intercambiar información de manera clara y desacoplada.

### Decisión

Se utilizarán APIs REST para:

- comunicación entre Angular y NestJS;
- comunicación interna entre NestJS y FastAPI.

Las solicitudes y respuestas utilizarán estructuras JSON.

### Consecuencias

- Los componentes quedan desacoplados.
- Los contratos de entrada y salida pueden documentarse y validarse.
- Los servicios podrán probarse de manera independiente.

---

## ADR-005 — Contenerización mediante Docker

### Contexto

LISTOCO está compuesto por varios servicios que requieren distintas tecnologías y dependencias.

### Decisión

Cada componente principal será ejecutado en su propio contenedor Docker:

- frontend Angular/Ionic;
- backend NestJS;
- servicio Python/FastAPI;
- PostgreSQL.

Docker Compose será utilizado para coordinar los servicios durante el desarrollo local.

### Consecuencias

- Se obtiene un entorno reproducible.
- Se reducen diferencias entre computadores de desarrollo.
- Los servicios pueden comunicarse utilizando los nombres definidos en Docker Compose.

---

## ADR-006 — Frontend multiplataforma con Ionic, Angular y Capacitor

### Contexto

LISTOCO debe poder utilizarse desde diferentes dispositivos manteniendo una base de código común.

### Decisión

El frontend se desarrollará utilizando:

- Angular;
- TypeScript;
- Ionic Framework;
- Capacitor.

### Consecuencias

- Se mantendrá una base de código común.
- La interfaz podrá adaptarse a distintos tamaños de pantalla.
- La aplicación podrá evolucionar posteriormente hacia PWA y Android.

---

## ADR-007 — Fuente web: plan de estudios oficial de la PUCV

### Contexto

LISTOCO necesita la estructura de la malla de Ingeniería Civil Informática (asignaturas, semestre y categoría) y debe obtenerla desde al menos una fuente web externa, con procedencia, calidad y uso responsable documentados.

La PUCV publica el plan de estudios como un PDF enlazado desde la página de la carrera. Ni la página ni el PDF publican créditos ni prerrequisitos.

### Decisión

**Fuente primaria (web, automatizada)**

| Elemento | Detalle |
|---|---|
| URL | https://pucv.cl/pucv/site/docs/20150611/20150611175606/ingenieria_civil_informatica_act__1_.pdf |
| Documento | Plan de Estudios, DRA 61/2020 mod. por DRA 10/2021 y DRA 31/2021 |
| Datos obtenidos | Nombre de la asignatura, semestre y categoría |
| Método | Descarga HTTP del PDF y lectura estructural (ver ADR-008) |
| Verificación (2026-10-23) | SHA-256 `e6f278bec5643370093506dce94202067f9bcfb19e8e8ecc2395d7858cc709b6`, 100.706 bytes, 58 asignaturas en 11 semestres |

**Uso responsable**

- `robots.txt` (verificado el 2026-10-23): permite el acceso a cualquier user-agent (`User-agent: *` con `Disallow:` vacío). El servicio consulta `robots.txt` antes de cada descarga y no descarga si lo prohíbe.
- Términos de uso del sitio: No se encontró un apartado de términos de uso.
- Límites: una descarga por ejecución, timeouts de 5 s (conexión) y 20 s (lectura), tamaño máximo de 10 MB, User-Agent identificable con contacto del equipo y verificación de que el contenido sea un PDF.
- Privacidad: documento público institucional; no se procesan datos personales.
- Atribución: la PUCV figura como fuente. El proyecto es académico y no tiene afiliación con la universidad. La malla es referencial y corresponde a un plan de 2020-2021, por lo que puede no reflejar cambios posteriores.
- Una copia del PDF se conserva en `python-service/tests/fixtures/` únicamente como dato de prueba de regresión.

**Fuente secundaria (curada, por implementar)**

Los créditos y prerrequisitos se mantendrán en un archivo versionado en el repositorio, con la procedencia de cada dato declarada. El servicio Python validará que cada prerrequisito apunte a una asignatura existente en la fuente primaria.

**Calidad, procedencia y actualización**

- Cada ingesta registra URL, fecha de descarga, hash SHA-256, resolución DRA y versión del extractor.
- Validación: se descartan textos demasiado cortos o sin letras. La deduplicación usa un código derivado del nombre.
- Métricas por ingesta: válidos, rechazados, duplicados, cobertura de semestres (11 esperados) y tiempo.
- Detección de cambios: se compara el hash con el de la última descarga.
- Indisponibilidad de la fuente: se usa la última copia en caché y la respuesta queda como `degraded`; sin caché se responde 503 con un error estructurado. Si `robots.txt` prohíbe el acceso, se responde 403 y no se descarga.
- Frecuencia: bajo demanda. La periodicidad se definirá en la integración con NestJS.

### Consecuencias

- Los datos son reales, trazables y reproducibles.
- El PDF contiene errores de origen que se conservan fielmente (por ejemplo, "Introducción a la Matemáticas"); si se corrigen, se hará en la fuente curada y no en el extractor.
- Créditos y prerrequisitos dependen de la fuente curada, que no es una fuente web.
- Todo el flujo depende de un único documento: si la PUCV cambia su diseño, la extracción falla de forma explícita.

---

## ADR-008 — Extracción de la malla por geometría del PDF

### Contexto

La malla es una grilla visual: una columna por semestre y una caja por asignatura. El texto plano del PDF pierde esa estructura. El primer intento, que agrupaba líneas por espaciado vertical, partió nombres de asignaturas y generó duplicados falsos al probarlo con el PDF real.

El PDF dibuja cada asignatura como un rectángulo coloreado según su categoría, y la leyenda usa muestras de los mismos colores.

### Decisión

Se utiliza `pdfplumber` y la geometría del documento:

1. Los encabezados "I Semestre" a "XI Semestre" se localizan por texto.
2. Las cajas de asignatura se identifican por tamaño (mismo ancho que el encabezado).
3. Cada palabra pertenece a la caja que la contiene, y cada caja al semestre cuyo encabezado está más cerca horizontalmente.
4. La categoría se obtiene comparando el color de la caja con las muestras de la leyenda.

Si no se encuentran cajas, la extracción falla con un error explícito.

### Consecuencias

- Con el PDF real se obtienen 58 de 58 asignaturas, 11 semestres y 10 categorías, sin heurísticas sobre el texto.
- La técnica depende del diseño del PDF: ante un rediseño falla de forma explícita en vez de devolver datos incorrectos, y el cambio de hash lo hace visible.
- Hay una prueba de regresión contra el PDF real (`tests/test_real_pdf.py`) y una herramienta de diagnóstico (`scripts/inspect_pdf.py`) para revisar nuevas versiones.
- Se agrega la dependencia `pdfplumber`.

---

## Decisiones pendientes

Las siguientes decisiones todavía deberán definirse durante el desarrollo:

- selección entre Prisma y TypeORM para PostgreSQL;
- estrategia definitiva de almacenamiento de documentos;
- proveedor y recursos utilizados para el ambiente de staging;
- estrategia definitiva de autenticación;
- mecanismo específico de generación personalizada de horarios.

Estas decisiones serán registradas cuando exista información suficiente para justificarlas.
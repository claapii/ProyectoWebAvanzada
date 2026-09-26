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

## Decisiones pendientes

Las siguientes decisiones todavía deberán definirse durante el desarrollo:

- selección entre Prisma y TypeORM para PostgreSQL;
- estrategia definitiva de almacenamiento de documentos;
- proveedor y recursos utilizados para el ambiente de staging;
- estrategia definitiva de autenticación;
- mecanismo específico de generación personalizada de horarios.

Estas decisiones serán registradas cuando exista información suficiente para justificarlas.
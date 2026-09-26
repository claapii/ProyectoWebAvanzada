# Diagrama de despliegue preliminar — LISTOCO

Este diagrama representa la estrategia preliminar de despliegue de LISTOCO para la Entrega Parcial 1.

```mermaid
flowchart TD

    DEV[Equipo de desarrollo]
    GH[Repositorio GitHub]
    CI[GitHub Actions]

    DEV -->|Push de código| GH
    GH -->|Ejecuta pipeline| CI

    subgraph STAGING[Ambiente de Staging]
        F[Contenedor Frontend<br/>Ionic + Angular]
        B[Contenedor Backend<br/>NestJS]
        PY[Contenedor Python<br/>FastAPI]
        DB[(Contenedor PostgreSQL)]

        F -->|API REST| B
        B -->|API REST interna| PY
        B -->|Conexión BD| DB
    end

    CI -->|Construcción y despliegue| STAGING

    TF[Terraform]
    TF -->|Define infraestructura| STAGING
```

## Descripción

LISTOCO estará compuesto por servicios independientes contenerizados mediante Docker.

Los principales componentes desplegados serán:

- frontend Ionic + Angular;
- backend NestJS;
- servicio Python con FastAPI;
- base de datos PostgreSQL.

Durante el desarrollo local, los servicios serán coordinados mediante Docker Compose.

El código fuente se mantendrá en GitHub y GitHub Actions ejecutará el pipeline DevSecOps encargado de validar, construir y posteriormente desplegar la aplicación.

Terraform se utilizará para definir de manera reproducible la infraestructura necesaria para el ambiente de staging.

## Comunicación entre servicios

El flujo desplegado será:

```text
Usuario
   ↓
Frontend
   ↓
NestJS
  ↙    ↘
PostgreSQL  FastAPI
```

NestJS actuará como backend principal y será el único servicio backend consumido directamente por el frontend.

## Estado

Este diseño corresponde a una propuesta preliminar para la EP1 y podrá evolucionar durante las siguientes etapas del proyecto.
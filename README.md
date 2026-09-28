# LISTOCO

## Descripción

LISTOCO es una plataforma de apoyo a la vida académica de estudiantes de la Pontificia Universidad Católica de Valparaíso (PUCV).

Su propósito es facilitar la planificación, organización y realización de gestiones académicas cotidianas, centralizando herramientas e información que permitan al estudiante tomar mejores decisiones durante su trayectoria universitaria.

Como caso inicial de prueba, LISTOCO estará enfocado en estudiantes de Ingeniería Civil Informática de la PUCV.

## Problema

Actualmente, distintas gestiones académicas se encuentran distribuidas entre plataformas institucionales, correos electrónicos y procesos presenciales.

Procesos como la inscripción y desinscripción de asignaturas, solicitudes académicas, justificación de inasistencias y planificación curricular pueden generar confusión, pérdida de tiempo y congestión.

LISTOCO busca centralizar y simplificar parte de estas actividades mediante una plataforma orientada al estudiante.

## Usuarios objetivo

### Estudiante

Usuario principal de LISTOCO. Podrá utilizar herramientas de planificación académica, gestión de asignaturas, trámites y otras funcionalidades de apoyo a su vida universitaria.

### Administrador

Usuario encargado de gestionar información y procesos internos necesarios para el funcionamiento de la plataforma.

## Objetivo general

Desarrollar una plataforma web multiplataforma que apoye a estudiantes de la PUCV en la planificación y gestión de su vida académica mediante herramientas centralizadas y funcionalidades personalizadas.

## Alcance

Durante la EP1, LISTOCO contempla la construcción de una base tecnológica funcional y reproducible para el proyecto.

El alcance incluye:

- prototipo navegable desarrollado con Ionic y Angular;
- backend inicial desarrollado con NestJS;
- persistencia mediante PostgreSQL y Prisma;
- servicio Python desarrollado con FastAPI;
- comunicación entre NestJS y FastAPI;
- contenerización mediante Docker y Docker Compose;
- pipeline DevSecOps con GitHub Actions;
- gestión de variables y secretos;
- infraestructura preliminar definida con Terraform.

En esta etapa no se contempla todavía la implementación completa de todas las funcionalidades, el procesamiento definitivo de información web, la capacidad adaptativa final ni un despliegue definitivo de producción.

## Funcionalidades principales propuestas

- Planificación e inscripción simulada de asignaturas.
- Generación personalizada de horarios.
- Validación de prerrequisitos.
- Gestión de cupos y listas de espera.
- Gestión y seguimiento de solicitudes académicas.
- Justificación de inasistencias mediante documentos.
- Planificación de trayectoria curricular.
- Calendario académico y personal.
- Alertas y notificaciones académicas.
- Panel administrativo.

## Fuente de información web

Se utilizará como fuente principal la malla curricular oficial de Ingeniería Civil Informática publicada por la PUCV.

Inicialmente se obtendrá de esta fuente la estructura curricular y distribución de asignaturas por semestre.

Para la información como los prerrequisitos y créditos, será sacada directamente desde personas que estén en las carreras. Como la carrera de prueba es Ingeniería Civil Informática, estos datos se sacarán de alumnos que estén en dicha carrera a día de hoy.

## Capacidad adaptativa propuesta

LISTOCO incorporará un generador personalizado de horarios.

El sistema considerará información como:

- asignaturas aprobadas
- asignaturas pendientes
- prerrequisitos
- créditos
- preferencias de jornada
- días libres deseados
- disponibilidad horaria
- prioridad o riesgo asociado a determinadas asignaturas

A partir de estas variables, el sistema podrá generar y priorizar alternativas de horario adaptadas a las preferencias y situación curricular del estudiante.

## Estado actual

El proyecto cuenta actualmente con una estructura inicial compuesta por:

- frontend Ionic + Angular;
- backend NestJS;
- servicio Python con FastAPI.

## Descripción de las variables requeridas

LISTOCO utiliza variables de entorno para separar la configuración del código fuente y evitar almacenar información sensible directamente en el repositorio.

Variables de GitHub Actions no sensibles:

APP_ENV  
Define el ambiente utilizado por el proyecto. Para la EP1 se utiliza staging.

POSTGRES_USER  
Usuario utilizado por PostgreSQL.

POSTGRES_DB  
Nombre de la base de datos PostgreSQL.

POSTGRES_PORT  
Puerto utilizado para acceder a PostgreSQL desde el host. En el entorno local se utiliza 5433.

Secrets de GitHub Actions:

POSTGRES_PASSWORD  
Contraseña de PostgreSQL. Debe configurarse como GitHub Actions Secret y nunca almacenarse directamente en el repositorio.

JWT_SECRET  
Clave utilizada por NestJS para firmar y validar tokens JWT. Debe configurarse como GitHub Actions Secret.

Variables del backend:

DATABASE_URL  
Cadena de conexión utilizada por Prisma para acceder a PostgreSQL.

Ejemplo:

postgresql://listoco:change_me@localhost:5433/listoco?schema=public

JWT_SECRET  
Clave para la autenticación basada en JWT.

PYTHON_SERVICE_URL  
Dirección utilizada por NestJS para comunicarse con FastAPI.

Ejemplo local:

http://localhost:8000

Variables de Docker Compose:

POSTGRES_USER  
POSTGRES_PASSWORD  
POSTGRES_DB  
POSTGRES_PORT  
JWT_SECRET

Los archivos .env.example contienen únicamente valores ficticios de referencia. Los archivos .env reales se encuentran excluidos mediante .gitignore y no deben subirse al repositorio.

## Descripción del pipeline DevSecOps

El proyecto utiliza GitHub Actions para automatizar tareas de integración continua y despliegue continuo.

El workflow de CI se encuentra en:

.github/workflows/ci.yml

Su objetivo es verificar automáticamente la calidad y seguridad del proyecto. Entre sus controles se incluyen:

- instalación reproducible de dependencias;
- linting del frontend y backend TypeScript;
- linting del servicio Python con Ruff;
- ejecución de pruebas unitarias;
- análisis estático de código con CodeQL;
- análisis de dependencias;
- auditoría de dependencias Python;
- detección de secretos mediante Gitleaks;
- construcción de los componentes;
- controles de calidad que detienen el flujo cuando falla una etapa crítica.

El workflow de CD se encuentra en:

.github/workflows/cd.yml

Este workflow se ejecuta sobre la rama main y verifica la configuración necesaria para el entorno de staging. También construye las imágenes Docker de:

- frontend;
- backend NestJS;
- servicio Python.

El workflow utiliza GitHub Actions Variables para configuraciones no sensibles y GitHub Actions Secrets para valores sensibles. Los secretos no se imprimen en los logs.

Durante la EP1, tanto el CI DevSecOps como el CD Staging fueron ejecutados correctamente en GitHub Actions, validando que los controles configurados funcionen sobre el repositorio.

## Instrucciones de ejecución con Docker Compose

LISTOCO puede ejecutarse de forma integrada mediante Docker Compose desde la raíz del repositorio.

1. Verificar que Docker Desktop esté iniciado.

2. Construir e iniciar los contenedores:

docker compose up --build

Docker Compose incluye valores de desarrollo predeterminados para permitir la ejecución inicial sin configuración adicional.

Si se desea utilizar una configuración personalizada, puede crearse un archivo .env tomando como referencia .env.example.

Variables utilizadas por Docker Compose:

POSTGRES_USER  
POSTGRES_PASSWORD  
POSTGRES_DB  
POSTGRES_PORT  
JWT_SECRET

En el entorno local del proyecto se utiliza el puerto 5433 en el host para PostgreSQL, evitando conflictos con otras instalaciones locales que puedan ocupar el puerto 5432.

3. Servicios principales disponibles:

Frontend:  
http://localhost:8080

Backend NestJS:  
http://localhost:3000

Servicio FastAPI:  
http://localhost:8000

PostgreSQL:  
localhost:5433

4. Para detener los contenedores:

docker compose down

5. Para eliminar además los volúmenes creados:

docker compose down -v

Docker Compose levanta los cuatro componentes principales del sistema: frontend, backend NestJS, servicio FastAPI y PostgreSQL. El backend se comunica internamente con PostgreSQL y con FastAPI utilizando los nombres de servicio definidos en docker-compose.yml.

## Instrucciones de instalación

Requisitos previos:

- Git.
- Node.js 24 o compatible con el proyecto.
- npm.
- Python 3.14 o compatible con el servicio FastAPI.
- Docker Desktop con Docker Compose.
- Terraform para trabajar con la infraestructura preliminar.

1. Clonar el repositorio:

git clone https://github.com/claapii/ProyectoWebAvanzada.git  
cd ProyectoWebAvanzada

2. Instalar dependencias del frontend:

npm ci --prefix frontend

3. Instalar dependencias del backend:

npm ci --prefix backend

4. Preparar el entorno Python:

cd python-service  
python -m venv .venv

En PowerShell:

.\.venv\Scripts\Activate.ps1

Instalar dependencias:

pip install -r requirements.txt

Para herramientas de desarrollo, linting, pruebas y auditoría:

pip install -r requirements-dev.txt

Luego volver a la raíz:

cd ..

5. Configuración de variables de entorno para ejecución local sin Docker

Si los servicios se ejecutan directamente en el equipo, se deben crear los archivos de entorno locales tomando como referencia los archivos .env.example.

Para el backend se utilizan:

DATABASE_URL  
JWT_SECRET  
PYTHON_SERVICE_URL

Los valores sensibles reales no deben almacenarse en el repositorio.

Este paso no es obligatorio cuando el proyecto completo se ejecuta mediante Docker Compose.

6. Inicializar Prisma en el backend cuando corresponda:

cd backend  
npx prisma generate  
npx prisma migrate deploy

Luego volver a la raíz del proyecto.

Con estos pasos, el proyecto queda preparado para ejecutarse localmente o mediante Docker Compose.

## Prototipo en Figma

https://www.figma.com/proto/lDXAUd1pbXqCx57El8fokI/Listoco?node-id=0-1&t=3o8pen7MmLMEIHnp-1

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

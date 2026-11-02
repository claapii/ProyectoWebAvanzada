# Capacidad adaptativa: generador personalizado de horarios

Especificación preliminar · Entrega Parcial 2 (EP2) · LISTOCO

## 1. Propósito y alcance

LISTOCO adaptará la **propuesta de asignaturas y de horario del próximo semestre** a la situación de cada estudiante (qué ya aprobó, qué le falta y qué prefiere), en lugar de mostrar a todos la misma malla.

**Qué se adapta:**

- Qué asignaturas se proponen.
- En qué orden de prioridad.
- Cómo se combinan en una alternativa de horario.

**Qué no hace:**

- No inscribe asignaturas en ningún sistema de la universidad: la inscripción es simulada y la decisión final es siempre del estudiante.
- No predice rendimiento académico.
- No usa datos de otros estudiantes.

## 2. Qué existe hoy y qué es diseño

| Componente | Estado |
|---|---|
| Malla por semestre con código, nombre y semestre sugerido, recuperada del PDF oficial de la PUCV | Implementado |
| Procedencia de cada dato (fuente, corrida, fecha, hash) y métricas de calidad de la ingesta | Implementado |
| Consulta de asignaturas (`GET /courses`) y vista de planificación con filtros, fuente y fecha de actualización | Implementado |
| Usuarios con rol (estudiante o administrador) y sesión con JWT | Implementado |
| Créditos y prerrequisitos | Pendiente: la fuente web no los publica; se cargarán desde una fuente curada por estudiantes de la carrera |
| Estado académico del estudiante (aprobadas y pendientes) | Diseño |
| Preferencias y disponibilidad horaria | Diseño |
| Oferta de secciones y horarios del semestre | Sin fuente definida (ver sección 10) |
| Motor de reglas y puntuación | Diseño |

En esta entrega se presenta la especificación y los datos que la sostienen. El generador todavía no está implementado.

## 3. Variables de entrada

| Variable | Origen | Disponible hoy | Papel en la decisión |
|---|---|---|---|
| Código, nombre, semestre sugerido y categoría de la asignatura | Ingesta del PDF de la PUCV | Sí | Base de toda propuesta |
| Créditos | Fuente curada | No (campo nulo) | Calcular la carga del semestre |
| Prerrequisitos | Fuente curada | No | Regla dura de elegibilidad |
| Semestre de la carrera en que se encuentra el estudiante | Estudiante | No | Calcular el atraso |
| Asignaturas aprobadas | Estudiante | No | Excluir asignaturas y desbloquear otras |
| Asignaturas reprobadas o marcadas como riesgo | Estudiante | No | Prioridad y riesgo |
| Carga máxima de créditos | Estudiante (con valor por defecto) | No | Límite del semestre |
| Preferencia de jornada (mañana, tarde, sin preferencia) | Estudiante | No | Regla blanda |
| Días libres deseados | Estudiante | No | Regla blanda |
| Disponibilidad horaria (bloques ocupados) | Estudiante | No | Regla dura sobre horarios |
| Horario de las secciones ofrecidas | Oferta del semestre | Sin fuente | Armado del horario |

## 4. Decisión que toma el sistema

Para cada estudiante y semestre, el sistema decide:

1. Qué asignaturas son **elegibles**.
2. Cuáles proponer dentro de su carga máxima, y con qué prioridad.
3. Cuando exista oferta horaria, qué combinación de secciones genera menos choques y respeta sus preferencias.

## 5. Mecanismo

Se usa un sistema de **reglas más puntuación ponderada**, no aprendizaje automático. Hay tres razones:

- No existen datos históricos para entrenar un modelo.
- La carrera tiene pocas asignaturas.
- Cada sugerencia debe poder explicarse al estudiante y a quien evalúe.

**Pasos:**

1. **Filtrar con reglas duras.** Se descartan las asignaturas ya aprobadas o con prerrequisitos sin aprobar, y se limita la suma de créditos a la carga máxima. Con oferta horaria, también se descartan las combinaciones con choque.
2. **Puntuar con reglas blandas.**

```text
puntaje = w_atraso * atraso + w_riesgo * riesgo + w_jornada * calce_jornada + w_dias * calce_dias

atraso        = max(0, semestre_del_estudiante - semestre_sugerido_de_la_asignatura)
riesgo        = 1 si el estudiante la reprobó o la marcó como preocupación; si no, 0
calce_jornada = 1 si la sección cae en la jornada preferida; si no, 0
calce_dias    = 1 si respeta los días libres deseados; si no, 0
```

   Los pesos iniciales propuestos son `w_atraso = 3`, `w_riesgo = 2`, `w_jornada = 1` y `w_dias = 1`. Son un punto de partida, **no están validados**, y se calibrarán en la evaluación. Los empates se resuelven a favor del menor semestre sugerido.
3. **Armar alternativas.** Se ordena por puntaje y se agregan asignaturas hasta llenar la carga máxima. Las alternativas 2 y 3 se generan variando las asignaturas de menor puntaje. Se muestran como máximo 3.
4. **Explicar.** Cada asignatura propuesta lleva el motivo por el que se sugirió.

**Datos faltantes.** Si falta un dato necesario, por ejemplo los prerrequisitos de una asignatura, el sistema no lo supone: la marca como **por confirmar** y no la presenta como elegible.

## 6. Resultado visible para el estudiante

En la pantalla de Planificación, una sección "Propuesta para el próximo semestre" muestra:

- Hasta 3 alternativas, cada una con sus asignaturas, créditos y total.
- El motivo de cada sugerencia, en lenguaje simple (por ejemplo: "pendiente del semestre 3; prerrequisitos aprobados").
- Advertencias cuando faltan datos (créditos o prerrequisitos por confirmar).
- La procedencia y la fecha de los datos de la malla, que ya se muestran hoy.

## 7. Control del usuario

- Puede editar sus datos y preferencias en cualquier momento, y la propuesta se recalcula.
- Puede fijar asignaturas obligatorias o excluir otras.
- Puede ajustar la importancia relativa entre ponerse al día y la comodidad horaria, con un control simple de tres niveles.
- Puede ver el porqué de cada sugerencia.
- Nada se inscribe sin una acción explícita suya, y puede descartar todas las alternativas.
- Puede borrar sus datos académicos.
- Si no completa sus datos, el sistema muestra la malla general, como hoy.

## 8. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Malla desactualizada o mal extraída | Procedencia con hash y fecha, métricas de calidad por corrida, evaluación documentada, reejecución de la ingesta por el administrador y aviso con la fecha de los datos |
| Prerrequisitos o créditos incorrectos (fuente curada por estudiantes) | Revisión por el administrador, estado "por confirmar" hasta verificar y registro de la última verificación |
| Sobreconfianza en la propuesta | Se presenta como sugerencia con su explicación y sin inscripción automática |
| Privacidad de los datos académicos | Se guardan solo los necesarios, asociados a la cuenta y visibles solo para el propio estudiante, con eliminación a petición; en staging se usan solo datos de prueba |
| No hay fuente de oferta horaria | El alcance se limita a elegibilidad y carga hasta contar con ella, y se declara |
| Casos no cubiertos (convalidaciones, cambios de plan, otras carreras) | El alcance es solo Ingeniería Civil Informática y se declara |
| Pesos arbitrarios | Se calibran en la evaluación y se documentan los cambios |
| Crecimiento combinatorio | Máximo de 3 alternativas y construcción por orden de puntaje |

## 9. Plan de evaluación

Las metas son criterios de aceptación propuestos, **no resultados**. Aún no se ha realizado la evaluación.

| Qué se mide | Cómo | Meta propuesta |
|---|---|---|
| Corrección de las reglas | Pruebas automatizadas con casos límite: prerrequisito sin cumplir, carga excedida, asignatura aprobada y choque de horario | 100 % de las propuestas sin violar reglas duras |
| Cobertura de datos | Porcentaje de asignaturas con créditos y prerrequisitos verificados | Al menos 90 % antes de probar con estudiantes |
| Utilidad | 5 a 8 estudiantes de la carrera arman su horario a mano (línea base) y con la propuesta; se mide el tiempo y cuántas asignaturas modifican | Menos tiempo que la línea base y a lo más 30 % de asignaturas modificadas |
| Comprensión | Los participantes califican de 1 a 5 si entienden por qué se sugirió cada asignatura | Promedio de al menos 4 |
| Robustez | Se quitan datos (sin créditos, sin preferencias) y se verifica que el sistema responde con avisos | Ningún error no controlado |

Los participantes serán voluntarios, y el informe no incluirá datos que los identifiquen. El protocolo, las fechas, los resultados y los ajustes de pesos se registrarán en este mismo documento.

## 10. Decisiones abiertas

1. De dónde se obtiene la oferta de secciones y horarios de cada semestre.
2. Cómo se cargan las asignaturas aprobadas: ingreso manual o importación del avance curricular.
3. Quién mantiene la fuente curada de créditos y prerrequisitos.
4. Con qué datos se calibran los pesos.
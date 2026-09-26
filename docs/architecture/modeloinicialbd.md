# Modelo inicial de base de datos — LISTOCO

El siguiente modelo representa las principales entidades necesarias para la primera versión de LISTOCO.

El modelo es preliminar y podrá evolucionar a medida que se incorporen nuevas funcionalidades.

```mermaid
erDiagram

    USER ||--o| STUDENT_PROFILE : posee
    STUDENT_PROFILE ||--o{ ENROLLMENT : realiza
    STUDENT_PROFILE ||--o{ ACADEMIC_REQUEST : crea
    STUDENT_PROFILE ||--o{ CALENDAR_EVENT : registra
    STUDENT_PROFILE ||--o| SCHEDULE_PREFERENCE : configura

    COURSE ||--o{ SECTION : posee
    COURSE ||--o{ PREREQUISITE : requiere
    COURSE ||--o{ PREREQUISITE : habilita

    SECTION ||--o{ CLASS_MEETING : contiene
    SECTION ||--o{ ENROLLMENT : recibe

    ACADEMIC_REQUEST ||--o{ REQUEST_ATTACHMENT : contiene

    USER {
        int id PK
        string email
        string passwordHash
        string role
        datetime createdAt
    }

    STUDENT_PROFILE {
        int id PK
        int userId FK
        string studentCode
        string career
        int currentSemester
    }

    COURSE {
        int id PK
        string code
        string name
        int suggestedSemester
        int credits
    }

    PREREQUISITE {
        int id PK
        int courseId FK
        int prerequisiteCourseId FK
    }

    SECTION {
        int id PK
        int courseId FK
        string sectionCode
        int capacity
        int availableSlots
    }

    CLASS_MEETING {
        int id PK
        int sectionId FK
        string dayOfWeek
        time startTime
        time endTime
        string room
    }

    ENROLLMENT {
        int id PK
        int studentId FK
        int sectionId FK
        string status
        datetime createdAt
    }

    SCHEDULE_PREFERENCE {
        int id PK
        int studentId FK
        string preferredShift
        string desiredFreeDay
        time earliestStart
        time latestEnd
    }

    ACADEMIC_REQUEST {
        int id PK
        int studentId FK
        string type
        string description
        string status
        datetime createdAt
    }

    REQUEST_ATTACHMENT {
        int id PK
        int requestId FK
        string fileName
        string filePath
        datetime uploadedAt
    }

    CALENDAR_EVENT {
        int id PK
        int studentId FK
        string title
        string eventType
        datetime startDate
        datetime endDate
        string description
    }
```

## Descripción de entidades

### USER

Representa las cuentas que pueden acceder a LISTOCO.

Inicialmente se consideran dos roles:

- estudiante;
- administrador.

La contraseña no se almacenará directamente, sino mediante un hash seguro.

---

### STUDENT_PROFILE

Contiene información académica específica del estudiante.

Se mantiene separada de `USER` para diferenciar los datos de autenticación de los datos académicos.

---

### COURSE

Representa una asignatura de la carrera.

Permitirá almacenar inicialmente:

- código;
- nombre;
- semestre sugerido;
- créditos.

La información correspondiente a la estructura curricular tendrá como referencia inicial la malla oficial de Ingeniería Civil Informática de la PUCV.

---

### PREREQUISITE

Representa la relación de prerrequisito entre dos asignaturas.

Por ejemplo:

```text
Programación 1
      ↓
Programación 2
```

Una asignatura puede requerir una o más asignaturas previamente aprobadas.

---

### SECTION

Representa una sección disponible de una asignatura.

Contiene información relacionada con:

- asignatura;
- código o número de sección;
- capacidad;
- cupos disponibles.

---

### CLASS_MEETING

Representa un bloque horario asociado a una sección.

Se utiliza una entidad separada debido a que una misma sección puede tener más de una clase durante la semana.

Ejemplo:

```text
Base de Datos - Sección 1

Lunes     09:30 - 11:00
Miércoles 09:30 - 11:00
```

---

### ENROLLMENT

Representa la relación entre un estudiante y una sección.

El estado podrá representar situaciones como:

- inscrito;
- pendiente;
- lista de espera;
- desinscrito.

---

### SCHEDULE_PREFERENCE

Almacena preferencias utilizadas posteriormente por la capacidad adaptativa de LISTOCO.

Por ejemplo:

- jornada preferida;
- día libre deseado;
- hora más temprana aceptable;
- hora máxima de término.

Estas preferencias podrán utilizarse posteriormente para generar y priorizar horarios.

---

### ACADEMIC_REQUEST

Representa una solicitud académica realizada por el estudiante.

Permitirá posteriormente manejar trámites como:

- justificación de inasistencia;
- solicitud de sobrecupo;
- problema de inscripción;
- otras solicitudes académicas.

Los posibles estados podrán ser:

```text
Pendiente
En revisión
Aceptada
Rechazada
```

---

### REQUEST_ATTACHMENT

Representa documentos adjuntos a una solicitud académica.

Por ejemplo, una justificación de inasistencia podrá incluir un certificado u otro documento de respaldo.

---

### CALENDAR_EVENT

Permite al estudiante registrar eventos académicos o personales relacionados con su organización universitaria.

Ejemplos:

- prueba;
- certamen;
- entrega;
- presentación;
- recordatorio personal.

---

## Relaciones principales

El modelo permite representar inicialmente el siguiente flujo:

```text
Usuario
  ↓
Perfil estudiante
  ├── Inscripciones
  ├── Preferencias de horario
  ├── Solicitudes académicas
  └── Calendario

Asignatura
  ├── Prerrequisitos
  └── Secciones
        └── Bloques horarios
```

Este modelo constituye una propuesta inicial para la Entrega Parcial 1 y podrá ampliarse en futuras etapas del proyecto.
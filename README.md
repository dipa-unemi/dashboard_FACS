# Dashboard de Desempeño de la Carrera · FACS · UNEMI

Tablero de seguimiento ACBSP de la Facultad de Ciencias de la Salud:
Enfermería y Nutrición y Dietética.

**Ver el dashboard:** https://dipa-unemi.github.io/dashboard_FACS/

## Qué muestra

| Vista | Qué responde |
|---|---|
| Vista general | Los indicadores principales de un vistazo |
| 1. Estudiantes | Cuatro pestañas: **Trayectoria** (matrícula, retención, deserción y graduación por cohorte), **Perfil sociodemográfico** (sexo, edad de ingreso, etnia, discapacidad, nivel socioeconómico y procedencia), **Rendimiento académico** (aprobación, reprobación, notas, asistencia y repetición por periodo, nivel y grupo de estudiantes) y **Seguimiento a graduados** (trayectoria, condiciones del empleo y formación y vinculación, por año de encuesta y momento) |
| 4. Cuerpo docente | Planta docente, nivel académico, doctorado, cualificación ACBSP (criterio provisional), evaluación, capacitación, dedicación, categoría y perfil demográfico |
| 3. Grupos de interés | Cómo perciben la carrera los estudiantes, los graduados y los docentes |
| 6. Investigación y actividad académica | Cuánto publica el cuerpo docente, en qué revistas y con quién |
| 7. Vinculación e impacto | Proyectos con la comunidad, personas que se propusieron atender y resultados |
| 8. Servicios de apoyo | Cobertura de tutorías y becas, y satisfacción con los servicios |

Cada vista presenta los indicadores con su resultado y su tendencia frente a la
medición anterior, los gráficos históricos y una tabla de resultados del periodo.

## Cómo se usa

- **Filtros superiores:** carrera, nivel (1.er a 9.º) y periodo. El periodo es por año en todo
  el tablero, salvo en Rendimiento académico, que se filtra por semestre (1S 2021, 2S 2021...). El nivel aplica a los
  indicadores de estudiantes: satisfacción, tutorías y becas.
- **Filtro cruzado:** al pulsar un punto o una barra, todo el tablero pasa a ese
  periodo; al pulsar una carrera en la leyenda, pasa a esa carrera; al pulsar un
  nivel socioeconómico, los indicadores de estudiantes se recalculan para ese grupo.
- **Rendimiento académico** tiene además un selector de grupo de estudiantes (sexo,
  etnia, tipo de ingreso, cohorte, número de matrícula); también se filtra pulsando
  un nivel, una matrícula o una banda de los histogramas de nota y asistencia. Un
  grupo a la vez.
- **Seguimiento a graduados** se filtra por momento de la encuesta (al titularse, al año,
  a los dos años) y por grupo (sexo, año de titulación o nivel socioeconómico).
- El ícono **i** de cada indicador explica qué mide y de dónde sale.

Los datos son agregados por carrera y periodo: el tablero no contiene
información de personas. Los grupos con menos de 10 personas no se publican (con
supresión complementaria, para que no puedan deducirse restando) y las categorías con
menos de 5 casos se agrupan. Estos umbrales se aplican al generar los archivos de
`docs/data/`, no solo en la pantalla.

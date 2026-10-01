# Dashboard de Desempeño de la Carrera · FACS · UNEMI

Tablero de seguimiento ACBSP de la Facultad de Ciencias de la Salud
(Enfermería y Nutrición y Dietética).

**Tablero publicado:** https://dipa-unemi.github.io/dashboard_FACS/docs/index.html
(también abre desde https://dipa-unemi.github.io/dashboard_FACS/)

## Vistas

| Menú | Vista | Estado |
|---|---|---|
| Inicio | Vista general | Publicada (resume las vistas 3, 6, 7 y 8) |
| 1 | Estudiantes | En preparación |
| 2 | Resultados de aprendizaje | En preparación |
| 3 | Grupos de interés | Publicada |
| 4 | Cuerpo docente | En preparación |
| 5 | Planificación estratégica | En preparación |
| 6 | Investigación y actividad académica | Publicada |
| 7 | Vinculación e impacto | Publicada |
| 8 | Servicios de apoyo | Publicada |

Las vistas en preparación no aparecen en el menú hasta que tengan datos.

Filtros comunes: carrera, modalidad, nivel y periodo (año). Cada indicador se
muestra en su periodicidad real (semestral o anual): la tarjeta toma la última
medición disponible hasta el año elegido y la compara con la anterior.

**Filtro cruzado.** Pulsar un punto o una barra filtra todo el tablero a ese
periodo; pulsar una carrera en la leyenda o en la etiqueta de una línea cambia
la carrera; pulsar un nivel socioeconómico recalcula los indicadores de
estudiantes (satisfacción, tutorías y becas) para ese nivel. Los indicadores
que no tienen ese desglose (graduados, docentes, producción, vinculación) lo
indican en su tarjeta. Celdas con menos de 10 personas no se publican.

## Estructura

```
docs/                     <- lo que publica GitHub Pages
  index.html              marco institucional, menú lateral y filtros
  styles.css              paleta UNEMI
  js/app.js               vistas, tarjetas, gráficos y lecturas
  data/indicadores.js     catálogo de indicadores y METAS (se edita a mano)
  data/facs-data.js       datos agregados (lo genera el script, no se edita)
  img/                    logos del Vicerrectorado y DIPA
scripts/agregar_facs.py   agrega los extractos del SGA y escribe facs-data.js
```

## Metas y semáforo

Las metas se fijan en `docs/data/indicadores.js`. Mientras una meta valga
`null`, el tablero muestra «Por definir» y no pinta estado. Al poner un valor
aparecen solas la línea de meta en los gráficos y el estado
(✓ Cumple · ! En seguimiento · ✕ No cumple). La `tolerancia` de cada indicador
define el margen de «En seguimiento»; el `sentido` dice si mayor o menor es mejor.

## Actualizar los datos

1. Dejar los Excel del SGA en la carpeta compartida de la facultad
   (por defecto `../Dashboard_Academico_Perfil/data/FACS`, o la que indique
   la variable `FACS_DATA_DIR`).
2. `python scripts/agregar_facs.py`
3. Revisar el tablero en local y subir solo `docs/data/facs-data.js`.

## Manejo de los datos fuente

**Este repositorio es público.** Los Excel de origen contienen microdatos de
estudiantes, docentes y graduados y **nunca** se suben: el `.gitignore` los
bloquea. El tablero solo publica conteos y porcentajes por carrera y periodo.
Si un Excel llegara a subirse por error, borrarlo en un commit nuevo no basta
(queda en el historial): hay que avisar antes de seguir trabajando.

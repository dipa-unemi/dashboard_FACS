/*
 * Catálogo de indicadores del tablero FACS (estructura del requerimiento 13).
 *
 * Este es el único archivo que se edita a mano. Aquí se fijan las METAS:
 * mientras una meta valga null, el tablero muestra «Por definir» y no pinta
 * semáforo, para no inventar un estado que nadie aprobó.
 *
 *   meta        valor objetivo, en la misma unidad del indicador (null = sin meta)
 *   lineaBase   valor de referencia aprobado por la carrera (null = sin definir)
 *   tolerancia  cuánto puede quedar por debajo (o por encima, si «menor es mejor»)
 *               de la meta y aún verse «En seguimiento» en lugar de «No cumple»
 *   umbral      variación mínima que cuenta como cambio en la tendencia
 *               (puntos porcentuales en %, o proporción 0.05 = 5 % en conteos)
 *   sentido     "mayor" | "menor" | "rango" | "info"
 *   acumula     true si el valor crece a lo largo del año (no se compara un año en curso)
 *   metas       metas distintas por carrera: { ENF: 80, NUT: 75 } (opcional)
 */
window.FACS_INDICADORES = {
  /* ---------------- Vista 1 · Estudiantes: rendimiento académico ---------------- */
  rend_est: {
    vista: "rendimiento", dimension: "Estudiantes", nombre: "Estudiantes con asignaturas",
    definicion: "Estudiantes únicos con al menos una asignatura registrada en el periodo.",
    formula: "Número de estudiantes únicos con registros asignatura-estudiante",
    unidad: "N.º", sentido: "info", frecuencia: "Semestral", fuente: "SGA · Registro académico",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 10, umbral: 0.05
  },
  rend_aprob: {
    vista: "rendimiento", dimension: "Estudiantes", nombre: "Aprobación",
    definicion: "Porcentaje de las evaluaciones válidas del periodo (estado final aprobado o reprobado) que terminan aprobadas. No incluye asignaturas en curso ni en recuperación.",
    formula: "(Evaluaciones aprobadas / evaluaciones válidas) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Semestral", fuente: "SGA · Registro académico",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  rend_reprob: {
    vista: "rendimiento", dimension: "Estudiantes", nombre: "Reprobación",
    definicion: "Porcentaje de las evaluaciones válidas del periodo que terminan reprobadas.",
    formula: "(Evaluaciones reprobadas / evaluaciones válidas) × 100",
    unidad: "%", sentido: "menor", frecuencia: "Semestral", fuente: "SGA · Registro académico",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 2, umbral: 1
  },
  rend_nota: {
    vista: "rendimiento", dimension: "Estudiantes", nombre: "Nota promedio",
    definicion: "Promedio de las notas finales válidas (de 1 a 100) de las asignaturas del periodo. La nota mínima de aprobación es 70.",
    formula: "Suma de notas finales válidas / número de notas válidas",
    unidad: "", sentido: "mayor", frecuencia: "Semestral", fuente: "SGA · Registro académico",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 2, umbral: 0.01
  },
  rend_asist: {
    vista: "rendimiento", dimension: "Estudiantes", nombre: "Asistencia promedio",
    definicion: "Promedio del porcentaje de asistencia final registrado en las asignaturas del periodo. El umbral institucional es 70 %.",
    formula: "Suma de porcentajes de asistencia válidos / número de registros con asistencia",
    unidad: "%", sentido: "mayor", frecuencia: "Semestral", fuente: "SGA · Registro académico",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  rend_exc: {
    vista: "rendimiento", dimension: "Estudiantes", nombre: "Excelente + Muy Bueno",
    definicion: "Porcentaje de evaluaciones con nota de 90 o más: las categorías Muy Bueno y Excelente de la escala institucional (Art. 75).",
    formula: "(Evaluaciones Muy Bueno y Excelente / evaluaciones válidas) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Semestral", fuente: "SGA · Registro académico",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  rend_rep: {
    vista: "rendimiento", dimension: "Estudiantes", nombre: "Estudiantes repetidores",
    definicion: "Porcentaje de estudiantes que cursan al menos una asignatura en segunda matrícula o posterior, sobre los estudiantes con número de matrícula conocido.",
    formula: "(Estudiantes con alguna matrícula ≥ 2 / estudiantes con matrícula conocida) × 100",
    unidad: "%", sentido: "menor", frecuencia: "Semestral", fuente: "SGA · Registro académico",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 2, umbral: 1
  },
  rend_aband: {
    vista: "rendimiento", dimension: "Estudiantes", nombre: "Abandono de asignatura",
    definicion: "Porcentaje de registros con nota final 0, que se interpretan como asignatura no cursada o abandonada.",
    formula: "(Registros con nota final 0 / registros evaluados) × 100",
    unidad: "%", sentido: "menor", frecuencia: "Semestral", fuente: "SGA · Registro académico",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 1, umbral: 0.5
  },

  /* ---------------- Vista 3 · Grupos de interés ---------------- */
  sat_est: {
    vista: "grupos", dimension: "Grupos de interés", nombre: "Satisfacción estudiantil",
    definicion: "Porcentaje de respuestas de los estudiantes que califican con 4 o 5, en una escala de 1 a 5, su experiencia académica y los servicios de la universidad.",
    formula: "(Valoraciones de 4 y 5 / total de valoraciones) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Semestral", fuente: "Encuesta integral de satisfacción estudiantil (SGA)",
    responsable: "DAC", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  sat_grad: {
    vista: "grupos", dimension: "Grupos de interés", nombre: "Satisfacción de graduados",
    definicion: "Porcentaje de graduados que califican con 5, 6 o 7, en una escala de 1 a 7, su satisfacción con los estudios realizados.",
    formula: "(Graduados que responden 5 a 7 / graduados consultados) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Anual", fuente: "Encuesta a graduados (SGA)",
    responsable: "Seguimiento a graduados", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  sat_doc: {
    vista: "grupos", dimension: "Grupos de interés", nombre: "Satisfacción docente",
    definicion: "Porcentaje de respuestas de los docentes que califican con 4 o 5, en una escala de 1 a 5, las condiciones y el apoyo institucional para su labor académica.",
    formula: "(Valoraciones de 4 y 5 / total de valoraciones) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Anual", fuente: "Encuesta integral de satisfacción docente (SGA)",
    responsable: "Dirección de Evaluación y Perfeccionamiento Académico", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },

  /* ---------------- Vista 6 · Investigación ---------------- */
  pub_total: {
    vista: "investigacion", dimension: "Investigación", nombre: "Producción científica",
    definicion: "Artículos publicados por los docentes de la carrera, aprobados por la universidad y con categoría institucional asignada. Cada artículo se cuenta una sola vez aunque lo firmen varios docentes.",
    formula: "Número de artículos únicos publicados en el año",
    unidad: "N.º", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Producción científica",
    responsable: "Facultad de Investigación", meta: null, lineaBase: null, tolerancia: 10, umbral: 0.05
  },
  doc_prod: {
    vista: "investigacion", dimension: "Investigación", nombre: "Docentes con producción científica",
    definicion: "Porcentaje de los docentes que dictaron clases en la carrera durante el año y que publicaron al menos un artículo ese mismo año.",
    formula: "(Docentes con al menos un artículo / docentes de la carrera en el año) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Producción científica y distributivo",
    responsable: "Facultad de Investigación", meta: null, lineaBase: null, tolerancia: 5, umbral: 1,
    acumula: true  // en el año en curso todavía puede crecer: no se compara con un año completo
  },
  pub_alto: {
    vista: "investigacion", dimension: "Investigación", nombre: "Artículos en revistas de impacto mundial",
    definicion: "Porcentaje de los artículos del año publicados en revistas indexadas en Scopus o Web of Science (categoría científica I o II).",
    formula: "(Artículos científicos nivel I y II / artículos del año) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Producción científica",
    responsable: "Facultad de Investigación", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  pub_q12: {
    vista: "investigacion", dimension: "Investigación", nombre: "Artículos en cuartiles Q1 y Q2",
    definicion: "Artículos del año publicados en revistas ubicadas en el primer o segundo cuartil de su área: el 50 % de revistas de mayor impacto.",
    formula: "Número de artículos en revistas Q1 o Q2",
    unidad: "N.º", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Producción científica",
    responsable: "Facultad de Investigación", meta: null, lineaBase: null, tolerancia: 10, umbral: 0.05
  },
  pub_est: {
    vista: "investigacion", dimension: "Investigación", nombre: "Artículos con coautoría estudiantil",
    definicion: "Porcentaje de los artículos del año en los que participa al menos un estudiante como coautor: mide cuánto se integra la investigación en la formación.",
    formula: "(Artículos con al menos un estudiante coautor / artículos del año) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Producción científica",
    responsable: "Facultad de Investigación", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  pub_proy: {
    vista: "investigacion", dimension: "Investigación", nombre: "Artículos derivados de proyectos",
    definicion: "Artículos del año que provienen de un proyecto de investigación registrado en la universidad.",
    formula: "Número de artículos marcados como resultado de un proyecto",
    unidad: "N.º", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Producción científica",
    responsable: "Facultad de Investigación", meta: null, lineaBase: null, tolerancia: 10, umbral: 0.05
  },

  /* ---------------- Vista 7 · Vinculación ---------------- */
  vin_proy: {
    vista: "vinculacion", dimension: "Vinculación", nombre: "Proyectos ejecutados", tipo: "Actividad",
    definicion: "Proyectos de vinculación con la sociedad aprobados que iniciaron en el año, estén en ejecución, finalizados o cerrados.",
    formula: "Número de proyectos aprobados según año de inicio",
    unidad: "N.º", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Vinculación",
    responsable: "Facultad de Vinculación", meta: null, lineaBase: null, tolerancia: 10, umbral: 0.05
  },
  vin_benef: {
    vista: "vinculacion", dimension: "Vinculación", nombre: "Beneficiarios directos previstos", tipo: "Cobertura",
    definicion: "Personas que los proyectos iniciados en el año se propusieron atender directamente. Es la cobertura planificada: no equivale a impacto.",
    formula: "Suma de beneficiarios directos registrados en los proyectos",
    unidad: "N.º", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Vinculación",
    responsable: "Facultad de Vinculación", meta: null, lineaBase: null, tolerancia: 10, umbral: 0.05
  },
  vin_avance: {
    vista: "vinculacion", dimension: "Vinculación", nombre: "Cumplimiento de resultados previstos", tipo: "Resultado",
    definicion: "Avance promedio que reportan, en sus informes aprobados, los proyectos ya finalizados o cerrados respecto de lo que planificaron.",
    formula: "Promedio del avance acumulado reportado por proyecto (tope 100 %)",
    unidad: "%", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Informes de vinculación",
    responsable: "Facultad de Vinculación", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  vin_est: {
    vista: "vinculacion", dimension: "Vinculación", nombre: "Participaciones estudiantiles", tipo: "Actividad",
    definicion: "Estudiantes de la carrera inscritos en los proyectos iniciados en el año. Un estudiante que participa en dos proyectos cuenta dos veces.",
    formula: "Suma de estudiantes participantes por proyecto",
    unidad: "N.º", sentido: "info", frecuencia: "Anual", fuente: "SGA · Vinculación",
    responsable: "Facultad de Vinculación", meta: null, lineaBase: null, tolerancia: 10, umbral: 0.05
  },
  vin_culm: {
    vista: "vinculacion", dimension: "Vinculación", nombre: "Culminación estudiantil en proyectos", tipo: "Resultado",
    definicion: "De los estudiantes que ya cerraron su participación, porcentaje que la culminó (frente a quienes se retiraron o reprobaron).",
    formula: "(Culminados / culminados + retirados + reprobados) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Anual", fuente: "SGA · Vinculación",
    responsable: "Facultad de Vinculación", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },

  /* ---------------- Vista 8 · Servicios de apoyo ---------------- */
  sat_serv: {
    vista: "apoyo", dimension: "Servicios de apoyo", nombre: "Satisfacción con servicios de apoyo",
    definicion: "Porcentaje de respuestas de los estudiantes que califican con 4 o 5 los servicios que acompañan su trayectoria: tutorías, salud y bienestar, prácticas, trámites, atención de requerimientos, seguridad e instalaciones deportivas.",
    formula: "(Valoraciones de 4 y 5 en los siete servicios / total de valoraciones) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Semestral", fuente: "Encuesta integral de satisfacción estudiantil (SGA)",
    responsable: "DAC", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  tut_cob: {
    vista: "apoyo", dimension: "Servicios de apoyo", nombre: "Cobertura de tutorías académicas",
    definicion: "Porcentaje de los estudiantes matriculados en el periodo que asistieron al menos a una tutoría académica realizada.",
    formula: "(Estudiantes atendidos en tutoría / estudiantes matriculados) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Semestral", fuente: "SGA · Tutorías",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  tut_ejec: {
    vista: "apoyo", dimension: "Servicios de apoyo", nombre: "Tutorías realizadas",
    definicion: "De las tutorías que se agendaron y ya tuvieron resolución, porcentaje que efectivamente se llevó a cabo (el resto se canceló).",
    formula: "(Tutorías ejecutadas / ejecutadas + canceladas) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Semestral", fuente: "SGA · Tutorías",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 5, umbral: 1
  },
  tut_int: {
    vista: "apoyo", dimension: "Servicios de apoyo", nombre: "Tutorías por estudiante atendido",
    definicion: "Número promedio de tutorías a las que asistió cada estudiante que recibió al menos una.",
    formula: "Tutorías asistidas / estudiantes atendidos",
    unidad: "", sentido: "info", frecuencia: "Semestral", fuente: "SGA · Tutorías",
    responsable: "Dirección de carrera", meta: null, lineaBase: null, tolerancia: 0.5, umbral: 0.05
  },
  beca_cob: {
    vista: "apoyo", dimension: "Servicios de apoyo", nombre: "Estudiantes con beca o ayuda",
    definicion: "Porcentaje de los estudiantes matriculados en el periodo que recibieron una beca o ayuda económica aceptada.",
    formula: "(Estudiantes beneficiarios / estudiantes matriculados) × 100",
    unidad: "%", sentido: "mayor", frecuencia: "Semestral", fuente: "SGA · Bienestar universitario",
    responsable: "Dirección de Bienestar Universitario", meta: null, lineaBase: null, tolerancia: 2, umbral: 1
  }
};

"""
Agrega los extractos del SGA de FACS (Enfermería y Nutrición y Dietética) y
escribe docs/data/facs-data.js, el único archivo de datos que lee el tablero.

Solo salen conteos y porcentajes por carrera y periodo: ninguna fila del
archivo publicado corresponde a una persona. Los Excel NO van al repositorio
(es público); se leen desde FACS_DATA_DIR, que por defecto apunta a la carpeta
donde el equipo los guarda:

    ../Dashboard_Academico_Perfil/data/FACS

Uso:
    python scripts/agregar_facs.py            # genera docs/data/facs-data.js
    FACS_DATA_DIR=ruta python scripts/agregar_facs.py

Reglas que no se cambian sin discutirlas (ver scripts/README.md):
  * Satisfacción = % de valoraciones por encima del punto neutro de la escala
    (4-5 en escalas de 1 a 5; 5-7 en escalas de 1 a 7).
  * Toda tasa de cobertura usa como denominador la matrícula del mismo periodo
    regular, y su numerador se restringe a estudiantes de esa matrícula.
  * Producción científica = artículos únicos aprobados en el SGA y con
    categoría institucional asignada. Un artículo cuenta una vez por carrera y
    una vez en la facultad aunque lo firmen varios docentes.
  * Vinculación: los beneficiarios son los PREVISTOS en el proyecto (el SGA
    no registra alcanzados) y no se presentan como impacto.
"""
import json
import os
import re
import sys
from datetime import date
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get("FACS_DATA_DIR",
                           RAIZ.parent / "Dashboard_Academico_Perfil" / "data" / "FACS"))
SALIDA = RAIZ / "docs" / "data" / "facs-data.js"

CARRERAS = {"ENFERMERIA": "ENF", "NUTRICION Y DIETETICA": "NUT"}
TODAS = "FACS"
CLAVES = [TODAS, "ENF", "NUT"]

MESES = {"ENERO": "Ene", "FEBRERO": "Feb", "MARZO": "Mar", "ABRIL": "Abr", "MAYO": "May",
         "JUNIO": "Jun", "JULIO": "Jul", "AGOSTO": "Ago", "SEPTIEMBRE": "Sep",
         "OCTUBRE": "Oct", "NOVIEMBRE": "Nov", "DICIEMBRE": "Dic"}


# ----------------------------------------------------------------- utilidades
def etiqueta_periodo(nombre: str) -> str:
    """'NOVIEMBRE 2021 MARZO 2022' -> 'Nov 2021 – Mar 2022'; 'ABRIL - JULIO 2026' -> 'Abr – Jul 2026'."""
    toks = re.findall(r"[A-ZÁÉÍÓÚ]+|\d{4}", nombre.upper())
    partes, mes = [], None
    for t in toks:
        if t in MESES:
            if mes:
                partes.append([mes, None])
            mes = MESES[t]
        elif t.isdigit() and mes:
            partes.append([mes, t]); mes = None
    if mes:
        partes.append([mes, None])
    if len(partes) >= 2:
        (m1, a1), (m2, a2) = partes[0], partes[-1]
        a1 = a1 or a2
        return f"{m1} – {m2} {a2}" if a1 == a2 else f"{m1} {a1} – {m2} {a2}"
    return nombre.title()


def orden_periodo(cod: str) -> tuple:
    s, a = cod.split("-")
    return int(a), int(s[0])


def pct(num, den, dec=1):
    return None if not den else round(100.0 * num / den, dec)


def por_carrera(df, col="carrera"):
    """Itera (clave, subconjunto) para la facultad y cada carrera."""
    yield TODAS, df
    for nombre, k in CARRERAS.items():
        yield k, df[df[col] == nombre]


def leer(nombre, **kw):
    ruta = DATA / nombre
    if not ruta.exists():
        sys.exit(f"No se encuentra {ruta}. Define FACS_DATA_DIR con la carpeta de los Excel.")
    return pd.read_excel(ruta, sheet_name=0, **kw)


# ------------------------------------------------------------------ fuentes
print("Leyendo extractos desde", DATA)
beca = leer("Result_beca.xlsx")
est = leer("Result_estudiante.xlsx", usecols=["carrera_estudiante", "inscripcion_id", "periodo", "nivel",
                                              "periodo_codigo", "grupo_socioeconomico"])
tut = leer("Result_tutorias.xlsx")
doc = leer("Result_docente.xlsx", usecols=["carrera_asignatura", "periodo", "periodo_codigo", "docente_id"])
prod = leer("Result_produccion_cientifica.xlsx")
grad = leer("Result_graduados.xlsx")
sest = leer("satisfaccion_est.xlsx")
sdoc = leer("satisfaccion_doc.xlsx")
desem = leer("desempeno_doc.xlsx")
vinc = leer("vinculacion.xlsx")

# Periodos académicos regulares: los once que comparten becas, tutorías y
# evaluación docente. Fuera quedan remediales, módulos y periodos de planificación.
PERIODOS = (beca[["periodo_codigo", "periodo"]].drop_duplicates()
            .assign(o=lambda d: d.periodo_codigo.map(orden_periodo))
            .sort_values("o"))
assert PERIODOS.periodo_codigo.is_unique
NOMBRE_DE = dict(zip(PERIODOS.periodo_codigo, PERIODOS.periodo))
COD_DE = dict(zip(PERIODOS.periodo, PERIODOS.periodo_codigo))
REGULARES = set(PERIODOS.periodo)


def punto(cod, v, n=None, **extra):
    d = {"p": cod, "a": orden_periodo(cod)[0], "l": etiqueta_periodo(NOMBRE_DE[cod]), "v": v}
    if n is not None:
        d["n"] = int(n)
    d.update(extra)
    return d


def punto_anio(anio, v, n=None, parcial=False, **extra):
    d = {"p": str(anio), "a": int(anio), "l": str(anio) + (" (parcial)" if parcial else ""), "v": v}
    if n is not None:
        d["n"] = int(n)
    if parcial:
        d["parcial"] = True
    d.update(extra)
    return d


# Matrícula de cada periodo regular: denominador de todas las coberturas.
est["carrera"] = est.carrera_estudiante
matr = est[est.periodo.isin(REGULARES)].copy()
matr["cod"] = matr.periodo.map(COD_DE)
MATRICULA = {(k, c): set(g.inscripcion_id)
             for k, sub in por_carrera(matr) for c, g in sub.groupby("cod")}

# ============================================================ VISTA 3 · GRUPOS
ind, detalle = {}, {}

# --- Satisfacción estudiantil ------------------------------------------------
sest["cod"] = sest.periodo.map(COD_DE)
assert sest.cod.notna().all(), "satisfacción estudiantil con periodo fuera del catálogo"
# Una persona que envió dos veces la misma pregunta cuenta una vez (la última).
# En abril-julio 2025 la encuesta guardó todas las respuestas bajo una sola
# pregunta global, así que ahí no hay duplicado que quitar.
glob_ = sest[sest.tipo_medicion == "GLOBAL"]
asp_ = (sest[sest.tipo_medicion != "GLOBAL"].sort_values("fecha_respuesta")
        .drop_duplicates(["persona_id", "cod", "pregunta_id"], keep="last"))
sest_d = pd.concat([glob_, asp_])

SERVICIOS = [  # aspectos que describen servicios de apoyo al estudiante (vista 8)
    "CALIDAD DE TUTORÍAS ACADÉMICAS",
    "SERVICIOS DE ATENCIÓN MÉDICA, PSICOLÓGICA, ODONTOLÓGICA Y NUTRICIONAL",
    "ACOMPAÑAMIENTO Y SEGUIMIENTO INSTITUCIONAL DURANTE LAS PRÁCTICAS PRE-PROFESIONALES",
    "AGILIDAD DE LOS PROCESOS DE MATRÍCULA, HOMOLOGACIÓN Y TRÁMITES ADMINISTRATIVOS",
    "RAPIDEZ CON LA QUE LA UNIVERSIDAD RESPONDE A SUS CONSULTAS O REQUERIMIENTOS",
    "SEGURIDAD Y BIENESTAR QUE PERCIBE DENTRO DEL CAMPUS UNIVERSITARIO",
    "INSTALACIONES DEPORTIVAS DISPONIBLES PARA LOS ESTUDIANTES",
]
assert set(SERVICIOS) <= set(sest.aspecto), "cambió el texto de algún aspecto de servicios"


def nombre_aspecto(a: str) -> str:
    a = a.strip().capitalize()
    return (a.replace("pre-profesionales", "preprofesionales")
             .replace("Servicios de atención médica, psicológica, odontológica y nutricional",
                      "Atención médica, psicológica, odontológica y nutricional"))


def serie_satisf(df, corte):
    out = {}
    for k, sub in por_carrera(df):
        s = []
        for c, g in sorted(sub.groupby("cod"), key=lambda x: orden_periodo(x[0])):
            pers = g.persona_id.nunique()
            s.append(punto(c, pct((g.respuesta >= corte).sum(), len(g)), pers,
                           media=round(g.respuesta.mean(), 2), resp=int(len(g)),
                           cob=pct(len(set(g.inscripcion_id) & MATRICULA.get((k, c), set())),
                                   len(MATRICULA.get((k, c), set()))) if "inscripcion_id" in g else None,
                           glob=bool((g.tipo_medicion == "GLOBAL").all()) if "tipo_medicion" in g else False))
        out[k] = s
    return out


ind["sat_est"] = serie_satisf(sest_d, 4)


def detalle_aspectos(df, corte, solo=None):
    out = {}
    d = df[df.tipo_medicion != "GLOBAL"] if "tipo_medicion" in df else df
    if solo:
        d = d[d.aspecto.isin(solo)]
    for k, sub in por_carrera(d):
        out[k] = {}
        for c, g in sub.groupby("cod"):
            filas = [{"a": nombre_aspecto(a), "v": pct((h.respuesta >= corte).sum(), len(h)),
                      "media": round(h.respuesta.mean(), 2), "n": int(len(h))}
                     for a, h in g.groupby("aspecto")]
            out[k][c] = sorted(filas, key=lambda r: -r["v"])
    return out


detalle["sat_est"] = detalle_aspectos(sest_d, 4)

# --- Satisfacción con servicios de apoyo (vista 8) ----------------------------
serv = sest_d[sest_d.aspecto.isin(SERVICIOS)]
ind["sat_serv"] = serie_satisf(serv, 4)
detalle["sat_serv"] = detalle_aspectos(serv, 4)

# --- Satisfacción docente -------------------------------------------------------
sdoc["cod"] = sdoc.periodo_id.map({475: "1S-2026"})
assert sdoc.cod.notna().all()
docentes_periodo = doc[doc.periodo.isin(REGULARES)].assign(cod=lambda d: d.periodo.map(COD_DE),
                                                          carrera=lambda d: d.carrera_asignatura)
DOC_PERIODO = {(k, c): set(g.docente_id.dropna())
               for k, sub in por_carrera(docentes_periodo) for c, g in sub.groupby("cod")}


def serie_sdoc(df):
    out = {}
    for k, sub in por_carrera(df):
        # En la facultad, quien dicta en las dos carreras responde una sola vez.
        g = sub.drop_duplicates(["docente_id", "pregunta_id"]) if k == TODAS else sub
        s = []
        for c, h in g.groupby("cod"):
            n = h.docente_id.nunique()
            univ = DOC_PERIODO.get((k, c), set())
            s.append(punto(c, pct((h.respuesta >= 4).sum(), len(h)), n,
                           media=round(h.respuesta.mean(), 2), resp=int(len(h)),
                           cob=pct(len(set(h.docente_id) & univ), len(univ))))
        out[k] = s
    return out


ind["sat_doc"] = serie_sdoc(sdoc)
detalle["sat_doc"] = {}
for k, sub in por_carrera(sdoc):
    g = sub.drop_duplicates(["docente_id", "pregunta_id"]) if k == TODAS else sub
    detalle["sat_doc"][k] = {c: sorted([{"a": nombre_aspecto(a), "v": pct((x.respuesta >= 4).sum(), len(x)),
                                         "media": round(x.respuesta.mean(), 2), "n": int(len(x))}
                                        for a, x in h.groupby("aspecto")], key=lambda r: -r["v"])
                             for c, h in g.groupby("cod")}

# --- Satisfacción de graduados --------------------------------------------------
grad["carrera"] = grad.carrera_estudiante
grad["anio"] = grad.periodo_encuesta.str.extract(r"(\d{4})").astype(int)
P_SAT = "¿Cuál es el grado de satisfacción con los estudios realizados?"
A1_ESCALA = {
    P_SAT: "Satisfacción con los estudios realizados",
    "¿En términos generales cuál fue el desempeño profesional de los docentes?": "Desempeño profesional de los docentes",
    "¿La malla curricular de su carrera durante su formación académica estuvo acorde a sus expectativas?": "Malla curricular acorde a sus expectativas",
    "¿Se siente orgulloso ser profesional de UNEMI?": "Orgullo de ser profesional UNEMI",
}
assert set(A1_ESCALA) <= set(grad.pregunta), "cambió el texto de una pregunta de satisfacción de graduados"
g_esc = grad[grad.pregunta.isin(A1_ESCALA) | grad.grupo_competencia.str.startswith("A.2 Satisfacción")]
g_esc = g_esc[g_esc.respuesta_numerica.between(1, 7)]
# Si un graduado respondió dos olas el mismo año, cuenta su última respuesta.
g_esc = (g_esc.sort_values("sagperiodo_id")
         .drop_duplicates(["persona_id", "anio", "pregunta_id"], keep="last"))

ind["sat_grad"], detalle["sat_grad"] = {}, {}
for k, sub in por_carrera(g_esc):
    s, det = [], {}
    for a, h in sub.groupby("anio"):
        p = h[h.pregunta == P_SAT]
        s.append(punto_anio(a, pct((p.respuesta_numerica >= 5).sum(), len(p)), p.persona_id.nunique(),
                            media=round(p.respuesta_numerica.mean(), 2)))
        filas = []
        for q, x in h.groupby("pregunta"):
            nom = A1_ESCALA.get(q, q.strip().rstrip(".").replace("En lo administrativo, el", "El")
                                .replace("En general, los", "Los"))
            filas.append({"a": nom[0].upper() + nom[1:], "v": pct((x.respuesta_numerica >= 5).sum(), len(x)),
                          "media": round(x.respuesta_numerica.mean(), 2), "n": int(len(x)),
                          "g": "formacion" if q in A1_ESCALA else "recursos"})
        det[str(a)] = sorted(filas, key=lambda r: -r["v"])
    ind["sat_grad"][k], detalle["sat_grad"][k] = s, det

# ====================================================== VISTA 6 · INVESTIGACIÓN
prod_ok = prod[(prod.aprobado == "SI") & (prod.nivel_nombre != "SIN CATEGORÍA")].copy()
ANIO_ACTUAL = int(prod.fechapublicacion.astype(str).str[:4].max())
NIVEL_GRUPO = {"CIENTÍFICO NIVEL I": "Científico (Scopus / WoS)", "CIENTÍFICO NIVEL II": "Científico (Scopus / WoS)",
               "REGIONAL": "Regional (Latindex)", "DIVULGATIVO": "Divulgativo y memorias",
               "PROCEEDING": "Divulgativo y memorias"}
assert set(prod_ok.nivel_nombre) <= set(NIVEL_GRUPO)
prod_ok["grupo"] = prod_ok.nivel_nombre.map(NIVEL_GRUPO)


def anios_de(nombre):
    a = [int(x) for x in re.findall(r"\d{4}", nombre)]
    return range(min(a), max(a) + 1)


# Docentes que dictaron clase en la carrera cada año (mismo criterio que la
# consulta de producción: un periodo cuenta para los años que abarca).
doc_anio = []
NO_LECTIVOS = r"REMEDIAL|PLANIFICACI|PRUEBA|ESPECIAL|M[ÓO]DULOS"  # mismos que excluye la consulta de producción
doc_lect = doc[~doc.periodo.str.upper().str.contains(NO_LECTIVOS)]
for _, r in doc_lect.dropna(subset=["docente_id"]).drop_duplicates(["carrera_asignatura", "periodo", "docente_id"]).iterrows():
    for a in anios_de(r.periodo):
        doc_anio.append((r.carrera_asignatura, a, int(r.docente_id)))
doc_anio = pd.DataFrame(doc_anio, columns=["carrera", "anio", "docente_id"]).drop_duplicates()

for clave in ["pub_total", "pub_alto", "pub_q12", "pub_est", "pub_proy", "doc_prod"]:
    ind[clave] = {}
detalle["pub_nivel"], detalle["pub_cuartil"] = {}, {}
for k, sub in por_carrera(prod_ok):
    u = sub.drop_duplicates("articulo_id")
    dpa = doc_anio if k == TODAS else doc_anio[doc_anio.carrera == [n for n, c in CARRERAS.items() if c == k][0]]
    s = {c: [] for c in ["pub_total", "pub_alto", "pub_q12", "pub_est", "pub_proy", "doc_prod"]}
    niv, cua = {}, {}
    for a in sorted(prod.anio.unique()):
        x = u[u.anio == a]
        parc = a == ANIO_ACTUAL
        n = len(x)
        s["pub_total"].append(punto_anio(a, n, parcial=parc))
        alto = (x.grupo == "Científico (Scopus / WoS)").sum()
        s["pub_alto"].append(punto_anio(a, pct(alto, n), n, parcial=parc, num=int(alto)))
        q12 = x.cuartil.isin(["Q1", "Q2"]).sum()
        s["pub_q12"].append(punto_anio(a, int(q12), parcial=parc))
        ce = (x.autores_estudiantes > 0).sum()
        s["pub_est"].append(punto_anio(a, pct(ce, n), n, parcial=parc, num=int(ce)))
        s["pub_proy"].append(punto_anio(a, int((x.proviene_proyecto == "SI").sum()), parcial=parc))
        univ = set(dpa[dpa.anio == a].docente_id)
        autores = set(sub[sub.anio == a].docente_id)
        assert autores <= univ, f"docentes con producción fuera de la planta {k} {a}"
        s["doc_prod"].append(punto_anio(a, pct(len(autores), len(univ)), len(univ), parcial=parc,
                                        num=len(autores)))
        niv[str(a)] = {g: int((x.grupo == g).sum()) for g in dict.fromkeys(NIVEL_GRUPO.values())}
        cua[str(a)] = {q: int((x.cuartil == q).sum()) for q in ["Q1", "Q2", "Q3", "Q4"]}
    for c in s:
        ind[c][k] = s[c]
    detalle["pub_nivel"][k], detalle["pub_cuartil"][k] = niv, cua

# La evaluación docente dejó de calificar la función de investigación desde
# abril 2024 (todas las notas en 0): no se usa como indicador porque mostraría
# una caída que no ocurrió. La participación docente se mide con la producción.

# ====================================================== VISTA 7 · VINCULACIÓN
# Los nombres llegan en mayúsculas: se pasan a tipo oración y se restauran los nombres propios.
PROPIOS = ["Milagro", "Ecuador", "Florence Nightingale", "Nola Pender", "Los Pinos", "Las Piñas", "Los Vergeles",
           "Las Palmas", "Nuevo Amanecer", "El Chobo", "Roberto Astudillo", "Barcelona", "AVINFFA", "CDI",
           "Cdla.", "10 de Agosto", "22 de Noviembre"]


def nombre_proyecto(t):
    t = re.sub(r"\s+", " ", t.strip()).capitalize()
    t = re.sub(r"\btipo ii\b", "tipo II", t)
    for p in PROPIOS:
        t = re.sub(r"\b" + re.escape(p.lower()) + r"(?=\W|$)", p, t)
    for mal, bien in [("Participaciòn", "Participación"), ("canton ", "cantón "), ("prevencion", "prevención"),
                      ("diagnostico", "diagnóstico"), ("Promocion,", "Promoción,"), ("Promocion ", "Promoción ")]:
        t = t.replace(mal, bien)
    return t


EJECUTADOS = {"APROBADO / EN EJECUCION", "FINALIZADO", "CERRADO"}
vinc["carrera"] = vinc.carrera
vx = vinc[vinc.estado_proyecto.isin(EJECUTADOS)].copy()
anios_v = sorted(vinc.anio_inicio.unique())
for clave in ["vin_proy", "vin_benef", "vin_avance", "vin_est", "vin_culm", "vin_doc"]:
    ind[clave] = {}
detalle["vin_estado"], detalle["vin_proyectos"] = {}, {}
for k, sub in por_carrera(vx):
    up = sub.drop_duplicates("proyecto_id")  # beneficiarios y avance son del proyecto
    s = {c: [] for c in ["vin_proy", "vin_benef", "vin_avance", "vin_est", "vin_culm", "vin_doc"]}
    for a in anios_v:
        x, xp = sub[sub.anio_inicio == a], up[up.anio_inicio == a]
        s["vin_proy"].append(punto_anio(a, int(len(xp)), parcial=a == ANIO_ACTUAL))
        s["vin_benef"].append(punto_anio(a, int(xp.benef_directos_personas.sum()), parcial=a == ANIO_ACTUAL))
        # Cumplimiento: solo proyectos que ya terminaron; los que siguen en
        # ejecución tienen informes parciales y bajarían el promedio sin razón.
        con = xp[xp.avance_pct.notna() & xp.estado_proyecto.isin(["FINALIZADO", "CERRADO"])]
        s["vin_avance"].append(punto_anio(a, round(con.avance_pct.mean(), 1) if len(con) else None, len(con), parcial=a == ANIO_ACTUAL))
        s["vin_est"].append(punto_anio(a, int(x.estudiantes.sum()), parcial=a == ANIO_ACTUAL))
        cerr = x.est_culminados.sum() + x.est_retirados.sum() + x.est_reprobados.sum()
        s["vin_culm"].append(punto_anio(a, pct(x.est_culminados.sum(), cerr), cerr, parcial=a == ANIO_ACTUAL))
        s["vin_doc"].append(punto_anio(a, int(x.docentes.sum()), parcial=a == ANIO_ACTUAL))
    for c in s:
        ind[c][k] = s[c]
    todos = vinc if k == TODAS else vinc[vinc.carrera == [n for n, c in CARRERAS.items() if c == k][0]]
    detalle["vin_estado"][k] = todos.drop_duplicates("proyecto_id").estado_proyecto.value_counts().to_dict()
    filas = []
    for _, r in sub.sort_values(["anio_inicio", "proyecto"], ascending=[False, True]).iterrows():
        filas.append({"nom": nombre_proyecto(r.proyecto), "a": int(r.anio_inicio),
                      "car": CARRERAS[r.carrera], "estado": r.estado_proyecto.title().replace(" / En Ejecucion", " / en ejecución"),
                      "av": None if pd.isna(r.avance_pct) else round(float(r.avance_pct), 1),
                      "ben": int(r.benef_directos_personas), "est": int(r.estudiantes),
                      "doc": int(r.docentes), "id": int(r.proyecto_id)})
    if k == TODAS:  # un proyecto compartido aparece una sola vez, con las dos carreras
        vistos = {}
        for f in filas:
            if f["id"] in vistos:
                v = vistos[f["id"]]
                v["car"] = "ENF+NUT"; v["est"] += f["est"]; v["doc"] += f["doc"]
            else:
                vistos[f["id"]] = f
        filas = list(vistos.values())
    for f in filas:
        f.pop("id")
    detalle["vin_proyectos"][k] = filas

# ================================================== VISTA 8 · SERVICIOS DE APOYO
tut["carrera"] = tut.carrera_estudiante
tut["cod"] = tut.periodo.map(COD_DE)
assert tut.cod.notna().all()
beca["carrera"] = beca.carrera_estudiante
beca["cod"] = beca.periodo.map(COD_DE)


MIN_CELDA = 10            # tamaño mínimo de un grupo para publicar su cifra (ver filtro cruzado)
SIN_UMBRAL = {"ALTO"}    # niveles socioeconómicos que se publican aunque sean pequeños


def bloque_apoyo(tut, beca):
    """Tutorías y becas por carrera y periodo, contra la MATRICULA vigente."""
    res = {c: {} for c in ["tut_cob", "tut_int", "tut_ejec", "beca_cob"]}
    det = {"beca_tipo": {}, "beca_gse": {}}
    for k in CLAVES:
        sc, si, se, sb, tipo, gse = bloque_apoyo_carrera(tut, beca, k)
        res["tut_cob"][k], res["tut_int"][k], res["tut_ejec"][k], res["beca_cob"][k] = sc, si, se, sb
        det["beca_tipo"][k], det["beca_gse"][k] = tipo, gse
    return res, det


def bloque_apoyo_carrera(tut, beca, k):
    t = tut if k == TODAS else tut[tut.carrera == [n for n, c in CARRERAS.items() if c == k][0]]
    b = beca if k == TODAS else beca[beca.carrera == [n for n, c in CARRERAS.items() if c == k][0]]
    sc, si, se, sb, tipo, gse = [], [], [], [], {}, {}
    for c in PERIODOS.periodo_codigo:
        univ = MATRICULA.get((k, c), set())
        x = t[t.cod == c]
        hechas = x[(x.estado == "EJECUTADO") & (x.asistio_tutoria == "SI")]
        hechas = hechas[hechas.inscripcion_id.isin(univ)]
        aten = hechas.inscripcion_id.nunique()
        sc.append(punto(c, pct(aten, len(univ)), len(univ), num=int(aten)))
        si.append(punto(c, round(len(hechas) / aten, 1) if aten else None, aten))
        cerradas = x.estado.isin(["EJECUTADO", "CANCELADO"]).sum()
        se.append(punto(c, pct((x.estado == "EJECUTADO").sum(), cerradas), cerradas))
        y = b[(b.cod == c) & b.inscripcion_id.isin(univ)]
        nb = y.inscripcion_id.nunique()
        sb.append(punto(c, pct(nb, len(univ)), len(univ), num=int(nb)))
        tipo[c] = (y.drop_duplicates(["inscripcion_id", "tipo_beca_corto"]).tipo_beca_corto
                   .value_counts().to_dict())
        # Cobertura dentro de cada grupo socioeconómico, con el grupo que trae la matrícula.
        m = (matr[(matr.cod == c) & matr.inscripcion_id.isin(univ)]
             .drop_duplicates("inscripcion_id")[["inscripcion_id", "grupo_socioeconomico"]])
        m["beca"] = m.inscripcion_id.isin(set(y.inscripcion_id))
        gse[c] = {g: {"v": pct(h.beca.sum(), len(h)), "n": int(len(h))}
                  for g, h in m.groupby("grupo_socioeconomico") if len(h) >= MIN_CELDA or g in SIN_UMBRAL}
    return sc, si, se, sb, tipo, gse


_r, _d = bloque_apoyo(tut, beca)
ind.update(_r)
detalle.update(_d)

# ==================================== FILTRO CRUZADO · NIVEL SOCIOECONÓMICO
# Los indicadores de estudiantes se recalculan dentro de cada nivel
# socioeconómico (el que trae la matrícula del periodo), para que el tablero
# pueda filtrarse al pulsar ese nivel. Se publican con la clave "CARRERA|NIVEL".
# Una celda con menos de 10 personas no se publica: el porcentaje de un grupo
# tan chico no es estable y acercaría el dato a personas identificables.
# Excepción pedida por la carrera (1-10-2026): el nivel socioeconómico ALTO se
# publica siempre, aunque tenga pocos estudiantes (en 2026, entre 1 y 5).
GSE = ["BAJO", "MEDIO BAJO", "MEDIO TÍPICO", "MEDIO ALTO", "ALTO"]
gse_de = (matr.drop_duplicates(["cod", "inscripcion_id"])
          .set_index(["cod", "inscripcion_id"]).grupo_socioeconomico.to_dict())



# Nivel de la carrera (1.er a 9.º) de cada estudiante en cada periodo: el nivel
# donde cursa la mayoría de sus materias (empate: el más alto). Coincide en el
# 97 % de los casos con el nivel oficial de la matrícula.
def _nivel_num(t):
    return int("".join(ch for ch in t if ch.isdigit()))


matr["niv"] = matr.nivel.map(_nivel_num)
_cnt = matr.groupby(["cod", "inscripcion_id", "niv"]).size().reset_index(name="m")
_cnt = _cnt.sort_values(["cod", "inscripcion_id", "m", "niv"]).drop_duplicates(["cod", "inscripcion_id"], keep="last")
niv_de = {(c, i): f"N{n}" for c, i, n in zip(_cnt.cod, _cnt.inscripcion_id, _cnt.niv)}
NIVELES = [f"N{n}" for n in sorted(_cnt.niv.unique())]


def con_dim(df, mapa):
    return df.assign(dim=[mapa.get(x) for x in zip(df.cod, df.inscripcion_id)])


def desglosar(mapa, valores):
    """Recalcula los indicadores de estudiantes dentro de cada valor de una dimensión
    (nivel socioeconómico o nivel de la carrera) y los publica como «CARRERA|VALOR»."""
    global MATRICULA
    se, sv, tu, be = (con_dim(x, mapa) for x in (sest_d, serv, tut, beca))
    toda = MATRICULA
    for g in valores:
        MATRICULA = {kc: {i for i in s if mapa.get((kc[1], i)) == g} for kc, s in toda.items()}
        partes = {"sat_est": serie_satisf(se[se.dim == g], 4), "sat_serv": serie_satisf(sv[sv.dim == g], 4)}
        _r, _d = bloque_apoyo(tu[tu.dim == g], be[be.dim == g])
        partes.update(_r)
        for k, porper in _d["beca_tipo"].items():
            detalle["beca_tipo"][f"{k}|{g}"] = porper
        dets = {"sat_est": detalle_aspectos(se[se.dim == g], 4), "sat_serv": detalle_aspectos(sv[sv.dim == g], 4)}
        for clave, porcar in partes.items():
            for k, s in porcar.items():
                for p in s:
                    base = p.get("n")
                    if base is None or (base < MIN_CELDA and g not in SIN_UMBRAL):
                        for campo in ("v", "n", "num", "cob", "media", "resp"):
                            p.pop(campo, None)
                        p["v"] = None
                ind[clave][f"{k}|{g}"] = s
        for clave, porcar in dets.items():
            for k, porper in porcar.items():
                detalle[clave][f"{k}|{g}"] = {c: [r for r in filas if r["n"] >= MIN_CELDA or g in SIN_UMBRAL] for c, filas in porper.items()}
    MATRICULA = toda


desglosar(gse_de, GSE)
desglosar(niv_de, NIVELES)

# Cobertura de tutorías por nivel en cada periodo (panel de la vista 8).
detalle["tut_niv"] = {}
for k in CLAVES:
    detalle["tut_niv"][k] = {}
    for g in NIVELES:
        for p in ind["tut_cob"][f"{k}|{g}"]:
            if p["v"] is not None:
                detalle["tut_niv"][k].setdefault(p["p"], {})[g] = {"v": p["v"], "n": p["n"]}

# Tipos de beca con menos de 5 beneficiarios no se publican con su número:
# «1 estudiante con beca por discapacidad» en una carrera y un semestre señala a alguien.
for porper in detalle["beca_tipo"].values():
    for tipos in porper.values():
        for t, v in tipos.items():
            if v < 5:
                tipos[t] = None

# Satisfacción estudiantil por nivel socioeconómico en cada periodo (panel de la vista 3).
detalle["sat_gse"] = {}
for k in CLAVES:
    detalle["sat_gse"][k] = {}
    for g in GSE:
        for p in ind["sat_est"][f"{k}|{g}"]:
            if p["v"] is not None:
                detalle["sat_gse"][k].setdefault(p["p"], {})[g] = {"v": p["v"], "n": p["n"]}

# ======================================================== catálogo de periodos
salida = {
    "generado": date.today().isoformat(),
    "actualizado": date.fromtimestamp(max(p.stat().st_mtime for p in DATA.glob("*.xlsx"))).isoformat(),
    "anioActual": ANIO_ACTUAL,
    "periodos": [{"p": c, "a": orden_periodo(c)[0], "l": etiqueta_periodo(n)}
                 for c, n in zip(PERIODOS.periodo_codigo, PERIODOS.periodo)],
    "matricula": {k: [punto(c, len(MATRICULA.get((k, c), set()))) for c in PERIODOS.periodo_codigo] for k in CLAVES},
    "ind": ind,
    "det": detalle,
}

SALIDA.parent.mkdir(parents=True, exist_ok=True)
txt = json.dumps(salida, ensure_ascii=False, separators=(",", ":"), allow_nan=False,
                 default=lambda o: o.item() if hasattr(o, "item") else str(o))
SALIDA.write_text("/* Generado por scripts/agregar_facs.py — no editar a mano. Solo datos agregados. */\n"
                  "window.FACS_DATA=" + txt + ";\n", encoding="utf-8")
print(f"Escrito {SALIDA.relative_to(RAIZ)} ({len(txt)/1024:.0f} KB)")

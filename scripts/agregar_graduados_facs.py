"""
Seguimiento a graduados de FACS -> docs/data/graduados-data.js (window.FACS_GRAD).

Reproduce las reglas de exportar_rendimiento_dashboard.R, que a su vez son
las de scripts/pipeline/04_agregar_graduados.py del tablero FACSECYD. Se comprobó
que con Result_graduados.xlsx solo da el mismo archivo publicado el 2-10-2026.

Fuentes (FACS_DATA_DIR, por defecto Dashboard_Academico_Perfil/data/FACS):
  * Result_graduados.xlsx      encuestas del SGA (una fila por respuesta)
  * Result_estudiante.xlsx     sexo, nivel socioeconómico y universo de titulados
  * extractos complementarios  otras descargas del SGA con las mismas columnas
                               (p. ej. Encuesta_enfermeria.xlsx, encuestas 2026);
                               se pasan como argumentos y se unen a la principal.

Uso:
    python scripts/agregar_graduados_facs.py [--salida RUTA] [EXTRACTO.xlsx ...]

Reglas:
  * Momento: PRIMERA = al titularse (1), SEGUNDA = al año (2), TERCERA = a los dos
    años (3); «T» suma los tres.
  * La pregunta se identifica por su texto normalizado (el id cambia entre olas).
  * Duplicados idénticos se quitan (así un extracto que repite respuestas del
    principal no cuenta dos veces); respuestas contradictorias se excluyen.
  * «Empleado» = «Bajo relación de dependencia»; con actividad = todo lo que no es
    «Sin actividad laboral» (incluye negocio propio y honorarios).
  * Alto grado = 6 o 7; satisfecho = 5 a 7.
  * k-anonimato: categorías < 5 se agrupan; base < 5 publica la base sin numerador;
    grupos (sexo, cohorte, nivel socioeconómico) solo con 10 respuestas o más.
"""
import argparse
import json
import os
import re
import unicodedata
from datetime import date
from decimal import ROUND_HALF_EVEN, Decimal
from pathlib import Path

import pandas as pd

RAIZ = Path(__file__).resolve().parents[1]
DATA = Path(os.environ.get("FACS_DATA_DIR", RAIZ.parent / "Dashboard_Academico_Perfil" / "data" / "FACS"))
CARRERA = {"ENFERMERIA": "ENF", "NUTRICION Y DIETETICA": "NUT"}
CLAVES = ["ENF", "NUT", "FACS"]
MIN_BASE, K_ANON, OTRAS = 10, 5, "Otras categorías (pocos casos)"
COLS = ["inscripcion_id", "persona_id", "carrera_estudiante", "sagperiodo_id", "periodo_encuesta",
        "pregunta_id", "pregunta", "grupo_competencia", "tipo_pregunta", "respuesta_texto", "respuesta_numerica"]

ap = argparse.ArgumentParser()
ap.add_argument("extractos", nargs="*", help="extractos complementarios del SGA")
ap.add_argument("--salida", default=str(RAIZ / "docs" / "data" / "graduados-data.js"))
args = ap.parse_args()


def filtro(df, k):
    return df if k == "FACS" else df[df.clave == k]


def r(x, dec=2):
    """Redondeo como R 4: mitades al par sobre la cifra decimal (6,325 -> 6,32)."""
    if x is None or pd.isna(x):
        return None
    return float(Decimal(repr(float(x))).quantize(Decimal(1).scaleb(-dec), rounding=ROUND_HALF_EVEN))


def nz(t):
    t = unicodedata.normalize("NFKD", str(t)).encode("ascii", "ignore").decode()
    return re.sub(r"\s+", " ", t).strip().lower()


def limpio(t):
    return None if t is None or pd.isna(t) else re.sub(r"\s+", " ", str(t).replace("_x000D_", " ")).strip() or None


# ------------------------------------------------------------------ lectura
partes = [pd.read_excel(DATA / "Result_graduados.xlsx")[COLS]]
for ruta in args.extractos:
    x = pd.read_excel(ruta, sheet_name=0)
    falta = set(COLS) - set(x.columns)
    assert not falta, f"{ruta}: faltan columnas {falta}"
    partes.append(x[COLS])
    print(f"Extracto complementario {Path(ruta).name}: {len(x)} filas, {x.persona_id.nunique()} graduados")
g = pd.concat(partes, ignore_index=True)
g["clave"] = g.carrera_estudiante.map(CARRERA)
assert g.clave.notna().all(), f"carrera desconocida: {set(g.carrera_estudiante) - set(CARRERA)}"

est = pd.read_excel(DATA / "Result_estudiante.xlsx",
                    usecols=["carrera_estudiante", "inscripcion_id", "sexo", "grupo_socioeconomico", "graduado", "fechagraduado"])
est["clave"] = est.carrera_estudiante.map(CARRERA)
est = est[est.clave.notna()]

# ------------------------------------------------------------------ depuración
g["respuesta_texto"] = g.respuesta_texto.map(limpio)
g.loc[g.respuesta_texto.fillna("").str.upper().isin(
    {"DATO INEXACTO", "NINGUNO", "NINGUNA", "N/A", "NA", "SIN DATO", "NO APLICA", "NO REGISTRA", "-", ".", "\\N"}),
    "respuesta_texto"] = None
g["pn"] = g.pregunta.map(nz)
g["gc"] = g.grupo_competencia.map(nz)
g["anio"] = g.periodo_encuesta.str.extract(r"(\d{4})")[0].astype(int)
g["mom"] = g.periodo_encuesta.str.split().str[0].map({"PRIMERA": "1", "SEGUNDA": "2", "TERCERA": "3"})
assert g.mom.notna().all(), f"periodo de encuesta sin momento: {set(g.periodo_encuesta[g.mom.isna()])}"
clave_dup = ["persona_id", "periodo_encuesta", "pn"]
antes = len(g)
g = g[~g.duplicated(clave_dup + ["respuesta_texto", "respuesta_numerica"])]
print(f"Respuestas repetidas idénticas quitadas: {antes - len(g)}")
contra = g.duplicated(clave_dup, keep=False)
print(f"Respuestas contradictorias excluidas: {int(contra.sum())} ({g.loc[contra, 'persona_id'].nunique()} graduados)")
g = g[~contra]

# ------------------------------------------------- variables del cuestionario
EQUIV = {
    "situacion_laboral": {"Bajo relación de dependencia": "Relación de dependencia",   # el formulario 2026 dice «Empleado» (dependencia u honorarios): se deja así
                          "Ninguna Actividad": "Sin actividad laboral"},
    "tramo_salarial": {"1001 A 2000": "1001 a 2000", ">2000": "mayor de 2000"},
    "tipo_empresa": {"PUBLICO": "Pública", "PÚBLICA": "Pública", "PRIVADA": "Privada"},
    "rango_jerarquico": {"Directivo/Gerencial": "Directivo / gerencial", "Gerencial": "Directivo / gerencial",
                         "Supervisor/Mandos Medios": "Supervisión y mandos medios",
                         "Supervisor/Mandos Medios/Docentes": "Supervisión y mandos medios",
                         "Obrero/Operativo": "Operativo / técnico", "Operativo/Técnico": "Operativo / técnico"},
    "estudios_deseados": {"Otra licenciatura / ingeniería": "Otra licenciatura/Ingeniería",
                          "Cursos de investigación": "Cursos de Investigación"},
}
SECTOR = {
    "Primario: agricultura, pesca, minería": "Primario: agricultura, pesca, minería",
    "Agricultura, ganadería, caza y silvicultura": "Primario: agricultura, pesca, minería",
    "Pesca": "Primario: agricultura, pesca, minería", "Explotación de minas y canteras": "Primario: agricultura, pesca, minería",
    "Secundario: sector industrial": "Secundario: sector industrial", "Industria manufacturera": "Secundario: sector industrial",
    "Construcción": "Secundario: sector industrial", "Otro": "Otro",
}
CATEGORICAS = {
    "situacion_laboral": r"sus fuentes principales de ingreso|actualmente se encuentra realizando alguna actividad",
    "tiempo_primer_empleo": r"cuanto tiempo ha tardado en encontrar su primer empleo",
    "tramo_salarial": r"en que tramo se encuentra su salario|cual es el salario mensual que percibe",
    "tipo_contrato": r"cual es su tipo de contrato",
    "rango_jerarquico": r"en que rango jerarquico se encuentra|indique el cargo que desempena en la empresa:",
    "sector_economico": r"sector economico",
    "tipo_empresa": r"que tipo de empresa es",
    "vinculo_empleador": r"existen vinculos entre",
    "canal_busqueda": r"canales de busqueda de empleo",
    "medio_empleo": r"a traves de que medio lo encontro",
    "estudios_deseados": r"cursar otros estudios en esta institucion|tipo de estudios le interesaria",
    "trabajo_mientras_estudiaba": r"^¿?trabajo mientras estudiaba",
    "formacion_posgrado": r"tipo de formacion que se encuentra realizando",
}
ESCALAS = {
    "relacion_empleo": r"se relaciona su trabajo actual con los estudios|que tan relacionadas estan las actividades"
                       r"|en que grado su actividad laboral o productiva se relaciona|en que grado las actividades desarrolladas en su negocio",
    "malla": r"malla curricular de su carrera",
    "satisfaccion": r"cual es el grado de satisfaccion con los estudios realizados",
}


def tomar(patron, numerica=False):
    x = g[g.pn.str.contains(patron, regex=True)]
    col = "respuesta_numerica" if numerica else "respuesta_texto"
    x = x[x[col].notna()]
    if numerica:
        x = x[x[col].between(1, 7)]
    return x.drop_duplicates(["persona_id", "periodo_encuesta"])[["persona_id", "periodo_encuesta", col]].rename(columns={col: "v"})


po = (g.drop_duplicates(["persona_id", "periodo_encuesta"])
      [["persona_id", "inscripcion_id", "periodo_encuesta", "clave", "anio", "mom"]].set_index(["persona_id", "periodo_encuesta"]))
for var, pat in CATEGORICAS.items():
    v = tomar(pat).set_index(["persona_id", "periodo_encuesta"]).v.replace(EQUIV.get(var, {}))
    if var == "sector_economico":
        v = v.map(lambda s: SECTOR.get(s, "Terciario: comercio y servicios"))
    po[var] = v
for var, pat in ESCALAS.items():
    po[var] = tomar(pat, numerica=True).set_index(["persona_id", "periodo_encuesta"]).v
po = po.reset_index()
# «Trabaja o cursa maestría» solo se mide en las olas que preguntan la formación desde la graduación
OLAS_FORMACION = set(g.loc[g.pn.str.contains(CATEGORICAS["formacion_posgrado"]), "periodo_encuesta"])
po["trabaja_o_maestria"] = po.situacion_laboral.where(po.periodo_encuesta.isin(OLAS_FORMACION))
po.loc[po.trabaja_o_maestria.notna(), "trabaja_o_maestria"] = (
    (po.situacion_laboral != "Sin actividad laboral") | (po.formacion_posgrado == "Programa de maestría"))
GRADO = {1: "Mínimo grado", 2: "Muy bajo grado", 3: "Bajo grado", 4: "Medio grado", 5: "Alto grado",
         6: "Muy Alto grado", 7: "Máximo grado"}
po["relacion_empleo_cat"] = po.relacion_empleo.map(GRADO)

comp = g[g.gc.str.contains(r"competencias (?:generales|especificas)") & g.respuesta_numerica.between(1, 7)
         & ~g.pn.str.contains("identificado con unemi")].copy()
comp["tipo"] = comp.gc.str.contains("especificas").map({True: "E", False: "G"})
comp["texto"] = comp.pregunta.map(limpio)
COMPETENCIAS = sorted(comp.texto.unique())
comp["idx"] = comp.texto.map({t: i for i, t in enumerate(COMPETENCIAS)})

# ------------------------------------------------------ cruce con estudiantes
e1 = est.drop_duplicates("inscripcion_id").set_index("inscripcion_id")
po["sexo"] = po.inscripcion_id.map(e1.sexo)
po["gse"] = po.inscripcion_id.map(e1.grupo_socioeconomico)
tit = est[est.graduado == "SI"].copy()
tit["ct"] = pd.to_datetime(tit.fechagraduado, errors="coerce").dt.year
tit = tit.dropna(subset=["ct"]).drop_duplicates("inscripcion_id")
tit["ct"] = tit.ct.astype(int)
po["ct"] = po.inscripcion_id.map(tit.set_index("inscripcion_id").ct)
print(f"Encuestas cruzadas con un titulado de la base de estudiantes: {po.ct.notna().mean() * 100:.1f} %")
comp = comp.merge(po[["persona_id", "periodo_encuesta", "sexo", "gse", "ct"]], on=["persona_id", "periodo_encuesta"], how="left")

# --------------------------------------------------------------- indicadores
INDICADORES = ["empleabilidad", "sin_actividad", "insercion_6m", "empleo_afin", "contrato_fijo", "salario_sobre_sbu",
               "supervision_direccion", "sector_terciario", "competencias_especificas", "competencias_generales",
               "empleador_convenio", "empleo_bolsa_unemi", "quiere_maestria", "malla_acorde", "satisfaccion_graduados", "trabaja_o_maestria"]


def par(serie, condicion):
    s = serie.dropna()
    b = len(s)
    return [b, int(condicion(s).sum()) if b >= K_ANON else None]


def fila_kpi(x, cx):
    f = [int(len(x)), int(x.persona_id.nunique())]
    f += par(x.situacion_laboral, lambda s: s != "Sin actividad laboral")
    f += par(x.situacion_laboral, lambda s: s == "Sin actividad laboral")
    f += par(x.tiempo_primer_empleo, lambda s: s == "0 a 6 meses")
    f += par(x.relacion_empleo, lambda s: s >= 6)
    f += par(x.tipo_contrato, lambda s: s == "Fijo")
    f += par(x.tramo_salarial, lambda s: s != "<=SBU")
    f += par(x.rango_jerarquico, lambda s: s.isin(["Supervisión y mandos medios", "Directivo / gerencial"]))
    f += par(x.sector_economico, lambda s: s.str.startswith("Terciario"))
    for t in ["E", "G"]:   # la base son valoraciones, pero el umbral se aplica a personas
        h = cx[cx.tipo == t]
        b = len(h)
        f += [b, int((h.respuesta_numerica >= 6).sum()) if h.persona_id.nunique() >= K_ANON else None]
    f += par(x.vinculo_empleador, lambda s: s != "Ningún tipo de convenio")
    f += par(x.medio_empleo, lambda s: s == "Bolsa trabajo UNEMI")
    f += par(x.estudios_deseados, lambda s: s == "Programa de maestría")
    f += par(x.malla, lambda s: s >= 6)
    f += par(x.satisfaccion, lambda s: s >= 6)
    f += par(x.trabaja_o_maestria, lambda s: s.astype(bool))
    return f


DIST = ["situacion_laboral", "tiempo_primer_empleo", "tramo_salarial", "tipo_contrato", "rango_jerarquico",
        "sector_economico", "tipo_empresa", "vinculo_empleador", "canal_busqueda", "medio_empleo",
        "estudios_deseados", "trabajo_mientras_estudiaba"]


def sup_comp(ns, minimo=MIN_BASE):
    """Supresión complementaria de exportar_rendimiento_dashboard.R: en una familia de grupos,
    si se oculta uno solo o los ocultos suman menos de MIN_BASE, se oculta el siguiente más pequeño."""
    s = [n < minimo for n in ns]
    if minimo <= 0 or not any(s):
        return s
    while (sum(n for n, o in zip(ns, s) if o) < minimo or sum(s) < 2) and not all(s):
        j = min((i for i in range(len(ns)) if not s[i]), key=lambda i: ns[i])
        s[j] = True
    return s


def anon_cat(conteos):
    """Categorías < K_ANON se suman en OTRAS (así lo publica el tablero vigente)."""
    grandes = [(c, n) for c, n in conteos if n >= K_ANON]
    otras = sum(n for _, n in conteos if n < K_ANON)
    return grandes + ([(OTRAS, otras)] if otras else [])


def dist(x):
    out = {}
    for var in DIST + ["relacion_empleo"]:
        s = x["relacion_empleo_cat" if var == "relacion_empleo" else var].dropna()
        b = len(s)
        if b < K_ANON:
            continue
        filas = [[c, int(n), b, round(100 * n / b, 2)] for c, n in anon_cat(list(s.value_counts().items()))]
        out[var] = sorted(filas, key=lambda z: -z[3])
    return out


def fila_comp(cx):
    out = []
    for (t, i), h in cx.groupby(["tipo", "idx"]):
        if len(h) >= K_ANON:
            alto = int((h.respuesta_numerica >= 6).sum())
            out.append([t, int(i), int(len(h)), alto, r(h.respuesta_numerica.mean()), round(100 * alto / len(h), 2)])
    return sorted(out, key=lambda z: -z[5])


GSE = ["BAJO", "MEDIO BAJO", "MEDIO TÍPICO", "MEDIO ALTO", "ALTO"]
kpi, dists, comps = {}, {}, {}


def celdas(x, cx):
    """(año, momento) -> (subconjunto de encuestas, subconjunto de competencias)."""
    for a, xa in x.groupby("anio"):
        ca = cx[cx.anio == a]
        for m in ["1", "2", "3", "T"]:
            xm = xa if m == "T" else xa[xa.mom == m]
            if len(xm):
                yield str(a), m, xm, (ca if m == "T" else ca[ca.mom == m])


def publicar(clave, a, m, xm, cm):
    kpi.setdefault(clave, {}).setdefault(a, {})[m] = fila_kpi(xm, cm)
    d = dist(xm)
    if d:
        dists.setdefault(clave, {}).setdefault(a, {})[m] = d
    fc = fila_comp(cm)
    if fc:
        comps.setdefault(clave, {}).setdefault(a, {})[m] = fc


for k in CLAVES:
    x, cx = filtro(po, k), filtro(comp, k)
    for a, m, xm, cm in celdas(x, cx):
        publicar(k, a, m, xm, cm)
    familias = {
        "sexo": [(f"sexo:{s}", x.sexo == s, cx.sexo == s) for s in ["MUJER", "HOMBRE"]],
        "gse": [(gs, x.gse == gs, cx.gse == gs) for gs in GSE],
        "cohorte": [(f"cohorte_titulacion:{int(ct)}", x.ct == ct, cx.ct == ct) for ct in sorted(x.ct.dropna().unique())],
    }
    for grupos in familias.values():
        por_celda = {}
        for suf, mx, mc in grupos:
            for a, m, xm, cm in celdas(x[mx], cx[mc]):
                por_celda.setdefault((a, m), []).append((f"{k}|{suf}", xm, cm))
        for (a, m), lista in por_celda.items():
            for (clave, xm, cm), oculto in zip(lista, sup_comp([len(xm) for _, xm, _ in lista])):
                if not oculto:
                    publicar(clave, a, m, xm, cm)

# ------------------------------------------------- cobertura del seguimiento
tit["enc"] = tit.inscripcion_id.isin(set(po.inscripcion_id.dropna()))
cob = {}
for k in CLAVES:
    t = filtro(tit, k)
    if len(t):
        cob[k] = [int(len(t)), int(t.enc.sum())]
    for col, pref in [("ct", "cohorte_titulacion:"), ("sexo", "sexo:"), ("grupo_socioeconomico", "")]:
        hs = list(t.groupby(col))
        for (v, h), oculto in zip(hs, sup_comp([len(h) for _, h in hs])):
            if not oculto:
                cob[f"{k}|{pref}{v}"] = [int(len(h)), int(h.enc.sum())]

usados = sorted({COMPETENCIAS[f[1]] for ys in comps.values() for ms in ys.values() for fs in ms.values() for f in fs})
nuevo_idx = {COMPETENCIAS.index(c): i for i, c in enumerate(usados)}
for ys in comps.values():
    for ms in ys.values():
        for fs in ms.values():
            for f in fs:
                f[1] = nuevo_idx[f[1]]
COMPETENCIAS = usados

obj = {"generado": date.today().isoformat(), "minBase": MIN_BASE, "kAnon": K_ANON, "umbralAltoGrado": 6,
       "indicadores": INDICADORES, "competencias": COMPETENCIAS, "kpi": kpi, "dist": dists, "comp": comps, "cob": cob}
txt = json.dumps(obj, ensure_ascii=False, separators=(",", ":"), allow_nan=False,
                 default=lambda o: o.item() if hasattr(o, "item") else str(o))
salida = Path(args.salida)
salida.parent.mkdir(parents=True, exist_ok=True)
salida.write_text("/* Generado por agregar_graduados_facs.py — no editar a mano. "
                  "Solo datos agregados de las encuestas a graduados. */\n"
                  f"window.FACS_GRAD={txt};\n", encoding="utf-8")
print(f"Escrito {salida} ({len(txt) / 1024:.0f} KB)")
print("Encuestas por año (FACS, todos los momentos):", {a: v["T"][0] for a, v in sorted(kpi["FACS"].items())})

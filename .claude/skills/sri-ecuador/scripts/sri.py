#!/usr/bin/env python3
"""Cálculos SRI Ecuador con la misma lógica que services/sri.ts del estudio.

Uso:
  sri.py vence  RUC PERIODO [--regimen general|emprendedor|popular|sociedad] [--especial]
  sri.py ruc    IDENTIFICACION        (valida RUC de 13 o cédula de 10)
  sri.py clave  CLAVE_DE_49_DIGITOS   (valida y desarma una clave de acceso)

PERIODO: 2026-10 (mes) · 2026-S1 / 2026-S2 (semestre) · 2025 (renta anual)
         · ats:2026-09 · 1021:2025 · adi:2025 · rebefics:2026 · anexo:2025 · pvp:2025
"""
import argparse
import calendar
import datetime as dt
import re
import sys

DIA_POR_DIGITO = {1: 10, 2: 12, 3: 14, 4: 16, 5: 18, 6: 20, 7: 22, 8: 24, 9: 26, 0: 28}
DIAS = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"]
MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]


def solo_digitos(s):
    return re.sub(r"\D", "", s or "")


def dia_9no(ruc):
    d = solo_digitos(ruc)
    if len(d) < 9:
        raise SystemExit("El RUC/cédula necesita al menos 9 dígitos.")
    return DIA_POR_DIGITO[int(d[8])]


def es_sociedad(ruc):
    d = solo_digitos(ruc)
    return len(d) == 13 and d[2] == "9"


def fecha(y, m, d):
    # Ajusta meses fuera de rango (13 -> enero siguiente)
    y += (m - 1) // 12
    m = (m - 1) % 12 + 1
    d = min(d, calendar.monthrange(y, m)[1])
    return dt.date(y, m, d)


def vencimiento(ruc, periodo, regimen, especial=False):
    dia = dia_9no(ruc)
    p = periodo.strip().upper().replace("-1S", "-S1").replace("-2S", "-S2")
    tipo, _, resto = p.partition(":") if ":" in p and not re.match(r"^\d{4}", p) else ("", "", p)
    if not tipo:
        resto = p.split(":")[0]  # 2026-10:ICE -> mismo vencimiento que el IVA del mes

    if tipo == "ATS":
        y, m = map(int, resto.split("-"))
        return fecha(y, m + 2, dia), "ATS: mes subsiguiente al período"
    if tipo == "1021":
        y = int(resto)
        return fecha(y + 1, 4, 11 if especial else dia), "Renta sociedades (1021): abril"
    if tipo == "ADI":
        return fecha(int(resto) + 1, 5, dia), "Anexo de dividendos: mayo"
    if tipo == "REBEFICS":
        return fecha(int(resto), 2, dia), "REBEFICS: febrero (la 1.ª vez: 28 días desde la constitución)"
    if tipo == "ANEXO":
        return fecha(int(resto) + 1, 2, 28), "Anexo de gastos personales: el código fija el 28 de febrero"
    if tipo == "PVP":
        return fecha(int(resto) + 1, 1, 5), "Anexo PVP: hasta el 5 de enero"
    if tipo:
        raise SystemExit(f"Tipo de período desconocido: {tipo}")

    if re.fullmatch(r"\d{4}-S[12]", resto):
        y, s = int(resto[:4]), resto[-1]
        if regimen == "popular":
            raise SystemExit("RIMPE Negocio Popular no declara IVA.")
        if s == "1":
            return fecha(y, 7, dia), "IVA semestral S1 (ene–jun): julio"
        return fecha(y + 1, 1, dia), "IVA semestral S2 (jul–dic): enero del año siguiente"
    if re.fullmatch(r"\d{4}-\d{2}", resto):
        y, m = map(int, resto.split("-"))
        if regimen == "popular":
            raise SystemExit("RIMPE Negocio Popular no declara IVA.")
        return fecha(y, m + 1, dia), "IVA mensual: mes siguiente al período"
    if re.fullmatch(r"\d{4}", resto):
        y = int(resto)
        if regimen == "sociedad":
            return fecha(y + 1, 4, 11 if especial else dia), "Renta sociedades (1021): abril"
        if regimen == "popular":
            return fecha(y + 1, 5, dia), "Renta RIMPE Negocio Popular (102A): mayo"
        return fecha(y + 1, 3, dia), "Renta anual (102 / 102A): marzo"
    raise SystemExit(f"No entiendo el período «{periodo}».")


def validar_identificacion(idn):
    c = solo_digitos(idn)
    if len(c) not in (10, 13):
        return False, "Debe tener 10 (cédula) o 13 (RUC) dígitos."
    if len(c) == 13 and not c.endswith("001"):
        # El sistema exige terminar en 001 (services/sri.ts validateRuc)
        return False, "El RUC debe terminar en 001."
    prov = int(c[:2])
    if not (1 <= prov <= 24 or prov == 30):
        return False, f"Código de provincia inválido: {c[:2]}."
    t = int(c[2])
    if t < 6:
        coef = [2, 1, 2, 1, 2, 1, 2, 1, 2]
        s = sum((v - 9 if v > 9 else v) for v in (int(c[i]) * coef[i] for i in range(9)))
        ver = (10 - s % 10) % 10
        ok = ver == int(c[9])
        tipo = "RUC de persona natural" if len(c) == 13 else "Cédula"
        return ok, f"{tipo}: verificador {'correcto' if ok else f'incorrecto (esperado {ver})'}."
    if t == 9 and len(c) == 13:
        coef = [4, 3, 2, 7, 6, 5, 4, 3, 2]
        r = sum(int(c[i]) * coef[i] for i in range(9)) % 11
        ver = 0 if r == 0 else 11 - r
        ok = ver == int(c[9])
        extra = "" if ok else (" Ojo: hay RUC de sociedades emitidos por el SRI que no cumplen el "
                               "módulo 11; confirma en el portal antes de rechazarlo.")
        return ok, f"RUC de sociedad privada: verificador {'correcto' if ok else f'incorrecto (esperado {ver})'}.{extra}"
    if t == 6 and len(c) == 13:
        coef = [3, 2, 7, 6, 5, 4, 3, 2]
        r = sum(int(c[i]) * coef[i] for i in range(8)) % 11
        ver = 0 if r == 0 else 11 - r
        ok = ver == int(c[8])
        return ok, f"RUC de entidad pública: verificador {'correcto' if ok else f'incorrecto (esperado {ver})'}."
    return False, f"Tercer dígito {t} no válido para un {'RUC' if len(c) == 13 else 'cédula'}."


TIPOS = {"01": "Factura", "03": "Liquidación de compra", "04": "Nota de crédito",
         "05": "Nota de débito", "06": "Guía de remisión", "07": "Comprobante de retención"}


def validar_clave(clave):
    c = solo_digitos(clave)
    if len(c) != 49:
        return {"valida": False, "motivo": f"Tiene {len(c)} dígitos; deben ser 49."}
    suma, peso = 0, 2
    for ch in reversed(c[:48]):
        suma += int(ch) * peso
        peso = 2 if peso == 7 else peso + 1
    ver = 11 - suma % 11
    ver = 0 if ver == 11 else 1 if ver == 10 else ver
    return {
        "valida": str(ver) == c[48],
        "fecha_emision": f"{c[0:2]}/{c[2:4]}/{c[4:8]}",
        "tipo": TIPOS.get(c[8:10], f"tipo {c[8:10]}"),
        "ruc_emisor": c[10:23],
        "ambiente": "Producción" if c[23] == "2" else "Pruebas",
        "serie": f"{c[24:27]}-{c[27:30]}",
        "secuencial": c[30:39],
        "verificador": f"{c[48]} (calculado {ver})",
    }


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    v = sub.add_parser("vence")
    v.add_argument("ruc")
    v.add_argument("periodo")
    v.add_argument("--regimen", choices=["general", "emprendedor", "popular", "sociedad"])
    v.add_argument("--especial", action="store_true", help="contribuyente especial (1021 el día 11)")
    r = sub.add_parser("ruc")
    r.add_argument("identificacion")
    k = sub.add_parser("clave")
    k.add_argument("clave")
    a = ap.parse_args()

    if a.cmd == "vence":
        regimen = a.regimen or ("sociedad" if es_sociedad(a.ruc) else "general")
        f, regla = vencimiento(a.ruc, a.periodo, regimen, a.especial)
        print(f"Vence: {DIAS[f.weekday()]} {f.day} de {MESES[f.month]} de {f.year}  ({f.isoformat()})")
        print(f"Regla: {regla} · día por 9.º dígito ({solo_digitos(a.ruc)[8]}) · régimen {regimen}")
        if f.weekday() >= 5:
            print("AVISO: cae en fin de semana. El código no lo corre; por norma general "
                  "pasa al siguiente día hábil. Verifica también feriados.")
    elif a.cmd == "ruc":
        ok, msg = validar_identificacion(a.identificacion)
        print(("VÁLIDO: " if ok else "INVÁLIDO: ") + msg)
        sys.exit(0 if ok else 1)
    else:
        res = validar_clave(a.clave)
        for kk, vv in res.items():
            print(f"{kk}: {vv}")
        sys.exit(0 if res["valida"] else 1)


if __name__ == "__main__":
    main()

"""
Varredura de bancos Access (.mdb) para extrair CNPJ/CGC por código de cliente legado
e correção no PostgreSQL dos cadastros criados com CNPJ sintético (prefixo 99…).

Importante:
  - Arquivos .ldb são apenas LOCK do Access; o banco de dados é o .mdb / .accdb.
  - Use os caminhos reais dos .mdb (ex.: E:\\BdGeral.mdb, E:\\Movime2.mdb, E:\\N_Siste.mdb).

Dependências (Windows, uma vez):
  pip install pyodbc psycopg[binary]
  + Driver ODBC Microsoft Access (mesmo do export_access_to_csv.py)

Uso típico:
  1) Escanear e gerar mapa CSV:
     python scripts/legacy_scan_and_fix_cnpj.py scan --mdb E:/BdGeral.mdb --mdb E:/Movime2.mdb --mdb E:/N_Siste.mdb --password "" --out scripts/legacy_cnpj_map.csv

  2) Ver clientes ainda “falsos” no Postgres:
     python scripts/legacy_scan_and_fix_cnpj.py report --env .env

     Se o .env aponta para um Postgres na nuvem e o PC não resolve o host (erro DNS):
     use um túnel/VPN, rode no servidor, OU aponte para Postgres local:
       set DATABASE_URL=postgresql://user:pass@localhost:5432/saas_colombocal
     (PowerShell: $env:DATABASE_URL="...")
     Ou: python ... report --database-url "postgresql://..."

  3) Aplicar (dry-run primeiro):
     python scripts/legacy_scan_and_fix_cnpj.py apply --env .env --map scripts/legacy_cnpj_map.csv
     python scripts/legacy_scan_and_fix_cnpj.py apply --env .env --map scripts/legacy_cnpj_map.csv --apply

  Limpar um CSV já gerado (remove datas disfarçadas de CNPJ e, opcional, scan_celula):
     python scripts/legacy_scan_and_fix_cnpj.py filter-map --in scripts/legacy_cnpj_map.csv --out scripts/legacy_cnpj_map.cleaned.csv --drop-scan-celula
"""

from __future__ import annotations

import argparse
import csv
import os
import re
import sys
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

try:
    import pyodbc
except ImportError:
    pyodbc = None

try:
    import psycopg
except ImportError:
    psycopg = None


def norm_code(raw) -> str:
    if raw is None:
        return ""
    return "".join(ch for ch in str(raw).strip() if ch.isdigit())


def only_digits(s) -> str:
    if s is None:
        return ""
    return "".join(ch for ch in str(s) if ch.isdigit())


def fake_cnpj_from_code(code: str) -> str:
    """Mesma regra de import_legacy_apply.py"""
    digits = norm_code(code)
    if not digits:
        digits = "0"
    return ("99" + digits).zfill(14)[-14:]


def valida_cnpj(d: str) -> bool:
    """Dígitos verificadores CNPJ (14 dígitos)."""
    d = only_digits(d)
    if len(d) != 14:
        return False
    if d in ("00000000000000", "11111111111111") or len(set(d)) == 1:
        return False

    def calc(base: str, weights: list[int]) -> int:
        s = sum(int(base[i]) * weights[i] for i in range(len(weights)))
        r = s % 11
        return 0 if r < 2 else 11 - r

    w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    if calc(d[:12], w1) != int(d[12]):
        return False
    if calc(d[:13], w2) != int(d[13]):
        return False
    return True


def looks_like_date_masquerading_as_cnpj(d: str) -> bool:
    """
    Access grava datas como números; 14 dígitos no padrão AAAAMMDD000000 passam no DV de CNPJ por acaso.
    """
    if len(d) != 14 or d[8:] != "000000":
        return False
    try:
        y, m, day = int(d[:4]), int(d[4:6]), int(d[6:8])
    except ValueError:
        return False
    return 1950 <= y <= 2036 and 1 <= m <= 12 and 1 <= day <= 31


def normalize_cnpj_field(raw) -> str | None:
    d = only_digits(raw)
    if len(d) > 14:
        d = d[:14]
    if len(d) == 14 and valida_cnpj(d):
        if looks_like_date_masquerading_as_cnpj(d):
            return None
        return d
    return None


def resolve_mdb_path(p: str) -> Path:
    path = Path(p)
    if path.suffix.lower() == ".ldb":
        path = path.with_suffix(".mdb")
        print(f"[INFO] .ldb é lock do Access; usando caminho equivalente: {path}", file=sys.stderr)
    return path


def connect_access(mdb_path: Path, password: str):
    if pyodbc is None:
        raise RuntimeError("Instale pyodbc: pip install pyodbc")
    conn_str = (
        "DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"DBQ={mdb_path.resolve()};"
        f"PWD={password};"
    )
    return pyodbc.connect(conn_str)


def get_table_columns(cur, table_name: str) -> list[str]:
    try:
        return [c.column_name for c in cur.columns(table=table_name)]
    except Exception:
        cur.execute(f"SELECT * FROM [{table_name}] WHERE 1=0")
        return [d[0] for d in (cur.description or [])]


def list_user_tables(cur) -> list[str]:
    names = []
    for row in cur.tables():
        tname = getattr(row, "table_name", None)
        ttype = (getattr(row, "table_type", "") or "").upper()
        if not tname or ttype not in {"TABLE", "VIEW"}:
            continue
        if str(tname).startswith("MSys"):
            continue
        names.append(str(tname))
    return sorted(set(names))


CODE_COL_CANDIDATES = (
    "CODI",
    "CLIE",
    "CLIENT",
    "NCLI",
    "IDCLI",
    "CODCLI",
    "CODCLIENTE",
    "ID_CLIENTE",
)

DOC_COL_CANDIDATES = (
    "CNPJ",
    "CGC",
    "CPFCNPJ",
    "NR_CGC",
    "CGCCPF",
    "DOCUMENTO",
    "CPF_CNPJ",
)
# INSC_FED / inscrição estadual costuma ser outro formato — removido para evitar ruído

NAME_COL_CANDIDATES = (
    "NOME",
    "RAZAO",
    "RAZAOSOCIAL",
    "FANTASIA",
    "FANT",
    "NOM",
    "DESCR",
)


def pick_column(cols: list[str], candidates: tuple[str, ...]) -> str | None:
    upper_map = {c.upper(): c for c in cols}
    for cand in candidates:
        if cand in upper_map:
            return upper_map[cand]
    for c in cols:
        u = c.upper()
        for cand in candidates:
            if cand in u:
                return c
    return None


# Varredura “qualquer célula” só em tabelas que não são claramente fiscais/movimento
BROAD_SCAN_TABLE_DENY_SUBSTR = (
    "icms",
    "produto",
    "tabelas",
    "cheque",
    "ordens",
    "carregamento",
    "veiculo",
    "seguro",
    "movfrete",
    "fretes",
    "duplicata",
    "contacorrente",
    "pagarreceber",
    "comissa",
    "estoque",
    "danfe",
    "sped",
    "ipi",
    "cfop",
    "nfe",
)


def table_denied_for_broad_scan(table: str) -> bool:
    t = (table or "").lower()
    return any(k in t for k in BROAD_SCAN_TABLE_DENY_SUBSTR)


def column_skipped_for_broad_scan(col_name: str) -> bool:
    """Colunas de data/hora geram falso CNPJ de 14 dígitos."""
    u = (col_name or "").strip().upper()
    if not u:
        return True
    if u in ("DATA", "HORA", "DT", "DTC", "DTV", "DTP", "DTS", "DATAI", "DATAF"):
        return True
    for frag in ("DATA", "HORA", "VENC", "EMISS", "ALT_", "_DATA", "DT_", "MODIF", "INCLUS", "ATUALIZ"):
        if frag in u:
            return True
    return False


def scan_table(cur, table: str, mdb_label: str) -> list[dict]:
    cols = get_table_columns(cur, table)
    if not cols:
        return []
    code_col = pick_column(cols, CODE_COL_CANDIDATES)
    doc_col = pick_column(cols, DOC_COL_CANDIDATES)
    out: list[dict] = []

    if code_col and doc_col:
        safe_code = f"[{code_col}]"
        safe_doc = f"[{doc_col}]"
        nome_col = pick_column(cols, NAME_COL_CANDIDATES)
        nome_sel = f", [{nome_col}]" if nome_col else ""
        try:
            cur.execute(
                f"SELECT TOP 20000 {safe_code}, {safe_doc}{nome_sel} FROM [{table}] "
                f"WHERE {safe_doc} IS NOT NULL AND {safe_code} IS NOT NULL"
            )
            for row in cur.fetchall():
                cod = norm_code(row[0])
                cnpj = normalize_cnpj_field(row[1])
                if not cod or not cnpj:
                    continue
                nome_txt = ""
                if nome_col and len(row) > 2 and row[2] is not None:
                    nome_txt = str(row[2]).strip()[:150]
                out.append(
                    {
                        "legacy_codigo": cod,
                        "cnpj": cnpj,
                        "nome": nome_txt,
                        "fonte": f"{mdb_label}:{table}",
                        "metodo": "colunas_nomeadas",
                    }
                )
        except Exception as e:
            print(f"[AVISO] {table}: {e}", file=sys.stderr)

    # Varredura ampla: só em tabelas “cadastro”; evita Icms/Produtos/Tabelas etc.
    if code_col and not table_denied_for_broad_scan(table):
        safe_code = f"[{code_col}]"
        try:
            cur.execute(
                f"SELECT TOP 12000 * FROM [{table}] WHERE {safe_code} IS NOT NULL"
            )
            col_list = cols
            for row in cur.fetchall():
                rowd = {col_list[i]: row[i] for i in range(len(col_list))}
                cod = norm_code(rowd.get(code_col))
                if not cod:
                    continue
                if doc_col and normalize_cnpj_field(rowd.get(doc_col)):
                    continue
                for cname, val in rowd.items():
                    if cname == code_col or column_skipped_for_broad_scan(cname):
                        continue
                    cnpj = normalize_cnpj_field(val)
                    if cnpj:
                        out.append(
                            {
                                "legacy_codigo": cod,
                                "cnpj": cnpj,
                                "nome": "",
                                "fonte": f"{mdb_label}:{table}",
                                "metodo": f"scan_celula:{cname}",
                            }
                        )
                        break
        except Exception as e:
            print(f"[AVISO] scan amplo {table}: {e}", file=sys.stderr)

    return out


def _write_map_csv(merged: list[dict], out: str) -> None:
    out_path = Path(out).resolve()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = ["legacy_codigo", "cnpj", "nome", "fonte", "metodo"]
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        for r in merged:
            row = {k: (r.get(k) or "") for k in fieldnames}
            w.writerow(row)
    print(f"[OK] Mapa: {len(merged)} códigos com CNPJ válido → {out_path}")


def merge_maps(rows: list[dict]) -> list[dict]:
    """Por código legado, fica um registro; prioriza metodo nomeado e fonte Geral."""
    by_code: dict[str, dict] = {}
    priority = {"colunas_nomeadas": 3, "csv_export": 2, "scan_celula": 1}

    def score(r: dict) -> tuple[int, int]:
        m = r.get("metodo") or ""
        key = m.split(":")[0] if m else ""
        base = priority.get(key, 0)
        geral = 1 if "Geral" in (r.get("fonte") or "") else 0
        return (base, geral)

    for r in rows:
        cod = r["legacy_codigo"]
        if cod not in by_code:
            by_code[cod] = r
            continue
        prev = by_code[cod]
        if score(r) > score(prev):
            by_code[cod] = r
        elif score(r) == score(prev):
            len_r = len((r.get("nome") or "").strip())
            len_p = len((prev.get("nome") or "").strip())
            if len_r > len_p:
                by_code[cod] = r

    return sorted(by_code.values(), key=lambda x: x["legacy_codigo"])


def find_column_name(fieldnames: list[str], candidates: tuple[str, ...]) -> str | None:
    """Resolve nome real da coluna no CSV (ignora espaços / case)."""
    if not fieldnames:
        return None
    mapping = {(n or "").strip().upper(): n for n in fieldnames}
    for cand in candidates:
        if cand.upper() in mapping:
            return mapping[cand.upper()]
    for n in fieldnames:
        u = (n or "").strip().upper()
        for cand in candidates:
            if cand.upper() in u:
                return n
    return None


def scan_csv_geral(path: Path) -> list[dict]:
    """Lê CSV exportado do Access (ex.: Geral.csv) sem precisar de ODBC."""
    out: list[dict] = []
    with path.open(encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        if not r.fieldnames:
            return []
        code_col = find_column_name(list(r.fieldnames), CODE_COL_CANDIDATES)
        doc_col = find_column_name(list(r.fieldnames), DOC_COL_CANDIDATES)
        nome_col = find_column_name(list(r.fieldnames), NAME_COL_CANDIDATES)
        if not code_col or not doc_col:
            cols = [c.strip() for c in r.fieldnames]
            print(
                f"[AVISO] {path.name}: colunas CODI+CNPJ/CGC não detectadas em {cols[:15]}...",
                file=sys.stderr,
            )
            return []
        for row in r:
            cod = norm_code(row.get(code_col))
            cnpj = normalize_cnpj_field(row.get(doc_col))
            if not cod or not cnpj:
                continue
            nome_txt = ""
            if nome_col and row.get(nome_col):
                nome_txt = str(row.get(nome_col)).strip()[:150]
            out.append(
                {
                    "legacy_codigo": cod,
                    "cnpj": cnpj,
                    "nome": nome_txt,
                    "fonte": f"{path.name}",
                    "metodo": "csv_export",
                }
            )
    return out


def cmd_scan(args: argparse.Namespace) -> None:
    all_rows: list[dict] = []

    for csv_extra in args.csv or []:
        p = Path(csv_extra).expanduser().resolve()
        if not p.is_file():
            print(
                f"[ERRO] CSV não encontrado: {p}\n"
                "  Confira o caminho (arraste o arquivo para o terminal ou use caminho completo).\n"
                "  Ex.: --csv \"C:\\Users\\seu_user\\Desktop\\Geral.csv\"",
                file=sys.stderr,
            )
            continue
        all_rows.extend(scan_csv_geral(p))

    if not args.mdb:
        if not all_rows:
            print(
                "Erro: nenhum CSV foi lido (arquivo inexistente ou vazio). "
                "Confira o caminho com aspas, ex.: --csv \"C:\\Users\\...\\Geral.csv\"\n"
                "Ou use --mdb para ler direto do Access.",
                file=sys.stderr,
            )
            sys.exit(1)
        merged = merge_maps(all_rows)
        _write_map_csv(merged, args.out)
        return

    if pyodbc is None:
        print("Erro: pyodbc não instalado. pip install pyodbc", file=sys.stderr)
        sys.exit(1)

    for raw_path in args.mdb:
        path = resolve_mdb_path(raw_path)
        if not path.is_file():
            print(f"[ERRO] Arquivo não encontrado: {path}", file=sys.stderr)
            continue
        label = path.name
        print(f"[INFO] Conectando: {path}", file=sys.stderr)
        conn = connect_access(path, args.password)
        cur = conn.cursor()
        try:
            tables = list_user_tables(cur)
            print(f"[INFO] {label}: {len(tables)} tabelas", file=sys.stderr)
            for t in tables:
                all_rows.extend(scan_table(cur, t, label))
        finally:
            conn.close()

    merged = merge_maps(all_rows)
    _write_map_csv(merged, args.out)


def get_env_db_url(env_path: Path) -> str:
    for line in env_path.read_text(encoding="utf-8").splitlines():
        if line.startswith("DATABASE_URL="):
            val = line.split("=", 1)[1].strip()
            if val.startswith('"') and val.endswith('"'):
                val = val[1:-1]
            return val
    raise RuntimeError("DATABASE_URL não encontrado no .env")


def normalize_db_url_for_psycopg(db_url: str) -> str:
    parsed = urlparse(db_url)
    q = parse_qsl(parsed.query, keep_blank_values=True)
    q = [(k, v) for (k, v) in q if k.lower() != "schema"]
    return urlunparse(parsed._replace(query=urlencode(q)))


def resolve_database_url(env_path: Path | None, cli_override: str | None) -> str:
    """Ordem: --database-url > variável DATABASE_URL > arquivo .env"""
    if cli_override and str(cli_override).strip():
        return str(cli_override).strip()
    from_env = (os.environ.get("DATABASE_URL") or "").strip()
    if from_env:
        return from_env
    if env_path is None:
        raise RuntimeError(
            "Defina DATABASE_URL no ambiente, ou --database-url, ou --env apontando para um .env com DATABASE_URL."
        )
    return get_env_db_url(env_path)


def connect_postgres_or_exit(url: str):
    """Conecta ao Postgres; em falha (DNS, rede) explica em português e sai com código 1."""
    if psycopg is None:
        print("Erro: psycopg não instalado. pip install psycopg[binary]", file=sys.stderr)
        sys.exit(1)
    try:
        return psycopg.connect(url)
    except Exception as e:
        err = str(e).lower()
        print(f"Erro ao conectar ao PostgreSQL: {e}", file=sys.stderr)
        if "resolve" in err or "getaddrinfo" in err or "name or service not known" in err:
            print(
                "\nO hostname do DATABASE_URL não foi resolvido nesta máquina.\n"
                "Isso é comum com banco na nuvem (Railway, etc.) acessível só de dentro da rede ou com VPN.\n"
                "Opções:\n"
                "  • Definir DATABASE_URL para um Postgres que você alcança (ex.: localhost após dump).\n"
                "  • Usar VPN/túnel se o provedor exigir.\n"
                "  • Rodar este script no mesmo ambiente onde a API já conecta ao banco.\n",
                file=sys.stderr,
            )
        sys.exit(1)


def cmd_filter_map(args: argparse.Namespace) -> None:
    """Pós-processa um mapa já exportado (remove ruído sem reabrir o Access)."""
    in_path = Path(args.in_path).expanduser().resolve()
    if not in_path.is_file():
        print(f"[ERRO] Entrada não encontrada: {in_path}", file=sys.stderr)
        sys.exit(1)

    raw: list[dict] = []
    with in_path.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            cod = norm_code(r.get("legacy_codigo") or r.get("CODI") or "")
            cnpj_raw = r.get("cnpj") or r.get("CNPJ") or ""
            cnpj = normalize_cnpj_field(cnpj_raw)
            if not cod or not cnpj:
                continue
            metodo = (r.get("metodo") or "").strip()
            if args.drop_scan_celula and metodo.startswith("scan_celula"):
                continue
            nome_txt = (r.get("nome") or r.get("NOME") or "").strip()[:150]
            raw.append(
                {
                    "legacy_codigo": cod,
                    "cnpj": cnpj,
                    "nome": nome_txt,
                    "fonte": (r.get("fonte") or "").strip() or "csv",
                    "metodo": metodo or "filtered",
                }
            )

    merged = merge_maps(raw)
    _write_map_csv(merged, args.out)
    print(
        f"[OK] filter-map: {in_path.name} → {len(merged)} linhas (após regra e dedupe por código)",
        file=sys.stderr,
    )


def cmd_deactivate_legacy(args: argparse.Namespace) -> None:
    """
    Inativa clientes claramente placeholder do import (Cliente legado… / CNPJ 99… + marca LEGACY).
    Não apaga linhas; vendas antigas continuam apontando para o id (como o botão Excluir da UI).
    """
    env_path = Path(args.env).resolve() if getattr(args, "env", None) else None
    try:
        raw_url = resolve_database_url(env_path, getattr(args, "database_url", None))
    except RuntimeError as e:
        print(f"Erro: {e}", file=sys.stderr)
        sys.exit(1)
    url = normalize_db_url_for_psycopg(raw_url)
    conn = connect_postgres_or_exit(url)
    cur = conn.cursor()
    where = """
        WHERE ativo = true AND (
            "razaoSocial" ILIKE %s
            OR ("nomeFantasia" ILIKE %s AND "cnpj" LIKE '99%%')
            OR (
                "cnpj" LIKE '99%%'
                AND strpos(COALESCE(observacoes, ''), '[LEGACY_CLIENTE:') > 0
            )
        )
    """
    params = ("Cliente legado%", "CL %")
    note = " [LEGACY_INATIVADO_SCRIPT]"
    try:
        cur.execute(
            f'SELECT id, cnpj, "razaoSocial" FROM "Cliente" {where} ORDER BY id',
            params,
        )
        rows = cur.fetchall()
        n = len(rows)
        print(f"Clientes legados encontrados (seriam inativados): {n}")
        for cid, cnpj, razao in rows[:80]:
            print(f"  id={cid} cnpj={cnpj} | {(razao or '')[:70]}")
        if n > 80:
            print(f"  ... e mais {n - 80}")

        if not getattr(args, "apply", False):
            print("\nDry-run. Para inativar no banco, rode o mesmo comando com --apply.")
            conn.rollback()
            return

        cur.execute(
            f"""
            UPDATE "Cliente"
            SET ativo = false,
                observacoes = LEFT(COALESCE(observacoes, '') || %s, 4000),
                "updatedAt" = now()
            {where}
            """,
            (note,) + params,
        )
        affected = cur.rowcount
        conn.commit()
        print(f"\n[OK] Inativados: {affected} cliente(s).")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def cmd_report(args: argparse.Namespace) -> None:
    env_path = Path(args.env).resolve() if getattr(args, "env", None) else None
    try:
        raw_url = resolve_database_url(env_path, getattr(args, "database_url", None))
    except RuntimeError as e:
        print(f"Erro: {e}", file=sys.stderr)
        sys.exit(1)
    url = normalize_db_url_for_psycopg(raw_url)
    conn = connect_postgres_or_exit(url)
    cur = conn.cursor()
    try:
        cur.execute(
            """
            SELECT id, cnpj, "razaoSocial", COALESCE(observacoes,'')
            FROM "Cliente"
            WHERE ativo = true
              AND (
                cnpj LIKE '99%'
                OR observacoes LIKE '%[LEGACY_CLIENTE:%'
                OR "razaoSocial" LIKE 'Cliente legado %'
              )
            ORDER BY id
            """
        )
        rows = cur.fetchall()
        print(f"Clientes candidatos a correção (sintéticos/legado): {len(rows)}\n")
        for cid, cnpj, razao, obs in rows[:500]:
            print(f"  id={cid} cnpj={cnpj} | {razao[:60]}")
        if len(rows) > 500:
            print(f"  ... e mais {len(rows) - 500} linhas")
    finally:
        cur.close()
        conn.close()


def cmd_apply(args: argparse.Namespace) -> None:
    map_path = Path(args.map).expanduser().resolve()
    if not map_path.is_file():
        print(
            f"[ERRO] Arquivo do mapa não encontrado:\n  {map_path}\n\n"
            "Gere o CSV antes, por exemplo:\n"
            "  python scripts/legacy_scan_and_fix_cnpj.py scan --csv \"C:\\caminho\\real\\Geral.csv\" --out scripts/legacy_cnpj_map.csv\n\n"
            f"Pasta atual de trabalho: {Path.cwd()}",
            file=sys.stderr,
        )
        sys.exit(1)

    rows = []
    with map_path.open(encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            cod = norm_code(r.get("legacy_codigo") or r.get("CODI") or "")
            cnpj = normalize_cnpj_field(r.get("cnpj") or r.get("CNPJ") or "")
            nome = (r.get("nome") or r.get("NOME") or "").strip()[:150]
            if cod and cnpj:
                rows.append({"legacy_codigo": cod, "cnpj": cnpj, "nome": nome})

    env_path = Path(args.env).resolve() if getattr(args, "env", None) else None
    try:
        raw_url = resolve_database_url(env_path, getattr(args, "database_url", None))
    except RuntimeError as e:
        print(f"Erro: {e}", file=sys.stderr)
        sys.exit(1)
    url = normalize_db_url_for_psycopg(raw_url)
    conn = connect_postgres_or_exit(url)
    cur = conn.cursor()

    updated = 0
    would_update = 0
    created = 0
    would_create = 0
    skipped = 0
    conflicts = 0
    create_missing = getattr(args, "create_missing", False)

    try:
        for r in rows:
            cod = r["legacy_codigo"]
            new_cnpj = r["cnpj"]
            fake = fake_cnpj_from_code(cod)
            token = f"[LEGACY_CLIENTE:{cod}]"

            cur.execute(
                """
                SELECT id, cnpj, observacoes FROM "Cliente"
                WHERE ativo = true
                  AND (
                    cnpj = %s
                    OR observacoes LIKE %s
                  )
                ORDER BY id
                LIMIT 1
                """,
                (fake, f"%{token}%"),
            )
            row = cur.fetchone()
            if not row:
                if not create_missing:
                    skipped += 1
                    continue
                cur.execute('SELECT id FROM "Cliente" WHERE cnpj = %s LIMIT 1', (new_cnpj,))
                if cur.fetchone():
                    print(
                        f"[PULAR-CREATE] CNPJ {new_cnpj} já existe no cadastro (código legado {cod})",
                        file=sys.stderr,
                    )
                    skipped += 1
                    continue
                nome = (r.get("nome") or "").strip()[:150]
                razao = nome if nome else f"Cliente importação legado {cod}"
                fantasia = nome if nome else razao
                obs = f"{token} [LEGACY_IMPORT_MAP]"
                if args.apply:
                    cur.execute(
                        """
                        INSERT INTO "Cliente" (
                            cnpj, "razaoSocial", "nomeFantasia", telefone, cidade, estado, endereco,
                            observacoes, "fretePadrao", ativo, "createdAt", "updatedAt"
                        )
                        VALUES (%s, %s, %s, NULL, NULL, NULL, NULL, %s, 0, true, now(), now())
                        """,
                        (new_cnpj, razao, fantasia, obs[:4000]),
                    )
                    created += 1
                else:
                    print(
                        f"[DRY-RUN CREATE] código={cod} cnpj={new_cnpj} | {razao[:60]}",
                        file=sys.stderr,
                    )
                    would_create += 1
                continue
            cliente_id, cnpj_atual, _obs = row

            cur.execute(
                'SELECT id FROM "Cliente" WHERE cnpj = %s AND id <> %s',
                (new_cnpj, cliente_id),
            )
            if cur.fetchone():
                print(f"[CONFLITO] CNPJ {new_cnpj} já usado por outro cliente; id legado {cliente_id} código {cod}")
                conflicts += 1
                continue

            nome = (r.get("nome") or "").strip()[:150]
            if cnpj_atual == new_cnpj and not nome:
                skipped += 1
                continue

            note = " [CNPJ_corrigido_legado_scan]"
            if args.apply:
                if nome:
                    cur.execute(
                        """
                        UPDATE "Cliente"
                        SET cnpj = %s,
                            "razaoSocial" = %s,
                            "nomeFantasia" = %s,
                            observacoes = LEFT(COALESCE(observacoes,'') || %s, 4000),
                            "updatedAt" = now()
                        WHERE id = %s
                        """,
                        (new_cnpj, nome, nome, note, cliente_id),
                    )
                else:
                    cur.execute(
                        """
                        UPDATE "Cliente"
                        SET cnpj = %s,
                            observacoes = LEFT(COALESCE(observacoes,'') || %s, 4000),
                            "updatedAt" = now()
                        WHERE id = %s
                        """,
                        (new_cnpj, note, cliente_id),
                    )
                updated += cur.rowcount
            else:
                extra = f" nome→{nome[:40]}…" if nome else ""
                print(f"[DRY-RUN] id={cliente_id} {cnpj_atual} -> {new_cnpj} ({cod}){extra}")
                would_update += 1

        if args.apply:
            conn.commit()
        else:
            conn.rollback()

        if args.apply:
            extra = f" criados={created}" if create_missing else ""
            print(
                f"\nResumo: atualizados={updated}{extra} ignorados={skipped} conflitos={conflicts}"
            )
        else:
            extra = f" criaria={would_create}" if create_missing else ""
            print(
                f"\nResumo (dry-run): atualizaria={would_update}{extra} ignorados={skipped} conflitos={conflicts}"
            )
            print("Rode com --apply para gravar.")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


def main():
    parser = argparse.ArgumentParser(description="Scan Access + corrigir CNPJ legado no Postgres")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_scan = sub.add_parser("scan", help="Ler .mdb e/ou CSV exportado e gerar mapa")
    p_scan.add_argument(
        "--mdb",
        action="append",
        default=[],
        help="Caminho do .mdb (repita --mdb). Omita se usar só --csv.",
    )
    p_scan.add_argument(
        "--csv",
        action="append",
        default=[],
        help="CSV já exportado (ex.: Geral.csv com colunas CODI + CNPJ/CGC). Repita --csv.",
    )
    p_scan.add_argument("--password", default="", help="Senha do Access (se houver)")
    p_scan.add_argument(
        "--out",
        default="legacy_cnpj_map.csv",
        help="CSV de saída",
    )
    p_scan.set_defaults(func=cmd_scan)

    p_filt = sub.add_parser(
        "filter-map",
        help="Limpar CSV de mapa (datas falsas, opcional remover scan_celula) sem reescanear o .mdb",
    )
    p_filt.add_argument("--in", dest="in_path", required=True, help="CSV original (ex.: legacy_cnpj_map.csv)")
    p_filt.add_argument(
        "--out",
        required=True,
        help="CSV de saída (ex.: legacy_cnpj_map.cleaned.csv)",
    )
    p_filt.add_argument(
        "--drop-scan-celula",
        action="store_true",
        help="Remove linhas cuja coluna metodo começa com scan_celula (recomendado)",
    )
    p_filt.set_defaults(func=cmd_filter_map)

    p_deac = sub.add_parser(
        "deactivate-legacy",
        help="Inativar no Postgres clientes placeholder (Cliente legado… / CNPJ 99… + LEGACY)",
    )
    p_deac.add_argument("--env", default=str(Path(__file__).resolve().parents[1] / ".env"))
    p_deac.add_argument("--database-url", default=None, help="Sobrescreve DATABASE_URL")
    p_deac.add_argument(
        "--apply",
        action="store_true",
        help="Grava inativação (sem isso, só lista quantos seriam afetados)",
    )
    p_deac.set_defaults(func=cmd_deactivate_legacy)

    p_rep = sub.add_parser("report", help="Listar clientes ainda com CNPJ sintético/legado no PG")
    p_rep.add_argument("--env", default=str(Path(__file__).resolve().parents[1] / ".env"))
    p_rep.add_argument(
        "--database-url",
        default=None,
        help="Sobrescreve DATABASE_URL (útil se o .env aponta para host que só resolve na nuvem)",
    )
    p_rep.set_defaults(func=cmd_report)

    p_app = sub.add_parser("apply", help="Aplicar mapa CSV ao PostgreSQL")
    p_app.add_argument("--env", default=str(Path(__file__).resolve().parents[1] / ".env"))
    p_app.add_argument(
        "--database-url",
        default=None,
        help="Sobrescreve DATABASE_URL",
    )
    p_app.add_argument("--map", required=True, help="CSV gerado pelo scan (ou editado manualmente)")
    p_app.add_argument("--apply", action="store_true", help="Gravar no banco (sem isso = dry-run)")
    p_app.add_argument(
        "--create-missing",
        action="store_true",
        help="Cria cliente novo quando o mapa tem código+CNPJ mas não existe cadastro ativo com CNPJ sintético/marca LEGACY",
    )
    p_app.set_defaults(func=cmd_apply)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()

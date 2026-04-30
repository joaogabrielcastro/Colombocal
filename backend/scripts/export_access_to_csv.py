import argparse
import csv
import os
import re
from pathlib import Path

import pyodbc


DEFAULT_TABLES = [
    "ChequesFinanceiro",
    "OrdensItens",
    "CarregamentoItens",
    "Ordens",
    "PagarReceber",
    "Carregamento",
    "Fretes",
    "ComissoesPagas",
    "VeiculosItens",
    "MovFretesItens",
    "MovFretes",
    "ChequesItens",
    "Veiculos",
    "ProdutosClientes",
    "Cheques",
    "SegurosItens",
    "Duplicatas",
    "Seguros",
    "ContaCorrente",
]


def connect_access(mdb_path: str, password: str):
    conn_str = (
        "DRIVER={Microsoft Access Driver (*.mdb, *.accdb)};"
        f"DBQ={mdb_path};"
        f"PWD={password};"
    )
    return pyodbc.connect(conn_str)


def list_tables(cur):
    names = []
    for row in cur.tables():
        tname = getattr(row, "table_name", None)
        ttype = (getattr(row, "table_type", "") or "").upper()
        if not tname:
            continue
        if ttype not in {"TABLE", "VIEW"}:
            continue
        if tname.startswith("MSys"):
            continue
        names.append(str(tname))
    return sorted(set(names))


def count_rows(cur, table_name: str):
    try:
        cur.execute(f"SELECT COUNT(*) FROM [{table_name}]")
        row = cur.fetchone()
        return int(row[0]) if row else 0
    except Exception:
        return -1


def get_table_columns(cur, table_name: str):
    try:
        return [c.column_name for c in cur.columns(table=table_name)]
    except Exception:
        # Fallback for legacy Access metadata encoding issues
        cur.execute(f"SELECT * FROM [{table_name}] WHERE 1=0")
        return [d[0] for d in (cur.description or [])]


def export_table(cur, table_name: str, out_dir: Path):
    columns = get_table_columns(cur, table_name)
    if not columns:
        return 0

    out_path = out_dir / f"{table_name}.csv"
    with out_path.open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(columns)
        row_count = 0
        for row in cur.execute(f"SELECT * FROM [{table_name}]"):
            writer.writerow(list(row))
            row_count += 1
    return row_count


def parse_keywords(raw):
    return [k.strip().lower() for k in str(raw).split(",") if k.strip()]


def should_skip_table(table_name: str, exclude_keywords):
    low = table_name.lower()
    return any(k in low for k in exclude_keywords)


def main():
    parser = argparse.ArgumentParser(
        description="Exporta tabelas do Access MDB para CSV."
    )
    parser.add_argument("--mdb", required=True, help="Caminho do arquivo .mdb")
    parser.add_argument("--password", required=True, help="Senha do banco Access")
    parser.add_argument(
        "--out",
        default="legacy_exports",
        help="Pasta de saída para CSVs (padrão: legacy_exports)",
    )
    parser.add_argument(
        "--tables",
        default=",".join(DEFAULT_TABLES),
        help='Lista de tabelas separadas por vírgula. Use "auto" para detectar todas.',
    )
    parser.add_argument(
        "--exclude-keywords",
        default="nota,nfe,fiscal,icms,ipi,cfop,sped,danfe",
        help="Palavras-chave para descartar tabelas automaticamente (nome da tabela)",
    )
    parser.add_argument(
        "--skip-empty",
        action="store_true",
        help="Não exporta tabelas sem linhas",
    )
    args = parser.parse_args()

    mdb_path = os.path.abspath(args.mdb)
    out_dir = Path(args.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    exclude_keywords = parse_keywords(args.exclude_keywords)

    conn = connect_access(mdb_path, args.password)
    cur = conn.cursor()

    if args.tables.strip().lower() == "auto":
        all_tables = list_tables(cur)
        tables = [t for t in all_tables if not should_skip_table(t, exclude_keywords)]
        print(f"[INFO] Tabelas detectadas: {len(all_tables)}")
        print(
            f"[INFO] Tabelas selecionadas após exclusão por palavra-chave: {len(tables)}"
        )
        if exclude_keywords:
            print(f"[INFO] Palavras de exclusão: {', '.join(exclude_keywords)}")
    else:
        tables = [t.strip() for t in args.tables.split(",") if t.strip()]

    exported = []
    for table_name in tables:
        try:
            if should_skip_table(table_name, exclude_keywords):
                print(f"[SKIP] {table_name}: descartada por palavra-chave")
                continue
            if args.skip_empty:
                total = count_rows(cur, table_name)
                if total == 0:
                    print(f"[SKIP] {table_name}: 0 linhas")
                    continue
            count = export_table(cur, table_name, out_dir)
            exported.append((table_name, count))
            print(f"[OK] {table_name}: {count} linhas")
        except Exception as e:
            print(f"[ERRO] {table_name}: {e}")

    conn.close()

    print("\nResumo:")
    for name, count in exported:
        print(f"- {name}: {count}")
    print(f"\nCSVs salvos em: {out_dir}")


if __name__ == "__main__":
    main()

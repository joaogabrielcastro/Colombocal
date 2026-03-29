import argparse
import csv
from pathlib import Path


def read_csv(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def norm_code(raw):
    if raw is None:
        return ""
    return "".join(ch for ch in str(raw).strip() if ch.isdigit())


def first_non_empty(row, keys):
    for k in keys:
        v = row.get(k)
        if v is not None and str(v).strip():
            return str(v).strip()
    return ""


def write_csv(path: Path, headers, rows):
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.DictWriter(f, fieldnames=headers)
        w.writeheader()
        for r in rows:
            w.writerow(r)


def build_master_clientes(geral_rows):
    out = []
    seen = set()
    for r in geral_rows:
        code = norm_code(first_non_empty(r, ["CODI", "CLIE", "ID"]))
        if not code or code in seen:
            continue
        nome = first_non_empty(r, ["NOME", "FANT", "RAZAO"])
        if not nome:
            continue
        out.append({"CODI": code, "NOME": nome})
        seen.add(code)
    return out


def build_master_produtos(produtos_rows):
    out = []
    seen = set()
    for r in produtos_rows:
        code = norm_code(first_non_empty(r, ["CODI", "PROD", "ID"]))
        if not code or code in seen:
            continue
        nome = first_non_empty(r, ["NOME", "DESC", "DESCRICAO"])
        if not nome:
            continue
        out.append({"CODI": code, "NOME": nome})
        seen.add(code)
    return out


def main():
    parser = argparse.ArgumentParser(
        description="Gera MasterClientes.csv e MasterProdutos.csv a partir de BdGeral exportado."
    )
    parser.add_argument(
        "--bdgeral-dir",
        required=True,
        help="Pasta dos CSVs exportados de BdGeral (ex.: scripts/legacy_exports_bdgeral)",
    )
    parser.add_argument(
        "--out-dir",
        required=True,
        help="Pasta de saída para MasterClientes.csv e MasterProdutos.csv",
    )
    args = parser.parse_args()

    src = Path(args.bdgeral_dir).resolve()
    out = Path(args.out_dir).resolve()
    out.mkdir(parents=True, exist_ok=True)

    geral = read_csv(src / "Geral.csv")
    produtos = read_csv(src / "Produtos.csv")

    master_clientes = build_master_clientes(geral)
    master_produtos = build_master_produtos(produtos)

    write_csv(out / "MasterClientes.csv", ["CODI", "NOME"], master_clientes)
    write_csv(out / "MasterProdutos.csv", ["CODI", "NOME"], master_produtos)

    print(f"[OK] MasterClientes.csv: {len(master_clientes)} linhas")
    print(f"[OK] MasterProdutos.csv: {len(master_produtos)} linhas")
    print(f"[OK] Saída: {out}")


if __name__ == "__main__":
    main()

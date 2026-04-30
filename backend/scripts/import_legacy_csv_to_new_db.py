import argparse
import csv
import json
import os
from collections import defaultdict
from datetime import datetime
from pathlib import Path


def parse_decimal(value):
    if value is None:
        return 0.0
    v = str(value).strip().replace(",", ".")
    if not v:
        return 0.0
    try:
        return float(v)
    except ValueError:
        return 0.0


def parse_dt(value):
    if not value:
        return None
    raw = str(value).strip()
    if not raw:
        return None
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d", "%d/%m/%y %H:%M", "%d/%m/%Y %H:%M"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


def is_on_or_after(dt_value, min_date):
    if min_date is None:
        return True
    if dt_value is None:
        return False
    return dt_value.date() >= min_date.date()


def fake_cnpj_from_code(code):
    digits = "".join(ch for ch in str(code) if ch.isdigit())
    if not digits:
        digits = "0"
    # 14 digits, deterministic and unique by legacy code
    return ("99" + digits).zfill(14)[-14:]


def read_csv(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def build_plan(csv_dir: Path, min_date=None):
    ordens = read_csv(csv_dir / "Ordens.csv")
    ordens_itens = read_csv(csv_dir / "OrdensItens.csv")
    produtos_clientes = read_csv(csv_dir / "ProdutosClientes.csv")
    cheques_itens = read_csv(csv_dir / "ChequesItens.csv")

    client_codes = set()
    rep_codes = set()
    product_codes = set()

    ordens_filtradas = [o for o in ordens if is_on_or_after(parse_dt(o.get("DATA")), min_date)]
    cheques_filtrados = [c for c in cheques_itens if is_on_or_after(parse_dt(c.get("DATA")), min_date)]

    for o in ordens_filtradas:
        client_codes.add((o.get("CLIE") or "000000").strip())
        rep_codes.add((o.get("REPR") or "000000").strip())

    for oi in ordens_itens:
        product_codes.add((oi.get("PROD") or "").strip())
        if oi.get("CLIE"):
            client_codes.add(oi.get("CLIE").strip())
        if oi.get("REPR"):
            rep_codes.add(oi.get("REPR").strip())

    for pc in produtos_clientes:
        if pc.get("CLIE"):
            client_codes.add(pc.get("CLIE").strip())
        if pc.get("PROD"):
            product_codes.add(pc.get("PROD").strip())

    for ch in cheques_filtrados:
        if ch.get("CLIE"):
            client_codes.add(ch.get("CLIE").strip())
        if ch.get("REPR"):
            rep_codes.add(ch.get("REPR").strip())
        if ch.get("CHEQ"):
            pass

    order_items_by_order = defaultdict(list)
    for oi in ordens_itens:
        order_items_by_order[(oi.get("CODI") or "").strip()].append(oi)

    sales_preview = []
    for o in ordens_filtradas[:20]:
        code = (o.get("CODI") or "").strip()
        items = order_items_by_order.get(code, [])
        total_items = sum(parse_decimal(i.get("TUNI")) for i in items)
        total_order = parse_decimal(o.get("TOTA"))
        sales_preview.append(
            {
                "ordem": code,
                "cliente_codigo": (o.get("CLIE") or "").strip(),
                "vendedor_codigo": (o.get("REPR") or "").strip(),
                "data": o.get("DATA"),
                "total_ordem": total_order,
                "total_itens": total_items,
                "itens": len(items),
            }
        )

    non_empty_tables = {
        "Ordens_total": len(ordens),
        "Ordens_filtradas": len(ordens_filtradas),
        "OrdensItens": len(ordens_itens),
        "ProdutosClientes": len(produtos_clientes),
        "ChequesItens_total": len(cheques_itens),
        "ChequesItens_filtradas": len(cheques_filtrados),
    }

    plan = {
        "summary": {
            "rows": non_empty_tables,
            "derived_entities": {
                "clientes_distintos": len([c for c in client_codes if c and c != "000000"]),
                "vendedores_distintos": len([r for r in rep_codes if r and r != "000000"]),
                "produtos_distintos": len([p for p in product_codes if p]),
            },
        },
        "client_mapping_preview": [
            {
                "legacy_code": c,
                "generated_cnpj": fake_cnpj_from_code(c),
                "generated_name": f"Cliente legado {c}",
            }
            for c in sorted([x for x in client_codes if x])[:20]
        ],
        "sales_preview": sales_preview,
        "notes": [
            "Cadastros de cliente/produto completos não apareceram neste MDB (apenas códigos).",
            "Importação inicial criará nomes fallback, depois podemos enriquecer com tabela mestre.",
            "Frete em Ordens.FRET parece percentual/fator; validar regra antes da carga final.",
        ],
    }
    return plan


def main():
    parser = argparse.ArgumentParser(
        description="Gera plano de importação do legado (modo seguro)."
    )
    parser.add_argument(
        "--csv-dir",
        required=True,
        help="Pasta com CSVs exportados do Access",
    )
    parser.add_argument(
        "--out",
        default="legacy_import_plan.json",
        help="Arquivo JSON de saída com o plano",
    )
    parser.add_argument(
        "--min-date",
        default="2020-01-01",
        help="Data mínima no formato YYYY-MM-DD (padrão: 2020-01-01)",
    )
    args = parser.parse_args()
    min_date = datetime.strptime(args.min_date, "%Y-%m-%d")

    csv_dir = Path(args.csv_dir).resolve()
    out_path = Path(args.out).resolve()

    plan = build_plan(csv_dir, min_date=min_date)
    out_path.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")

    print("Plano gerado em:", out_path)
    print(json.dumps(plan["summary"], ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

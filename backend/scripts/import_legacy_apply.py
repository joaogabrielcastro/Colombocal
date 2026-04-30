import argparse
import csv
import os
from collections import defaultdict
from datetime import datetime
import re
from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg


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
        return datetime.now()
    raw = str(value).strip()
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return datetime.now()


def is_on_or_after(dt_value, min_date):
    if min_date is None:
        return True
    return dt_value.date() >= min_date.date()


def read_csv(path):
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def read_csv_optional(path):
    if not path.exists():
        return []
    return read_csv(path)


def first_non_empty(d, keys):
    for k in keys:
        v = d.get(k)
        if v is not None and str(v).strip() != "":
            return str(v).strip()
    return None


def get_env_db_url(env_path: Path):
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


def norm_code(raw):
    if raw is None:
        return ""
    s = str(raw).strip()
    digits = "".join(ch for ch in s if ch.isdigit())
    return digits


def normalize_name_candidate(raw):
    if not raw:
        return None
    name = str(raw).strip()
    if not name:
        return None
    upper = name.upper()
    banned = [
        "FRETE",
        "REF ORDEM",
        "LEGADO",
        "SEM NOME",
        "OBS",
    ]
    if any(b in upper for b in banned):
        return None
    if len(name) < 4:
        return None
    name = re.sub(r"\s+", " ", name)
    return name[:120]


def fake_cnpj_from_code(code):
    digits = norm_code(code)
    if not digits:
        digits = "0"
    return ("99" + digits).zfill(14)[-14:]


def build_vendedor_name_map(geral_rows):
    by_code = {}
    for row in geral_rows:
        code = norm_code(row.get("CODI"))
        if not code:
            continue
        nome = first_non_empty(row, ["NOME", "FANT", "RESP"])
        if not nome:
            continue
        by_code[code] = nome[:150]
    return by_code


def get_or_create_vendedor(cur, legacy_code, cache, vendedor_name_by_code=None):
    code = norm_code(legacy_code)
    if not code:
        code = "0"
    if code in cache:
        return cache[code]

    fallback_name = f"Vendedor legado {code}"
    resolved_name = (
        (vendedor_name_by_code or {}).get(code, "").strip() or fallback_name
    )

    # Reusa vendedor já importado por código legado (formato antigo)
    cur.execute('SELECT id FROM "Vendedor" WHERE nome = %s LIMIT 1', (fallback_name,))
    row = cur.fetchone()
    if row:
        if resolved_name != fallback_name:
            cur.execute('UPDATE "Vendedor" SET nome=%s WHERE id=%s', (resolved_name, row[0]))
        cache[code] = row[0]
        return row[0]

    # Se já existir alguém com o nome de cadastro da Geral, reutiliza.
    cur.execute('SELECT id FROM "Vendedor" WHERE nome = %s LIMIT 1', (resolved_name,))
    row = cur.fetchone()
    if row:
        cache[code] = row[0]
        return row[0]

    cur.execute(
        'INSERT INTO "Vendedor" (nome, telefone, "comissaoPercentual", ativo, "createdAt") '
        "VALUES (%s, %s, %s, %s, now()) RETURNING id",
        (resolved_name, None, 0, True),
    )
    vid = cur.fetchone()[0]
    cache[code] = vid
    return vid


def get_or_create_cliente(cur, legacy_code, cache):
    code = norm_code(legacy_code)
    if not code:
        code = "0"
    if code in cache:
        return cache[code]
    cnpj = fake_cnpj_from_code(code)
    cur.execute('SELECT id FROM "Cliente" WHERE cnpj = %s LIMIT 1', (cnpj,))
    row = cur.fetchone()
    if row:
        cache[code] = row[0]
        return row[0]
    cur.execute(
        'INSERT INTO "Cliente" (cnpj, "razaoSocial", "nomeFantasia", telefone, cidade, estado, endereco, observacoes, "fretePadrao", ativo, "createdAt", "updatedAt") '
        "VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now(), now()) RETURNING id",
        (
            cnpj,
            f"Cliente legado {code}",
            f"CL {code}",
            None,
            None,
            None,
            None,
            f"[LEGACY_CLIENTE:{code}]",
            0,
            True,
        ),
    )
    cid = cur.fetchone()[0]
    cache[code] = cid
    return cid


def get_or_create_produto(cur, legacy_code, cache):
    code = norm_code(legacy_code)
    if not code:
        code = "0"
    if code in cache:
        return cache[code]
    prod_codigo = f"LEG-{code}"
    cur.execute('SELECT id FROM "Produto" WHERE codigo = %s LIMIT 1', (prod_codigo,))
    row = cur.fetchone()
    if row:
        cache[code] = row[0]
        return row[0]
    cur.execute(
        'INSERT INTO "Produto" (nome, codigo, "precoPadrao", unidade, ativo, "createdAt", "updatedAt") '
        "VALUES (%s, %s, %s, %s, %s, now(), now()) RETURNING id",
        (f"Produto legado {code}", prod_codigo, 0, "ton", True),
    )
    pid = cur.fetchone()[0]
    cache[code] = pid
    return pid


def upsert_preco_cliente(cur, cliente_id, produto_id, preco):
    cur.execute(
        'SELECT id FROM "PrecoClienteProduto" WHERE "clienteId"=%s AND "produtoId"=%s',
        (cliente_id, produto_id),
    )
    row = cur.fetchone()
    if row:
        cur.execute(
            'UPDATE "PrecoClienteProduto" SET preco=%s WHERE id=%s',
            (preco, row[0]),
        )
    else:
        cur.execute(
            'INSERT INTO "PrecoClienteProduto" ("clienteId","produtoId",preco) VALUES (%s,%s,%s)',
            (cliente_id, produto_id, preco),
        )


def find_legacy_venda(cur, legacy_ordem_code):
    token = f"[LEGACY_ORDEM:{legacy_ordem_code}]"
    cur.execute(
        'SELECT id FROM "Venda" WHERE observacoes LIKE %s ORDER BY id LIMIT 1',
        (f"%{token}%",),
    )
    row = cur.fetchone()
    return row[0] if row else None


def find_legacy_cheque(cur, legacy_cheque_key):
    token = f"[LEGACY_CHEQUE:{legacy_cheque_key}]"
    cur.execute(
        'SELECT id FROM "Cheque" WHERE observacoes LIKE %s ORDER BY id LIMIT 1',
        (f"%{token}%",),
    )
    row = cur.fetchone()
    return row[0] if row else None


def load_existing_legacy_vendas(cur):
    cur.execute(
        'SELECT id, observacoes FROM "Venda" WHERE observacoes LIKE %s',
        ("%[LEGACY_ORDEM:%",),
    )
    out = {}
    for vid, obs in cur.fetchall():
        text = obs or ""
        m = re.search(r"\[LEGACY_ORDEM:(\d+)\]", text)
        if m:
            out[m.group(1)] = vid
    return out


def load_existing_legacy_cheques(cur):
    cur.execute(
        'SELECT id, observacoes FROM "Cheque" WHERE observacoes LIKE %s',
        ("%[LEGACY_CHEQUE:%",),
    )
    out = {}
    for cid, obs in cur.fetchall():
        text = obs or ""
        m = re.search(r"\[LEGACY_CHEQUE:([0-9\-]+)\]", text)
        if m:
            out[m.group(1)] = cid
    return out


def update_vendedor_comissao(cur, comissoes_pagas, vendedor_cache, vendedor_name_by_code, min_date=None):
    by_rep = defaultdict(lambda: {"base": 0.0, "vlcm": 0.0})
    for c in comissoes_pagas:
        c_date = parse_dt(c.get("DATA"))
        if min_date and not is_on_or_after(c_date, min_date):
            continue
        rep = norm_code(c.get("REPR"))
        if not rep:
            continue
        base = parse_decimal(c.get("BASE"))
        vlcm = parse_decimal(c.get("VLCM"))
        if base <= 0 or vlcm < 0:
            continue
        by_rep[rep]["base"] += base
        by_rep[rep]["vlcm"] += vlcm

    updated = 0
    for rep_code, agg in by_rep.items():
        if agg["base"] <= 0:
            continue
        vendedor_id = get_or_create_vendedor(
            cur,
            rep_code,
            vendedor_cache,
            vendedor_name_by_code=vendedor_name_by_code,
        )
        percent = (agg["vlcm"] / agg["base"]) * 100
        percent = round(percent, 2)
        cur.execute(
            'UPDATE "Vendedor" SET "comissaoPercentual"=%s WHERE id=%s',
            (percent, vendedor_id),
        )
        if cur.rowcount:
            updated += 1
    return updated


def find_venda_id_for_frete(cur, venda_map, nota_raw, obsg_raw):
    candidates = []
    m = re.search(r"REF\s+ORDEM\s+NR:\s*(\d+)", str(obsg_raw or ""), re.I)
    if m:
        candidates.append(m.group(1))
    digits = "".join(ch for ch in str(nota_raw or "") if ch.isdigit())
    if digits:
        candidates.append(digits)
        stripped = digits.lstrip("0")
        if stripped and stripped != digits:
            candidates.append(stripped)
        if len(digits) >= 6:
            candidates.append(digits[-6:])
    seen = set()
    ordered = []
    for c in candidates:
        if not c or c in seen:
            continue
        seen.add(c)
        ordered.append(c)
    for c in ordered:
        if c in venda_map:
            return venda_map[c]
    for c in ordered:
        cur.execute(
            'SELECT id FROM "Venda" WHERE observacoes LIKE %s ORDER BY id LIMIT 1',
            (f"%[LEGACY_ORDEM:{c}]%",),
        )
        row = cur.fetchone()
        if row:
            return row[0]
    for c in ordered:
        cur.execute(
            'SELECT id FROM "Venda" WHERE observacoes LIKE %s ORDER BY id LIMIT 1',
            (f"%{c}%",),
        )
        row = cur.fetchone()
        if row:
            return row[0]
    return None


def import_legacy_fretes(cur, csv_dir, venda_map, cliente_cache, min_date, limit=10000):
    inserted = 0
    skipped = 0
    seen_tokens = set()

    def already_has_token(token):
        cur.execute(
            'SELECT 1 FROM "FreteMovimento" WHERE observacao LIKE %s LIMIT 1',
            (f"%{token}%",),
        )
        return cur.fetchone() is not None

    path_main = csv_dir / "Fretes.csv"
    if path_main.exists():
        for row in read_csv(path_main):
            if inserted >= limit:
                break
            token_base = (row.get("CODI") or "").strip()
            token = f"[LEGACY_FRETE:{token_base}]"
            if token in seen_tokens or already_has_token(token):
                skipped += 1
                continue
            seen_tokens.add(token)
            dt = parse_dt(row.get("DATA"))
            if min_date and not is_on_or_after(dt, min_date):
                skipped += 1
                continue
            valor = parse_decimal(row.get("TOTA"))
            if valor <= 0:
                skipped += 1
                continue
            ccode = norm_code(row.get("CLIE"))
            if not ccode:
                skipped += 1
                continue
            cid = get_or_create_cliente(cur, ccode, cliente_cache)
            vid = find_venda_id_for_frete(cur, venda_map, row.get("NOTA"), row.get("OBSG"))
            obs_extra = " ".join(
                x
                for x in [
                    (row.get("OBSG") or "").strip(),
                    (row.get("MOTO") or "").strip(),
                    (row.get("PLAC") or "").strip(),
                ]
                if x
            )
            obs = f"{token} {obs_extra}".strip()[:2000]
            cur.execute(
                'INSERT INTO "FreteMovimento" ("vendaId","clienteId",valor,"reciboEmitido","reciboNumero","reciboData",data,observacao,"createdAt") '
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,now())",
                (vid, cid, valor, False, None, None, dt, obs),
            )
            inserted += 1

    path_mov = csv_dir / "MovFretes.csv"
    if path_mov.exists():
        for row in read_csv(path_mov):
            if inserted >= limit:
                break
            token_base = (row.get("CODI") or "").strip()
            token = f"[LEGACY_MOVFRETE:{token_base}]"
            if token in seen_tokens or already_has_token(token):
                skipped += 1
                continue
            seen_tokens.add(token)
            dt = parse_dt(row.get("DATA"))
            if min_date and not is_on_or_after(dt, min_date):
                skipped += 1
                continue
            valor = parse_decimal(row.get("TOTA"))
            if valor <= 0:
                skipped += 1
                continue
            ccode = norm_code(row.get("CLIE"))
            if not ccode:
                skipped += 1
                continue
            cid = get_or_create_cliente(cur, ccode, cliente_cache)
            vid = None
            pedi = norm_code(row.get("PEDI"))
            if pedi and pedi in venda_map:
                vid = venda_map[pedi]
            obs_extra = " ".join(
                x
                for x in [
                    (row.get("OBSE") or "").strip(),
                    (row.get("T_NO") or "").strip(),
                    (row.get("T_PL") or "").strip(),
                ]
                if x
            )
            obs = f"{token} {obs_extra}".strip()[:2000]
            cur.execute(
                'INSERT INTO "FreteMovimento" ("vendaId","clienteId",valor,"reciboEmitido","reciboNumero","reciboData",data,observacao,"createdAt") '
                "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,now())",
                (vid, cid, valor, False, None, None, dt, obs),
            )
            inserted += 1

    return inserted, skipped


def sync_legacy_vendedor_names(cur, vendedor_name_by_code):
    cur.execute('SELECT id, nome FROM "Vendedor"')
    vendedores = cur.fetchall()
    updated = 0
    for vendedor_id, nome_atual in vendedores:
        nome = (nome_atual or "").strip()
        m = re.match(r"^Vendedor legado\s+(\d+)$", nome, flags=re.IGNORECASE)
        if not m:
            continue
        code = m.group(1).zfill(6)
        novo_nome = (vendedor_name_by_code.get(code) or "").strip()
        if not novo_nome or novo_nome == nome:
            continue
        cur.execute('UPDATE "Vendedor" SET nome=%s WHERE id=%s', (novo_nome, vendedor_id))
        if cur.rowcount:
            updated += 1
    return updated


def enrich_client_names(cur, cheques_itens):
    # Melhor evidência de nome encontrada no legado disponível
    by_client_name_counts = defaultdict(lambda: defaultdict(int))
    for ch in cheques_itens:
        ccode = norm_code(ch.get("CLIE"))
        if not ccode or ccode == "0":
            continue
        cand = normalize_name_candidate(ch.get("OBSE"))
        if not cand:
            continue
        by_client_name_counts[ccode][cand] += 1

    updated = 0
    for ccode, options in by_client_name_counts.items():
        best_name = sorted(options.items(), key=lambda x: (-x[1], x[0]))[0][0]
        cnpj = fake_cnpj_from_code(ccode)
        # só substitui fallback legado
        cur.execute(
            'UPDATE "Cliente" SET "razaoSocial"=%s, "nomeFantasia"=%s, "updatedAt"=now() '
            'WHERE cnpj=%s AND "razaoSocial" LIKE %s',
            (best_name, best_name, cnpj, "Cliente legado %"),
        )
        if cur.rowcount:
            updated += 1
    return updated


def enrich_from_master_csv(cur, master_clientes, master_produtos):
    updated_clientes = 0
    updated_produtos = 0

    for c in master_clientes:
        code = norm_code(first_non_empty(c, ["CODI", "CLIE", "CLIENTE", "ID"]))
        if not code:
            continue
        nome = first_non_empty(c, ["NOME", "RAZAO", "RAZAOSOCIAL", "FANTASIA", "NOM"])
        if not nome:
            continue
        cnpj = fake_cnpj_from_code(code)
        cur.execute(
            'UPDATE "Cliente" SET "razaoSocial"=%s, "nomeFantasia"=%s, "updatedAt"=now() '
            "WHERE cnpj=%s",
            (nome[:150], nome[:150], cnpj),
        )
        if cur.rowcount:
            updated_clientes += 1

    for p in master_produtos:
        code = norm_code(first_non_empty(p, ["CODI", "PROD", "PRODUTO", "ID"]))
        if not code:
            continue
        nome = first_non_empty(p, ["NOME", "DESCRICAO", "DESCRI", "DESC"])
        if not nome:
            continue
        cur.execute(
            'UPDATE "Produto" SET nome=%s, "updatedAt"=now() WHERE codigo=%s',
            (nome[:150], f"LEG-{code}"),
        )
        if cur.rowcount:
            updated_produtos += 1

    return updated_clientes, updated_produtos


def main():
    parser = argparse.ArgumentParser(description="Importador legado CSV -> banco novo")
    parser.add_argument("--csv-dir", required=True, help="Pasta dos CSVs")
    parser.add_argument(
        "--env",
        default=str(Path(__file__).resolve().parents[1] / ".env"),
        help="Arquivo .env do backend",
    )
    parser.add_argument("--limit-sales", type=int, default=1000)
    parser.add_argument("--limit-cheques", type=int, default=2000)
    parser.add_argument(
        "--limit-fretes",
        type=int,
        default=10000,
        help="Limite de linhas de Fretes.csv/MovFretes.csv",
    )
    parser.add_argument(
        "--min-date",
        default="2020-01-01",
        help="Data mínima no formato YYYY-MM-DD (padrão: 2020-01-01)",
    )
    parser.add_argument("--apply", action="store_true", help="Executa escrita no banco")
    args = parser.parse_args()
    min_date = datetime.strptime(args.min_date, "%Y-%m-%d")

    csv_dir = Path(args.csv_dir).resolve()
    ordens = read_csv_optional(csv_dir / "Ordens.csv")
    ordens_itens = read_csv_optional(csv_dir / "OrdensItens.csv")
    produtos_clientes = read_csv_optional(csv_dir / "ProdutosClientes.csv")
    cheques_itens = read_csv_optional(csv_dir / "ChequesItens.csv")
    comissoes_pagas = read_csv_optional(csv_dir / "ComissoesPagas.csv")
    master_clientes = read_csv_optional(csv_dir / "MasterClientes.csv")
    master_produtos = read_csv_optional(csv_dir / "MasterProdutos.csv")
    geral = read_csv_optional(csv_dir / "Geral.csv")
    vendedor_name_by_code = build_vendedor_name_map(geral)

    items_by_order = defaultdict(list)
    for it in ordens_itens:
        items_by_order[norm_code(it.get("CODI"))].append(it)

    print("Resumo origem:")
    ordens_filtradas = [o for o in ordens if is_on_or_after(parse_dt(o.get("DATA")), min_date)]
    cheques_filtrados = [c for c in cheques_itens if is_on_or_after(parse_dt(c.get("DATA")), min_date)]

    print("- Ordens:", len(ordens))
    print("- Ordens (>= min-date):", len(ordens_filtradas))
    print("- OrdensItens:", len(ordens_itens))
    print("- ProdutosClientes:", len(produtos_clientes or []))
    print("- ChequesItens:", len(cheques_itens))
    print("- ChequesItens (>= min-date):", len(cheques_filtrados))
    print("- ComissoesPagas:", len(comissoes_pagas))
    print("- MasterClientes:", len(master_clientes))
    print("- MasterProdutos:", len(master_produtos))
    print("- Geral:", len(geral))
    print("- Vendedores detectados na Geral:", len(vendedor_name_by_code))
    if not ordens:
        print("! Aviso: Ordens.csv não encontrado. Importação de vendas será ignorada.")
    if not ordens_itens:
        print("! Aviso: OrdensItens.csv não encontrado. Itens de venda serão ignorados.")
    if not cheques_itens:
        print("! Aviso: ChequesItens.csv não encontrado. Importação de cheques será ignorada.")
    print("- Fretes.csv:", "sim" if (csv_dir / "Fretes.csv").exists() else "não")
    print("- MovFretes.csv:", "sim" if (csv_dir / "MovFretes.csv").exists() else "não")

    if not args.apply:
        print("\nDry-run concluído. Para aplicar:")
        print(
            "python import_legacy_apply.py --csv-dir <pasta> --apply --limit-sales 1000 --limit-cheques 2000"
        )
        return

    db_url = normalize_db_url_for_psycopg(get_env_db_url(Path(args.env)))
    conn = psycopg.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()

    vendedor_cache = {}
    cliente_cache = {}
    produto_cache = {}
    venda_map = {}

    inserted = {
        "vendas": 0,
        "itens": 0,
        "cheques": 0,
        "precos_cliente": 0,
        "vendas_reutilizadas": 0,
        "cheques_reutilizados": 0,
        "vendedores_comissao_atualizada": 0,
        "vendedores_nome_sincronizado": 0,
        "clientes_nome_enriquecido": 0,
        "clientes_master_enriquecido": 0,
        "produtos_master_enriquecido": 0,
        "fretes_legacy": 0,
        "fretes_legacy_skipped": 0,
    }

    existing_vendas = load_existing_legacy_vendas(cur)
    existing_cheques = load_existing_legacy_cheques(cur)

    # 1) Base de cadastros via preços por cliente
    for pc in produtos_clientes or []:
        ccode = norm_code(pc.get("CLIE"))
        pcode = norm_code(pc.get("PROD"))
        if not ccode or not pcode:
            continue
        cid = get_or_create_cliente(cur, ccode, cliente_cache)
        pid = get_or_create_produto(cur, pcode, produto_cache)
        upsert_preco_cliente(cur, cid, pid, parse_decimal(pc.get("PREC")))
        inserted["precos_cliente"] += 1

    # 2) Vendas + itens
    for o in ordens_filtradas[: args.limit_sales]:
        ordem_code = norm_code(o.get("CODI"))
        if not ordem_code:
            continue
        existing_venda_id = existing_vendas.get(ordem_code)
        if existing_venda_id:
            venda_map[ordem_code] = existing_venda_id
            valor_total = parse_decimal(o.get("TOTA"))
            frete = parse_decimal(o.get("FRMF"))
            data_venda = parse_dt(o.get("DATA"))
            cur.execute(
                'UPDATE "Venda" SET frete=%s, "valorTotal"=%s, "dataVenda"=%s WHERE id=%s',
                (frete, valor_total, data_venda, existing_venda_id),
            )
            inserted["vendas_reutilizadas"] += 1
            continue
        cid = get_or_create_cliente(cur, o.get("CLIE"), cliente_cache)
        vid = get_or_create_vendedor(
            cur,
            o.get("REPR"),
            vendedor_cache,
            vendedor_name_by_code=vendedor_name_by_code,
        )
        obs = (o.get("OBSE") or "").strip()
        obsg = (o.get("OBSG") or "").strip()
        notes = " | ".join(x for x in [obs, obsg] if x)
        obs_full = f"[LEGACY_ORDEM:{ordem_code}] {notes}".strip()
        valor_total = parse_decimal(o.get("TOTA"))
        # FRET no legado parece fator; FRMF tende a refletir valor monetário de frete.
        frete = parse_decimal(o.get("FRMF"))
        data_venda = parse_dt(o.get("DATA"))

        cur.execute(
            'INSERT INTO "Venda" ("clienteId","vendedorId","motoristaId",frete,"freteRecibo","freteReciboNum","valorTotal","dataVenda",observacoes,"createdAt") '
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,now()) RETURNING id",
            (cid, vid, None, frete, False, None, valor_total, data_venda, obs_full),
        )
        venda_id = cur.fetchone()[0]
        venda_map[ordem_code] = venda_id
        existing_vendas[ordem_code] = venda_id
        inserted["vendas"] += 1

        for it in items_by_order.get(ordem_code, []):
            pcode = norm_code(it.get("PROD"))
            if not pcode:
                continue
            pid = get_or_create_produto(cur, pcode, produto_cache)
            qtd = parse_decimal(it.get("QUAN"))
            unit = parse_decimal(it.get("UNIT"))
            subtotal = parse_decimal(it.get("TUNI")) or (qtd * unit)
            cur.execute(
                'INSERT INTO "ItemVenda" ("vendaId","produtoId",quantidade,"precoUnitario",subtotal) '
                "VALUES (%s,%s,%s,%s,%s)",
                (venda_id, pid, qtd, unit, subtotal),
            )
            inserted["itens"] += 1

    # 3) Cheques
    for ch in cheques_filtrados[: args.limit_cheques]:
        legacy_cheque_key = f"{norm_code(ch.get('CODI'))}-{norm_code(ch.get('ITEM'))}"
        existing_cheque_id = existing_cheques.get(legacy_cheque_key)
        if existing_cheque_id:
            inserted["cheques_reutilizados"] += 1
            continue
        ccode = norm_code(ch.get("CLIE"))
        cid = get_or_create_cliente(cur, ccode, cliente_cache)
        vref = norm_code(ch.get("CODI"))
        venda_id = venda_map.get(vref)
        valor = parse_decimal(ch.get("VALO"))
        banco = (ch.get("BANC") or "").strip() or None
        numero = (ch.get("CHEQ") or "").strip() or None
        agencia = (ch.get("AGEN") or "").strip() or None
        conta = (ch.get("CONT") or "").strip() or None
        data_rec = parse_dt(ch.get("DATA"))
        obs_raw = (ch.get("OBSE") or "").strip()
        obs = f"[LEGACY_CHEQUE:{legacy_cheque_key}] {obs_raw}".strip()
        cur.execute(
            'INSERT INTO "Cheque" ("clienteId","vendaId",valor,banco,numero,agencia,conta,"dataRecebimento","dataCompensacao",status,observacoes,"createdAt") '
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now())",
            (cid, venda_id, valor, banco, numero, agencia, conta, data_rec, None, "a_receber", obs),
        )
        existing_cheques[legacy_cheque_key] = True
        inserted["cheques"] += 1

    fret_ins, fret_skip = import_legacy_fretes(
        cur,
        csv_dir,
        venda_map,
        cliente_cache,
        min_date,
        limit=args.limit_fretes,
    )
    inserted["fretes_legacy"] = fret_ins
    inserted["fretes_legacy_skipped"] = fret_skip

    if comissoes_pagas:
        inserted["vendedores_comissao_atualizada"] = update_vendedor_comissao(
            cur,
            comissoes_pagas,
            vendedor_cache=vendedor_cache,
            vendedor_name_by_code=vendedor_name_by_code,
            min_date=min_date,
        )
    inserted["vendedores_nome_sincronizado"] = sync_legacy_vendedor_names(
        cur, vendedor_name_by_code
    )
    inserted["clientes_nome_enriquecido"] = enrich_client_names(cur, cheques_itens)
    (
        inserted["clientes_master_enriquecido"],
        inserted["produtos_master_enriquecido"],
    ) = enrich_from_master_csv(cur, master_clientes, master_produtos)

    conn.commit()
    cur.close()
    conn.close()

    print("\nImportação concluída:")
    for k, v in inserted.items():
        print(f"- {k}: {v}")


if __name__ == "__main__":
    main()

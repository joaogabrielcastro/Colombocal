from pathlib import Path
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg


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


db_url = normalize_db_url_for_psycopg(
    get_env_db_url(Path(__file__).resolve().parents[1] / ".env")
)

conn = psycopg.connect(db_url)
cur = conn.cursor()

queries = [
    ('SELECT COUNT(*) FROM "Cliente"', "clientes"),
    ('SELECT COUNT(*) FROM "Produto"', "produtos"),
    ('SELECT COUNT(*) FROM "Vendedor"', "vendedores"),
    ('SELECT COUNT(*) FROM "Venda"', "vendas_total"),
    ('SELECT COUNT(*) FROM "ItemVenda"', "itens_total"),
    ('SELECT COUNT(*) FROM "Cheque"', "cheques_total"),
    ('SELECT COUNT(*) FROM "PrecoClienteProduto"', "precos_especiais_total"),
    ('SELECT COUNT(*) FROM "Venda" WHERE "dataVenda" >= %s::date', "vendas_2020_plus"),
]

for q, name in queries:
    if "%s" in q:
        cur.execute(q, ("2020-01-01",))
    else:
        cur.execute(q)
    print(f"{name}: {cur.fetchone()[0]}")

cur.close()
conn.close()

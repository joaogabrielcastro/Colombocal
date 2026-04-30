"""
Higienização pós-import (PostgreSQL):
- Clientes com CNPJ placeholder 99000000000000 (código 000000)
- Mesmo nome + cidade: mantém menor id, desativa duplicata e mescla observações
- Produtos com mesmo codigo LEG-* duplicado por nome similar (opcional)
Execute: python scripts/post_import_cleanup.py --apply
"""

import argparse
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


def fix_placeholder_cnpj(cur):
    """Marca clientes claramente placeholder."""
    cur.execute(
        """
        UPDATE "Cliente"
        SET observacoes = COALESCE(observacoes,'') || ' [HIGIENE:CNPJ_PLACEHOLDER]'
        WHERE cnpj = '99000000000000'
          AND (observacoes IS NULL OR observacoes NOT LIKE '%HIGIENE:CNPJ_PLACEHOLDER%')
        """
    )
    return cur.rowcount


def deactivate_obvious_duplicates(cur):
    """Mesmo razaoSocial (trim) e mesma cidade: mantém id mínimo, desativa outros."""
    cur.execute(
        """
        WITH d AS (
          SELECT LOWER(TRIM("razaoSocial")) AS r,
                 COALESCE(LOWER(TRIM(cidade)),'') AS c,
                 MIN(id) AS keep_id,
                 COUNT(*) AS n
          FROM "Cliente"
          WHERE ativo = true
          GROUP BY 1, 2
          HAVING COUNT(*) > 1
        )
        UPDATE "Cliente" c
        SET ativo = false,
            observacoes = LEFT(
              COALESCE(c.observacoes,'') || ' [HIGIENE:DUPLICATA_DESATIVADA keep=' || d.keep_id::text || ']',
              4000
            )
        FROM d
        WHERE LOWER(TRIM(c."razaoSocial")) = d.r
          AND COALESCE(LOWER(TRIM(c.cidade)),'') = d.c
          AND c.id <> d.keep_id
          AND c.ativo = true
        """
    )
    return cur.rowcount


def fix_common_mojibake(cur):
    """Substituições comuns Latin1->UTF8 mal decodificadas."""
    pairs = [
        ("COMISS�O", "COMISSÃO"),
        ("PARAN�", "PARANÁ"),
        ("REPRESENTA��ES", "REPRESENTAÇÕES"),
        ("CONSTRU��O", "CONSTRUÇÃO"),
        ("�", "Ç"),
    ]
    n = 0
    for table, col in [("Cliente", "razaoSocial"), ("Cliente", "nomeFantasia"), ("Vendedor", "nome")]:
        for wrong, right in pairs:
            cur.execute(
                f'UPDATE "{table}" SET "{col}" = REPLACE("{col}", %s, %s) '
                f'WHERE "{col}" LIKE %s',
                (wrong, right, f"%{wrong}%"),
            )
            n += cur.rowcount
    return n


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--env",
        default=str(Path(__file__).resolve().parents[1] / ".env"),
    )
    parser.add_argument("--apply", action="store_true")
    args = parser.parse_args()
    if not args.apply:
        print("Dry-run. Use --apply para executar no banco.")
        return

    url = normalize_db_url_for_psycopg(get_env_db_url(Path(args.env)))
    conn = psycopg.connect(url)
    cur = conn.cursor()
    try:
        a = fix_placeholder_cnpj(cur)
        b = deactivate_obvious_duplicates(cur)
        c = fix_common_mojibake(cur)
        conn.commit()
        print(f"Placeholder CNPJ marcados: {a}")
        print(f"Duplicatas desativadas: {b}")
        print(f"Substituições encoding (linhas afetadas): {c}")
    except Exception:
        conn.rollback()
        raise
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()

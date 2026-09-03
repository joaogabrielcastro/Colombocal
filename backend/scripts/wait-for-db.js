#!/usr/bin/env node
/**
 * Espera o Postgres aceitar TCP antes de `prisma migrate deploy`.
 * No Docker Desktop, pg_isready no container do banco pode marcar healthy
 * (socket local) mesmo quando o hostname `db` ainda não resolve neste container.
 */
const net = require("net");
const dns = require("dns").promises;

const DEFAULT_ATTEMPTS = 30;
const DEFAULT_DELAY_MS = 1000;

function parseDatabaseUrl(databaseUrl) {
  const raw = databaseUrl || process.env.DATABASE_URL || "";
  if (!raw) {
    throw new Error("DATABASE_URL não definido.");
  }
  const u = new URL(raw);
  return {
    host: u.hostname || "db",
    port: Number(u.port) || 5432,
  };
}

function tryConnect(host, port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect({ host, port, family: 4 });
    socket.setTimeout(2000);
    socket.once("connect", () => {
      socket.end();
      resolve();
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("timeout"));
    });
    socket.once("error", reject);
  });
}

async function main() {
  const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
  const attempts = Number(process.env.WAIT_FOR_DB_ATTEMPTS || DEFAULT_ATTEMPTS);
  const delayMs = Number(process.env.WAIT_FOR_DB_DELAY_MS || DEFAULT_DELAY_MS);

  console.log(`Aguardando Postgres em ${parsed.host}:${parsed.port}...`);

  let lastError = "desconhecido";
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const { address } = await dns.lookup(parsed.host, { family: 4 });
      await tryConnect(address, parsed.port);
      console.log(
        `Postgres acessível em ${parsed.host} (${address}:${parsed.port}) — tentativa ${i}/${attempts}.`
      );
      return;
    } catch (err) {
      lastError = err && err.message ? err.message : String(err);
      console.log(`  ainda indisponível (${lastError}) — ${i}/${attempts}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  console.error(
    `Não foi possível conectar em ${parsed.host}:${parsed.port} após ${attempts} tentativas (${lastError}).`
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err && err.message ? err.message : err);
  process.exit(1);
});

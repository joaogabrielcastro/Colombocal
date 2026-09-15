#!/usr/bin/env node
/**
 * Prepara e sobe o server Next standalone para E2E (output: 'standalone').
 * Uso: node scripts/start-standalone-e2e.js
 */
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const root = path.resolve(__dirname, "..");
const standalone = path.join(root, ".next", "standalone");
const serverJs = path.join(standalone, "server.js");

if (!fs.existsSync(serverJs)) {
  console.error("Build standalone ausente. Rode: npm run build");
  process.exit(1);
}

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyRecursive(from, to);
    else fs.copyFileSync(from, to);
  }
}

copyRecursive(path.join(root, ".next", "static"), path.join(standalone, ".next", "static"));
copyRecursive(path.join(root, "public"), path.join(standalone, "public"));

const port = process.env.PORT || "3010";
const hostname = process.env.HOSTNAME || "127.0.0.1";

const child = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  env: {
    ...process.env,
    PORT: String(port),
    HOSTNAME: hostname,
  },
  stdio: "inherit",
});

child.on("exit", (code) => process.exit(code ?? 1));

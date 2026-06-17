const crypto = require("crypto");

function getSetupSecret() {
  const s = process.env.SETUP_SECRET;
  if (!s || String(s).trim().length < 8) return null;
  return String(s).trim();
}

function timingSafeEqualString(a, b) {
  const ba = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

function verifySetupSecret(provided) {
  const setupSecret = getSetupSecret();
  if (!setupSecret) return false;
  return timingSafeEqualString(String(provided ?? ""), setupSecret);
}

module.exports = {
  getSetupSecret,
  timingSafeEqualString,
  verifySetupSecret,
};

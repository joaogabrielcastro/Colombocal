function isValidFiscalAccessKey(value) {
  const key = String(value || "");
  if (!/^\d{44}$/.test(key)) return false;

  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index -= 1) {
    sum += Number(key[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const calculated = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return calculated === Number(key[43]);
}

module.exports = { isValidFiscalAccessKey };

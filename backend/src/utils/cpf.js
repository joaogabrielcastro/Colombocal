function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function isValidCpf(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(d[i]) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== Number(d[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(d[i]) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === Number(d[10]);
}

function normalizeCpf(cpf) {
  const d = onlyDigits(cpf);
  if (!isValidCpf(d)) {
    const err = new Error("CPF inválido");
    err.statusCode = 400;
    throw err;
  }
  return d;
}

module.exports = {
  onlyDigits,
  isValidCpf,
  normalizeCpf,
};

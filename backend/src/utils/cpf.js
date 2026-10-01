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

function isValidCnpj(cnpj) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base, weights) => {
    const sum = base.split("").reduce((acc, n, i) => acc + Number(n) * weights[i], 0);
    const rest = sum % 11;
    return rest < 2 ? 0 : 11 - rest;
  };
  const first = calc(d.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const second = calc(d.slice(0, 12) + first, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${first}${second}`);
}

function isValidIeParana(ie) {
  const d = onlyDigits(ie);
  if (d.length !== 10 || /^(\d)\1{9}$/.test(d)) return false;
  const digit = (base, weights) => {
    const rest = base.split("").reduce((acc, n, i) => acc + Number(n) * weights[i], 0) % 11;
    const result = 11 - rest;
    return result >= 10 ? 0 : result;
  };
  const first = digit(d.slice(0, 8), [3, 2, 7, 6, 5, 4, 3, 2]);
  const second = digit(d.slice(0, 8) + first, [4, 3, 2, 7, 6, 5, 4, 3, 2]);
  return d.endsWith(`${first}${second}`);
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
  isValidCnpj,
  isValidIeParana,
  normalizeCpf,
};

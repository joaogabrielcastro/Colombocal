/** Validação de CPF (espelha backend/src/utils/cpf.js). */
export function onlyDigits(value: string): string {
  return String(value ?? "").replace(/\D/g, "");
}

export function isValidCpf(cpf: string): boolean {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10], 10);
}

export function isValidCnpj(cnpj: string): boolean {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1{13}$/.test(d)) return false;

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 12; i++) sum += parseInt(d[i], 10) * w1[i];
  let rest = sum % 11;
  const d1 = rest < 2 ? 0 : 11 - rest;
  if (d1 !== parseInt(d[12], 10)) return false;

  sum = 0;
  for (let i = 0; i < 13; i++) sum += parseInt(d[i], 10) * w2[i];
  rest = sum % 11;
  const d2 = rest < 2 ? 0 : 11 - rest;
  return d2 === parseInt(d[13], 10);
}

export function isValidCnpjDigits(cnpj: string): boolean {
  return isValidCnpj(cnpj);
}

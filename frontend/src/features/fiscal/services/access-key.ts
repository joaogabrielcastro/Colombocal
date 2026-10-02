export function isValidFiscalAccessKey(value: string): boolean {
  if (!/^\d{44}$/.test(value)) return false;

  let sum = 0;
  let weight = 2;
  for (let index = 42; index >= 0; index -= 1) {
    sum += Number(value[index]) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }

  const remainder = sum % 11;
  const calculated = remainder === 0 || remainder === 1 ? 0 : 11 - remainder;
  return calculated === Number(value[43]);
}

export function fiscalAccessKeyError(value: string): string | null {
  if (!/^\d{44}$/.test(value)) return "Informe exatamente 44 dígitos.";
  if (!isValidFiscalAccessKey(value)) return "Chave inválida. Verifique o dígito verificador.";
  return null;
}

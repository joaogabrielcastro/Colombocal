/**
 * Detecta possíveis lacunas na numeração por série.
 * NÃO classifica como erro fiscal — apenas "possível lacuna" para investigação.
 * Sem inutilização registrada no sistema, toda lacuna é possível.
 *
 * @param {Array<{ serie?: number|null, numero?: number|null }>} notas
 * @returns {Array<{ serie: number, numerosAusentes: number[], label: string }>}
 */
function detectarLacunasNumeracao(notas = []) {
  /** @type {Map<number, Set<number>>} */
  const porSerie = new Map();

  for (const nota of notas) {
    const numero = Number(nota.numero);
    if (!Number.isFinite(numero) || numero < 1) continue;
    const serie = Number(nota.serie);
    const serieKey = Number.isFinite(serie) && serie > 0 ? serie : 1;
    if (!porSerie.has(serieKey)) porSerie.set(serieKey, new Set());
    porSerie.get(serieKey).add(Math.trunc(numero));
  }

  const resultado = [];
  for (const [serie, set] of [...porSerie.entries()].sort((a, b) => a[0] - b[0])) {
    const nums = [...set].sort((a, b) => a - b);
    if (nums.length < 2) continue;
    const min = nums[0];
    const max = nums[nums.length - 1];
    const presentes = new Set(nums);
    const ausentes = [];
    for (let n = min; n <= max; n += 1) {
      if (!presentes.has(n)) ausentes.push(n);
    }
    if (ausentes.length) {
      resultado.push({
        serie,
        numerosAusentes: ausentes,
        label: "Possível lacuna de numeração",
      });
    }
  }
  return resultado;
}

module.exports = { detectarLacunasNumeracao };

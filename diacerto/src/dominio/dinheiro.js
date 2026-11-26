// Valores monetários sempre em centavos (inteiros), para evitar erro de ponto flutuante.

/** @param {number} reais */
export function reais(reais) {
  return Math.round(reais * 100);
}

/** Aplica um percentual a um valor em centavos, arredondando para o centavo mais próximo.
 * @param {number} centavos @param {number} percentual ex.: 0.2 para 20% */
export function percentualDe(centavos, percentual) {
  return Math.round(centavos * percentual);
}

/** @param {number} centavos */
export function formatarReais(centavos) {
  const sinal = centavos < 0 ? '- ' : '';
  const abs = Math.abs(centavos);
  const inteiro = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const resto = (abs % 100).toString().padStart(2, '0');
  return `${sinal}R$ ${inteiro},${resto}`;
}

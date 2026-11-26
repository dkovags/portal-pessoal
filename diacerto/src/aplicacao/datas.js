// Utilitários de data usados pelos casos de uso (chave AAAA-MM-DD em horário local).
/** @param {Date} d */
export function chaveDia(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
/** @param {string} chave @param {number} [hora] */
export function deChave(chave, hora = 0) {
  const [a, m, d] = chave.split('-').map(Number);
  return new Date(a, m - 1, d, hora);
}

import { formatarReais } from '../dominio/index.js';

export const moeda = formatarReais;
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
const SEMANA_LONGA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

const comoData = (v) => (v instanceof Date ? v : new Date(`${v}T00:00`));
export const dataCurta = (v) => { const d = comoData(v); return `${SEMANA[d.getDay()]}, ${d.getDate()} ${MESES[d.getMonth()]}`; };
export const dataLonga = (v) => { const d = comoData(v); return `${SEMANA_LONGA[d.getDay()]}, ${d.getDate()} de ${MESES[d.getMonth()]}`; };
export const horario = (i, f) => `${i}h às ${f}h`;
export const nota = (n) => (n === null ? 'Nova no DiaCerto' : n.toFixed(1).replace('.', ','));
export const percentual = (p) => `${Math.round(p * 100)}%`;
/** "R$ 200,00" ou "200" → centavos */
export function lerReais(texto) {
  const limpo = String(texto).replace(/[^\d,]/g, '').replace(',', '.');
  const n = Number(limpo);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
}

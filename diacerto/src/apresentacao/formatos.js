import { formatarReais, TIPOS_IMOVEL } from '../dominio/index.js';

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

/** "qui, 3 dez, 18h" (ou 18h30) */
export const quando = (v) => {
  const d = new Date(v);
  return `${dataCurta(d)}, ${d.getHours()}h${d.getMinutes() ? String(d.getMinutes()).padStart(2, '0') : ''}`;
};
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
/** "Apartamento · 2 quartos · 1 banheiro · 1 gato" */
export const descreverImovel = (i) => (i ? [TIPOS_IMOVEL[i.tipo] ?? i.tipo, plural(i.quartos, 'quarto', 'quartos'),
  plural(i.banheiros, 'banheiro', 'banheiros'), i.animais].filter(Boolean).join(' · ') : 'Não informado');

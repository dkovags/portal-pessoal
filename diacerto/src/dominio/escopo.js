import { RegraDeNegocioViolada } from './erros.js';

// RF02: o pedido diz como é o imóvel, o que precisa ser feito e quem fornece os materiais.
// Evita surpresa no local e serve de base se houver disputa.

export const TIPOS_IMOVEL = Object.freeze({ apartamento: 'Apartamento', casa: 'Casa', quitinete: 'Quitinete ou estúdio' });

export const MATERIAIS = Object.freeze({
  cliente: 'O cliente fornece produtos e equipamentos',
  profissional: 'A profissional leva os produtos de limpeza; os equipamentos são do cliente',
});

const inteiroEntre = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;

/** @param {{tipo:string, quartos:number, banheiros:number, animais?:string}} d */
export function novoImovel(d) {
  if (!TIPOS_IMOVEL[d?.tipo]) throw new RegraDeNegocioViolada('IMOVEL', 'Informe o tipo de imóvel.');
  const quartos = Number(d.quartos);
  const banheiros = Number(d.banheiros);
  if (!inteiroEntre(quartos, 0, 10)) throw new RegraDeNegocioViolada('IMOVEL', 'Informe quantos quartos o imóvel tem (de 0 a 10).');
  if (!inteiroEntre(banheiros, 1, 10)) throw new RegraDeNegocioViolada('IMOVEL', 'Informe quantos banheiros o imóvel tem (de 1 a 10).');
  return { tipo: d.tipo, quartos, banheiros, animais: String(d.animais ?? '').trim().slice(0, 100) };
}

/**
 * Tarefas escolhidas dentro do que a profissional faz, e quem fornece os materiais.
 * @param {{tarefas:string[], materiais?:string}} d @param {{tarefas:string[], levaMateriais?:boolean}} diarista
 */
export function novoEscopo(d, diarista) {
  const tarefas = [...new Set((d.tarefas ?? []).map((t) => String(t).trim()).filter(Boolean))];
  if (!tarefas.length) throw new RegraDeNegocioViolada('TAREFAS', 'Escolha ao menos uma tarefa.');
  const fora = tarefas.filter((t) => !diarista.tarefas.includes(t));
  if (fora.length) throw new RegraDeNegocioViolada('TAREFAS', `A profissional não faz: ${fora.join(', ')}.`);
  const materiais = d.materiais ?? 'cliente';
  if (!MATERIAIS[materiais]) throw new RegraDeNegocioViolada('MATERIAIS', 'Diga quem fornece os produtos e equipamentos.');
  if (materiais === 'profissional' && !diarista.levaMateriais) {
    throw new RegraDeNegocioViolada('MATERIAIS', 'Esta profissional não leva produtos de limpeza. Os materiais ficam por conta do cliente.');
  }
  return { tarefas, materiais };
}

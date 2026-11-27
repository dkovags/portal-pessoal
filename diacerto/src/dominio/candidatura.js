import { RegraDeNegocioViolada } from './erros.js';
import { validarPrecosDaDiarista } from './precificacao.js';
import { PARAMETROS_PADRAO } from './parametros.js';

// Cadastro assistido: a operação conduz o cadastro com a candidata (vídeo ou presencial).
// Da verificação só se guarda o resultado e a data; cópias de documentos não ficam no sistema.

export const STATUS_CANDIDATURA = Object.freeze({
  CONTATO: 'contato', // pediu contato pelo site
  EM_CADASTRO: 'em_cadastro',
  APROVADA: 'aprovada',
  REPROVADA: 'reprovada',
});

export const ITENS_VERIFICACAO = Object.freeze([
  { id: 'identidade', rotulo: 'Documento com foto e selfie conferidos' },
  { id: 'certidao_pcdf', rotulo: 'Certidão de antecedentes da Polícia Civil do DF' },
  { id: 'certidao_pf', rotulo: 'Certidão de antecedentes da Polícia Federal' },
  { id: 'referencia_1', rotulo: '1ª referência confirmada por telefone' },
  { id: 'referencia_2', rotulo: '2ª referência confirmada por telefone' },
  { id: 'conversa', rotulo: 'Conversa por vídeo ou presencial' },
]);

export const RESULTADOS = Object.freeze(['pendente', 'ok', 'nao_aprovado']);

export const TAREFAS_CATALOGO = Object.freeze([
  'Limpeza geral', 'Banheiros', 'Cozinha', 'Roupa de cama', 'Passar roupas leves',
  'Organização de armários', 'Limpeza de manutenção',
]);

export const REGIOES_PILOTO = Object.freeze(['Asa Norte', 'Asa Sul', 'Noroeste', 'Sudoeste', 'Lago Norte', 'Lago Sul']);

/** @param {{id:string, nome:string, celular:string, regiao?:string, origem?:string}} dados */
export function novaCandidatura(dados) {
  const nome = String(dados.nome ?? '').trim();
  const celular = String(dados.celular ?? '').replace(/\D/g, '');
  if (nome.length < 3) throw new RegraDeNegocioViolada('NOME', 'Informe o nome completo.');
  if (!/^\d{10,11}$/.test(celular)) throw new RegraDeNegocioViolada('CELULAR', 'Informe o celular com DDD, só números.');
  return {
    id: dados.id, nome, celular, status: STATUS_CANDIDATURA.CONTATO,
    regioes: dados.regiao ? [dados.regiao] : [], tarefas: [], naoFaz: '', anosExperiencia: 0,
    precos: { diaria: 0, meiaDiaria: 0, transporte: 0, descontoPacote: 0 },
    agenda: { diasDaSemana: [], inicio: 8, fim: 17 },
    verificacao: Object.fromEntries(ITENS_VERIFICACAO.map((i) => [i.id, { resultado: 'pendente', data: null }])),
    aceiteConduta: null, motivoReprovacao: '', diaristaId: null, email: null,
  };
}

/** Lista o que ainda impede a aprovação. Vazia = pode aprovar. */
export function pendenciasDaCandidatura(c, parametros = PARAMETROS_PADRAO) {
  const p = [];
  if (!c.regioes.length) p.push('Escolher ao menos uma região de atendimento.');
  if (!c.tarefas.length) p.push('Escolher ao menos uma tarefa.');
  try { validarPrecosDaDiarista(c.precos, parametros); } catch (e) { p.push(e.message); }
  if (!c.agenda.diasDaSemana.length) p.push('Definir os dias de agenda inicial.');
  if (c.agenda.inicio < parametros.janela.inicio || c.agenda.fim > parametros.janela.fim || c.agenda.fim - c.agenda.inicio < 4) {
    p.push(`O horário da agenda precisa ter ao menos 4 horas entre ${parametros.janela.inicio}h e ${parametros.janela.fim}h.`);
  }
  for (const item of ITENS_VERIFICACAO) {
    const r = c.verificacao[item.id]?.resultado;
    if (r === 'nao_aprovado') p.push(`Verificação não aprovada: ${item.rotulo}.`);
    else if (r !== 'ok') p.push(`Verificação pendente: ${item.rotulo}.`);
  }
  if (!c.aceiteConduta) p.push('Registrar o aceite do código de conduta.');
  return p;
}

export function iniciaisDe(nome) {
  const partes = nome.trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes.at(-1)[0] : '')).toUpperCase();
}

/** Nome exibido no perfil: primeiro nome e inicial do último sobrenome. */
export function nomePublico(nome) {
  const partes = nome.trim().split(/\s+/);
  return partes.length > 1 ? `${partes[0]} ${partes.at(-1)[0].toUpperCase()}.` : partes[0];
}

// Conversão entre as linhas do schema diacerto e os objetos usados pela aplicação.

const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deDia = (texto, hora = 0) => { const [a, m, d] = texto.split('-').map(Number); return new Date(a, m - 1, d, hora); };
export { dia as chaveDia };

export function diaristaDeLinha(l) {
  return {
    id: l.id, nome: l.nome, iniciais: l.iniciais, anosExperiencia: l.anos_experiencia,
    regioes: l.regioes ?? [], tarefas: l.tarefas ?? [], naoFaz: l.nao_faz ?? '',
    precos: { diaria: l.diaria, meiaDiaria: l.meia_diaria, transporte: l.transporte, descontoPacote: Number(l.desconto_pacote) },
    disponibilidade: Object.fromEntries((l.disponibilidade ?? []).map((x) => [x.data, { inicio: x.hora_inicio, fim: x.hora_fim }])),
    verificacao: l.verificacao_data ? { data: l.verificacao_data, resultado: l.verificacao_resultado } : null,
    avaliacoes: (l.avaliacoes ?? []).map((a) => ({ nota: Number(a.nota), texto: a.texto, autor: a.autor, mes: a.mes })),
  };
}

export function linhaDeDiarista(d) {
  return {
    id: d.id, nome: d.nome, iniciais: d.iniciais, anos_experiencia: d.anosExperiencia,
    regioes: d.regioes, tarefas: d.tarefas, nao_faz: d.naoFaz,
    diaria: d.precos.diaria, meia_diaria: d.precos.meiaDiaria, transporte: d.precos.transporte,
    desconto_pacote: d.precos.descontoPacote,
    verificacao_data: d.verificacao?.data ?? null, verificacao_resultado: d.verificacao?.resultado ?? null,
  };
}

export function atendimentoDeLinha(l) {
  return {
    id: l.id, clienteId: l.cliente_id, diaristaId: l.diarista_id,
    inicio: deDia(l.data, l.hora_inicio), horaInicio: l.hora_inicio, horaFim: l.hora_fim,
    duracao: l.duracao, modalidade: l.modalidade, status: l.status, metodo: l.metodo,
    observacoes: l.observacoes ?? '', codigoConfirmacao: l.codigo_confirmacao,
    autorizacao: l.autorizacao ?? undefined, concluidoEm: l.concluido_em ? new Date(l.concluido_em) : undefined,
    valores: {
      servico: l.servico, transporte: l.transporte, taxaCliente: l.taxa_cliente, cupom: l.cupom, comissao: l.comissao,
      totalCliente: l.total_cliente, recebeDiarista: l.recebe_diarista, receitaPlataforma: l.receita_plataforma,
    },
  };
}

export function linhaDeAtendimento(a) {
  const v = a.valores;
  return {
    id: a.id, cliente_id: a.clienteId, diarista_id: a.diaristaId, data: dia(a.inicio),
    hora_inicio: a.horaInicio, hora_fim: a.horaFim, duracao: a.duracao, modalidade: a.modalidade,
    status: a.status, metodo: a.metodo ?? 'pix', observacoes: a.observacoes ?? '',
    codigo_confirmacao: a.codigoConfirmacao, autorizacao: a.autorizacao ?? null,
    concluido_em: a.concluidoEm ? new Date(a.concluidoEm).toISOString() : null,
    servico: v.servico, transporte: v.transporte, taxa_cliente: v.taxaCliente, cupom: v.cupom, comissao: v.comissao,
    total_cliente: v.totalCliente, recebe_diarista: v.recebeDiarista, receita_plataforma: v.receitaPlataforma,
  };
}

export const pacoteDeLinha = (l) => ({ id: l.id, clienteId: l.cliente_id, diaristaId: l.diarista_id, total: l.total, usados: l.usados, validade: new Date(l.validade) });
export const linhaDePacote = (p) => ({ id: p.id, cliente_id: p.clienteId, diarista_id: p.diaristaId, total: p.total, usados: p.usados, validade: new Date(p.validade).toISOString() });

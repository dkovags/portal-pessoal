// Dados fictícios do protótipo, gerados em relação à data de hoje.
// Nomes, avaliações e endereços são inventados.
import { reais, calcularAtendimento, STATUS } from '../../dominio/index.js';

const chave = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const somarDias = (base, n) => { const d = new Date(base.getFullYear(), base.getMonth(), base.getDate()); d.setDate(d.getDate() + n); return d; };

function agenda(hoje, diasDaSemana, inicio, fim) {
  const disp = {};
  for (let i = 1; i <= 21; i++) {
    const d = somarDias(hoje, i);
    if (diasDaSemana.includes(d.getDay())) disp[chave(d)] = { inicio, fim };
  }
  return disp;
}

/** @param {Date} hoje */
export function gerarDadosFicticios(hoje) {
  const diaristas = [
    {
      id: 'd1', nome: 'Marlene S.', iniciais: 'MS', anosExperiencia: 12,
      regioes: ['Asa Norte', 'Asa Sul', 'Noroeste'],
      tarefas: ['Limpeza geral', 'Banheiros', 'Cozinha', 'Roupa de cama'],
      naoFaz: 'Janelas externas, áreas em altura, limpeza pós-obra.',
      precos: { diaria: reais(200), meiaDiaria: reais(110), transporte: reais(20), descontoPacote: 0.10 },
      disponibilidade: agenda(hoje, [1, 2, 3, 4], 8, 17),
      verificacao: { data: 'out/2026', resultado: 'Documento com foto, certidões de antecedentes da Polícia Civil do DF e da Polícia Federal e duas referências confirmadas por telefone.' },
      avaliacoes: [
        { nota: 5, texto: 'Pontual e caprichosa', autor: 'Cliente da Asa Norte', mes: 'nov/2026' },
        { nota: 4.8, texto: 'Deixou a cozinha impecável', autor: 'Cliente do Noroeste', mes: 'out/2026' },
        { nota: 4.9, texto: 'Muito cuidadosa com os objetos', autor: 'Cliente da Asa Sul', mes: 'out/2026' },
      ],
    },
    {
      id: 'd2', nome: 'Joana P.', iniciais: 'JP', anosExperiencia: 7,
      regioes: ['Asa Norte', 'Sudoeste'],
      tarefas: ['Limpeza de manutenção', 'Organização de armários'],
      naoFaz: 'Passar roupas, limpeza pós-obra.',
      precos: { diaria: reais(190), meiaDiaria: reais(110), transporte: reais(20), descontoPacote: 0.05 },
      disponibilidade: agenda(hoje, [1, 3, 5], 8, 12),
      verificacao: { data: 'nov/2026', resultado: 'Documento com foto, certidões de antecedentes e duas referências confirmadas.' },
      avaliacoes: [{ nota: 4.8, texto: 'Organizou tudo muito bem', autor: 'Cliente do Sudoeste', mes: 'nov/2026' }],
    },
    {
      id: 'd3', nome: 'Rosa C.', iniciais: 'RC', anosExperiencia: 9,
      regioes: ['Asa Norte', 'Lago Norte'],
      tarefas: ['Limpeza geral', 'Passar roupas leves'],
      naoFaz: 'Áreas em altura.',
      precos: { diaria: reais(180), meiaDiaria: reais(100), transporte: reais(15), descontoPacote: 0.10 },
      disponibilidade: agenda(hoje, [2, 4, 6], 10, 19),
      verificacao: { data: 'nov/2026', resultado: 'Documento com foto, certidões de antecedentes e duas referências confirmadas.' },
      avaliacoes: [],
    },
  ];

  const clientes = [
    { id: 'c1', nome: 'Ana R.', endereco: 'SQN 210, Bloco [X], apto [Y]', regiao: 'Asa Norte' },
    { id: 'c2', nome: 'Carlos M.', endereco: 'SQS 308, Bloco [X], apto [Y]', regiao: 'Asa Sul' },
    { id: 'c3', nome: 'Paula T.', endereco: 'SQNW 108, Bloco [X], apto [Y]', regiao: 'Noroeste' },
  ];

  const porId = Object.fromEntries(diaristas.map((d) => [d.id, d]));
  let n = 0;
  const atendimento = (clienteId, diaristaId, deslocamento, status, modalidade = 'avulso') => {
    const d = porId[diaristaId];
    const inicio = somarDias(hoje, deslocamento); inicio.setHours(8);
    const valores = calcularAtendimento({ servico: d.precos.diaria, transporte: d.precos.transporte, modalidade, descontoPacote: d.precos.descontoPacote });
    const fim = new Date(inicio); fim.setHours(17);
    return { id: `a${++n}`, clienteId, diaristaId, inicio, horaInicio: 8, horaFim: 17, duracao: 'diaria', modalidade,
      valores, metodo: 'pix', observacoes: '', codigoConfirmacao: '4821', status,
      ...(status === STATUS.CONCLUIDO ? { concluidoEm: fim, autorizacao: `sim-hist-${n}` } : {}) };
  };

  const atendimentos = [
    atendimento('c1', 'd1', -28, STATUS.CONCLUIDO),
    atendimento('c1', 'd1', -21, STATUS.CONCLUIDO),
    atendimento('c1', 'd1', -14, STATUS.CONCLUIDO),
    atendimento('c1', 'd1', -7, STATUS.CONCLUIDO, 'pacote'),
    atendimento('c1', 'd2', -10, STATUS.CONCLUIDO),
    atendimento('c2', 'd1', -3, STATUS.CONCLUIDO),
    atendimento('c3', 'd1', -2, STATUS.CONCLUIDO),
    atendimento('c2', 'd1', proximoDiaUtil(hoje, 3), STATUS.SOLICITADO),
  ];
  atendimentos[atendimentos.length - 1].observacoes = 'Tenho um gato. A chave fica na portaria.';

  const validade = new Date(hoje); validade.setMonth(validade.getMonth() + 3);
  const pacotes = [{ id: 'p1', clienteId: 'c1', diaristaId: 'd1', total: 4, usados: 1, validade }];

  return { diaristas, clientes, atendimentos, pacotes, cupons: { LANCAMENTO: reais(30) } };
}

function proximoDiaUtil(hoje, minimo) {
  for (let i = minimo; i < minimo + 7; i++) {
    const d = somarDias(hoje, i);
    if ([1, 2, 3, 4].includes(d.getDay())) return i;
  }
  return minimo;
}

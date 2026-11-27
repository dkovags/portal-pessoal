// Gera o SQL da carga fictícia a partir do mesmo gerador usado em memória.
// Uso: node banco/gerar-carga.js > banco/projeto-diacerto/002_carga_ficticia.sql
import { gerarDadosFicticios } from '../src/infraestrutura/memoria/dados-ficticios.js';
import {
  linhaDeDiarista, linhaDeAtendimento, linhaDePacote, linhaDeCandidatura, linhaDeOcorrencia,
} from '../src/infraestrutura/mapeamento-sql.js';

const d = gerarDadosFicticios(new Date());
const tabela = (nome, linhas, colunas) => {
  if (!linhas.length) return '';
  const json = JSON.stringify(linhas).replace(/'/g, "''");
  const cols = colunas ?? Object.keys(linhas[0]);
  return `insert into diacerto.${nome} (${cols.join(', ')}) select ${cols.join(', ')} from json_populate_recordset(null::diacerto.${nome}, '${json}');`;
};
const sql = [
  `-- Carga fictícia do protótipo, gerada em ${new Date().toISOString()} (datas relativas a esse dia).`,
  tabela('clientes', d.clientes),
  tabela('diaristas', d.diaristas.map(linhaDeDiarista)),
  tabela('disponibilidade', d.diaristas.flatMap((x) => Object.entries(x.disponibilidade).map(([data, j]) => ({ diarista_id: x.id, data, hora_inicio: j.inicio, hora_fim: j.fim })))),
  tabela('avaliacoes', d.diaristas.flatMap((x) => x.avaliacoes.map((a) => ({ diarista_id: x.id, ...a })))),
  tabela('pacotes', d.pacotes.map(linhaDePacote)),
  tabela('atendimentos', d.atendimentos.map(linhaDeAtendimento)),
  tabela('cupons', Object.entries(d.cupons).map(([codigo, valor]) => ({ codigo, valor, ativo: true }))),
  tabela('candidaturas', d.candidaturas.map(linhaDeCandidatura)),
  tabela('ocorrencias', d.ocorrencias.map(linhaDeOcorrencia)),
].filter(Boolean);
console.log(sql.join('\n'));

// Gera o SQL da carga inicial (dados fictícios) a partir do mesmo gerador usado em memória.
// Uso: node banco/gerar-carga.js > banco/002_carga_ficticia.sql
import { gerarDadosFicticios } from '../src/infraestrutura/memoria/dados-ficticios.js';

const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const arr = (a) => `array[${a.map(q).join(',')}]::text[]`;
const dia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const dados = gerarDadosFicticios(new Date());
const sql = ['-- Carga fictícia do protótipo, gerada em ' + new Date().toISOString()];
for (const c of dados.clientes) sql.push(`insert into diacerto.clientes values (${q(c.id)},${q(c.nome)},${q(c.endereco)},${q(c.regiao)});`);
for (const d of dados.diaristas) {
  sql.push(`insert into diacerto.diaristas values (${q(d.id)},${q(d.nome)},${q(d.iniciais)},${d.anosExperiencia},${arr(d.regioes)},${arr(d.tarefas)},${q(d.naoFaz)},${d.precos.diaria},${d.precos.meiaDiaria},${d.precos.transporte},${d.precos.descontoPacote},${q(d.verificacao.data)},${q(d.verificacao.resultado)});`);
  for (const [data, j] of Object.entries(d.disponibilidade)) sql.push(`insert into diacerto.disponibilidade values (${q(d.id)},'${data}',${j.inicio},${j.fim});`);
  for (const a of d.avaliacoes) sql.push(`insert into diacerto.avaliacoes (diarista_id,nota,texto,autor,mes) values (${q(d.id)},${a.nota},${q(a.texto)},${q(a.autor)},${q(a.mes)});`);
}
for (const p of dados.pacotes) sql.push(`insert into diacerto.pacotes values (${q(p.id)},${q(p.clienteId)},${q(p.diaristaId)},${p.total},${p.usados},${q(p.validade.toISOString())});`);
for (const a of dados.atendimentos) {
  const v = a.valores;
  sql.push(`insert into diacerto.atendimentos (id,cliente_id,diarista_id,data,hora_inicio,hora_fim,duracao,modalidade,status,metodo,observacoes,codigo_confirmacao,autorizacao,concluido_em,servico,transporte,taxa_cliente,cupom,comissao,total_cliente,recebe_diarista,receita_plataforma) values (${q(a.id)},${q(a.clienteId)},${q(a.diaristaId)},'${dia(a.inicio)}',${a.horaInicio},${a.horaFim},${q(a.duracao)},${q(a.modalidade)},${q(a.status)},${q(a.metodo)},${q(a.observacoes)},${q(a.codigoConfirmacao)},${q(a.autorizacao)},${a.concluidoEm ? q(a.concluidoEm.toISOString()) : 'null'},${v.servico},${v.transporte},${v.taxaCliente},${v.cupom},${v.comissao},${v.totalCliente},${v.recebeDiarista},${v.receitaPlataforma});`);
}
for (const [codigo, valor] of Object.entries(dados.cupons)) sql.push(`insert into diacerto.cupons values (${q(codigo)},${valor},true);`);
console.log(sql.join('\n'));

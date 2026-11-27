// Navegador ↔ servidor: o cliente da API sobre o servidor real (com repositórios em memória).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { clienteApi } from '../src/infraestrutura/api/casos-remotos.js';
import { criarServidor } from '../src/apresentacao/api/servidor.js';
import { criarCasosDeUso } from '../src/aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../src/infraestrutura/memoria/index.js';
import { reais } from '../src/dominio/index.js';

function montar(token) {
  const dep = criarInfraestruturaEmMemoria({ agora: new Date(2026, 11, 1, 10) });
  dep.perfis = { porEmail: async (e) => ({ 'ana@x.com': { papel: 'cliente', clienteId: 'c1' }, 'op@x.com': { papel: 'operacao' } }[e] ?? null), emailDoUsuario: async () => null };
  const srv = criarServidor({ casos: criarCasosDeUso(dep), dep, origens: ['https://pessoal.kovags.com'], registrar: () => {}, verificarToken: async (t) => ({ email: t }) });
  const fetchFalso = (url, init) => srv.fetch(new Request(url, { ...init, headers: { ...init.headers, origin: 'https://pessoal.kovags.com' } }));
  return clienteApi({ url: 'https://api.teste/', token: async () => token, fetch: fetchFalso });
}

test('cliente da API: datas voltam como Date e valores batem com o domínio', async () => {
  const api = montar('ana@x.com');
  assert.equal((await api.eu()).clienteId, 'c1');
  const minhas = await api.casos.minhasDiaristas('qualquer');
  assert.ok(minhas[0].ultima instanceof Date);
  const sim = await api.casos.simularReserva({ diaristaId: 'd3', codigoCupom: 'LANCAMENTO' });
  assert.equal(sim.valores.totalCliente, reais(180));
});

test('cliente da API: erros de regra e de permissão viram mensagens para a tela', async () => {
  const api = montar('ana@x.com');
  await assert.rejects(api.casos.simularReserva({ diaristaId: 'd3', codigoCupom: 'XPTO' }), { message: 'Cupom inválido ou expirado.', codigo: 'CUPOM_INVALIDO' });
  await assert.rejects(api.casos.listarCandidaturas(), { status: 403 });
  assert.equal(api.casos.then, undefined);
});

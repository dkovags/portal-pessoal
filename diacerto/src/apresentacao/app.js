// Raiz de composição: único ponto que conhece a implementação concreta da infraestrutura.
import { criarCasosDeUso } from '../aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../infraestrutura/memoria/index.js';
import { conectarNeon, criarInfraestruturaNeon } from '../infraestrutura/neon/index.js';
import { telaInicio } from './telas/inicio.js';
import { telaBusca } from './telas/busca.js';
import { telaPerfil } from './telas/perfil.js';
import { telaReserva } from './telas/reserva.js';
import { telaMinhas } from './telas/minhas.js';
import { telaDiarista } from './telas/diarista.js';
import { telaAjuda } from './telas/ajuda.js';
import { telaTrabalhe } from './telas/trabalhe.js';
import { telaOperacao } from './telas/operacao.js';
import { telaCadastro } from './telas/cadastro.js';
import { telaAtendimentoOperacao } from './telas/atendimento-operacao.js';
import { html } from './html.js';

const ROTAS = {
  '': telaInicio, busca: telaBusca, profissional: telaPerfil, reserva: telaReserva,
  minhas: telaMinhas, diarista: telaDiarista, ajuda: telaAjuda, trabalhe: telaTrabalhe,
  operacao: (ctx, rota) => ({ cadastro: telaCadastro, atendimento: telaAtendimentoOperacao }[rota.params[0]] ?? telaOperacao)(ctx, rota),
};

function lerRota() {
  const [caminho, busca = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [nome = '', ...params] = caminho.split('/').filter(Boolean);
  return { nome, params, query: Object.fromEntries(new URLSearchParams(busca)) };
}

function portao(raiz, mensagem, acoes = []) {
  raiz.innerHTML = String(html`
    <main class="tela portao">
      <span class="marca"><span>DiaCerto</span></span>
      <h1 class="titulo">Protótipo do piloto</h1>
      <p class="mudo" role="status">${mensagem}</p>
      ${acoes.map((a) => html`<button type="button" class="btn ${a.secundaria ? html`contorno` : ''}" data-acao="${a.id}">${a.rotulo}</button>`)}
      <a class="link-forte" href="?demo#/">Abrir a demonstração sem login (dados só neste navegador)</a>
    </main>`);
  for (const a of acoes) raiz.querySelector(`[data-acao="${a.id}"]`).addEventListener('click', a.fazer);
}

/** Escolhe a infraestrutura: Neon com login Google (padrão) ou memória (?demo). */
export async function iniciar(raiz) {
  if (new URLSearchParams(location.search).has('demo')) {
    return montarApp(raiz, criarInfraestruturaEmMemoria(), { modo: 'memoria' });
  }
  portao(raiz, 'Conectando ao banco…');
  let conexao;
  try { conexao = await conectarNeon(); } catch (falha) {
    console.error(falha);
    return portao(raiz, 'Não foi possível carregar o login do Neon. Recarregue a página.');
  }
  const sessao = await conexao.sessao();
  if (!sessao) {
    return portao(raiz, 'Acesso restrito. Entre com a sua conta Google.', [{ id: 'entrar', rotulo: 'Entrar com Google', fazer: async () => {
      try { await conexao.entrar(); } catch { portao(raiz, 'Não foi possível iniciar o login. Tente de novo.'); }
    } }]);
  }
  const email = String(sessao.user?.email ?? '').toLowerCase();
  const sair = async () => { await conexao.sair().catch(() => {}); location.replace(location.pathname); };
  const infra = criarInfraestruturaNeon(conexao.db);
  try {
    if (!(await infra.clientes.obter('c1'))) throw new Error('sem acesso');
  } catch {
    return portao(raiz, `A conta ${email} não tem acesso ao DiaCerto.`, [{ id: 'sair', rotulo: 'Sair', secundaria: true, fazer: sair }]);
  }
  return montarApp(raiz, infra, { modo: 'neon', email, sair });
}

function montarApp(raiz, infra, info) {
  const casos = criarCasosDeUso(infra);
  const estados = new Map();
  let rotaAtual = lerRota();

  const ctx = {
    casos,
    sessao: { clienteId: 'c1', diaristaId: 'd1' }, // protótipo: Ana (cliente) e Marlene (diarista)
    agora: () => infra.relogio.agora(),
    ir: (hash) => { location.hash = hash; },
    estado: (chave, inicial) => { if (!estados.has(chave)) estados.set(chave, { ...inicial }); return estados.get(chave); },
    redesenhar: () => desenhar(false),
  };

  async function desenhar(mudouDeTela = true) {
    const tela = ROTAS[rotaAtual.nome] ?? telaInicio;
    try {
      const r = await tela(ctx, rotaAtual);
      raiz.innerHTML = String(html`
        <div class="faixa-prototipo" role="note">${info.modo === 'neon'
          ? html`Protótipo · dados de teste gravados no banco · ${info.email} · <button type="button" class="link-claro" data-sair>Sair</button>`
          : 'Demonstração com dados fictícios, só neste navegador'} ·
          <a href="#/">Ver como cliente</a> · <a href="#/diarista">Ver como diarista</a> · <a href="#/operacao">Ver como operação</a></div>
        <main class="tela">${r.html}</main>`);
      raiz.querySelector('[data-sair]')?.addEventListener('click', info.sair);
      r.ligar?.(raiz);
      if (mudouDeTela) { window.scrollTo(0, 0); raiz.querySelector('h1')?.focus?.(); }
    } catch (falha) {
      console.error(falha);
      raiz.innerHTML = String(html`<main class="tela"><p class="erro" role="alert">${falha.message}</p><a class="btn" href="#/">Voltar ao início</a></main>`);
    }
  }

  window.addEventListener('hashchange', () => {
    const anterior = rotaAtual.nome + rotaAtual.params.join('/');
    rotaAtual = lerRota();
    if (anterior !== rotaAtual.nome + rotaAtual.params.join('/')) {
      // nova tela: estado da reserva recomeça; demais estados (abas, plano) persistem na sessão
      for (const k of [...estados.keys()]) if (k.startsWith('reserva-') && estados.get(k).enviado) estados.delete(k);
    }
    desenhar();
  });
  desenhar();
  return { infra, casos };
}

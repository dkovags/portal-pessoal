// Raiz de composição: único ponto que conhece a implementação concreta da infraestrutura.
import { criarCasosDeUso } from '../aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../infraestrutura/memoria/index.js';
import { conectarLogin, CONFIG_SERVIDOR } from '../infraestrutura/api/login.js';
import { clienteApi } from '../infraestrutura/api/casos-remotos.js';
import { telaInicio } from './telas/inicio.js';
import { telaBusca } from './telas/busca.js';
import { telaPerfil } from './telas/perfil.js';
import { telaReserva } from './telas/reserva.js';
import { telaMinhas } from './telas/minhas.js';
import { telaDiarista } from './telas/diarista.js';
import { telaAjuda } from './telas/ajuda.js';
import { telaRemarcar } from './telas/remarcar.js';
import { telaTrabalhe } from './telas/trabalhe.js';
import { telaOperacao } from './telas/operacao.js';
import { telaCadastro } from './telas/cadastro.js';
import { telaAtendimentoOperacao } from './telas/atendimento-operacao.js';
import { telaBoasVindas } from './telas/boas-vindas.js';
import { telaAceite } from './telas/aceite.js';
import { telaTermos, documentoLegal } from './telas/termos.js';
import { telaPacotes } from './telas/pacotes.js';
import { telaComprarPacote } from './telas/comprar-pacote.js';
import { TEXTOS_LEGAIS } from './textos-legais.js';
import { html } from './html.js';

const ROTAS = {
  '': telaInicio, busca: telaBusca, profissional: telaPerfil, reserva: telaReserva,
  minhas: telaMinhas, diarista: telaDiarista, ajuda: telaAjuda, remarcar: telaRemarcar, trabalhe: telaTrabalhe,
  pacotes: telaPacotes, pacote: telaComprarPacote, termos: telaTermos, 'boas-vindas': telaBoasVindas,
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
      <p class="mudo mini">${Object.entries(TEXTOS_LEGAIS).map(([id, d], i) => html`${i ? ' · ' : ''}<button type="button" class="link-forte" data-documento="${id}">${d.titulo}</button>`)}</p>
    </main>`);
  for (const a of acoes) raiz.querySelector(`[data-acao="${a.id}"]`).addEventListener('click', a.fazer);
  raiz.querySelectorAll('[data-documento]').forEach((b) => b.addEventListener('click', () => mostrarDocumento(raiz, b.dataset.documento, () => portao(raiz, mensagem, acoes))));
}

/** Documento legal fora do app (antes do login ou por link direto). */
function mostrarDocumento(raiz, id, voltar) {
  raiz.innerHTML = String(html`
    <main class="tela">
      <header class="topo"><h1 class="titulo">${TEXTOS_LEGAIS[id]?.titulo ?? 'Documento'}</h1></header>
      ${documentoLegal(id)}
      <button type="button" class="btn contorno" data-voltar>Voltar</button>
    </main>`);
  raiz.querySelector('[data-voltar]').addEventListener('click', voltar);
  window.scrollTo(0, 0);
}

/** Escolhe a origem dos casos de uso: API do servidor com login Google (padrão) ou memória (?demo). */
export async function iniciar(raiz) {
  if (new URLSearchParams(location.search).has('demo')) {
    const infra = criarInfraestruturaEmMemoria();
    return montarApp(raiz, criarCasosDeUso(infra), { modo: 'memoria', papel: 'operacao', aceitesPendentes: [], agora: () => infra.relogio.agora() });
  }
  const rota = lerRota();
  if (rota.nome === 'termos' && TEXTOS_LEGAIS[rota.params[0]]) {
    // link direto para um documento: abre sem pedir login
    return mostrarDocumento(raiz, rota.params[0], () => { history.replaceState(null, '', location.pathname); iniciar(raiz); });
  }
  portao(raiz, 'Conectando…');
  let login;
  try { login = await conectarLogin(); } catch (falha) {
    console.error(falha);
    return portao(raiz, 'Não foi possível carregar o login. Recarregue a página.');
  }
  const sessao = await login.sessao();
  if (!sessao) {
    return portao(raiz, 'Entre com a sua conta Google para continuar.', [{ id: 'entrar', rotulo: 'Entrar com Google', fazer: async () => {
      try { await login.entrar(); } catch { portao(raiz, 'Não foi possível iniciar o login. Tente de novo.'); }
    } }]);
  }
  const sair = async () => { await login.sair().catch(() => {}); location.replace(location.pathname); };
  const api = clienteApi({ url: CONFIG_SERVIDOR.api, token: login.token });
  let eu;
  try { eu = await api.eu(); } catch (falha) {
    return portao(raiz, falha.message, [{ id: 'sair', rotulo: 'Sair', secundaria: true, fazer: sair }]);
  }
  const base = { modo: 'servidor', email: eu.email, sair, agora: () => new Date() };
  if (!eu.papel) {
    // sem acesso ainda: autocadastro como cliente (RF14); diaristas são cadastradas pela operação
    return montarApp(raiz, api.casos, { ...base, papel: 'visitante', nome: sessao.user?.name ?? '', aceitesPendentes: [], aoCadastrar: () => location.reload() });
  }
  return montarApp(raiz, api.casos, { ...base, papel: eu.papel, clienteId: eu.clienteId, diaristaId: eu.diaristaId, aceitesPendentes: eu.aceitesPendentes ?? [] });
}

function montarApp(raiz, casos, info) {
  if (!location.hash && info.papel === 'diarista') location.hash = '#/diarista';
  const estados = new Map();
  let rotaAtual = lerRota();

  const operacao = info.papel === 'operacao';
  const ctx = {
    casos,
    info,
    // operação vê o protótipo como Ana (cliente) e Marlene (diarista); os demais, como eles mesmos
    sessao: { clienteId: info.clienteId ?? (operacao ? 'c1' : null), diaristaId: info.diaristaId ?? (operacao ? 'd1' : null), papel: info.papel },
    agora: info.agora,
    aoCadastrar: info.aoCadastrar ?? (() => location.reload()),
    concluirAceite: (restantes) => {
      info.aceitesPendentes = restantes;
      const inicio = info.papel === 'diarista' ? '#/diarista' : '#/';
      if (location.hash !== inicio) location.hash = inicio; else desenhar();
    },
    ir: (hash) => { location.hash = hash; },
    estado: (chave, inicial) => { if (!estados.has(chave)) estados.set(chave, { ...inicial }); return estados.get(chave); },
    redesenhar: () => desenhar(false),
  };

  /** Visitante só se cadastra; quem tem termos pendentes aceita antes de seguir; documentos sempre abrem. */
  function telaDa(rota) {
    if (rota.nome === 'termos') return telaTermos;
    if (info.papel === 'visitante') return rota.nome === 'trabalhe' ? telaTrabalhe : telaBoasVindas;
    if (info.aceitesPendentes?.length) return telaAceite;
    return ROTAS[rota.nome] ?? telaInicio;
  }

  async function desenhar(mudouDeTela = true) {
    const tela = telaDa(rotaAtual);
    try {
      const r = await tela(ctx, rotaAtual);
      raiz.innerHTML = String(html`
        <div class="faixa-prototipo" role="note">${info.modo === 'servidor'
          ? html`Protótipo · ${info.email} · <button type="button" class="link-claro" data-sair>Sair</button>`
          : 'Demonstração com dados fictícios, só neste navegador'}${operacao ? html` ·
          <a href="#/">Ver como cliente</a> · <a href="#/diarista">Ver como diarista</a> · <a href="#/operacao">Ver como operação</a> · <a href="#/boas-vindas">Ver cadastro</a>` : ''}</div>
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
  return { casos };
}

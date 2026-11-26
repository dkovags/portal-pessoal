// Raiz de composição: único ponto que conhece a implementação concreta da infraestrutura.
import { criarCasosDeUso } from '../aplicacao/casos-de-uso.js';
import { criarInfraestruturaEmMemoria } from '../infraestrutura/memoria/index.js';
import { telaInicio } from './telas/inicio.js';
import { telaBusca } from './telas/busca.js';
import { telaPerfil } from './telas/perfil.js';
import { telaReserva } from './telas/reserva.js';
import { telaMinhas } from './telas/minhas.js';
import { telaDiarista } from './telas/diarista.js';
import { telaAjuda } from './telas/ajuda.js';
import { html } from './html.js';

const ROTAS = {
  '': telaInicio, busca: telaBusca, profissional: telaPerfil, reserva: telaReserva,
  minhas: telaMinhas, diarista: telaDiarista, ajuda: telaAjuda,
};

function lerRota() {
  const [caminho, busca = ''] = location.hash.replace(/^#\/?/, '').split('?');
  const [nome = '', ...params] = caminho.split('/').filter(Boolean);
  return { nome, params, query: Object.fromEntries(new URLSearchParams(busca)) };
}

export function iniciar(raiz) {
  const infra = criarInfraestruturaEmMemoria();
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
        <div class="faixa-prototipo" role="note">Protótipo com dados fictícios ·
          <a href="#/">Ver como cliente</a> · <a href="#/diarista">Ver como diarista</a></div>
        <main class="tela">${r.html}</main>`);
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

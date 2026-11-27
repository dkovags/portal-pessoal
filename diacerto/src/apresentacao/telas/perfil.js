import { html } from '../html.js';
import { cabecalho, avatar, CORES } from '../componentes.js';
import { moeda, nota, percentual } from '../formatos.js';

export async function telaPerfil(ctx, rota) {
  const id = rota.params[0];
  const duracao = rota.query.duracao ?? 'diaria';
  const p = await ctx.casos.obterPerfil(id, duracao);
  const sim = await ctx.casos.simularReserva({ diaristaId: id, clienteId: ctx.sessao.clienteId, duracao });
  const pacote = sim.pacoteAtivo; // pacote com saldo com esta profissional, nesta duração
  const reservar = (modalidade) => '#/reserva/' + id + '?' + new URLSearchParams({ duracao, modalidade, data: rota.query.data ?? '' });
  const quantidadeTexto = `${p.pacote.quantidade} ${duracao === 'diaria' ? 'diárias' : 'meias diárias'}`;

  return {
    html: html`
      ${cabecalho('', '#/busca')}
      <section class="linha">
        ${avatar(p.iniciais, CORES[p.id], 72)}
        <div class="pilha-curta">
          <h1 class="titulo">${p.nome}</h1>
          <span class="mudo pequeno">${nota(p.nota)}${p.nota ? html` em ${p.atendimentos} atendimentos` : ''} · ${p.anosExperiencia} anos de experiência</span>
          <span class="mudo pequeno">Atende ${p.regioes.join(', ')}</span>
        </div>
      </section>
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">O que foi verificado</h2>
        <p class="mudo pequeno">${p.verificacao.resultado} Verificação em ${p.verificacao.data}. A verificação reduz riscos, mas não os elimina.</p>
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">O que ela faz</h2>
        <div class="chips">${p.tarefas.map((t) => html`<span class="etiqueta neutra">${t}</span>`)}</div>
        <p class="mudo pequeno">Não faz: ${p.naoFaz} ${p.levaMateriais ? 'Pode levar os produtos de limpeza, se você pedir; os equipamentos são seus.' : 'Produtos e equipamentos ficam por conta do cliente.'}</p>
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">Como contratar</h2>
        ${pacote ? html`
          <div class="cartao escuro pilha-curta">
            <span class="mini claro">Seu pacote com ${p.nome.split(' ')[0]}</span>
            <strong>${pacote.saldo} de ${pacote.total} atendimentos disponíveis</strong>
            <span class="pequeno claro">Já pago. Válido até ${new Date(pacote.validade).toLocaleDateString('pt-BR')}.</span>
            <a class="btn claro-btn" href="${reservar('pacote')}">Agendar pelo pacote</a>
          </div>` : ''}
        ${pacote ? html`<p class="mudo mini">Enquanto o pacote tiver saldo, os atendimentos de ${p.horas} horas com a ${p.nome.split(' ')[0]} saem dele, sem cobrança nova.</p>` : html`
          <div class="opcao">
            <span class="entre"><strong>Atendimento avulso</strong><strong>${moeda(p.avulso.totalCliente)}</strong></span>
            <span class="mudo mini">${p.horas} horas. Serviço ${moeda(p.avulso.servico)}, transporte ${moeda(p.avulso.transporte)}, taxa DiaCerto ${moeda(p.avulso.taxaCliente)}. Você só paga depois que ela aceita.</span>
            <a class="btn suave-btn" href="${reservar('avulso')}">Escolher data e horário</a>
          </div>`}
        ${pacote ? '' : html`
          <div class="opcao">
            <span class="entre"><strong>Pacote de ${quantidadeTexto}</strong><strong>${moeda(p.pacote.totalCliente)} cada</strong></span>
            <span class="mudo mini">${percentual(p.pacote.desconto)} de desconto definido pela ${p.nome.split(' ')[0]}. Paga ${moeda(p.pacote.totalCliente * p.pacote.quantidade)} de uma vez e marca os dias quando quiser, em até ${p.pacote.validadeMeses} meses. O que não usar volta para você.</span>
            <a class="btn contorno" href="#/pacote/${id}?duracao=${duracao}">Ver o pacote</a>
          </div>`}
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">Avaliações de atendimentos realizados</h2>
        ${p.avaliacoes.length === 0 ? html`<p class="mudo pequeno">Ainda sem avaliações. Toda avaliação vem de um atendimento concluído.</p>` : ''}
        ${p.avaliacoes.map((a) => html`<div class="cartao"><strong class="pequeno">${'★'.repeat(Math.round(a.nota))} ${nota(a.nota)}${a.texto ? ` · ${a.texto}` : ''}</strong><span class="mudo mini bloco">${a.autor}, ${a.mes}</span></div>`)}
      </section>
`,
  };
}

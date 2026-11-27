import { html } from '../html.js';
import { cabecalho, erro } from '../componentes.js';
import { moeda, dataCurta, dataLonga, horario, percentual } from '../formatos.js';
import { TIPOS_IMOVEL, MATERIAIS, LIMITE_INSTRUCOES } from '../../dominio/index.js';

const HORAS = { diaria: 9, meiaDiaria: 4 }; // diária: 8h de serviço + 1h de intervalo

export async function telaReserva(ctx, rota) {
  const id = rota.params[0];
  const duracao = rota.query.duracao ?? 'diaria';
  const perfil = await ctx.casos.obterPerfil(id, duracao);
  const dados = await ctx.casos.meusDados({ clienteId: ctx.sessao.clienteId });
  const e = ctx.estado('reserva-' + id, {
    data: rota.query.data || perfil.proximosHorarios[0]?.data || '', hora: null,
    cupom: 'LANCAMENTO', cupomDigitado: 'LANCAMENTO', metodo: 'pix', observacoes: '', erro: '', enviado: null,
    // RF02: imóvel do último pedido e, por padrão, tudo o que a profissional faz
    imovel: { ...(dados.imovel ?? { tipo: 'apartamento', quartos: 1, banheiros: 1, animais: '' }) },
    tarefas: [...perfil.tarefas], materiais: 'cliente', instrucoes: '',
  });

  if (e.enviado) {
    return { html: html`
      ${cabecalho('Pedido enviado', '#/minhas')}
      <section class="cartao pilha-curta">
        <strong>${perfil.nome} · ${dataLonga(e.enviado.inicio)}</strong>
        <span class="mudo pequeno">${horario(e.enviado.horaInicio, e.enviado.horaFim)} · ${moeda(e.enviado.valores.totalCliente)}</span>
        <span class="mudo pequeno">${e.enviado.tarefas.join(', ')} · ${e.enviado.materiais === 'profissional' ? 'ela leva os produtos' : 'produtos e equipamentos seus'}</span>
        <span class="destaque pequeno">${e.enviado.modalidade === 'pacote'
          ? 'Aguardando a profissional aceitar. Saiu do saldo do seu pacote, sem cobrança nova.'
          : 'Aguardando a profissional aceitar. Você só é cobrado depois do aceite.'}</span>
      </section>
      <section class="cartao pilha-curta">
        <strong class="pequeno">Seu código de confirmação: ${e.enviado.codigoConfirmacao}</strong>
        <span class="mudo mini">Informe à profissional quando ela chegar. O código libera o pagamento dela.</span>
      </section>
      <a class="btn" href="#/minhas">Ver minhas diaristas</a>` };
  }

  const janela = perfil.proximosHorarios.find((h) => h.data === e.data);
  const inicios = janela ? Array.from({ length: Math.max(0, janela.fim - janela.inicio - HORAS[duracao] + 1) }, (_, i) => janela.inicio + i) : [];
  if (!inicios.includes(e.hora)) e.hora = inicios[0] ?? null;

  let sim; let erroCupom = '';
  try {
    sim = await ctx.casos.simularReserva({ diaristaId: id, clienteId: ctx.sessao.clienteId, duracao, modalidade: rota.query.modalidade ?? 'avulso', codigoCupom: e.cupom || undefined });
  } catch (falha) {
    erroCupom = falha.message; e.cupom = '';
    sim = await ctx.casos.simularReserva({ diaristaId: id, clienteId: ctx.sessao.clienteId, duracao, modalidade: rota.query.modalidade ?? 'avulso' });
  }
  const v = sim.valores;
  const pelo = sim.modalidade === 'pacote';
  const pol = sim.politicaCancelamento;
  const textoCancelamento = pelo
    ? `Cancelamento gratuito até ${pol.horasGratuitas}h antes: o atendimento volta para o saldo do pacote. Depois disso, ele sai do saldo, ${percentual(pol.percentualDevidoDiarista)} do valor da profissional fica com ela e o restante volta para você.`
    : `Cancelamento gratuito até ${pol.horasGratuitas}h antes. Depois disso, ${percentual(pol.percentualDevidoDiarista)} do valor da profissional fica com ela e o restante volta para você.`;

  return {
    html: html`
      ${cabecalho('Revisar reserva', '#/profissional/' + id + '?duracao=' + duracao)}
      <section class="cartao pilha-curta">
        <strong>${perfil.nome} · ${pelo ? 'Pelo pacote' : 'Atendimento avulso'}</strong>
        <span class="mudo pequeno">${duracao === 'diaria' ? '8 horas de serviço, com 1 hora de intervalo' : '4 horas de serviço'}</span>
        ${pelo ? html`<span class="destaque pequeno">Saldo do pacote: ${sim.pacoteAtivo.saldo} de ${sim.pacoteAtivo.total}. Este atendimento já está pago.</span>` : ''}
      </section>
      ${rota.query.modalidade === 'pacote' && !pelo ? html`<p class="cartao aviso-texto">Você não tem saldo de pacote com ${perfil.nome.split(' ')[0]} para esta duração. Este pedido será avulso.</p>` : ''}
      <section class="pilha-curta">
        <h2 class="subtitulo">Quando</h2>
        <div class="chips">${perfil.proximosHorarios.map((h) => html`<button type="button" class="chip ${h.data === e.data ? html`ativo` : ''}" data-data="${h.data}">${dataCurta(h.data)}</button>`)}</div>
        ${inicios.length ? html`<label>Horário de início
          <select data-hora>${inicios.map((h) => html`<option value="${h}" ${h === e.hora ? html`selected` : ''}>${horario(h, h + HORAS[duracao])}</option>`)}</select></label>`
          : html`<p class="mudo pequeno">Escolha um dia com horário livre.</p>`}
      </section>
      <section class="pilha-curta" data-escopo>
        <h2 class="subtitulo">O imóvel</h2>
        <div class="grade2">
          <label>Tipo<select data-imovel="tipo">${Object.entries(TIPOS_IMOVEL).map(([k, r]) => html`<option value="${k}" ${k === e.imovel.tipo ? html`selected` : ''}>${r}</option>`)}</select></label>
          <label>Animais<input data-imovel="animais" maxlength="100" placeholder="Ex.: 1 gato" value="${e.imovel.animais}"></label>
          <label>Quartos<select data-imovel="quartos">${Array.from({ length: 11 }, (_, n) => html`<option value="${n}" ${n === e.imovel.quartos ? html`selected` : ''}>${n}</option>`)}</select></label>
          <label>Banheiros<select data-imovel="banheiros">${Array.from({ length: 10 }, (_, i) => i + 1).map((n) => html`<option value="${n}" ${n === e.imovel.banheiros ? html`selected` : ''}>${n}</option>`)}</select></label>
        </div>
        <h2 class="subtitulo">O que precisa ser feito</h2>
        <div class="chips">${perfil.tarefas.map((t) => html`<label class="marcavel"><input type="checkbox" data-tarefa value="${t}" ${e.tarefas.includes(t) ? html`checked` : ''}><span>${t}</span></label>`)}</div>
        ${perfil.naoFaz ? html`<span class="mudo mini">${perfil.nome.split(' ')[0]} não faz: ${perfil.naoFaz}</span>` : ''}
        <h2 class="subtitulo">Produtos e equipamentos</h2>
        ${perfil.levaMateriais
          ? html`<div class="pilha-curta">${Object.entries(MATERIAIS).map(([k, r]) => html`<label class="aceite"><input type="radio" name="materiais" data-materiais value="${k}" ${k === e.materiais ? html`checked` : ''}><span>${r}</span></label>`)}</div>`
          : html`<p class="mudo pequeno">Por sua conta: produtos e equipamentos de limpeza.</p>`}
      </section>
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">Onde</h2>
        <strong class="pequeno">${dados.endereco}</strong>
        <span class="mudo mini">Endereço do seu cadastro.</span>
        <label>Instruções de acesso (opcional)<textarea data-instrucoes maxlength="${LIMITE_INSTRUCOES}" placeholder="Ex.: a chave fica na portaria, em nome de ${dados.nome.split(' ')[0]}.">${e.instrucoes}</textarea></label>
        <span class="mudo mini">A profissional só vê o endereço e as instruções depois de aceitar o pedido, e só até o fim do dia do atendimento.</span>
      </section>
      <label class="pilha-curta">Observações para a profissional
        <textarea data-obs maxlength="500" placeholder="Ex.: pode começar pela cozinha.">${e.observacoes}</textarea></label>
      <span class="mudo mini">As observações aparecem no pedido, antes do aceite. Não coloque aqui chave ou senha.</span>
      ${pelo ? html`
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">Valores</h2>
        <div class="entre"><span>Atendimento do pacote (preço travado na compra)</span><span>${moeda(v.totalCliente)}</span></div>
        <div class="entre total"><span>A pagar agora</span><span>${moeda(0)}</span></div>
        <p class="mudo mini">${perfil.nome.split(' ')[0]} recebe ${moeda(v.recebeDiarista)} quando o atendimento for concluído.</p>
      </section>` : html`
      <section class="cartao pilha-curta">
        <h2 class="subtitulo">Valores</h2>
        <div class="entre"><span>Serviço</span><span>${moeda(v.servico)}</span></div>
        <div class="entre"><span>Transporte</span><span>${moeda(v.transporte)}</span></div>
        <div class="entre"><span>Taxa DiaCerto</span><span>${moeda(v.taxaCliente)}</span></div>
        ${v.cupom ? html`<div class="entre desconto"><span>Cupom ${e.cupom}</span><span>${moeda(-v.cupom)}</span></div>` : ''}
        <hr>
        <div class="entre total"><span>Total</span><span>${moeda(v.totalCliente)}</span></div>
        <p class="mudo mini">${perfil.nome.split(' ')[0]} recebe ${moeda(v.recebeDiarista)} (serviço e transporte). A taxa paga pagamento seguro, suporte e reembolso de danos.</p>
        <div class="linha">
          <label class="cresce">Cupom<input data-cupom value="${e.cupomDigitado}" autocomplete="off"></label>
          <button type="button" class="btn pequeno-btn contorno" data-aplicar>${v.cupom ? 'Trocar' : 'Aplicar'}</button>
        </div>
        ${erro(erroCupom)}
      </section>
      <section class="pilha-curta">
        <h2 class="subtitulo">Forma de pagamento</h2>
        <div class="grade2">
          ${[['pix', 'Pix'], ['cartao', 'Cartão de crédito']].map(([m, r]) => html`<button type="button" class="opcao centro ${e.metodo === m ? html`ativa` : ''}" data-metodo="${m}" aria-pressed="${e.metodo === m}">${r}</button>`)}
        </div>
      </section>`}
      <section class="cartao suave pilha-curta">
        <strong class="pequeno">Antes de confirmar</strong>
        <span class="mudo mini">${textoCancelamento} Dá para remarcar uma vez, até 24h antes.</span>
        <span class="mudo mini">Danos materiais: reembolso de até R$ 500 por ocorrência, conforme a Política de Reembolso. Não há seguro contra furto.</span>
      </section>
      ${erro(e.erro)}
      <button type="button" class="btn fixo" data-enviar ${e.hora === null ? html`disabled` : ''}>${pelo ? 'Enviar pedido pelo pacote' : `Enviar pedido de ${moeda(v.totalCliente)}`}</button>`,
    ligar(raiz) {
      raiz.querySelectorAll('[data-data]').forEach((b) => b.addEventListener('click', () => { e.data = b.dataset.data; e.hora = null; ctx.redesenhar(); }));
      raiz.querySelector('[data-hora]')?.addEventListener('change', (ev) => { e.hora = Number(ev.target.value); });
      raiz.querySelector('[data-obs]').addEventListener('input', (ev) => { e.observacoes = ev.target.value; });
      raiz.querySelector('[data-instrucoes]').addEventListener('input', (ev) => { e.instrucoes = ev.target.value; });
      raiz.querySelectorAll('[data-imovel]').forEach((c) => c.addEventListener('change', () => {
        const campo = c.dataset.imovel;
        e.imovel[campo] = ['quartos', 'banheiros'].includes(campo) ? Number(c.value) : c.value;
      }));
      raiz.querySelectorAll('[data-tarefa]').forEach((c) => c.addEventListener('change', () => {
        e.tarefas = [...raiz.querySelectorAll('[data-tarefa]:checked')].map((x) => x.value);
      }));
      raiz.querySelectorAll('[data-materiais]').forEach((c) => c.addEventListener('change', () => { e.materiais = c.value; }));
      raiz.querySelector('[data-cupom]')?.addEventListener('input', (ev) => { e.cupomDigitado = ev.target.value; });
      raiz.querySelector('[data-aplicar]')?.addEventListener('click', () => { e.cupom = e.cupomDigitado.trim(); ctx.redesenhar(); });
      raiz.querySelectorAll('[data-metodo]').forEach((b) => b.addEventListener('click', () => { e.metodo = b.dataset.metodo; ctx.redesenhar(); }));
      raiz.querySelector('[data-enviar]').addEventListener('click', async () => {
        try {
          e.erro = '';
          e.enviado = await ctx.casos.solicitarReserva({
            clienteId: ctx.sessao.clienteId, diaristaId: id, data: e.data, horaInicio: e.hora, duracao,
            modalidade: sim.modalidade, metodo: e.metodo, observacoes: e.observacoes, codigoCupom: pelo ? undefined : (e.cupom || undefined),
            imovel: { ...e.imovel }, tarefas: e.tarefas, materiais: perfil.levaMateriais ? e.materiais : 'cliente', instrucoes: e.instrucoes,
          });
        } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
    },
  };
}

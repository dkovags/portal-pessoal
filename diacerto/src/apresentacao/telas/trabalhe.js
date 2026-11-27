import { html } from '../html.js';
import { cabecalho, erro } from '../componentes.js';
import { REGIOES_PILOTO } from '../../dominio/index.js';

export async function telaTrabalhe(ctx) {
  const e = ctx.estado('trabalhe', { nome: '', celular: '', regiao: REGIOES_PILOTO[0], erro: '', enviado: false });
  if (e.enviado) {
    return { html: html`
      ${cabecalho('Recebemos seu contato', '#/')}
      <section class="cartao pilha-curta">
        <strong>Obrigado pelo contato, ${e.nome.split(' ')[0]}!</strong>
        <p class="mudo pequeno">Vamos te chamar no WhatsApp para marcar o cadastro. Ele é feito junto com alguém da nossa equipe, por vídeo ou pessoalmente, e leva cerca de 30 minutos.</p>
      </section>
      <section class="cartao suave pilha-curta">
        <strong class="pequeno">Separe para o dia do cadastro</strong>
        <ul class="lista mudo pequeno">
          <li>Documento com foto.</li>
          <li>Certidões de antecedentes da Polícia Civil do DF e da Polícia Federal (são gratuitas e emitidas pela internet; ajudamos se precisar).</li>
          <li>Telefone de duas pessoas para quem você já trabalhou.</li>
        </ul>
      </section>
      <a class="btn contorno" href="#/">Voltar ao início</a>` };
  }
  return {
    html: html`
      ${cabecalho('Trabalhe com o DiaCerto', '#/')}
      <section class="pilha-curta">
        <p class="mudo">Você define seu preço, seus dias e seus horários, e aceita só os pedidos que quiser. Recebe pela plataforma depois de cada atendimento concluído.</p>
      </section>
      <section class="cartao suave pilha-curta">
        <strong class="pequeno">Como é o cadastro</strong>
        <ol class="passos">
          <li>Você deixa seu nome e WhatsApp aqui.</li>
          <li>A gente te chama e faz o cadastro junto com você.</li>
          <li>Depois da verificação, seu perfil aparece para os clientes.</li>
        </ol>
      </section>
      <form class="pilha-curta" data-contato>
        <label>Nome completo<input name="nome" autocomplete="name" value="${e.nome}" required></label>
        <label>WhatsApp com DDD<input name="celular" inputmode="tel" autocomplete="tel" placeholder="61 99999-9999" value="${e.celular}" required></label>
        <label>Onde você prefere trabalhar
          <select name="regiao">${REGIOES_PILOTO.map((r) => html`<option ${r === e.regiao ? html`selected` : ''}>${r}</option>`)}</select></label>
        <p class="mudo mini">Usamos esses dados só para falar com você sobre o cadastro.</p>
        ${erro(e.erro)}
        <button class="btn">Quero que me chamem</button>
      </form>`,
    ligar(raiz) {
      raiz.querySelector('[data-contato]').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const f = new FormData(ev.currentTarget);
        Object.assign(e, { nome: f.get('nome'), celular: f.get('celular'), regiao: f.get('regiao'), erro: '' });
        try { await ctx.casos.solicitarContato({ nome: e.nome, celular: e.celular, regiao: e.regiao }); e.enviado = true; } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
    },
  };
}

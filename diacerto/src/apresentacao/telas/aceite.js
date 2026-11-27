import { html } from '../html.js';
import { erro } from '../componentes.js';

/** Quem já tem acesso e ainda não aceitou a versão vigente dos documentos (RF14). */
export async function telaAceite(ctx) {
  const pendentes = ctx.info.aceitesPendentes;
  const e = ctx.estado('aceite', { marcados: {}, erro: '' });
  const primeiraVez = pendentes.length > 1;
  return {
    html: html`
      <header class="topo"><h1 class="titulo">${primeiraVez ? 'Antes de continuar' : 'Atualizamos um documento'}</h1></header>
      <p class="mudo">${primeiraVez
        ? 'Para usar o DiaCerto, leia e aceite os documentos abaixo. Eles explicam como funcionam as reservas, os pagamentos e o cuidado com os seus dados.'
        : 'Uma nova versão precisa do seu aceite. Reservas e pacotes já contratados mantêm as condições da época.'}</p>
      <form class="pilha-curta" data-aceites>
        ${pendentes.map((d) => html`
          <label class="aceite"><input type="checkbox" name="aceite" value="${d.documento}" ${e.marcados[d.documento] ? html`checked` : ''}>
            <span>Li e aceito: <a href="#/termos/${d.documento}?voltar=%23%2F">${d.titulo}</a></span></label>`)}
        ${erro(e.erro)}
        <button class="btn">Aceitar e continuar</button>
      </form>
      ${ctx.info.sair ? html`<button type="button" class="btn contorno-neutro" data-sair-conta>Sair</button>` : ''}`,
    ligar(raiz) {
      const form = raiz.querySelector('[data-aceites]');
      const ler = () => { e.marcados = Object.fromEntries(new FormData(form).getAll('aceite').map((id) => [id, true])); };
      form.addEventListener('change', ler);
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault(); ler(); e.erro = '';
        const aceites = Object.fromEntries(pendentes.filter((d) => e.marcados[d.documento]).map((d) => [d.documento, d.versao]));
        try {
          const restantes = await ctx.casos.registrarAceites({ email: ctx.info.email, papel: ctx.sessao.papel, aceites });
          return ctx.concluirAceite(restantes);
        } catch (falha) { e.erro = falha.message; }
        ctx.redesenhar();
      });
      raiz.querySelector('[data-sair-conta]')?.addEventListener('click', ctx.info.sair);
    },
  };
}

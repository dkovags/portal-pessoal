import { repasseVencido, liberarPorPrazo } from '../dominio/index.js';

// RF03: repasse à profissional. A captura leva uma chave de idempotência: o provedor real
// não paga duas vezes o mesmo repasse se duas chamadas chegarem juntas.

/** Captura o valor e paga a profissional pelo split do provedor. */
export async function pagarRepasse(dep, a) {
  await dep.pagamento.capturarComSplit({
    autorizacao: a.autorizacao, repasseDiarista: a.valores.recebeDiarista, motivo: `repasse:${a.id}`, idempotencia: `repasse:${a.id}`,
  });
}

/**
 * Libera os repasses cujo prazo de contestação terminou e devolve a lista atualizada.
 * Roda quando alguém consulta (painel da diarista, confirmações do cliente, telas da operação)
 * e também pode ser chamada pela operação.
 */
export async function comRepassesEmDia(dep, lista) {
  const agora = dep.relogio.agora();
  const saida = [];
  for (const a of lista) {
    if (!repasseVencido(a, agora)) { saida.push(a); continue; }
    const liberado = liberarPorPrazo(a, agora);
    await pagarRepasse(dep, a);
    await dep.atendimentos.salvar(liberado);
    saida.push(liberado);
  }
  return saida;
}

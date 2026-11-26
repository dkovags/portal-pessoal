// Serviços simulados: pagamento, notificação, relógio e gerador de ids.

/** @returns {import('../../aplicacao/portas.js').ServicoPagamento & {registro:any[]}} */
export function pagamentoSimulado() {
  const registro = [];
  let n = 0;
  return {
    registro,
    async autorizar(p) { const autorizacao = `sim-${++n}`; registro.push({ tipo: 'autorizacao', autorizacao, ...p }); return { autorizacao }; },
    async capturarComSplit(p) { registro.push({ tipo: 'captura', ...p }); },
    async estornar(p) { registro.push({ tipo: 'estorno', ...p }); },
  };
}

/** @returns {import('../../aplicacao/portas.js').Notificador & {enviadas:any[]}} */
export function notificadorSimulado() {
  const enviadas = [];
  return { enviadas, async enviar(m) { enviadas.push(m); } };
}

/** @param {Date} [fixo] @returns {import('../../aplicacao/portas.js').Relogio} */
export function relogio(fixo) {
  return { agora: () => (fixo ? new Date(fixo) : new Date()) };
}

/** @returns {import('../../aplicacao/portas.js').GeradorDeIds} */
export function geradorDeIds(prefixo = 'id') {
  let n = 0;
  return {
    novo: () => `${prefixo}-${Date.now().toString(36)}-${++n}`,
    codigo: () => String(Math.floor(1000 + Math.random() * 9000)),
  };
}

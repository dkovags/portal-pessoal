import {
  validarParametros, parteEditavel, aplicarParametros, RegraDeNegocioViolada, PARAMETROS_PADRAO,
} from '../dominio/index.js';

/**
 * Parâmetros comerciais com vigência (RF7): a operação altera, com motivo, e a mudança vale para
 * reservas e pacotes novos. O que já foi contratado guarda os próprios valores.
 * @param {{configuracao:import('./portas.js').RepositorioParametros, diaristas:import('./portas.js').RepositorioDiaristas,
 *   relogio:import('./portas.js').Relogio, parametros?:typeof PARAMETROS_PADRAO}} dep
 */
export function criarCasosDeParametros(dep) {
  const parametros = dep.parametros ?? PARAMETROS_PADRAO;
  return {
    /** Regras comerciais em vigor, para as telas mostrarem os valores certos (é público: sem quem alterou nem o motivo). */
    async parametrosVigentes() {
      const v = await dep.configuracao.vigente();
      return { valores: parteEditavel(parametros), janela: { ...parametros.janela }, limiteSemanal: parametros.limiteSemanalMesmoCliente,
        vigenteDesde: v?.vigenteDesde ?? null };
    },

    async historicoParametros() {
      const lista = await dep.configuracao.historico();
      return lista.map((v, i) => ({ ...v, mudancas: diferencas(lista[i + 1]?.valores ?? null, v.valores) }));
    },

    async alterarParametros({ valores, motivo, alteradoPor }) {
      const novos = validarParametros(valores);
      const m = String(motivo ?? '').trim();
      if (m.length < 10) throw new RegraDeNegocioViolada('MOTIVO', 'Explique o motivo da mudança (ao menos 10 caracteres). Ele fica no histórico.');
      if (diferencas(parteEditavel(parametros), novos).length === 0) throw new RegraDeNegocioViolada('SEM_MUDANCA', 'Nenhum valor foi alterado.');
      const versao = { valores: novos, motivo: m.slice(0, 500), alteradoPor: String(alteradoPor ?? 'operacao'), vigenteDesde: dep.relogio.agora() };
      await dep.configuracao.salvar(versao);
      const completos = aplicarParametros(parametros, novos);
      const abaixoDoPiso = (await dep.diaristas.listar()).filter((d) => d.precos.diaria < completos.piso.diaria || d.precos.meiaDiaria < completos.piso.meiaDiaria)
        .map((d) => ({ id: d.id, nome: d.nome }));
      return { ...versao, abaixoDoPiso };
    },
  };
}

/** Lista legível do que mudou entre duas versões (só a parte editável). */
export function diferencas(antes, depois) {
  if (!antes) return [];
  const saida = [];
  for (const [grupo, campos] of Object.entries(depois)) {
    for (const [campo, valor] of Object.entries(campos)) {
      if (antes[grupo]?.[campo] !== valor) saida.push({ campo: `${grupo}.${campo}`, antes: antes[grupo]?.[campo] ?? null, depois: valor });
    }
  }
  return saida;
}

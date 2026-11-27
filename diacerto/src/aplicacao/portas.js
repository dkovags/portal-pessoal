// Portas da camada de aplicação: contratos que a infraestrutura implementa.
// Os casos de uso dependem só destes contratos, nunca de uma implementação.

/**
 * @typedef {object} Diarista
 * @property {string} id @property {string} nome @property {string} iniciais
 * @property {string[]} regioes @property {string[]} tarefas @property {string} naoFaz
 * @property {number} anosExperiencia
 * @property {{diaria:number, meiaDiaria:number, transporte:number, descontoPacote:number}} precos
 * @property {Record<string,{inicio:number, fim:number}>} disponibilidade chave = data AAAA-MM-DD
 * @property {{data:string, resultado:string}} verificacao
 * @property {{nota:number, texto:string, autor:string, mes:string}[]} avaliacoes
 */

/** @typedef {{id:string, nome:string, endereco:string, regiao:string, celular?:string|null, imovel?:any}} Cliente */
/**
 * @typedef {object} RepositorioAceites
 * @property {(email:string) => Promise<{documento:string, versao:string, aceitoEm:Date}[]>} listar
 * @property {(a:{email:string, documento:string, versao:string, aceitoEm:Date}) => Promise<void>} registrar
 */
/**
 * Endereço e instruções de acesso de cada atendimento (RF01), guardados à parte: só vão para a
 * profissional quando o caso de uso pede, depois do aceite.
 * @typedef {object} RepositorioLocais
 * @property {(atendimentoId:string) => Promise<{endereco:string, instrucoes:string}|null>} obter
 * @property {(atendimentoId:string, local:{endereco:string, instrucoes:string}) => Promise<void>} salvar
 */
/**
 * Versões dos parâmetros comerciais (só a parte editável), da mais recente para a mais antiga.
 * @typedef {object} RepositorioParametros
 * @property {() => Promise<{valores:any, motivo:string, alteradoPor:string, vigenteDesde:Date}|null>} vigente
 * @property {() => Promise<{valores:any, motivo:string, alteradoPor:string, vigenteDesde:Date}[]>} historico
 * @property {(v:{valores:any, motivo:string, alteradoPor:string, vigenteDesde:Date}) => Promise<void>} salvar
 */
/** @typedef {{email:string, papel:'operacao'|'cliente'|'diarista', clienteId:string|null, diaristaId:string|null}} Perfil */
/**
 * @typedef {object} RepositorioPerfis
 * @property {(email:string) => Promise<Perfil|null>} porEmail
 * @property {() => Promise<Perfil[]>} listar
 * @property {(p:Perfil) => Promise<void>} salvar
 * @property {(email:string) => Promise<void>} remover
 * @property {(idUsuario:string) => Promise<string|null>} [emailDoUsuario] só no servidor
 */

/**
 * @typedef {object} RepositorioDiaristas
 * @property {(filtro?:{regiao?:string}) => Promise<Diarista[]>} listar
 * @property {(id:string) => Promise<Diarista|null>} obter
 * @property {(d:Diarista) => Promise<void>} salvar
 * @property {(d:Diarista) => Promise<void>} criar
 */

/**
 * @typedef {object} Candidatura
 * @property {string} id @property {string} nome @property {string} celular
 * @property {'contato'|'em_cadastro'|'aprovada'|'reprovada'} status
 * @property {string[]} regioes @property {string[]} tarefas @property {string} naoFaz @property {number} anosExperiencia
 * @property {{diaria:number, meiaDiaria:number, transporte:number, descontoPacote:number}} precos
 * @property {{diasDaSemana:number[], inicio:number, fim:number}} agenda
 * @property {Record<string,{resultado:string, data:string|null}>} verificacao só resultado e data, nunca cópias
 * @property {string|null} aceiteConduta @property {string} motivoReprovacao @property {string|null} diaristaId
 * @property {Date|string} [criadaEm]
 * @property {string|null} [email] conta Google; na aprovação vira o acesso da diarista
 */
/**
 * @typedef {object} RepositorioCandidaturas
 * @property {() => Promise<Candidatura[]>} listar
 * @property {(id:string) => Promise<Candidatura|null>} obter
 * @property {(c:Candidatura) => Promise<void>} salvar
 */

/** @typedef {{obter:(id:string)=>Promise<Cliente|null>, listar:()=>Promise<Cliente[]>, criar:(c:Cliente)=>Promise<void>, salvar:(c:Cliente)=>Promise<void>}} RepositorioClientes */

/**
 * @typedef {object} RepositorioAtendimentos
 * @property {(a:import('../dominio/atendimento.js').Atendimento) => Promise<void>} salvar
 * @property {(id:string) => Promise<import('../dominio/atendimento.js').Atendimento|null>} obter
 * @property {(clienteId:string) => Promise<import('../dominio/atendimento.js').Atendimento[]>} listarPorCliente
 * @property {(diaristaId:string) => Promise<import('../dominio/atendimento.js').Atendimento[]>} listarPorDiarista
 * @property {() => Promise<import('../dominio/atendimento.js').Atendimento[]>} listarTodos
 */

/**
 * @typedef {object} RepositorioOcorrencias
 * @property {() => Promise<ReturnType<import('../dominio/ocorrencia.js').novaOcorrencia>[]>} listar
 * @property {(o:ReturnType<import('../dominio/ocorrencia.js').novaOcorrencia>) => Promise<void>} salvar
 */

/**
 * Pacote comprado (RF11). O saldo não é guardado: sai dos atendimentos ligados a ele (pacoteId).
 * @typedef {object} Pacote
 * @property {string} id @property {string} clienteId @property {string} diaristaId
 * @property {'diaria'|'meiaDiaria'} duracao @property {number} total quantidade de atendimentos
 * @property {ReturnType<import('../dominio/precificacao.js').calcularAtendimento>} unitario preço travado na compra
 * @property {number} totalPago @property {string} metodo @property {Date} compradoEm @property {Date} validade
 * @property {'ativo'|'encerrado'} status @property {string|null} autorizacao
 * @property {Date|null} encerradoEm @property {number} reembolso
 */
/**
 * @typedef {object} RepositorioPacotes
 * @property {(id:string) => Promise<Pacote|null>} obter
 * @property {(clienteId:string) => Promise<Pacote[]>} listarPorCliente
 * @property {(p:Pacote) => Promise<void>} salvar
 */

/**
 * @typedef {object} RepositorioAvaliacoes
 * @property {(atendimentoId:string) => Promise<{doCliente:any|null, daDiarista:any|null}>} doAtendimento
 * @property {(av:any, ctx:{clienteId:string, diaristaId:string, publica:any|null}) => Promise<void>} salvar
 *   a avaliação do cliente (publica) também passa a aparecer no perfil da profissional
 */

/** @typedef {{valor:(codigo:string, clienteId:string)=>Promise<number|null>}} ServicoCupons */

/**
 * Provedor de pagamento com split. O dinheiro nunca fica em conta da DiaCerto.
 * @typedef {object} ServicoPagamento
 * @property {(p:{atendimentoId:string, valor:number, metodo:string}) => Promise<{autorizacao:string}>} autorizar
 * @property {(p:{autorizacao:string, repasseDiarista:number, motivo?:string, idempotencia?:string}) => Promise<void>} capturarComSplit
 *   idempotencia: o provedor real não repete uma captura com a mesma chave
 * @property {(p:{autorizacao:string, valor:number, motivo?:string}) => Promise<void>} estornar
 */

/** @typedef {{enviar:(m:{para:string, canal:'whatsapp'|'email', texto:string})=>Promise<void>}} Notificador */
/** @typedef {{agora:()=>Date}} Relogio */
/** @typedef {{novo:()=>string, codigo:()=>string}} GeradorDeIds */

export {};

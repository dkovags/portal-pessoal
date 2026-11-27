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

/** @typedef {{id:string, nome:string, endereco:string, regiao:string}} Cliente */
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

/** @typedef {{obter:(id:string)=>Promise<Cliente|null>, listar:()=>Promise<Cliente[]>, criar:(c:Cliente)=>Promise<void>}} RepositorioClientes */

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
 * @typedef {object} Pacote
 * @property {string} id @property {string} clienteId @property {string} diaristaId
 * @property {number} total @property {number} usados @property {Date} validade
 */
/**
 * @typedef {object} RepositorioPacotes
 * @property {(clienteId:string, diaristaId:string) => Promise<Pacote|null>} obterAtivo
 * @property {(p:Pacote) => Promise<void>} salvar
 */

/** @typedef {{valor:(codigo:string, clienteId:string)=>Promise<number|null>}} ServicoCupons */

/**
 * Provedor de pagamento com split. O dinheiro nunca fica em conta da DiaCerto.
 * @typedef {object} ServicoPagamento
 * @property {(p:{atendimentoId:string, valor:number, metodo:string}) => Promise<{autorizacao:string}>} autorizar
 * @property {(p:{autorizacao:string, repasseDiarista:number}) => Promise<void>} capturarComSplit
 * @property {(p:{autorizacao:string, valor:number}) => Promise<void>} estornar
 */

/** @typedef {{enviar:(m:{para:string, canal:'whatsapp'|'email', texto:string})=>Promise<void>}} Notificador */
/** @typedef {{agora:()=>Date}} Relogio */
/** @typedef {{novo:()=>string, codigo:()=>string}} GeradorDeIds */

export {};

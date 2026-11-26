export class RegraDeNegocioViolada extends Error {
  /** @param {string} codigo @param {string} mensagem */
  constructor(codigo, mensagem) {
    super(mensagem);
    this.name = 'RegraDeNegocioViolada';
    this.codigo = codigo;
  }
}

import { RegraDeNegocioViolada } from './erros.js';

// Documentos que cada papel precisa aceitar (RF14). A versão muda quando o texto muda,
// e quem tem acesso aceita de novo no próximo login.
export const DOCUMENTOS_LEGAIS = Object.freeze({
  'termos-cliente': Object.freeze({ titulo: 'Termos de uso para clientes', versao: '2026-11-27' }),
  'termos-profissional': Object.freeze({ titulo: 'Termos de uso para profissionais', versao: '2026-11-27' }),
  privacidade: Object.freeze({ titulo: 'Política de privacidade', versao: '2026-11-27' }),
});

export const DOCUMENTOS_POR_PAPEL = Object.freeze({
  cliente: Object.freeze(['termos-cliente', 'privacidade']),
  diarista: Object.freeze(['termos-profissional', 'privacidade']),
  operacao: Object.freeze([]),
});

/** Documentos do papel ainda não aceitos na versão vigente. @param {{documento:string, versao:string}[]} aceites */
export function aceitesPendentes(papel, aceites) {
  return (DOCUMENTOS_POR_PAPEL[papel] ?? [])
    .filter((id) => !aceites.some((a) => a.documento === id && a.versao === DOCUMENTOS_LEGAIS[id].versao))
    .map((id) => ({ documento: id, titulo: DOCUMENTOS_LEGAIS[id].titulo, versao: DOCUMENTOS_LEGAIS[id].versao }));
}

/** Confere se a pessoa aceitou cada documento exigido, na versão vigente. @param {Record<string,string>} aceitos documento → versão */
export function validarAceites(papel, aceitos) {
  for (const id of DOCUMENTOS_POR_PAPEL[papel] ?? []) {
    if (aceitos?.[id] !== DOCUMENTOS_LEGAIS[id].versao) {
      throw new RegraDeNegocioViolada('ACEITE', `Leia e aceite: ${DOCUMENTOS_LEGAIS[id].titulo}.`);
    }
  }
  return (DOCUMENTOS_POR_PAPEL[papel] ?? []).map((id) => ({ documento: id, versao: DOCUMENTOS_LEGAIS[id].versao }));
}

// Template seguro: toda interpolação é escapada, exceto trechos já produzidos por html``.
const SEGURO = Symbol('html-seguro');

export function escapar(texto) {
  return String(texto).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function converter(valor) {
  if (valor === null || valor === undefined || valor === false) return '';
  if (Array.isArray(valor)) return valor.map(converter).join('');
  if (typeof valor === 'object' && valor[SEGURO]) return valor.conteudo;
  return escapar(valor);
}

export function html(partes, ...valores) {
  let saida = '';
  partes.forEach((parte, i) => { saida += parte + (i < valores.length ? converter(valores[i]) : ''); });
  return { [SEGURO]: true, conteudo: saida, toString() { return saida; } };
}

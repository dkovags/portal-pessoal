// Login Google pelo Neon Auth do projeto "diacerto". O token (JWT) vai em cada chamada à API.

export const CONFIG_SERVIDOR = Object.freeze({
  banco: 'https://ep-noisy-band-bcue15da.c-16.us-east-1.aws.neon.tech/neondb', // projeto Neon "diacerto" (us-east-1)
  api: 'https://br-silent-meadow-bc96vaxe-api.compute.c-16.us-east-1.aws.neon.tech', // função "api" (Neon Functions)
});

export async function conectarLogin(config = CONFIG_SERVIDOR) {
  let mod;
  try { mod = await import('https://esm.sh/@neon/neon-js@0.10.2'); } catch { mod = await import('https://esm.sh/@neondatabase/neon-js'); }
  const cliente = mod.createClient(config.banco);
  const aqui = location.origin + location.pathname;
  const sessaoAtual = async () => {
    try { const r = await cliente.auth.getSession(); return r?.data?.session ? r.data : null; } catch { return null; }
  };
  return {
    sessao: sessaoAtual,
    async token() { return (await sessaoAtual())?.session?.token ?? null; },
    async entrar() {
      const r = await cliente.auth.signIn.social({ provider: 'google', callbackURL: aqui });
      if (r?.error) throw r.error;
    },
    async sair() { await cliente.auth.signOut(); },
  };
}

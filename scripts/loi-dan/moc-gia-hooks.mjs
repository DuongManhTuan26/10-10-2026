const GIA_DB = new URL("./gia-db.mjs", import.meta.url).href;
const GIA_AI = new URL("./gia-ai.mjs", import.meta.url).href;

export async function resolve(specifier, context, next) {
  const r = await next(specifier, context);
  if (/\/server\/db\.(ts|js)$/.test(r.url)) return { url: GIA_DB, shortCircuit: true };
  if (/\/server\/services\/ai\.(ts|js)$/.test(r.url)) return { url: GIA_AI, shortCircuit: true };
  return r;
}

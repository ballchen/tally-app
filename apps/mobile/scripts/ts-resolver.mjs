import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * `packages/shared` is authored for bundlers, so its relative imports omit the
 * `.ts` extension that Node's ESM resolver insists on. Scripts that reuse
 * shared code register this hook (see register-ts-resolver.mjs) to fill it in.
 */
export async function resolve(specifier, context, next) {
  try {
    return await next(specifier, context);
  } catch (error) {
    if (!specifier.startsWith('.') && !specifier.startsWith('/')) throw error;
    const base = new URL(specifier, context.parentURL).href;
    for (const candidate of [`${base}.ts`, `${base}/index.ts`]) {
      if (existsSync(fileURLToPath(candidate))) return next(candidate, context);
    }
    throw error;
  }
}

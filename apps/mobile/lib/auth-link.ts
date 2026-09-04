import { supabase } from './supabase';

export type LinkSessionResult = { ok: true } | { ok: false; error: string };

/**
 * Supabase sends recovery/confirmation links either as PKCE (`?code=`) or as an
 * implicit grant whose tokens sit in the URL fragment; deep links can carry either.
 */
export async function establishSessionFromUrl(url: string): Promise<LinkSessionResult | null> {
  const params = new URLSearchParams();
  const [beforeHash, afterHash] = url.split('#');

  const queryStart = beforeHash.indexOf('?');
  if (queryStart >= 0) {
    new URLSearchParams(beforeHash.slice(queryStart + 1)).forEach((v, k) => params.set(k, v));
  }
  if (afterHash) {
    new URLSearchParams(afterHash).forEach((v, k) => params.set(k, v));
  }

  const errorDescription = params.get('error_description') ?? params.get('error');
  if (errorDescription) return { ok: false, error: errorDescription };

  const code = params.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    return error ? { ok: false, error: error.message } : { ok: true };
  }

  return null;
}

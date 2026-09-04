/** The leave/remove RPCs raise this text when the target member still has a non-zero net balance. */
const UNSETTLED_BALANCE = 'Balance must be settled';

/** Supabase rejects with a plain `{ message, code, ... }` object rather than an Error. */
export function errorMessage(error: unknown): string | undefined {
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error) {
    const { message } = error as { message: unknown };
    if (typeof message === 'string') return message;
  }
  return undefined;
}

export function isUnsettledBalanceError(error: unknown): boolean {
  return errorMessage(error)?.includes(UNSETTLED_BALANCE) ?? false;
}

import type { MutateOptions, UseMutationResult } from "@tanstack/react-query"

/**
 * Adds default callbacks to a shared (UI-free) mutation hook. The caller's own
 * `mutate(vars, { onSuccess })` options still run, after the defaults.
 */
export function withMutationCallbacks<TData, TError, TVars, TContext>(
  mutation: UseMutationResult<TData, TError, TVars, TContext>,
  defaults: MutateOptions<TData, TError, TVars, TContext>
): UseMutationResult<TData, TError, TVars, TContext> {
  type Options = MutateOptions<TData, TError, TVars, TContext>

  const merge = (options?: Options): Options => ({
    onSuccess: (...args) => {
      defaults.onSuccess?.(...args)
      options?.onSuccess?.(...args)
    },
    onError: (...args) => {
      defaults.onError?.(...args)
      options?.onError?.(...args)
    },
    onSettled: (...args) => {
      defaults.onSettled?.(...args)
      options?.onSettled?.(...args)
    },
  })

  // The public mutate/mutateAsync signatures are variadic tuples that only
  // narrow at the call site; they are (variables, options) at runtime.
  const baseMutate = mutation.mutate as (variables: TVars, options?: Options) => void
  const baseMutateAsync = mutation.mutateAsync as (
    variables: TVars,
    options?: Options
  ) => Promise<TData>

  return {
    ...mutation,
    mutate: ((variables: TVars, options?: Options) =>
      baseMutate(variables, merge(options))) as typeof mutation.mutate,
    mutateAsync: ((variables: TVars, options?: Options) =>
      baseMutateAsync(variables, merge(options))) as typeof mutation.mutateAsync,
  }
}

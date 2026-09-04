/**
 * Centralized auth error handling with graceful degradation
 * Provides user-friendly error messages for common auth failures
 */

import { SupabaseClient, User } from '@supabase/supabase-js'

export type AuthErrorType =
  | 'STORAGE_ACCESS'
  | 'SESSION_EXPIRED'
  | 'NOT_AUTHENTICATED'
  | 'AUTH_ERROR'
  | 'UNKNOWN'
  | null

export interface SafeGetUserResult {
  user: User | null
  error: Error | null
  errorType: AuthErrorType
}

/**
 * Safely get the current user with comprehensive error handling
 * Handles storage access errors common in PWA standalone mode
 */
export async function safeGetUser(supabase: SupabaseClient): Promise<SafeGetUserResult> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser()

    if (error) {
      // Storage access errors (PWA, service worker, strict privacy mode)
      if (error.message?.includes('storage') ||
          error.message?.includes('cookie') ||
          error.message?.includes('localStorage')) {
        return {
          user: null,
          error: new Error('Unable to access authentication storage. Please refresh the app.'),
          errorType: 'STORAGE_ACCESS'
        }
      }

      // Session errors (expired, invalid, missing)
      if (error.message?.includes('session') ||
          error.message?.includes('expired')) {
        return {
          user: null,
          error: new Error('Your session has expired. Please log in again.'),
          errorType: 'SESSION_EXPIRED'
        }
      }

      // Generic auth error
      return {
        user: null,
        error,
        errorType: 'AUTH_ERROR'
      }
    }

    // User successfully retrieved but is null
    if (!user) {
      return {
        user: null,
        error: new Error('Not authenticated'),
        errorType: 'NOT_AUTHENTICATED'
      }
    }

    // Success
    return { user, error: null, errorType: null }
  } catch (error) {
    // Unexpected exception
    return {
      user: null,
      error: error instanceof Error ? error : new Error('Unknown error'),
      errorType: 'UNKNOWN'
    }
  }
}

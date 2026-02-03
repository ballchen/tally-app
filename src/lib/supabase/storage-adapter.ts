/**
 * Custom storage adapter with graceful degradation for PWA compatibility
 * Fallback chain: cookies → localStorage → memory storage
 */

interface CookieOptions {
  maxAge?: number
  path?: string
  sameSite?: boolean | 'lax' | 'strict' | 'none'
  secure?: boolean
}

interface StorageItem {
  name: string
  value: string
  options?: CookieOptions
}

// Memory fallback storage (does not persist across sessions)
let memoryStorage: Map<string, StorageItem> = new Map()

export const customStorageAdapter = {
  getAll(): StorageItem[] {
    // Try 1: document.cookie
    try {
      if (typeof document !== 'undefined' && document.cookie) {
        const cookies = document.cookie.split(';').map(cookie => {
          const [name, ...rest] = cookie.trim().split('=')
          return {
            name: name.trim(),
            value: decodeURIComponent(rest.join('=')),
          }
        }).filter(c => c.name.startsWith('sb-'))

        if (cookies.length > 0) return cookies
      }
    } catch (e) {
      console.warn('Cookie access failed:', e)
    }

    // Try 2: localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const items: StorageItem[] = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key?.startsWith('sb-')) {
            const value = localStorage.getItem(key)
            if (value) items.push({ name: key, value })
          }
        }
        if (items.length > 0) return items
      }
    } catch (e) {
      console.warn('localStorage failed:', e)
    }

    // Fallback: memory storage
    return Array.from(memoryStorage.values())
  },

  setAll(items: StorageItem[]): void {
    let persistSuccess = false

    // Try cookies
    try {
      if (typeof document !== 'undefined') {
        items.forEach(({ name, value, options }) => {
          let cookie = `${name}=${encodeURIComponent(value)}`
          if (options?.maxAge) cookie += `; max-age=${options.maxAge}`
          if (options?.path) cookie += `; path=${options.path}`
          if (options?.sameSite) cookie += `; samesite=${options.sameSite}`
          if (options?.secure) cookie += `; secure`
          document.cookie = cookie
        })
        persistSuccess = true
      }
    } catch (e) {
      console.warn('Failed to set cookies:', e)
    }

    // Try localStorage
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        items.forEach(({ name, value }) => {
          localStorage.setItem(name, value)
        })
        persistSuccess = true
      }
    } catch (e) {
      console.warn('Failed to set localStorage:', e)
    }

    // Always update memory
    items.forEach(item => memoryStorage.set(item.name, item))

    if (!persistSuccess) {
      console.warn('Using memory storage only - session will not persist')
    }
  }
}

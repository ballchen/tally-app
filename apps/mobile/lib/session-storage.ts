import type { SupportedStorage } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as aesjs from 'aes-js';
import * as SecureStore from 'expo-secure-store';

// iOS may prewarm the app before the user unlocks the device; WHEN_UNLOCKED
// (the default) makes every keychain read fail during that launch.
const KEYCHAIN_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

const V2_PREFIX = 'v2:';

const toHex = (bytes: Uint8Array) => aesjs.utils.hex.fromBytes(bytes);
const fromHex = (hex: string) => aesjs.utils.hex.toBytes(hex);
const randomBytes = (length: number) => crypto.getRandomValues(new Uint8Array(length));

function decrypt(keyHex: string, counter: aesjs.Counter, cipherHex: string) {
  const cipher = new aesjs.ModeOfOperation.ctr(fromHex(keyHex), counter);
  return aesjs.utils.utf8.fromBytes(cipher.decrypt(fromHex(cipherHex)));
}

/**
 * SecureStore rejects values over 2048 bytes and a Supabase session exceeds that,
 * so the session ciphertext lives in AsyncStorage and only its AES-256 key is kept
 * in the keychain.
 *
 * The key is created once and never rotated: rewriting it on every save left a
 * window where the keychain and AsyncStorage disagreed if iOS suspended the app
 * mid-refresh. A random IV per write keeps CTR from reusing a keystream.
 *
 * `v1` ciphertext (no prefix, fixed counter, key under the bare storage key) is
 * still readable and is replaced by `v2` on the next token refresh.
 */
export class SessionStorage implements SupportedStorage {
  // auth-js refreshes without a lock, so concurrent first saves must share one key.
  private keys = new Map<string, Promise<string>>();

  private keyName(key: string) {
    return `${key}.aes`;
  }

  private loadOrCreateKey(key: string) {
    let pending = this.keys.get(key);
    if (!pending) {
      pending = (async () => {
        const existing = await SecureStore.getItemAsync(this.keyName(key), KEYCHAIN_OPTIONS);
        if (existing) return existing;
        const created = toHex(randomBytes(32));
        await SecureStore.setItemAsync(this.keyName(key), created, KEYCHAIN_OPTIONS);
        return created;
      })();
      pending.catch(() => this.keys.delete(key));
      this.keys.set(key, pending);
    }
    return pending;
  }

  async getItem(key: string) {
    const stored = await AsyncStorage.getItem(key);
    if (!stored) return null;

    // Never delete on failure: a locked keychain throws here too, and wiping the
    // session then is what signed TestFlight users out after a background launch.
    try {
      if (stored.startsWith(V2_PREFIX)) {
        const [ivHex, cipherHex] = stored.slice(V2_PREFIX.length).split(':');
        const keyHex = await SecureStore.getItemAsync(this.keyName(key), KEYCHAIN_OPTIONS);
        if (!keyHex || !ivHex || !cipherHex) return null;
        return decrypt(keyHex, new aesjs.Counter(fromHex(ivHex)), cipherHex);
      }

      const legacyKeyHex = await SecureStore.getItemAsync(key, KEYCHAIN_OPTIONS);
      if (!legacyKeyHex) return null;
      return decrypt(legacyKeyHex, new aesjs.Counter(1), stored);
    } catch {
      return null;
    }
  }

  async setItem(key: string, value: string) {
    const keyHex = await this.loadOrCreateKey(key);
    const iv = randomBytes(16);
    const cipher = new aesjs.ModeOfOperation.ctr(fromHex(keyHex), new aesjs.Counter(iv));
    const cipherHex = toHex(cipher.encrypt(aesjs.utils.utf8.toBytes(value)));

    await AsyncStorage.setItem(key, `${V2_PREFIX}${toHex(iv)}:${cipherHex}`);
    await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS).catch(() => {});
  }

  // The AES key outlives sign-out; deleting it would strand the cached copy in `keys`.
  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
    await SecureStore.deleteItemAsync(key, KEYCHAIN_OPTIONS).catch(() => {});
  }
}

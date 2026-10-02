import * as aesjs from 'aes-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const keychain = new Map<string, string>();
const asyncStorage = new Map<string, string>();
const keychainLocked = { value: false };

vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: vi.fn(async (key: string) => {
    if (keychainLocked.value) throw new Error('errSecInteractionNotAllowed');
    return keychain.get(key) ?? null;
  }),
  setItemAsync: vi.fn(async (key: string, value: string) => {
    keychain.set(key, value);
  }),
  deleteItemAsync: vi.fn(async (key: string) => {
    keychain.delete(key);
  }),
}));

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => asyncStorage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      asyncStorage.set(key, value);
    }),
    removeItem: vi.fn(async (key: string) => {
      asyncStorage.delete(key);
    }),
  },
}));

const { SessionStorage } = await import('./session-storage');
const SecureStore = await import('expo-secure-store');

const KEY = 'sb-ref-auth-token';
const SESSION = JSON.stringify({ access_token: 'a'.repeat(3000), refresh_token: 'r' });

function writeLegacy(value: string) {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32));
  const cipher = new aesjs.ModeOfOperation.ctr(keyBytes, new aesjs.Counter(1));
  keychain.set(KEY, aesjs.utils.hex.fromBytes(keyBytes));
  asyncStorage.set(KEY, aesjs.utils.hex.fromBytes(cipher.encrypt(aesjs.utils.utf8.toBytes(value))));
}

describe('SessionStorage', () => {
  beforeEach(() => {
    keychain.clear();
    asyncStorage.clear();
    keychainLocked.value = false;
    vi.clearAllMocks();
  });

  it('round-trips a session larger than the keychain limit', async () => {
    const storage = new SessionStorage();
    await storage.setItem(KEY, SESSION);
    expect(await new SessionStorage().getItem(KEY)).toBe(SESSION);
  });

  it('keeps the stored session when the keychain is locked', async () => {
    await new SessionStorage().setItem(KEY, SESSION);
    keychainLocked.value = true;

    expect(await new SessionStorage().getItem(KEY)).toBeNull();

    keychainLocked.value = false;
    expect(await new SessionStorage().getItem(KEY)).toBe(SESSION);
  });

  it('creates the key once and stores it readable after first unlock', async () => {
    const storage = new SessionStorage();
    await storage.setItem(KEY, SESSION);
    await storage.setItem(KEY, `${SESSION}!`);

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(`${KEY}.aes`, expect.any(String), {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
    expect(await storage.getItem(KEY)).toBe(`${SESSION}!`);
  });

  it('shares one key between concurrent first writes', async () => {
    const storage = new SessionStorage();
    await Promise.all([storage.setItem(KEY, 'first'), storage.setItem(KEY, 'second')]);

    expect(SecureStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(['first', 'second']).toContain(await new SessionStorage().getItem(KEY));
  });

  it('retries key creation after a locked-keychain failure', async () => {
    const storage = new SessionStorage();
    keychainLocked.value = true;
    await expect(storage.setItem(KEY, SESSION)).rejects.toThrow();

    keychainLocked.value = false;
    await storage.setItem(KEY, SESSION);
    expect(await new SessionStorage().getItem(KEY)).toBe(SESSION);
  });

  it('uses a fresh IV for every write', async () => {
    const storage = new SessionStorage();
    await storage.setItem(KEY, SESSION);
    const first = asyncStorage.get(KEY);
    await storage.setItem(KEY, SESSION);

    expect(asyncStorage.get(KEY)).not.toBe(first);
  });

  it('reads legacy v1 ciphertext and migrates it on the next write', async () => {
    writeLegacy(SESSION);
    const storage = new SessionStorage();

    expect(await storage.getItem(KEY)).toBe(SESSION);

    await storage.setItem(KEY, SESSION);
    expect(asyncStorage.get(KEY)?.startsWith('v2:')).toBe(true);
    expect(keychain.has(KEY)).toBe(false);
    expect(await new SessionStorage().getItem(KEY)).toBe(SESSION);
  });

  it('can sign in again after sign-out', async () => {
    const storage = new SessionStorage();
    await storage.setItem(KEY, SESSION);
    await storage.removeItem(KEY);
    expect(await storage.getItem(KEY)).toBeNull();

    await storage.setItem(KEY, 'next');
    expect(await new SessionStorage().getItem(KEY)).toBe('next');
  });
});

import { describe, expect, it } from 'vitest';

import { resolveExchangeRate } from './expense-rate';

const RATES = {
  USDTWD: { Exrate: 31.661, UTC: '' },
  USDJPY: { Exrate: 156.307, UTC: '' },
};

describe('resolveExchangeRate', () => {
  it('is 1 when the expense is already in the base currency', () => {
    expect(
      resolveExchangeRate({ currency: 'TWD', baseCurrency: 'TWD', rates: undefined }),
    ).toBe(1);
  });

  it('crosses through USD for a foreign currency', () => {
    const rate = resolveExchangeRate({ currency: 'JPY', baseCurrency: 'TWD', rates: RATES });
    expect(rate).toBeCloseTo(31.661 / 156.307, 6);
  });

  it('keeps the locked rate when editing without changing currency', () => {
    expect(
      resolveExchangeRate({
        currency: 'JPY',
        baseCurrency: 'TWD',
        rates: RATES,
        locked: { currency: 'JPY', rate: 0.25 },
      }),
    ).toBe(0.25);
  });

  it('re-quotes when the edit switches to another currency', () => {
    const rate = resolveExchangeRate({
      currency: 'JPY',
      baseCurrency: 'TWD',
      rates: RATES,
      locked: { currency: 'USD', rate: 32 },
    });
    expect(rate).toBeCloseTo(31.661 / 156.307, 6);
  });

  it('returns null when the rates are unavailable, so the caller blocks the save', () => {
    expect(
      resolveExchangeRate({ currency: 'JPY', baseCurrency: 'TWD', rates: undefined }),
    ).toBeNull();
  });

  it('returns null when the rate table is missing one leg', () => {
    expect(
      resolveExchangeRate({
        currency: 'JPY',
        baseCurrency: 'TWD',
        rates: { USDTWD: { Exrate: 31.661, UTC: '' } },
      }),
    ).toBeNull();
  });

  it('ignores a zero or missing locked rate', () => {
    expect(
      resolveExchangeRate({
        currency: 'JPY',
        baseCurrency: 'TWD',
        rates: undefined,
        locked: { currency: 'JPY', rate: 0 },
      }),
    ).toBeNull();
  });
});

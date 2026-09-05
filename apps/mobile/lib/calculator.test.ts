import { describe, expect, it } from 'vitest';

import { initialState, reduce, run, tokenFor, type CalculatorToken } from './calculator';

/** "1200+350*2=" → the token stream a user would tap. */
function keys(sequence: string): CalculatorToken[] {
  return [...sequence]
    .map((key) => tokenFor(key))
    .filter((token): token is CalculatorToken => token !== null);
}

describe('calculator', () => {
  it('starts at zero', () => {
    expect(initialState().display).toBe('0');
  });

  it('seeds an initial amount for editing', () => {
    expect(initialState(1234.5).display).toBe('1234.5');
  });

  it('applies × ÷ before + −', () => {
    const state = run(keys('1200+350×2='));
    expect(state.value).toBe(1900);
    expect(state.display).toBe('1900');
  });

  it('divides to a fractional result', () => {
    expect(run(keys('10÷4=')).value).toBe(2.5);
  });

  it('rounds binary float noise away', () => {
    expect(run(keys('0.1+0.2=')).display).toBe('0.3');
  });

  it('enters the error state on divide by zero', () => {
    const state = run(keys('5÷0='));
    expect(state.error).toBe(true);
    expect(state.value).toBe(0);
  });

  it('recovers from the error state on the next digit', () => {
    const state = run(keys('5÷0=7'));
    expect(state.error).toBe(false);
    expect(state.display).toBe('7');
  });

  it('ignores non-digit keys while in the error state', () => {
    expect(run(keys('5÷0=+')).error).toBe(true);
  });

  it('caps decimals at two places', () => {
    expect(run(keys('1.2345')).display).toBe('1.23');
  });

  it('accepts only one decimal point', () => {
    expect(run(keys('1.2.3')).display).toBe('1.23');
  });

  it('caps the integer part at ten digits', () => {
    expect(run(keys('123456789012')).display).toBe('1234567890');
  });

  it('backspaces one character at a time', () => {
    expect(run(keys('123⌫')).display).toBe('12');
    expect(run(keys('123⌫⌫')).display).toBe('1');
    expect(run(keys('123⌫⌫⌫')).display).toBe('0');
  });

  it('clears everything', () => {
    const state = run(keys('12+34C'));
    expect(state).toEqual(initialState());
  });

  it('replaces a trailing operator instead of stacking one', () => {
    const state = run(keys('12+×3='));
    expect(state.value).toBe(36);
  });

  it('starts a new calculation when a digit follows =', () => {
    expect(run(keys('2+3=7')).display).toBe('7');
  });

  it('continues from the result when an operator follows =', () => {
    expect(run(keys('2+3=×2=')).value).toBe(10);
  });

  it('shows the running expression above the display', () => {
    expect(run(keys('1200+350')).expression).toBe('1200 + 350');
    expect(run(keys('1200+350×2=')).expression).toBe('1200 + 350 × 2 =');
  });

  it('handles subtraction into a negative result', () => {
    expect(run(keys('3−10=')).value).toBe(-7);
  });

  it('treats a leading dot as zero point', () => {
    expect(reduce(initialState(), { kind: 'dot' }).display).toBe('0.');
  });
});

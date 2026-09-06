/**
 * Pure state machine behind the amount keypad. Kept free of React so the
 * arithmetic rules (precedence, decimal/digit caps, divide-by-zero) can be
 * tested exhaustively without rendering anything.
 */

export type Operator = '+' | '-' | '*' | '/';

export type CalculatorToken =
  | { kind: 'digit'; value: string }
  | { kind: 'dot' }
  | { kind: 'operator'; value: Operator }
  | { kind: 'equals' }
  | { kind: 'backspace' }
  | { kind: 'clear' };

export type CalculatorState = {
  /** Digits being typed right now, or the result after `=`. */
  display: string;
  /** The finished part of the expression, e.g. "1200 + 350 ×". */
  expression: string;
  /** Numeric value of `display`; 0 while in the error state. */
  value: number;
  error: boolean;
  /** Pending operands/operators awaiting evaluation. */
  operands: number[];
  operators: Operator[];
  /** The next digit starts a fresh number rather than appending. */
  replacing: boolean;
};

export const MAX_DECIMALS = 2;
export const MAX_INTEGER_DIGITS = 10;

const OPERATOR_GLYPH: Record<Operator, string> = {
  '+': '+',
  '-': '−',
  '*': '×',
  '/': '÷',
};

export const initialState = (initialValue?: number): CalculatorState => ({
  display: initialValue && initialValue > 0 ? trimNumber(initialValue) : '0',
  expression: '',
  value: initialValue && initialValue > 0 ? initialValue : 0,
  error: false,
  operands: [],
  operators: [],
  replacing: false,
});

/** Renders a computed number without exponent notation or trailing zeros. */
function trimNumber(n: number): string {
  const rounded = Number(n.toFixed(MAX_DECIMALS));
  if (!Number.isFinite(rounded)) return '0';
  return String(rounded);
}

function renderExpression(operands: number[], operators: Operator[], typed: string): string {
  const parts: string[] = [];
  operands.forEach((operand, index) => {
    parts.push(trimNumber(operand));
    if (operators[index]) parts.push(OPERATOR_GLYPH[operators[index]]);
  });
  if (typed) parts.push(typed);
  return parts.join(' ');
}

/**
 * Evaluates the flat operand/operator lists with × ÷ binding tighter than + −.
 * Returns null for division by zero so the caller can enter the error state.
 */
function evaluate(operands: number[], operators: Operator[]): number | null {
  const values = [operands[0]];
  const pending: Operator[] = [];

  for (let i = 0; i < operators.length; i += 1) {
    const op = operators[i];
    const next = operands[i + 1];
    if (op === '*' || op === '/') {
      const left = values[values.length - 1];
      if (op === '/' && next === 0) return null;
      values[values.length - 1] = op === '*' ? left * next : left / next;
    } else {
      pending.push(op);
      values.push(next);
    }
  }

  let total = values[0];
  for (let i = 0; i < pending.length; i += 1) {
    total = pending[i] === '+' ? total + values[i + 1] : total - values[i + 1];
  }
  return Number.isFinite(total) ? Number(total.toFixed(MAX_DECIMALS)) : null;
}

function withDisplay(state: CalculatorState, display: string): CalculatorState {
  return {
    ...state,
    display,
    value: Number(display) || 0,
    expression: renderExpression(state.operands, state.operators, display === '0' ? '' : display),
  };
}

function appendDigit(display: string, digit: string): string {
  if (display === '0') return digit;
  const [integer, decimal] = display.split('.');
  if (decimal !== undefined) {
    if (decimal.length >= MAX_DECIMALS) return display;
  } else if (integer.replace('-', '').length >= MAX_INTEGER_DIGITS) {
    return display;
  }
  return display + digit;
}

export function reduce(state: CalculatorState, token: CalculatorToken): CalculatorState {
  if (token.kind === 'clear') return initialState();

  // Any digit rescues the error state; other keys keep showing "Error".
  if (state.error) {
    return token.kind === 'digit' ? withDisplay(initialState(), token.value) : state;
  }

  switch (token.kind) {
    case 'digit': {
      const base = state.replacing ? '0' : state.display;
      const next = { ...state, replacing: false };
      return withDisplay(next, appendDigit(base, token.value));
    }

    case 'dot': {
      if (state.replacing) return withDisplay({ ...state, replacing: false }, '0.');
      if (state.display.includes('.')) return state;
      return withDisplay(state, `${state.display}.`);
    }

    case 'backspace': {
      if (state.replacing) return withDisplay({ ...state, replacing: false }, '0');
      const trimmed = state.display.slice(0, -1);
      return withDisplay(state, trimmed === '' || trimmed === '-' ? '0' : trimmed);
    }

    case 'operator': {
      // A trailing operator is replaced rather than stacked.
      if (state.replacing && state.operators.length === state.operands.length && state.operands.length > 0) {
        const operators = [...state.operators.slice(0, -1), token.value];
        return {
          ...state,
          operators,
          expression: renderExpression(state.operands, operators, ''),
        };
      }
      const operands = [...state.operands, Number(state.display) || 0];
      const operators = [...state.operators, token.value];
      return {
        ...state,
        operands,
        operators,
        replacing: true,
        expression: renderExpression(operands, operators, ''),
      };
    }

    case 'equals': {
      if (state.operators.length === 0) return { ...state, replacing: true };
      const operands = [...state.operands, Number(state.display) || 0];
      const result = evaluate(operands, state.operators);
      if (result === null) {
        return { ...initialState(), error: true, expression: renderExpression(operands, state.operators, '') };
      }
      return {
        display: trimNumber(result),
        expression: `${renderExpression(operands, state.operators, '')} =`,
        value: result,
        error: false,
        operands: [],
        operators: [],
        replacing: true,
      };
    }
  }
}

export function run(tokens: CalculatorToken[], initial?: number): CalculatorState {
  return tokens.reduce(reduce, initialState(initial));
}

/** Parses the keypad's label into a token; unknown labels are ignored by the caller. */
export function tokenFor(key: string): CalculatorToken | null {
  if (/^[0-9]$/.test(key)) return { kind: 'digit', value: key };
  if (key === '.') return { kind: 'dot' };
  if (key === '+') return { kind: 'operator', value: '+' };
  if (key === '−') return { kind: 'operator', value: '-' };
  if (key === '×') return { kind: 'operator', value: '*' };
  if (key === '÷') return { kind: 'operator', value: '/' };
  if (key === '=') return { kind: 'equals' };
  if (key === '⌫') return { kind: 'backspace' };
  if (key === 'C') return { kind: 'clear' };
  return null;
}

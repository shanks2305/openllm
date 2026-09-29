import type { ToolCall } from './types';

export type ToolContext = {
  now: () => Date;
  searchChats: (query: string) => { title: string; snippet: string }[];
  remember: (fact: string) => boolean;
};

type ToolDefinition = {
  name: string;
  description: string;
  parameters: string;
  run: (args: Record<string, unknown>, context: ToolContext) => string;
};

export const TOOL_CALL_OPEN = '<tool_call>';
export const TOOL_CALL_CLOSE = '</tool_call>';
export const MAX_TOOL_ROUNDS = 3;

// ---------------------------------------------------------------------------
// Calculator: a small recursive-descent parser, so nothing is ever eval'd.

const FUNCTIONS: Record<string, (x: number) => number> = {
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  round: Math.round,
  floor: Math.floor,
  ceil: Math.ceil,
  exp: Math.exp,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
};

const CONSTANTS: Record<string, number> = { pi: Math.PI, e: Math.E };

class Calculator {
  private pos = 0;
  private readonly src: string;

  constructor(source: string) {
    this.src = source
      .toLowerCase()
      .replace(/[×x](?=\s*[\d(.])/g, '*')
      .replace(/÷/g, '/')
      .replace(/−/g, '-')
      .replace(/\*\*/g, '^')
      .replace(/,(?=\d{3}\b)/g, '')
      .replace(/\s+/g, '');
  }

  evaluate(): number {
    const value = this.expression();

    if (this.pos < this.src.length) {
      throw new Error(`Unexpected "${this.src[this.pos]}"`);
    }

    return value;
  }

  private peek() {
    return this.src[this.pos];
  }

  private expression(): number {
    let value = this.term();

    while (this.peek() === '+' || this.peek() === '-') {
      const op = this.src[this.pos++];
      const right = this.term();
      value = op === '+' ? value + right : value - right;
    }

    return value;
  }

  private term(): number {
    let value = this.unary();

    while (true) {
      const next = this.peek();
      const implicit = next === '(' || /[a-z]/.test(next ?? '');

      if (next !== '*' && next !== '/' && next !== '%' && !implicit) {
        break;
      }

      const op = implicit ? '*' : this.src[this.pos++];
      const right = this.unary();

      if (op === '*') {
        value *= right;
      } else if (op === '/') {
        if (right === 0) {
          throw new Error('Division by zero');
        }
        value /= right;
      } else {
        value %= right;
      }
    }

    return value;
  }

  // Exponents bind tighter than a leading minus, so -3^2 is -9.
  private unary(): number {
    if (this.peek() === '-') {
      this.pos += 1;
      return -this.unary();
    }

    if (this.peek() === '+') {
      this.pos += 1;
      return this.unary();
    }

    return this.power();
  }

  private power(): number {
    const base = this.postfix(this.primary());

    if (this.peek() === '^') {
      this.pos += 1;
      return Math.pow(base, this.unary());
    }

    return base;
  }

  private postfix(value: number): number {
    let result = value;

    while (this.peek() === '!' || this.peek() === '%') {
      if (this.peek() === '%' && /[\d(.a-z]/.test(this.src[this.pos + 1] ?? '')) {
        break;
      }

      const op = this.src[this.pos++];

      if (op === '%') {
        result /= 100;
      } else {
        if (result < 0 || !Number.isInteger(result) || result > 170) {
          throw new Error('Factorial needs a whole number from 0 to 170');
        }

        let product = 1;
        for (let n = 2; n <= result; n += 1) {
          product *= n;
        }
        result = product;
      }
    }

    return result;
  }

  private primary(): number {
    const char = this.peek();

    if (char === '(') {
      this.pos += 1;
      const value = this.expression();

      if (this.peek() !== ')') {
        throw new Error('Missing )');
      }

      this.pos += 1;
      return value;
    }

    const number = /^(\d+\.?\d*|\.\d+)(e[+-]?\d+)?/.exec(this.src.slice(this.pos));

    if (number) {
      this.pos += number[0].length;
      return parseFloat(number[0]);
    }

    const word = /^[a-z][a-z0-9]*/.exec(this.src.slice(this.pos));

    if (word) {
      this.pos += word[0].length;
      const name = word[0];

      if (FUNCTIONS[name]) {
        return FUNCTIONS[name](this.primary());
      }

      if (CONSTANTS[name] !== undefined) {
        return CONSTANTS[name];
      }

      throw new Error(`Unknown name "${name}"`);
    }

    throw new Error(char ? `Unexpected "${char}"` : 'Expression ended early');
  }
}

export function calculate(expression: string): number {
  const value = new Calculator(expression).evaluate();

  if (!Number.isFinite(value)) {
    throw new Error('The result is not a finite number');
  }

  return value;
}

function formatNumber(value: number) {
  if (Number.isInteger(value) && Math.abs(value) < 1e15) {
    return String(value);
  }

  return String(Number(value.toPrecision(12)));
}

// ---------------------------------------------------------------------------
// Unit conversion.

const UNITS: Record<string, { kind: string; factor: number }> = {
  mm: { kind: 'length', factor: 0.001 },
  cm: { kind: 'length', factor: 0.01 },
  m: { kind: 'length', factor: 1 },
  km: { kind: 'length', factor: 1000 },
  in: { kind: 'length', factor: 0.0254 },
  inch: { kind: 'length', factor: 0.0254 },
  ft: { kind: 'length', factor: 0.3048 },
  foot: { kind: 'length', factor: 0.3048 },
  feet: { kind: 'length', factor: 0.3048 },
  yd: { kind: 'length', factor: 0.9144 },
  mi: { kind: 'length', factor: 1609.344 },
  mile: { kind: 'length', factor: 1609.344 },
  mg: { kind: 'mass', factor: 0.000001 },
  g: { kind: 'mass', factor: 0.001 },
  kg: { kind: 'mass', factor: 1 },
  t: { kind: 'mass', factor: 1000 },
  oz: { kind: 'mass', factor: 0.028349523125 },
  lb: { kind: 'mass', factor: 0.45359237 },
  ml: { kind: 'volume', factor: 0.001 },
  l: { kind: 'volume', factor: 1 },
  tsp: { kind: 'volume', factor: 0.00492892 },
  tbsp: { kind: 'volume', factor: 0.0147868 },
  cup: { kind: 'volume', factor: 0.236588 },
  floz: { kind: 'volume', factor: 0.0295735 },
  gal: { kind: 'volume', factor: 3.78541 },
  s: { kind: 'time', factor: 1 },
  min: { kind: 'time', factor: 60 },
  h: { kind: 'time', factor: 3600 },
  day: { kind: 'time', factor: 86400 },
  week: { kind: 'time', factor: 604800 },
  kmh: { kind: 'speed', factor: 1 / 3.6 },
  mph: { kind: 'speed', factor: 0.44704 },
  ms: { kind: 'speed', factor: 1 },
  knot: { kind: 'speed', factor: 0.514444 },
  b: { kind: 'data', factor: 1 },
  kb: { kind: 'data', factor: 1e3 },
  mb: { kind: 'data', factor: 1e6 },
  gb: { kind: 'data', factor: 1e9 },
  tb: { kind: 'data', factor: 1e12 },
};

const ALIASES: Record<string, string> = {
  meter: 'm', meters: 'm', metre: 'm', kilometer: 'km', kilometers: 'km',
  centimeter: 'cm', centimeters: 'cm', millimeter: 'mm', inches: 'inch',
  miles: 'mile', yard: 'yd', yards: 'yd', gram: 'g', grams: 'g',
  kilogram: 'kg', kilograms: 'kg', kgs: 'kg', pound: 'lb', pounds: 'lb',
  lbs: 'lb', ounce: 'oz', ounces: 'oz', liter: 'l', liters: 'l', litre: 'l',
  milliliter: 'ml', gallon: 'gal', gallons: 'gal', cups: 'cup',
  second: 's', seconds: 's', sec: 's', minute: 'min', minutes: 'min',
  hour: 'h', hours: 'h', hr: 'h', days: 'day', weeks: 'week',
  'km/h': 'kmh', kph: 'kmh', 'm/s': 'ms', knots: 'knot',
  celsius: 'c', '°c': 'c', fahrenheit: 'f', '°f': 'f', kelvin: 'k',
};

function unitKey(unit: string) {
  const key = unit.trim().toLowerCase().replace(/\s+/g, '');
  return ALIASES[key] ?? key;
}

function toCelsius(value: number, unit: string) {
  return unit === 'f' ? ((value - 32) * 5) / 9 : unit === 'k' ? value - 273.15 : value;
}

function fromCelsius(value: number, unit: string) {
  return unit === 'f' ? (value * 9) / 5 + 32 : unit === 'k' ? value + 273.15 : value;
}

export function convertUnits(value: number, from: string, to: string): number {
  const a = unitKey(from);
  const b = unitKey(to);
  const temps = ['c', 'f', 'k'];

  if (temps.includes(a) && temps.includes(b)) {
    return fromCelsius(toCelsius(value, a), b);
  }

  const source = UNITS[a];
  const target = UNITS[b];

  if (!source || !target) {
    throw new Error(`Unknown unit "${!source ? from : to}"`);
  }

  if (source.kind !== target.kind) {
    throw new Error(`Can't convert ${source.kind} to ${target.kind}`);
  }

  return (value * source.factor) / target.factor;
}

// ---------------------------------------------------------------------------

function stringArg(args: Record<string, unknown>, ...names: string[]) {
  for (const name of names) {
    const value = args[name];

    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }
  }

  return '';
}

export const TOOLS: ToolDefinition[] = [
  {
    name: 'calculator',
    description: 'Evaluate arithmetic exactly. Supports + - * / ^ %, parentheses, sqrt, log, ln, sin, cos, tan, abs, round, pi, e.',
    parameters: '{"expression": "string"}',
    run: args => {
      const expression = stringArg(args, 'expression', 'expr', 'input');

      if (!expression) {
        throw new Error('Missing "expression"');
      }

      return `${expression} = ${formatNumber(calculate(expression))}`;
    },
  },
  {
    name: 'current_datetime',
    description: "Get the user's current local date, time, weekday, and time zone.",
    parameters: '{}',
    run: (_args, context) => {
      const now = context.now();
      const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return `${now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })}, ${now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })} (${zone})`;
    },
  },
  {
    name: 'convert_units',
    description: 'Convert a value between units of length, mass, volume, time, speed, data size, or temperature (c, f, k).',
    parameters: '{"value": number, "from": "string", "to": "string"}',
    run: args => {
      const value = Number(args.value);
      const from = stringArg(args, 'from', 'from_unit');
      const to = stringArg(args, 'to', 'to_unit');

      if (!Number.isFinite(value) || !from || !to) {
        throw new Error('Needs "value", "from", and "to"');
      }

      return `${formatNumber(value)} ${from} = ${formatNumber(convertUnits(value, from, to))} ${to}`;
    },
  },
  {
    name: 'search_chats',
    description: "Search the user's earlier conversations on this device for a word or phrase.",
    parameters: '{"query": "string"}',
    run: (args, context) => {
      const query = stringArg(args, 'query', 'q', 'text');

      if (!query) {
        throw new Error('Missing "query"');
      }

      const hits = context.searchChats(query).slice(0, 3);

      if (hits.length === 0) {
        return `No earlier chats mention "${query}".`;
      }

      return hits
        .map(hit => `- ${hit.title}${hit.snippet ? `: ${hit.snippet}` : ''}`)
        .join('\n');
    },
  },
  {
    name: 'remember',
    description: 'Save a short fact about the user to memory so future chats know it. Use only when the user asks you to remember something.',
    parameters: '{"fact": "string"}',
    run: (args, context) => {
      const fact = stringArg(args, 'fact', 'text', 'memory');

      if (!fact) {
        throw new Error('Missing "fact"');
      }

      return context.remember(fact)
        ? `Saved to memory: ${fact}`
        : 'Not saved. It is already in memory, or memory is full or turned off.';
    },
  },
];

export function toolsPrompt() {
  const list = TOOLS.map(
    tool => `- ${tool.name}: ${tool.description} Arguments: ${tool.parameters}`,
  ).join('\n');

  return `You can use tools. To call one, reply with only this and nothing else:
${TOOL_CALL_OPEN}
{"name": "tool_name", "arguments": {...}}
${TOOL_CALL_CLOSE}
The result comes back in a <tool_response> message. Then answer the user normally. Use a tool only when it gives a better answer, such as exact math or today's date.

Tools:
${list}`;
}

export type ParsedToolCall = {
  // Text the model wrote before the call.
  before: string;
  raw: string;
  name: string;
  arguments: Record<string, unknown>;
};

function extractJson(text: string) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  return start >= 0 && end > start ? text.slice(start, end + 1) : null;
}

// The close tag is a stop sequence, so a finished call usually ends without it.
export function parseToolCall(text: string): ParsedToolCall | null {
  const open = text.indexOf(TOOL_CALL_OPEN);

  if (open < 0) {
    return null;
  }

  const afterOpen = text.slice(open + TOOL_CALL_OPEN.length);
  const close = afterOpen.indexOf(TOOL_CALL_CLOSE);
  const body = close >= 0 ? afterOpen.slice(0, close) : afterOpen;
  const json = extractJson(body);

  if (!json) {
    return null;
  }

  try {
    const parsed = JSON.parse(json);
    const name = typeof parsed?.name === 'string' ? parsed.name : null;

    if (!name) {
      return null;
    }

    let args = parsed.arguments ?? parsed.parameters ?? {};

    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
      } catch {
        args = { input: args };
      }
    }

    return {
      before: text.slice(0, open),
      raw: `${TOOL_CALL_OPEN}\n${json}\n${TOOL_CALL_CLOSE}`,
      name,
      arguments: args && typeof args === 'object' ? args : {},
    };
  } catch {
    return null;
  }
}

// While a call streams in, only the text before it is shown.
export function hideToolCall(text: string) {
  const open = text.indexOf(TOOL_CALL_OPEN);

  if (open >= 0) {
    return text.slice(0, open);
  }

  for (let length = TOOL_CALL_OPEN.length - 1; length > 0; length -= 1) {
    if (text.endsWith(TOOL_CALL_OPEN.slice(0, length))) {
      return text.slice(0, -length);
    }
  }

  return text;
}

export function runTool(
  call: Pick<ParsedToolCall, 'name' | 'arguments'>,
  context: ToolContext,
): ToolCall {
  const tool = TOOLS.find(item => item.name === call.name);
  let result: string;

  if (!tool) {
    result = `Error: there is no tool named "${call.name}". Available: ${TOOLS.map(
      item => item.name,
    ).join(', ')}.`;
  } else {
    try {
      result = tool.run(call.arguments, context);
    } catch (error) {
      result = `Error: ${error instanceof Error ? error.message : 'the tool failed'}`;
    }
  }

  return { name: call.name, arguments: call.arguments, result };
}

export function toolResponseTurn(call: ToolCall) {
  return `<tool_response>\n${JSON.stringify({ name: call.name, result: call.result })}\n</tool_response>`;
}

const SYMBOLS: Record<string, string> = {
  alpha: 'α',
  beta: 'β',
  gamma: 'γ',
  delta: 'δ',
  epsilon: 'ε',
  varepsilon: 'ε',
  zeta: 'ζ',
  eta: 'η',
  theta: 'θ',
  vartheta: 'ϑ',
  iota: 'ι',
  kappa: 'κ',
  lambda: 'λ',
  mu: 'μ',
  nu: 'ν',
  xi: 'ξ',
  pi: 'π',
  varpi: 'ϖ',
  rho: 'ρ',
  sigma: 'σ',
  tau: 'τ',
  upsilon: 'υ',
  phi: 'φ',
  varphi: 'φ',
  chi: 'χ',
  psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ',
  Delta: 'Δ',
  Theta: 'Θ',
  Lambda: 'Λ',
  Xi: 'Ξ',
  Pi: 'Π',
  Sigma: 'Σ',
  Upsilon: 'Υ',
  Phi: 'Φ',
  Psi: 'Ψ',
  Omega: 'Ω',
  times: '×',
  cdot: '·',
  div: '÷',
  pm: '±',
  mp: '∓',
  le: '≤',
  leq: '≤',
  ge: '≥',
  geq: '≥',
  ne: '≠',
  neq: '≠',
  approx: '≈',
  sim: '∼',
  simeq: '≃',
  cong: '≅',
  equiv: '≡',
  propto: '∝',
  ll: '≪',
  gg: '≫',
  infty: '∞',
  sum: '∑',
  prod: '∏',
  int: '∫',
  iint: '∬',
  oint: '∮',
  partial: '∂',
  nabla: '∇',
  to: '→',
  rightarrow: '→',
  leftarrow: '←',
  leftrightarrow: '↔',
  Rightarrow: '⇒',
  Leftarrow: '⇐',
  Leftrightarrow: '⇔',
  implies: '⇒',
  iff: '⇔',
  mapsto: '↦',
  uparrow: '↑',
  downarrow: '↓',
  in: '∈',
  notin: '∉',
  ni: '∋',
  subset: '⊂',
  subseteq: '⊆',
  supset: '⊃',
  supseteq: '⊇',
  cup: '∪',
  cap: '∩',
  setminus: '∖',
  emptyset: '∅',
  varnothing: '∅',
  forall: '∀',
  exists: '∃',
  neg: '¬',
  lnot: '¬',
  land: '∧',
  wedge: '∧',
  lor: '∨',
  vee: '∨',
  oplus: '⊕',
  otimes: '⊗',
  cdots: '⋯',
  ldots: '…',
  dots: '…',
  vdots: '⋮',
  ddots: '⋱',
  degree: '°',
  circ: '∘',
  angle: '∠',
  perp: '⊥',
  parallel: '∥',
  mid: '∣',
  prime: '′',
  hbar: 'ℏ',
  ell: 'ℓ',
  Re: 'ℜ',
  Im: 'ℑ',
  aleph: 'ℵ',
  langle: '⟨',
  rangle: '⟩',
  lfloor: '⌊',
  rfloor: '⌋',
  lceil: '⌈',
  rceil: '⌉',
  lvert: '|',
  rvert: '|',
  vert: '|',
  Vert: '‖',
  quad: '  ',
  qquad: '    ',
  star: '⋆',
  ast: '∗',
  bullet: '•',
  therefore: '∴',
  because: '∵',
};

const FUNCTIONS = new Set([
  'sin',
  'cos',
  'tan',
  'cot',
  'sec',
  'csc',
  'arcsin',
  'arccos',
  'arctan',
  'sinh',
  'cosh',
  'tanh',
  'log',
  'ln',
  'lg',
  'exp',
  'lim',
  'max',
  'min',
  'sup',
  'inf',
  'det',
  'gcd',
  'deg',
  'dim',
  'ker',
  'arg',
  'Pr',
]);

const TEXT_COMMANDS = new Set([
  'text',
  'textrm',
  'textbf',
  'textit',
  'mathrm',
  'mathbf',
  'mathit',
  'mathsf',
  'mathtt',
  'mathcal',
  'boldsymbol',
  'operatorname',
  'displaystyle',
  'textstyle',
]);

const SIZING = new Set([
  'left',
  'right',
  'big',
  'Big',
  'bigg',
  'Bigg',
  'bigl',
  'bigr',
  'Bigl',
  'Bigr',
  'biggl',
  'biggr',
]);

const DOUBLE_STRUCK: Record<string, string> = {
  R: 'ℝ',
  N: 'ℕ',
  Z: 'ℤ',
  Q: 'ℚ',
  C: 'ℂ',
  P: 'ℙ',
  E: '𝔼',
};

const ACCENTS: Record<string, string> = {
  hat: '\u0302',
  widehat: '\u0302',
  bar: '\u0304',
  overline: '\u0305',
  vec: '\u20D7',
  dot: '\u0307',
  ddot: '\u0308',
  tilde: '\u0303',
  widetilde: '\u0303',
};

const SUPERSCRIPT: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '+': '⁺',
  '-': '⁻',
  '−': '⁻',
  '=': '⁼',
  '(': '⁽',
  ')': '⁾',
  a: 'ᵃ',
  b: 'ᵇ',
  c: 'ᶜ',
  d: 'ᵈ',
  e: 'ᵉ',
  f: 'ᶠ',
  g: 'ᵍ',
  h: 'ʰ',
  i: 'ⁱ',
  j: 'ʲ',
  k: 'ᵏ',
  l: 'ˡ',
  m: 'ᵐ',
  n: 'ⁿ',
  o: 'ᵒ',
  p: 'ᵖ',
  r: 'ʳ',
  s: 'ˢ',
  t: 'ᵗ',
  u: 'ᵘ',
  v: 'ᵛ',
  w: 'ʷ',
  x: 'ˣ',
  y: 'ʸ',
  z: 'ᶻ',
  T: 'ᵀ',
  '′': '′',
  '∗': '*',
  '*': '*',
};

const SUBSCRIPT: Record<string, string> = {
  '0': '₀',
  '1': '₁',
  '2': '₂',
  '3': '₃',
  '4': '₄',
  '5': '₅',
  '6': '₆',
  '7': '₇',
  '8': '₈',
  '9': '₉',
  '+': '₊',
  '-': '₋',
  '−': '₋',
  '=': '₌',
  '(': '₍',
  ')': '₎',
  a: 'ₐ',
  e: 'ₑ',
  h: 'ₕ',
  i: 'ᵢ',
  j: 'ⱼ',
  k: 'ₖ',
  l: 'ₗ',
  m: 'ₘ',
  n: 'ₙ',
  o: 'ₒ',
  p: 'ₚ',
  r: 'ᵣ',
  s: 'ₛ',
  t: 'ₜ',
  u: 'ᵤ',
  v: 'ᵥ',
  x: 'ₓ',
};

class LatexReader {
  private pos = 0;

  constructor(private readonly source: string) {}

  read(): string {
    return this.sequence(false);
  }

  private sequence(inGroup: boolean): string {
    let out = '';

    while (this.pos < this.source.length) {
      const char = this.source[this.pos];

      if (char === '}') {
        this.pos += 1;

        if (inGroup) {
          return out;
        }

        continue;
      }

      if (char === '{') {
        this.pos += 1;
        out += this.sequence(true);
      } else if (char === '\\') {
        out += this.command();
      } else if (char === '^' || char === '_') {
        this.pos += 1;
        out += script(this.argument(), char === '^' ? SUPERSCRIPT : SUBSCRIPT, char);
      } else if (char === '&' || char === '~') {
        this.pos += 1;
        out += ' ';
      } else {
        this.pos += 1;
        out += char;
      }
    }

    return out;
  }

  private argument(): string {
    while (this.source[this.pos] === ' ') {
      this.pos += 1;
    }

    const char = this.source[this.pos];

    if (char === undefined) {
      return '';
    }

    if (char === '{') {
      this.pos += 1;
      return this.sequence(true);
    }

    if (char === '\\') {
      return this.command();
    }

    this.pos += 1;
    return char;
  }

  private optional(): string | null {
    if (this.source[this.pos] !== '[') {
      return null;
    }

    const end = this.source.indexOf(']', this.pos);

    if (end < 0) {
      return null;
    }

    const value = new LatexReader(this.source.slice(this.pos + 1, end)).read();
    this.pos = end + 1;
    return value;
  }

  private command(): string {
    this.pos += 1;
    const match = /^[a-zA-Z]+/.exec(this.source.slice(this.pos));

    if (!match) {
      const char = this.source[this.pos] ?? '';
      this.pos += 1;

      if (char === '\\') {
        return '\n';
      }

      if (char === ',' || char === ';' || char === ':' || char === ' ') {
        return ' ';
      }

      return char === '!' ? '' : char;
    }

    const name = match[0];
    this.pos += name.length;

    if (name === 'frac' || name === 'dfrac' || name === 'tfrac') {
      return fraction(this.argument(), this.argument());
    }

    if (name === 'binom') {
      return `C(${this.argument()}, ${this.argument()})`;
    }

    if (name === 'sqrt') {
      const index = this.optional();
      const body = this.argument();
      const root = index ? `${script(index, SUPERSCRIPT, '^')}√` : '√';
      return isSimple(body) ? `${root}${body}` : `${root}(${body})`;
    }

    if (name === 'mathbb') {
      const body = this.argument();
      return [...body].map(char => DOUBLE_STRUCK[char] ?? char).join('');
    }

    if (ACCENTS[name]) {
      const body = this.argument();
      return [...body].length === 1 ? `${body}${ACCENTS[name]}` : body;
    }

    if (TEXT_COMMANDS.has(name)) {
      return name === 'displaystyle' || name === 'textstyle'
        ? ''
        : this.argument();
    }

    if (name === 'begin' || name === 'end') {
      this.argument();
      return '';
    }

    if (SIZING.has(name)) {
      if (this.source[this.pos] === '.') {
        this.pos += 1;
      }

      return '';
    }

    if (SYMBOLS[name] !== undefined) {
      return SYMBOLS[name];
    }

    if (FUNCTIONS.has(name)) {
      return name;
    }

    return name;
  }
}

function isSimple(value: string) {
  return /^[A-Za-z0-9.′\u0370-\u03FF]+$/.test(value) && value.length <= 6;
}

function fraction(top: string, bottom: string) {
  const wrap = (value: string) => (isSimple(value) ? value : `(${value})`);
  return `${wrap(top)}/${wrap(bottom)}`;
}

function script(value: string, table: Record<string, string>, mark: string) {
  const chars = [...value];

  if (chars.length > 0 && chars.every(char => table[char] !== undefined)) {
    return chars.map(char => table[char]).join('');
  }

  return chars.length === 1 ? `${mark}${value}` : `${mark}(${value})`;
}

export function latexToUnicode(source: string): string {
  return new LatexReader(source.trim())
    .read()
    .replace(/[ \t]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .trim();
}

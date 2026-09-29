export type CodeToken = {
  type: 'plain' | 'keyword' | 'string' | 'comment' | 'number';
  text: string;
};

const HASH_COMMENT_LANGUAGES = new Set([
  'py',
  'python',
  'sh',
  'bash',
  'zsh',
  'shell',
  'rb',
  'ruby',
  'yaml',
  'yml',
  'toml',
  'r',
  'perl',
]);

const KEYWORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'def',
  'default',
  'del',
  'do',
  'elif',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'fn',
  'for',
  'from',
  'func',
  'function',
  'go',
  'if',
  'impl',
  'import',
  'in',
  'interface',
  'is',
  'lambda',
  'let',
  'match',
  'mut',
  'new',
  'nil',
  'None',
  'not',
  'null',
  'or',
  'and',
  'package',
  'pass',
  'private',
  'protected',
  'pub',
  'public',
  'raise',
  'return',
  'self',
  'static',
  'struct',
  'super',
  'switch',
  'this',
  'throw',
  'trait',
  'True',
  'False',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'use',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

function tokenPattern(hashComments: boolean) {
  const comment = hashComments
    ? String.raw`#[^\n]*`
    : String.raw`\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)`;
  const string = String.raw`"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|` + '`(?:\\\\.|[^`\\\\])*`?';
  const number = String.raw`\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b|\b0x[\da-f]+\b`;
  const word = String.raw`[A-Za-z_$][\w$]*`;
  return new RegExp(`(${comment})|(${string})|(${number})|(${word})`, 'gi');
}

export function highlightCode(code: string, language: string): CodeToken[] {
  const lang = language.trim().toLowerCase();

  if (!lang || lang === 'text' || lang === 'plaintext' || code.length > 20000) {
    return [{ type: 'plain', text: code }];
  }

  const tokens: CodeToken[] = [];
  const pattern = tokenPattern(HASH_COMMENT_LANGUAGES.has(lang));
  let cursor = 0;

  const push = (type: CodeToken['type'], text: string) => {
    const last = tokens[tokens.length - 1];

    if (last && last.type === type) {
      last.text += text;
    } else if (text) {
      tokens.push({ type, text });
    }
  };

  for (const match of code.matchAll(pattern)) {
    const start = match.index ?? 0;
    push('plain', code.slice(cursor, start));

    if (match[1]) {
      push('comment', match[1]);
    } else if (match[2]) {
      push('string', match[2]);
    } else if (match[3]) {
      push('number', match[3]);
    } else {
      push(KEYWORDS.has(match[4]) ? 'keyword' : 'plain', match[4]);
    }

    cursor = start + match[0].length;
  }

  push('plain', code.slice(cursor));
  return tokens;
}

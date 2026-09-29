import {
  artifactKind,
  extractArtifacts,
  previewHtml,
} from '../src/chat/artifacts';
import type { ChatMessage } from '../src/chat/types';

describe('artifacts', () => {
  const messages: ChatMessage[] = [
    { id: 'u', role: 'user', content: '```html\n<p>not mine</p>\n```' },
    {
      id: 'a1',
      role: 'assistant',
      content:
        '<think>```js\nhidden()\n```</think>Here:\n```html\n<html><head><title>Clock</title></head><body>hi</body></html>\n```\nand `x`\n```js\nconst a = 1;\n```\n```python\na = 1\nb = 2\nprint(a + b)\n```',
    },
    {
      id: 'a2',
      role: 'assistant',
      content: '```svg\n<svg viewBox="0 0 10 10"><circle r="4"/></svg>\n```',
    },
  ];

  it('collects previewable and longer code blocks from replies only', () => {
    const found = extractArtifacts(messages);
    expect(found.map(item => [item.id, item.kind, item.title])).toEqual([
      ['a1:0', 'html', 'Clock'],
      ['a1:2', 'code', 'Python'],
      ['a2:0', 'svg', 'SVG image'],
    ]);
  });

  it('detects HTML and SVG without a language tag', () => {
    expect(artifactKind('', '<!DOCTYPE html><html></html>')).toBe('html');
    expect(artifactKind('xml', '<svg></svg>')).toBe('svg');
    expect(artifactKind('ts', 'const a = 1')).toBe('code');
  });

  it('puts the offline CSP ahead of page content', () => {
    const withHead = previewHtml({
      kind: 'html',
      code: '<html><head><script src="https://x.test/a.js"></script></head></html>',
    });
    expect(withHead.indexOf('Content-Security-Policy')).toBeLessThan(
      withHead.indexOf('<script'),
    );
    expect(withHead).toContain("default-src 'none'");

    const fragment = previewHtml({ kind: 'html', code: '<p>hi</p>' });
    expect(fragment).toMatch(/^<!doctype html><html><head><meta charset/);
    expect(previewHtml({ kind: 'svg', code: '<svg/>' })).toContain('<body><svg/>');
  });
});

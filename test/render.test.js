// @ts-check
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyConditions, applyPlaceholders, evaluate, pruneLinks } from '../src/render.js';

const F = new Set(['ios', 'design', 'mobile']);

test('evaluate supports OR, AND and NOT', () => {
  assert.equal(evaluate('android,ios', F), true);
  assert.equal(evaluate('design+mobile', F), true);
  assert.equal(evaluate('design+web', F), false);
  assert.equal(evaluate('!web', F), true);
});

test('block and line markers keep or drop content and leave no marker text', () => {
  const src = ['a', '<!-- if:web -->', 'web only', '<!-- endif -->', '| row | <!-- if:ios -->', '| gone | <!-- if:android -->', '.env # if:design', 'b'].join('\n');
  assert.equal(applyConditions(src, F), ['a', '| row |', '.env', 'b'].join('\n'));
});

test('nested blocks and unbalanced markers', () => {
  assert.equal(applyConditions('<!-- if:ios -->\n<!-- if:web -->\nx\n<!-- endif -->\ny\n<!-- endif -->', F), 'y');
  assert.throws(() => applyConditions('<!-- if:ios -->\nx', F));
  assert.throws(() => applyConditions('x\n<!-- endif -->', F));
});

test('placeholders', () => {
  const names = { name: '我的应用', pascal: 'MyApp', slug: 'my-app', prefix: 'MY_APP' };
  assert.equal(applyPlaceholders('<项目名> <Project> <project> <PROJECT>_ENV <其他>', names), '我的应用 MyApp my-app MY_APP_ENV <其他>');
});

test('pruneLinks drops links to missing documents only', () => {
  const text = '[a](design/x.md) [b](missing.md#h) [c](https://e.com) [d](#local) [e](../root.md)';
  const exists = (/** @type {string} */ t) => ['docs/design/x.md', 'root.md'].includes(t);
  assert.equal(pruneLinks(text, 'docs/guide.md', exists), '[a](design/x.md) b [c](https://e.com) [d](#local) [e](../root.md)');
});

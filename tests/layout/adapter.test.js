import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { emptySession, DEFAULT_OPTIONS } from '../../src/layout/adapter.js';

describe('emptySession', () => {
  test('initial state', () => {
    const s = emptySession();
    assert.ok(s.positions instanceof Map);
    assert.ok(s.containers instanceof Map);
    assert.deepEqual(s.bounds, { x: 0, y: 0, width: 0, height: 0 });
    assert.equal(s.stopped, false);
  });

  test('on/emit + unsubscribe', () => {
    const s = emptySession();
    let count = 0;
    const off = s.on('tick', () => count++);
    s.emit('tick');
    s.emit('tick');
    off();
    s.emit('tick');
    assert.equal(count, 2);
  });

  test('stop flag', () => {
    const s = emptySession();
    s.stop();
    assert.equal(s.stopped, true);
  });
});

describe('DEFAULT_OPTIONS', () => {
  test('is an empty defaults object', () => {
    assert.deepEqual(DEFAULT_OPTIONS, {});
  });
});

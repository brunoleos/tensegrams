// Andaime do solver físico: shape dos factories de corpo e utilities
// puras (converged, tickCooldown). Comportamento end-to-end do
// runPhysicsRouter vive em phase2.test.js (e seguintes).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  makeSegmentBody, makeCornerBody, makePointBody, clearForces, getSegmentC, getSegmentBounds,
} from '../../../src/routing/physics/bodies.js';
import { converged } from '../../../src/routing/physics/solver.js';
import { tickCooldown } from '../../../src/routing/physics/topology.js';

describe('physics scaffold — factories + utilities', () => {
  test('makeSegmentBody devolve shape derivada dos corners (sem DOF próprio)', () => {
    const prevCorner = makeCornerBody({ id: 'a', x: 0, y: 10 });
    const nextCorner = makeCornerBody({ id: 'b', x: 100, y: 10 });
    const seg = makeSegmentBody({
      id: 's1', orientation: 'h', pad: 3, prevCorner, nextCorner,
    });
    assert.equal(seg.kind, 'segment');
    assert.equal(seg.orientation, 'h');
    assert.equal(seg.pad, 3);
    assert.equal(seg.prevCorner, prevCorner);
    assert.equal(seg.nextCorner, nextCorner);
    // Geometria derivada dos corners.
    assert.equal(getSegmentC(seg), 10);
    const [x0, x1] = getSegmentBounds(seg);
    assert.equal(x0, 0);
    assert.equal(x1, 100);
  });

  test('makeCornerBody devolve 2D pinnable', () => {
    const c = makeCornerBody({ id: 'c1', x: 5, y: 7, pinned: true, anchorOf: 'e1' });
    assert.equal(c.kind, 'corner');
    assert.equal(c.x, 5);
    assert.equal(c.y, 7);
    assert.equal(c.pinned, true);
    assert.equal(c.anchorOf, 'e1');
  });

  test('makePointBody tem raio de cobertura default', () => {
    const p = makePointBody({ id: 'p1', x: 0, y: 0 });
    assert.equal(p.kind, 'point');
    assert.equal(p.radius, 12);
  });

  test('clearForces zera acumuladores de corners/points; no-op para segments', () => {
    const seg = makeSegmentBody({
      id: 's1', orientation: 'h', pad: 2,
      prevCorner: makeCornerBody({ id: 'a', x: 0, y: 0 }),
      nextCorner: makeCornerBody({ id: 'b', x: 1, y: 0 }),
    });
    // Segmento não tem fc/fy próprio — clearForces é no-op.
    clearForces(seg);  // não deve crashar nem alterar estado

    const c = makeCornerBody({ id: 'c1', x: 0, y: 0 });
    c.fx = 1; c.fy = 2;
    clearForces(c);
    assert.equal(c.fx, 0);
    assert.equal(c.fy, 0);
  });

  test('converged é true em world vazio', () => {
    assert.equal(converged({ bodies: [] }), true);
  });

  test('tickCooldown decrementa até zero', () => {
    const b = makeSegmentBody({
      id: 's', orientation: 'h', pad: 2,
      prevCorner: makeCornerBody({ id: 'a', x: 0, y: 0 }),
      nextCorner: makeCornerBody({ id: 'b', x: 1, y: 0 }),
    });
    b.topologyCooldown = 2;
    tickCooldown(b); tickCooldown(b); tickCooldown(b);
    assert.equal(b.topologyCooldown, 0);
  });
});

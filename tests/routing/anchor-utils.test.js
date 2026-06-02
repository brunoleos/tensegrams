import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { faceOf, rebuildManhattanWaypoints, enforcePerpendicularLegs, rebuildWithFaces, simplifyCollinear, simplifyStairsAndExcursions } from '../../src/routing/anchor-utils.js';

const RECT_A = { x: 60, y: 80, width: 80, height: 40 };   // x∈[60,140], y∈[80,120]
const RECT_B = { x: 320, y: 120, width: 80, height: 40 }; // x∈[320,400], y∈[120,160]

describe('faceOf', () => {
  test('east face: point on right edge', () => {
    assert.equal(faceOf({ x: 140, y: 100 }, RECT_A), 'east');
  });
  test('west face: point on left edge', () => {
    assert.equal(faceOf({ x: 60, y: 100 }, RECT_A), 'west');
  });
  test('north face: point on top edge', () => {
    assert.equal(faceOf({ x: 100, y: 80 }, RECT_A), 'north');
  });
  test('south face: point on bottom edge', () => {
    assert.equal(faceOf({ x: 100, y: 120 }, RECT_A), 'south');
  });
});

describe('rebuildManhattanWaypoints', () => {
  test('4-point Z is rebuilt with dominant-axis (horizontal)', () => {
    const points = [{x:140,y:100}, {x:230,y:100}, {x:230,y:140}, {x:320,y:140}];
    const out = rebuildManhattanWaypoints(points, undefined);
    assert.equal(out.length, 4);
    assert.deepEqual(out[1], { x: 230, y: 100 });
    assert.deepEqual(out[2], { x: 230, y: 140 });
  });

  test('kind === "curve" is left intact', () => {
    const points = [{x:0,y:0}, {x:50,y:50}, {x:80,y:30}, {x:100,y:0}];
    assert.equal(rebuildManhattanWaypoints(points, 'curve'), points);
  });

  test('kind === "spline" is left intact (obstacle-routed curve)', () => {
    const points = [{x:0,y:0}, {x:30,y:20}, {x:60,y:40}, {x:90,y:20}, {x:120,y:0}];
    assert.equal(rebuildManhattanWaypoints(points, 'spline'), points);
  });

  test('length > 4 is left intact (preserves obstacle detour)', () => {
    const points = [{x:0,y:0}, {x:50,y:0}, {x:50,y:50}, {x:100,y:50}, {x:100,y:100}];
    assert.equal(rebuildManhattanWaypoints(points, undefined), points);
  });

  test('length < 3 is left intact (straight 2-point line)', () => {
    const points = [{x:0,y:0}, {x:100,y:0}];
    assert.equal(rebuildManhattanWaypoints(points, undefined), points);
  });
});

describe('enforcePerpendicularLegs', () => {
  test('east face + horizontal first leg → unchanged (already perpendicular)', () => {
    // Both sides already perpendicular: source east (horizontal leg),
    // target west (horizontal leg). 4-point Z.
    const pts = [{x:140,y:100}, {x:230,y:100}, {x:230,y:140}, {x:320,y:140}];
    const out = enforcePerpendicularLegs(pts, undefined, RECT_A, RECT_B);
    assert.equal(out.length, 4);
    assert.deepEqual(out[1], { x: 230, y: 100 });
    assert.deepEqual(out[2], { x: 230, y: 140 });
  });

  test('south face anchor + horizontal-first L → swap to vertical-first L', () => {
    // Anchor (100, 120) on SOUTH face of RECT_A. Manhattanize built a
    // "horizontal-first" L (corner at (200, 120) on the same y as anchor).
    // First leg is tangent to south → not perpendicular. enforcePerpendicularLegs
    // swaps the corner to (100, 200) so first leg becomes vertical.
    const pts = [{x:100,y:120}, {x:200,y:120}, {x:200,y:200}];
    const out = enforcePerpendicularLegs(pts, undefined, RECT_A, null);
    assert.equal(out.length, 3, 'length preserved (corner replaced, not inserted)');
    assert.deepEqual(out[0], { x: 100, y: 120 });
    assert.deepEqual(out[1], { x: 100, y: 200 }, 'corner now on vertical leg from anchor');
    assert.deepEqual(out[2], { x: 200, y: 200 });
  });

  test('east face anchor + vertical-first L → swap to horizontal-first L', () => {
    // Anchor (140, 100) east face. Manhattan built corner at (140, 200) —
    // vertical first leg, not perpendicular. Swap to horizontal.
    const pts = [{x:140,y:100}, {x:140,y:200}, {x:230,y:200}];
    const out = enforcePerpendicularLegs(pts, undefined, RECT_A, null);
    assert.equal(out.length, 3);
    assert.deepEqual(out[1], { x: 230, y: 100 }, 'corner now on horizontal leg from anchor');
  });

  test('target side: north face anchor with tangent last leg → swap', () => {
    // Anchor (360, 120) NORTH face of RECT_B. Last leg horizontal — but
    // north needs vertical. Corner swaps so last leg becomes vertical.
    const pts = [{x:140,y:100}, {x:260,y:80}, {x:360,y:80}, {x:360,y:120}];
    // Wait — last leg here IS vertical (360,80)→(360,120). Let me change to tangent case:
    const pts2 = [{x:140,y:100}, {x:260,y:120}, {x:360,y:120}];
    const out = enforcePerpendicularLegs(pts2, undefined, null, RECT_B);
    // Last leg (260,120)→(360,120) horizontal. North face needs vertical.
    // Corner at out[1] swaps: target=out[0]=(140,100). swappedCorner((360,120), (140,100), 'north')
    //   = {x:360, y:100}.
    assert.deepEqual(out[1], { x: 360, y: 100 });
    assert.deepEqual(out[out.length - 1], { x: 360, y: 120 });
  });

  test('5-point polyline: preserves interior, only fixes first/last L', () => {
    // Source south face (100, 120). Path goes through 3 obstacle detour
    // waypoints. Only the corner adjacent to anchor changes.
    const pts = [
      {x:100,y:120}, {x:200,y:120}, {x:200,y:200}, {x:300,y:200}, {x:300,y:180}
    ];
    const out = enforcePerpendicularLegs(pts, undefined, RECT_A, null);
    assert.equal(out.length, 5, 'length preserved');
    // Source side: out[1] swaps. target = out[2] = (200, 200). face south →
    // corner = (anchor.x=100, target.y=200) = (100, 200).
    assert.deepEqual(out[1], { x: 100, y: 200 });
    // Interior preserved.
    assert.deepEqual(out[2], { x: 200, y: 200 });
    assert.deepEqual(out[3], { x: 300, y: 200 });
    assert.deepEqual(out[4], { x: 300, y: 180 });
  });

  test('kind === "curve" is left intact', () => {
    const pts = [{x:0,y:0}, {x:50,y:50}, {x:100,y:50}, {x:150,y:0}];
    assert.equal(enforcePerpendicularLegs(pts, 'curve', RECT_A, RECT_B), pts);
  });

  test('rects missing → skip side', () => {
    const pts = [{x:100,y:120}, {x:200,y:120}, {x:200,y:200}];
    const out = enforcePerpendicularLegs(pts, undefined, undefined, undefined);
    assert.deepEqual(out, pts);
  });

  // ----- Regressions for B6 (global rebuild via rebuildWithFaces) -----

  test('B6.a: faces east/west + gap horizontal pequeno → midX entre os anchors, sem tangente', () => {
    // A.east at x=100 face, B.west at x=120 face — gap of 20px.
    // Dominant-axis heuristic (old) picked the vertical midline because
    // |dy| > |dx|, giving a Z whose first leg was vertical from the
    // east face → tangent (the B6 bug observed in the `requests` edge).
    // Global rebuild now puts midX at 110 (midway between 100 and 120),
    // making both first and last legs horizontal — perpendicular to
    // east/west.
    const sR = { x: 80,  y: 40,  width: 20, height: 60 };  // east at x=100
    const tR = { x: 120, y: 180, width: 20, height: 60 };  // west at x=120
    const pts = [{x:100,y:70}, {x:100,y:125}, {x:120,y:125}, {x:120,y:210}]; // old buggy Z
    const out = enforcePerpendicularLegs(pts, undefined, sR, tR);
    assert.equal(out.length, 4);
    assert.deepEqual(out[0], { x: 100, y: 70 });
    assert.deepEqual(out[3], { x: 120, y: 210 });
    // First leg horizontal (perpendicular to east face at x=100).
    assert.equal(out[1].y, out[0].y, `first leg should be horizontal; got (${out[0].x},${out[0].y})→(${out[1].x},${out[1].y})`);
    // Last leg horizontal (perpendicular to west face at x=120).
    assert.equal(out[2].y, out[3].y, `last leg should be horizontal; got (${out[2].x},${out[2].y})→(${out[3].x},${out[3].y})`);
    // Midline strictly between the two anchors.
    assert.equal(out[1].x, out[2].x, 'midline shared x');
    assert.ok(out[1].x > 100 && out[1].x < 120, `midX=${out[1].x} should be strictly between 100 and 120`);
  });

  test('B6.b: faces east/west + gap horizontal negativo (target à esquerda) → Z válido', () => {
    // Source A on east, target B on west, but B sits to the LEFT of A
    // (negative gap). Old code would still pick vertical dominant axis
    // for tall gap, same tangent bug. New rebuild puts midX between the
    // two anchor x-coords — still produces horizontal first/last legs.
    const sR = { x: 200, y: 40,  width: 40, height: 60 };  // east at x=240
    const tR = { x: 100, y: 180, width: 40, height: 60 };  // west at x=100
    const pts = [{x:240,y:70}, {x:240,y:125}, {x:100,y:125}, {x:100,y:210}];
    const out = enforcePerpendicularLegs(pts, undefined, sR, tR);
    assert.equal(out.length, 4);
    // midX = (240 + 100) / 2 = 170 — between the anchors.
    assert.equal(out[1].x, 170);
    assert.equal(out[2].x, 170);
    // First leg horizontal at p0.y=70.
    assert.equal(out[1].y, 70);
    // Last leg horizontal at pN.y=210.
    assert.equal(out[2].y, 210);
    // Polyline doesn't invade either source or target (sR right edge 240,
    // tR right edge 140 — midX=170 falls in the gap between them).
    assert.ok(out[1].x < 200 || out[1].x > 240, `midX=${out[1].x} outside source x-range`);
    assert.ok(out[1].x < 100 || out[1].x > 140, `midX=${out[1].x} outside target x-range`);
  });

  test('B6.c: A* 5-point polyline + tangent first leg → corner adjacente substituído fora do sRect', () => {
    // Source A on east face. A* gave first waypoint at (150, 200) — same
    // column as anchor (vertical first leg, tangent to east). Length 5
    // > 4 so we replace out[1] only (preserving the rest of the A*
    // detour). New corner must NOT fall inside sRect.
    const sR = { x: 100, y: 100, width: 50, height: 50 };  // east at x=150
    const pts = [
      {x:150,y:125}, {x:150,y:200}, {x:300,y:200}, {x:300,y:250}, {x:400,y:250}
    ];
    const out = enforcePerpendicularLegs(pts, undefined, sR, null);
    assert.equal(out.length, 5, 'length preserved');
    // out[1] replaced — was (150,200), should become a corner that makes
    // first leg horizontal AND lands outside sR. target = out[2] = (300, 200).
    // swappedCorner(anchor=(150,125), target=(300,200), 'east') = (300, 125).
    assert.deepEqual(out[1], { x: 300, y: 125 });
    // Verify corner is NOT inside sR.
    assert.ok(out[1].x < sR.x || out[1].x > sR.x + sR.width,
      `corner x=${out[1].x} outside sR x-range [${sR.x},${sR.x + sR.width}]`);
    // Interior waypoints preserved.
    assert.deepEqual(out[2], { x: 300, y: 200 });
    assert.deepEqual(out[3], { x: 300, y: 250 });
    assert.deepEqual(out[4], { x: 400, y: 250 });
  });

  test('B6.d: faces mistas (east + north) → L de 3 pontos sem corner dentro de rect', () => {
    // Source east face (horizontal first leg), target north face
    // (vertical last leg). Mixed → 3-point L.
    const sR = { x: 80,  y: 80,  width: 80, height: 40 };   // east at x=160
    const tR = { x: 300, y: 200, width: 80, height: 60 };   // north at y=200
    const pts = [{x:160,y:100}, {x:230,y:100}, {x:230,y:200}, {x:340,y:200}]; // 4-pt input
    const out = enforcePerpendicularLegs(pts, undefined, sR, tR);
    // Mixed faces → L: [p0, {pN.x, p0.y}, pN] because source horizontal.
    // p0=(160,100), pN=(340,200) → corner=(340,100).
    assert.equal(out.length, 3);
    assert.deepEqual(out[0], { x: 160, y: 100 });
    assert.deepEqual(out[1], { x: 340, y: 100 });
    assert.deepEqual(out[2], { x: 340, y: 200 });
    // First leg horizontal (east), last leg vertical (north). ✓
  });
});

describe('rebuildWithFaces (B6 global rebuild)', () => {
  test('both horizontal faces → 4-point Z with midX', () => {
    const out = rebuildWithFaces({x:0,y:0}, {x:100,y:50}, 'east', 'west');
    assert.deepEqual(out, [{x:0,y:0}, {x:50,y:0}, {x:50,y:50}, {x:100,y:50}]);
  });

  test('both vertical faces → 4-point Z with midY', () => {
    const out = rebuildWithFaces({x:0,y:0}, {x:50,y:100}, 'south', 'north');
    assert.deepEqual(out, [{x:0,y:0}, {x:0,y:50}, {x:50,y:50}, {x:50,y:100}]);
  });

  test('mixed (horiz source + vert target) → 3-point L', () => {
    const out = rebuildWithFaces({x:0,y:0}, {x:100,y:50}, 'east', 'south');
    assert.deepEqual(out, [{x:0,y:0}, {x:100,y:0}, {x:100,y:50}]);
  });

  test('mixed (vert source + horiz target) → 3-point L', () => {
    const out = rebuildWithFaces({x:0,y:0}, {x:100,y:50}, 'south', 'west');
    assert.deepEqual(out, [{x:0,y:0}, {x:0,y:50}, {x:100,y:50}]);
  });
});

describe('simplifyCollinear (B8 — dedup + collinear interior removal)', () => {
  test('B8.a: duplicate consecutive point dropped', () => {
    // Reproduz `L -45 -62 L -45 -62` do `requests` no SVG real — Z
    // colapsado pelo rebuildWithFaces quando midX iguala um dos anchors.
    const out = simplifyCollinear([{x:0,y:0}, {x:5,y:0}, {x:5,y:0}, {x:10,y:0}]);
    // O dup vai embora; depois 3 colineares restam: [(0,0), (5,0), (10,0)].
    // O interior (5,0) é colinear com vizinhos → também removido.
    assert.deepEqual(out, [{x:0,y:0}, {x:10,y:0}]);
  });

  test('B8.b: near-duplicate (sub-pixel) também é removido', () => {
    // Reproduz `drena` (78.26, 82.96 — diff ~5px) e casos com kink < 0.1px.
    const out = simplifyCollinear([{x:0,y:0}, {x:5,y:0}, {x:5.05,y:0.01}, {x:10,y:0}]);
    // (5.05, 0.01) ≈ (5, 0) dentro da tolerância 0.1 → dup. Restam 3
    // colineares: simplifica para [(0,0), (10,0)].
    assert.deepEqual(out, [{x:0,y:0}, {x:10,y:0}]);
  });

  test('B8.c: vertical Z com midline degenerado colapsa pra linha reta', () => {
    // rebuildWithFaces produz [(0,0), (0,50), (0,50), (0,100)] quando
    // ambas as faces são north/south e os anchors compartilham x — Z
    // colapsa numa vertical. simplifyCollinear vira [(0,0), (0,100)].
    const out = simplifyCollinear([{x:0,y:0}, {x:0,y:50}, {x:0,y:50}, {x:0,y:100}]);
    assert.deepEqual(out, [{x:0,y:0}, {x:0,y:100}]);
  });

  test('polilinha sem redundância → intacta', () => {
    const pts = [{x:0,y:0}, {x:50,y:0}, {x:50,y:50}, {x:100,y:50}];
    assert.deepEqual(simplifyCollinear(pts), pts);
  });

  test('kink REAL (1px) → preservado', () => {
    const pts = [{x:0,y:0}, {x:5,y:1}, {x:10,y:0}];
    assert.deepEqual(simplifyCollinear(pts), pts);
  });

  test('length < 3 → intacta', () => {
    const pts = [{x:0,y:0}, {x:10,y:0}];
    assert.equal(simplifyCollinear(pts), pts);
  });
});

describe('simplifyStairsAndExcursions (B12+B13)', () => {
  test('B12/B13.a: stair Y-1.36px + back X-31px → colapsa em L (reproduz bruno)', () => {
    // Reproduz o path real do bruno no showcase.
    const pts = [
      {x:-80.71, y:75.91},
      {x:-26.16, y:75.91},   // a→b east
      {x:-26.16, y:74.55},   // b→c south 1.36px (stair, < 1.5 tol)
      {x:-57.34, y:74.55},   // c→d west (back — reverse of a→b)
      {x:-57.34, y:-141.91}, // d→e north (continuação)
    ];
    // Isolado: substitui [b,c] por corner — produz [a, corner, d, e].
    // Pipeline real (clip-anchors etc.) chama simplifyCollinear depois,
    // que colapsa corner→d→e (todos x=-57.34) em [a, corner, e].
    const raw = simplifyStairsAndExcursions(pts, undefined);
    assert.equal(raw.length, 4, `excursão removida: 5pt → 4pt; got ${raw.length}: ${JSON.stringify(raw)}`);
    assert.deepEqual(raw[1], {x:-57.34, y:75.91}, 'corner em (d.x, a.y)');
    // Pipeline completo: collinear depois remove d.
    const collapsed = simplifyCollinear(raw);
    assert.equal(collapsed.length, 3, 'depois de collinear: L final de 3 pts');
    assert.deepEqual(collapsed, [
      {x:-80.71, y:75.91},
      {x:-57.34, y:75.91},
      {x:-57.34, y:-141.91},
    ]);
  });

  test('B12/B13.b: stair Y-1.36px + FORWARD (mesma direção, não back) → intacta', () => {
    // Padrão similar mas c→d segue na mesma direção de a→b (east),
    // não é "back" — sem excursão pra remover.
    const pts = [
      {x:0, y:10}, {x:10, y:10}, {x:10, y:9}, {x:20, y:9}, {x:20, y:-100},
    ];
    const out = simplifyStairsAndExcursions(pts, undefined);
    assert.deepEqual(out, pts, 'forward não é back; intacto');
  });

  test('B12/B13.c: stair Y-5px (acima de tol) → intacta', () => {
    // Stair de 5px é grande demais — não é noise sub-pixel.
    const pts = [
      {x:0, y:10}, {x:10, y:10}, {x:10, y:5}, {x:-10, y:5}, {x:-10, y:-50},
    ];
    const out = simplifyStairsAndExcursions(pts, undefined);
    assert.deepEqual(out, pts, '5px > tol; intacto');
  });

  test('B12/B13.d: kind === "curve" → intacta', () => {
    const pts = [{x:0,y:10}, {x:10,y:10}, {x:10,y:9.5}, {x:-10,y:9.5}, {x:-10,y:-50}];
    assert.equal(simplifyStairsAndExcursions(pts, 'curve'), pts);
  });

  test('B12/B13.e: length < 4 → intacta', () => {
    const pts = [{x:0,y:0}, {x:10,y:0}, {x:10,y:10}];
    assert.equal(simplifyStairsAndExcursions(pts, undefined), pts);
  });

  test('B12/B13: padrão vertical (eixo invertido) também detectado', () => {
    // Variante: primeiro segmento VERTICAL, stair horizontal, back vertical.
    const pts = [
      {x:10, y:0}, {x:10, y:50}, {x:11, y:50}, {x:11, y:30}, {x:100, y:30},
    ];
    const raw = simplifyStairsAndExcursions(pts, undefined);
    assert.equal(raw.length, 4, `5pt → 4pt isolado; got ${raw.length}`);
    assert.deepEqual(raw[1], {x:10, y:30}, 'corner em (a.x, d.y)');
    const collapsed = simplifyCollinear(raw);
    // raw=[a, corner, d, e] = [(10,0),(10,30),(11,30),(100,30)].
    // corner→d→e: y=30 const, so cross between (10,30)/(11,30)/(100,30)
    // = 0 → d colinear → remove. Result: [a, corner, e] = 3 pts.
    assert.equal(collapsed.length, 3);
    assert.deepEqual(collapsed, [
      {x:10, y:0}, {x:10, y:30}, {x:100, y:30},
    ]);
  });
});

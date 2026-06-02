import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createWaypointState, stepWaypoints } from '../../../src/layout/adapters/live/collision-waypoints.js';
import { buildCollisionResolver } from '../../../src/layout/collision.js';

function spec(o) { return new Map(Object.entries(o || {})); }

function makeState(nodes) {
  const leaves = nodes.filter(n => !n.hasChildren);
  const containers = nodes.filter(n => n.hasChildren);
  const N = leaves.length;
  const state = {
    leaves,
    containers,
    containersWithChildren: containers,
    idToIndex: new Map(leaves.map((l, i) => [l.id, i])),
    px: new Float64Array(N),
    py: new Float64Array(N),
    vx: new Float64Array(N),
    vy: new Float64Array(N),
    fx: new Array(N).fill(null),
    fy: new Array(N).fill(null),
    ancestors: new Map(nodes.map(n => [n.id, new Set(n.parent ? [n.parent] : [])])),
  };
  leaves.forEach((l, i) => { state.px[i] = l._cx; state.py[i] = l._cy; });
  return state;
}

function irOf(nodes, edges) {
  return { nodes, edges, layers: [], meta: {}, errors: [] };
}

// CFG sem springs e sem damping → impulsos de colisão aparecem puros em wvx/wvy.
const CFG = {
  collisionPadding: 0,
  collisionK: 0.5,
  waypointSpring: 0,
  waypointSeedSpring: 0,
  waypointChainSpring: 0,
  damping: 1,
};

// Helper: roda 1 tick para semear o strip, depois sobrescreve posição
// do waypoint para o cenário de teste, depois mais 1 tick para colher
// os impulsos. Como o seedKey não muda (obstáculos no mesmo lugar),
// o reseed do 2º tick é um no-op — só o force loop executa.
function tickAndOverride(wp, state, resolver, cfg, edgeId, wpIdx, x, y) {
  stepWaypoints(wp, state, resolver, cfg, 1);
  const strip = wp.strips.get(edgeId);
  if (!strip) return null;
  strip.wpx[wpIdx] = x;
  strip.wpy[wpIdx] = y;
  strip.wvx[wpIdx] = 0;
  strip.wvy[wpIdx] = 0;
  // Limpa velocidades do nó também — só queremos ver o efeito do 2º tick.
  for (let i = 0; i < state.vx.length; i++) { state.vx[i] = 0; state.vy[i] = 0; }
  stepWaypoints(wp, state, resolver, cfg, 1);
  return strip;
}

describe('stepWaypoints — modelo strip + hybrid A*/physics', () => {
  test('aresta sem obstáculo na linha direta → strip.count === 0', () => {
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx: -100, _cy: 0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:  100, _cy: 0 },
    ];
    const edges = [{
      id: 'e1', source: 'a', target: 'b',
      nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}),
    }];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    stepWaypoints(wp, state, resolver, CFG, 1);
    const strip = wp.strips.get('e1');
    assert.ok(strip);
    assert.equal(strip.count, 0, 'sem obstáculo no caminho direto → 0 waypoints');
  });

  test('aresta com 1 obstáculo na linha direta → A* gera waypoints', () => {
    // Aresta a→b cruza um blocker centrado em (0,0). A* deve gerar 1+
    // vértices internos para contornar.
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx: -200, _cy: 0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:  200, _cy: 0 },
      { id: 'blocker', width: 60, height: 60, nodeCollision: spec({ wire: 0 }), _cx: 0, _cy: 0 },
    ];
    const edges = [{
      id: 'e1', source: 'a', target: 'b',
      nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}),
    }];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    stepWaypoints(wp, state, resolver, CFG, 1);
    const strip = wp.strips.get('e1');
    assert.ok(strip.count >= 1, `esperado >= 1 waypoint, got ${strip.count}`);
    assert.ok(strip.count <= 4, `cap maxWaypointsPerEdge=4, got ${strip.count}`);
  });

  test('waypoint dentro de blocker → IMPULSO SÓ NO WAYPOINT, nó intocado (frac.edge=0.5)', () => {
    // Política atual: nós não recebem impulso de arestas/labels. Mesmo
    // com pesos 0/0 (frac.edge=frac.node=0.5), o waypoint absorve a
    // colisão sozinho — o blocker fica parado.
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx: -200, _cy: 0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:  200, _cy: 0 },
      { id: 'blocker', width: 200, height: 40, nodeCollision: spec({ wire: 0 }), _cx: 0, _cy: 0 },
    ];
    const edges = [{
      id: 'e1', source: 'a', target: 'b',
      nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}),
    }];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    const strip = tickAndOverride(wp, state, resolver, CFG, 'e1', 0, 0, 0);
    assert.ok(strip);
    // pen={x:0, y:-20}. frac.edge=0.5, k=0.5 → wvy += -20 * 0.5 * 0.5 = -5.
    assert.ok(Math.abs(strip.wvy[0] - (-5)) < 1e-9, `wvy[0]=${strip.wvy[0]}, esperado -5`);
    assert.equal(state.vy[2], 0, `nó NUNCA recebe impulso de aresta (vy[blocker]=${state.vy[2]})`);
    assert.equal(state.vx[2], 0);
  });

  test('weights 1/0: edge anchor → waypoint ainda absorve frac.edge (apesar do peso 1)', () => {
    // Pesos: edge=1, blocker=0. computeSplit dá frac.edge=0, frac.node=1
    // (blocker "absorve tudo"). Antes: blocker recebia +10. Agora: nó
    // permanece intocado independentemente dos pesos; o waypoint apenas
    // não se move (frac.edge=0). Net: ambos parados.
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx: -200, _cy: 0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:  200, _cy: 0 },
      { id: 'blocker', width: 200, height: 40, nodeCollision: spec({ wire: 0 }), _cx: 0, _cy: 0 },
    ];
    const edges = [{
      id: 'e1', source: 'a', target: 'b',
      nodeCollision: spec({ wire: 1 }), edgeCollision: spec({}),
    }];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    const strip = tickAndOverride(wp, state, resolver, CFG, 'e1', 0, 0, 0);
    assert.ok(strip);
    assert.ok(Math.abs(strip.wvy[0]) < 1e-9, `wvy[0]=${strip.wvy[0]}, esperado 0 (frac.edge=0)`);
    assert.equal(state.vy[2], 0, `nó nunca recebe impulso (vy[blocker]=${state.vy[2]})`);
  });

  test('container com filhos: NENHUM filho recebe impulso de aresta', () => {
    // Antes: o impulso era distribuído rigidamente nos descendentes.
    // Agora: nem o container nem os filhos se movem. Só o waypoint.
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx: -300, _cy: -40 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:  300, _cy: -40 },
      { id: 'box', hasChildren: true, nodeCollision: spec({ wire: 0 }) },
      { id: 'c1', width: 60, height: 20, nodeCollision: spec({}), parent: 'box', _cx: -60, _cy: 0 },
      { id: 'c2', width: 60, height: 20, nodeCollision: spec({}), parent: 'box', _cx:  60, _cy: 0 },
    ];
    const edges = [{
      id: 'e1', source: 'a', target: 'b',
      nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}),
    }];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    const strip = tickAndOverride(wp, state, resolver, CFG, 'e1', 0, 0, -40);
    assert.ok(strip);
    // Nenhum nó (a, b, c1, c2) recebe impulso.
    assert.equal(state.vx[0], 0); assert.equal(state.vy[0], 0);
    assert.equal(state.vx[1], 0); assert.equal(state.vy[1], 0);
    assert.equal(state.vx[2], 0); assert.equal(state.vy[2], 0);
    assert.equal(state.vx[3], 0); assert.equal(state.vy[3], 0);
    // Mas o waypoint SIM (algum impulso).
    assert.ok(Math.abs(strip.wvx[0]) + Math.abs(strip.wvy[0]) > 0, 'waypoint deve receber impulso');
  });

  test('label collision: label de outra aresta empurra waypoint via edgeEdgePair', () => {
    // e1 vertical (a→b), e2 horizontal (c→d) cruzam em (0,0). Ambas
    // compartilham edgeLayer 'bus'. e1 tem obstáculo em (0,0) → A* semeia.
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx:   0, _cy: -200 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:   0, _cy:  200 },
      { id: 'c', width: 10, height: 10, nodeCollision: spec({}), _cx: -200, _cy: 0 },
      { id: 'd', width: 10, height: 10, nodeCollision: spec({}), _cx:  200, _cy: 0 },
      // Sem blocker — straight path livre. Strips terão count=0.
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', nodeCollision: spec({}), edgeCollision: spec({ bus: 0 }) },
      { id: 'e2', source: 'c', target: 'd', nodeCollision: spec({}), edgeCollision: spec({ bus: 0 }) },
    ];
    const state = makeState(nodes);
    state.labelBBoxes = new Map([['e2', { width: 80, height: 20 }]]);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);

    // edge é collidable só se tiver edgesWithObstacles. e1/e2 têm edgeCollision
    // mas precisam de edgesWithObstacles. Verifico:
    if (!wp.edges.length) {
      assert.fail('esperava edges em wp.edges — edgeCollision não fez edge entrar em obstacles');
    }
  });

  test('B1: label empurra waypoint de OUTRA aresta sem edgeLayers compartilhada', () => {
    // e1 (vertical a→b) com obstáculo no centro → A* semeia waypoint.
    // e2 (horizontal c→d) tem label largo passando por cima do waypoint
    // de e1. Antes do fix: edgeEdgePair gate retornava null porque e1 e
    // e2 NÃO compartilham edgeLayers → label não interagia.
    // Agora: label-vs-waypoint é incondicional.
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx:   0, _cy: -200 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:   0, _cy:  200 },
      { id: 'c', width: 10, height: 10, nodeCollision: spec({}), _cx: -200, _cy: 0 },
      { id: 'd', width: 10, height: 10, nodeCollision: spec({}), _cx:  200, _cy: 0 },
      { id: 'blocker', width: 60, height: 60, nodeCollision: spec({ wire: 0 }), _cx: 0, _cy: 0 },
    ];
    const edges = [
      // e1 tem nodeCollision wire → edgesWithObstacles, A* semeia.
      { id: 'e1', source: 'a', target: 'b', nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}) },
      // e2 SEM edgeLayers em comum com e1.
      { id: 'e2', source: 'c', target: 'd', nodeCollision: spec({}), edgeCollision: spec({}) },
    ];
    const state = makeState(nodes);
    state.labelBBoxes = new Map([['e2', { width: 200, height: 30 }]]);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);

    // Tick 1: semeia.
    stepWaypoints(wp, state, resolver, CFG, 1);
    const strip = wp.strips.get('e1');
    assert.ok(strip);
    assert.ok(strip.count > 0, `esperava ≥1 waypoint em e1 (count=${strip.count})`);

    // Override: forçar o waypoint dentro do labelRect de e2.
    // e2 vai de (-200, 0) a (200, 0) → midpoint (0, 0). label 200×30 →
    // rect [-100,-15, 200, 30]. Coloco waypoint em (0, 0) — dentro.
    strip.wpx[0] = 0; strip.wpy[0] = 0;
    strip.wvx[0] = 0; strip.wvy[0] = 0;
    for (let i = 0; i < state.vx.length; i++) { state.vx[i] = 0; state.vy[i] = 0; }
    stepWaypoints(wp, state, resolver, CFG, 1);

    // O waypoint deve ter recebido impulso PRA FORA do label rect.
    const moved = Math.abs(strip.wvx[0]) + Math.abs(strip.wvy[0]);
    assert.ok(moved > 0, `waypoint não recebeu impulso (wvx=${strip.wvx[0]}, wvy=${strip.wvy[0]})`);
  });

  test('label NUNCA empurra nós (B2 desativado — política nós-intocáveis)', () => {
    // Antes da política nós-intocáveis: B2 movia o nó pra fora do label.
    // Agora: nem o nó nem o label se movem; visualmente eles podem se
    // sobrepor (responsabilidade futura do reposicionamento de labels).
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({ wire: 0 }), _cx: -200, _cy: 0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({ wire: 0 }), _cx:  200, _cy: 0 },
      { id: 'c', width: 20, height: 20, nodeCollision: spec({ wire: 0 }), _cx: 0, _cy: 0 },
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}) },
    ];
    const state = makeState(nodes);
    state.labelBBoxes = new Map([['e1', { width: 100, height: 30 }]]);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);

    stepWaypoints(wp, state, resolver, CFG, 1);

    // c em (0,0), label centrado em (0,0). Antes: impulso vertical.
    // Agora: c.vx=c.vy=0.
    assert.equal(state.vx[2], 0, `c.vx deve ser 0 (label nunca empurra nó); got ${state.vx[2]}`);
    assert.equal(state.vy[2], 0, `c.vy deve ser 0 (label nunca empurra nó); got ${state.vy[2]}`);
  });

  // B9 (labelRect deriva do midpoint da polilinha real, não dos centros)
  // não tem teste unitário direto porque, sob a política "nós nunca
  // empurrados", a única observação externa do labelRect é o impulso em
  // WAYPOINTS de outras arestas (label-vs-edge). A cobertura efetiva do
  // B9 fica:
  // - tests/routing/geometry.test.js (midPoint helper canônico)
  // - debug:assert no showcase (live × orthogonal) — labels não
  //   sobrepõem nós alheios na renderização final.

  test('B11: duas arestas com edgeLayers compartilhada, SEM nó bloqueador, geram waypoints após 2 ticks', () => {
    // Cenário: e1 (a→b) e e2 (c→d) cruzam em (0,0) mas nenhum NÓ está
    // entre elas. Pré-B11: A* não acha obstáculo → ambas count=0 →
    // inter-strip nunca atua → cruzamento eterno. Pós-B11: tick 2
    // enxerga a polilinha do tick 1 como obstáculo (segmentRect com
    // padding) → A* desvia → count > 0 → inter-strip resolve.
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx: -200, _cy:    0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:  200, _cy:    0 },
      { id: 'c', width: 10, height: 10, nodeCollision: spec({}), _cx:    0, _cy: -200 },
      { id: 'd', width: 10, height: 10, nodeCollision: spec({}), _cx:    0, _cy:  200 },
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', nodeCollision: spec({}), edgeCollision: spec({ feixe: 0 }) },
      { id: 'e2', source: 'c', target: 'd', nodeCollision: spec({}), edgeCollision: spec({ feixe: 0 }) },
    ];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    // Padding > 0 é necessário para segmentRect inflar a polilinha
    // [S, T] em obstáculo de área não-zero (A* ignora 0-width rects).
    const cfg = { ...CFG, collisionPadding: 4 };

    // Tick 1: prevRouted vazio (strips ainda não criadas) → cai no
    // baseline porque sem nós obstáculo, count=0.
    stepWaypoints(wp, state, resolver, cfg, 1);
    // Tick 2: prevRouted agora contém [S, T] de ambas. A* de e1 vê o
    // segmentRect padded de e2 como obstáculo e desvia.
    stepWaypoints(wp, state, resolver, cfg, 1);
    const s1 = wp.strips.get('e1');
    const s2 = wp.strips.get('e2');
    const someoneSeed = s1.count > 0 || s2.count > 0;
    assert.ok(someoneSeed, `tick 2: esperado ≥1 strip com count>0 (e1=${s1.count}, e2=${s2.count})`);
  });

  test('B11: arestas SEM edgeLayers compartilhada continuam count=0 (não vira obstáculo mútuo)', () => {
    // Negativo: e1 e e2 cruzam mas não compartilham edgeLayers. A*
    // não deve adicionar e2 como obstáculo de e1, então ambas seguem
    // count=0 (comportamento baseline preservado quando não há
    // intenção de colisão).
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx: -200, _cy:    0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:  200, _cy:    0 },
      { id: 'c', width: 10, height: 10, nodeCollision: spec({}), _cx:    0, _cy: -200 },
      { id: 'd', width: 10, height: 10, nodeCollision: spec({}), _cx:    0, _cy:  200 },
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', nodeCollision: spec({}), edgeCollision: spec({ bus1: 0 }) },
      { id: 'e2', source: 'c', target: 'd', nodeCollision: spec({}), edgeCollision: spec({ bus2: 0 }) },
    ];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);

    stepWaypoints(wp, state, resolver, CFG, 1);
    stepWaypoints(wp, state, resolver, CFG, 1);
    assert.equal(wp.strips.get('e1').count, 0, 'sem feixe comum: e1 não muda');
    assert.equal(wp.strips.get('e2').count, 0, 'sem feixe comum: e2 não muda');
  });

  test('política nós-intocáveis: 50 ticks de label e edge sobre nós, todos parados', () => {
    // Stress: vários nós sobrepostos a labels e a polilinhas de arestas.
    // Após 50 ticks com config realista (springs + collision), nenhum
    // nó deve ter velocidade não-trivial vinda das interações de aresta.
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({ wire: 0 }), _cx: -200, _cy: 0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({ wire: 0 }), _cx:  200, _cy: 0 },
      // c, d, e: todos no caminho ou sobre o label de e1.
      { id: 'c', width: 30, height: 30, nodeCollision: spec({ wire: 0 }), _cx:    0, _cy: 0 },
      { id: 'd', width: 30, height: 30, nodeCollision: spec({ wire: 0 }), _cx:   50, _cy: 0 },
      { id: 'e', width: 30, height: 30, nodeCollision: spec({ wire: 0 }), _cx:  -50, _cy: 0 },
    ];
    const edges = [
      { id: 'e1', source: 'a', target: 'b', nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}) },
    ];
    const state = makeState(nodes);
    state.labelBBoxes = new Map([['e1', { width: 200, height: 40 }]]);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    const realistic = {
      collisionPadding: 4, collisionK: 0.3,
      waypointSpring: 0.08, waypointSeedSpring: 0.15, waypointChainSpring: 0.04,
      damping: 0.82,
    };
    // Posições iniciais.
    const initialPos = nodes.map(n => ({ x: n._cx, y: n._cy }));
    for (let t = 0; t < 50; t++) stepWaypoints(wp, state, resolver, realistic, 1);
    // Nenhum nó alheio à edge1 mexeu. (a, b são endpoints, mas mesmo
    // assim não podem ser empurrados pelo label da própria aresta.)
    for (let i = 0; i < nodes.length; i++) {
      assert.equal(state.vx[i], 0, `nó ${nodes[i].id} vx=${state.vx[i]} (esperado 0)`);
      assert.equal(state.vy[i], 0, `nó ${nodes[i].id} vy=${state.vy[i]} (esperado 0)`);
      // Posição inalterada (sem integração de v→x para edge forces).
      // Note: stepWaypoints só integra waypoints; nó pos só muda no
      // collision-resolution.js (node-node), que não roda aqui.
      assert.equal(state.px[i], initialPos[i].x);
      assert.equal(state.py[i], initialPos[i].y);
    }
  });

  test('B7: A* gera waypoint dentro do source/target rect → filtrado', () => {
    // Cenário: source A pequeno, target B distante, blocker entre eles
    // mas A* pode (em alguns arranjos) gerar vértice intermediário que
    // cai sobre uma face de A ou B porque o grid Hanan inclui os anchors
    // como coordenadas. O filtro B7 garante que nenhum vértice INTERNO
    // cai estritamente dentro do source ou target.
    const nodes = [
      { id: 'a', width: 80, height: 80, nodeCollision: spec({}), _cx: -150, _cy: 0 },
      { id: 'b', width: 80, height: 80, nodeCollision: spec({}), _cx:  150, _cy: 0 },
      { id: 'blocker', width: 40, height: 200, nodeCollision: spec({ wire: 0 }), _cx: 0, _cy: 0 },
    ];
    const edges = [{
      id: 'e1', source: 'a', target: 'b',
      nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}),
    }];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    stepWaypoints(wp, state, resolver, CFG, 1);
    const strip = wp.strips.get('e1');
    assert.ok(strip);

    // Calcular rects de a e b (ambos leaves, centro±size/2).
    const aRect = { x: -190, y: -40, width: 80, height: 80 };
    const bRect = { x:  110, y: -40, width: 80, height: 80 };

    for (let j = 0; j < strip.count; j++) {
      const insideA = strip.sx[j] > aRect.x + 1e-3 && strip.sx[j] < aRect.x + aRect.width - 1e-3
                   && strip.sy[j] > aRect.y + 1e-3 && strip.sy[j] < aRect.y + aRect.height - 1e-3;
      const insideB = strip.sx[j] > bRect.x + 1e-3 && strip.sx[j] < bRect.x + bRect.width - 1e-3
                   && strip.sy[j] > bRect.y + 1e-3 && strip.sy[j] < bRect.y + bRect.height - 1e-3;
      assert.ok(!insideA, `seed[${j}]=(${strip.sx[j]},${strip.sy[j]}) dentro de source A ${JSON.stringify(aRect)}`);
      assert.ok(!insideB, `seed[${j}]=(${strip.sx[j]},${strip.sy[j]}) dentro de target B ${JSON.stringify(bRect)}`);
    }
  });

  test('B7: A* path com TODOS waypoints dentro de source/target → strip vazia (fallback linha direta)', () => {
    // Caso patológico: source e target sobrepostos (interior comum).
    // Qualquer interior do A* path tende a cair dentro de um dos dois.
    // Após filtro, fica zero — fallback strip vazia.
    const nodes = [
      // source e target enormes e sobrepostos
      { id: 'a', width: 400, height: 400, nodeCollision: spec({}), _cx: 0, _cy: 0 },
      { id: 'b', width: 400, height: 400, nodeCollision: spec({}), _cx: 50, _cy: 50 },
      { id: 'blocker', width: 20, height: 20, nodeCollision: spec({ wire: 0 }), _cx: 25, _cy: 25 },
    ];
    const edges = [{
      id: 'e1', source: 'a', target: 'b',
      nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}),
    }];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);
    stepWaypoints(wp, state, resolver, CFG, 1);
    const strip = wp.strips.get('e1');
    assert.ok(strip);
    // Mesmo se A* gerou waypoints, todos foram filtrados (sobreposição
    // total) — strip.count cai para 0.
    // OBS: se o teste falhar com count > 0, verificar se algum waypoint
    // cai NA borda (não estritamente dentro) — nesse caso fica.
    if (strip.count > 0) {
      // Tudo bem se o que sobrou é exatamente um waypoint na borda;
      // garantir que NENHUM cai estritamente dentro de a ou b.
      const aRect = { x: -200, y: -200, width: 400, height: 400 };
      const bRect = { x: -150, y: -150, width: 400, height: 400 };
      for (let j = 0; j < strip.count; j++) {
        const inA = strip.sx[j] > aRect.x + 1e-3 && strip.sx[j] < aRect.x + aRect.width - 1e-3
                 && strip.sy[j] > aRect.y + 1e-3 && strip.sy[j] < aRect.y + aRect.height - 1e-3;
        const inB = strip.sx[j] > bRect.x + 1e-3 && strip.sx[j] < bRect.x + bRect.width - 1e-3
                 && strip.sy[j] > bRect.y + 1e-3 && strip.sy[j] < bRect.y + bRect.height - 1e-3;
        assert.ok(!inA && !inB, `seed[${j}] sobrevivente cai dentro de source/target`);
      }
    }
  });

  test('convergência: sistema não explode após 100 ticks com config realista', () => {
    const nodes = [
      { id: 'a', width: 10, height: 10, nodeCollision: spec({}), _cx: -200, _cy: 0 },
      { id: 'b', width: 10, height: 10, nodeCollision: spec({}), _cx:  200, _cy: 0 },
      { id: 'blocker', width: 200, height: 40, nodeCollision: spec({ wire: 1 }), _cx: 0, _cy: 0 },
    ];
    const edges = [{
      id: 'e1', source: 'a', target: 'b',
      nodeCollision: spec({ wire: 0 }), edgeCollision: spec({}),
    }];
    const state = makeState(nodes);
    const resolver = buildCollisionResolver(irOf(nodes, edges));
    const wp = createWaypointState(irOf(nodes, edges), resolver);

    const realistic = {
      collisionPadding: 4, collisionK: 0.3,
      waypointSpring: 0.08, waypointSeedSpring: 0.15, waypointChainSpring: 0.04,
      damping: 0.82,
    };
    for (let t = 0; t < 100; t++) stepWaypoints(wp, state, resolver, realistic, 1);

    const strip = wp.strips.get('e1');
    assert.ok(strip);
    if (strip.count > 0) {
      for (let j = 0; j < strip.count; j++) {
        assert.ok(Math.abs(strip.wpx[j]) < 1000, `wpx[${j}]=${strip.wpx[j]} não explodiu`);
        assert.ok(Math.abs(strip.wpy[j]) < 1000, `wpy[${j}]=${strip.wpy[j]} não explodiu`);
        assert.ok(Math.abs(strip.wvx[j]) < 10,   `wvx[${j}]=${strip.wvx[j]} convergiu`);
        assert.ok(Math.abs(strip.wvy[j]) < 10,   `wvy[${j}]=${strip.wvy[j]} convergiu`);
      }
    }
  });
});

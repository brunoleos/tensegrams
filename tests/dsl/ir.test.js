import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../../src/dsl/parser.js';
import { buildIR } from '../../src/dsl/ir.js';

const ir = (src) => buildIR(parse(src));
const node = (g, id) => g.nodes.find(n => n.id === id);
const edge = (g, src, tgt) => g.edges.find(e => e.source === src && e.target === tgt);

describe('buildIR — implicit nodes from connections', () => {
  test('connection auto-declares its endpoints', () => {
    const g = ir(`connections:\n  - [a, b]\n`);
    assert.equal(g.nodes.length, 2);
    assert.equal(node(g, 'a').label, 'a');   // default label = id
    assert.equal(node(g, 'b').label, 'b');
  });

  test('connection plus an explicit node block merges attrs', () => {
    const g = ir(`connections:\n  - [a, b]\na:\n  label: Aye\n`);
    assert.equal(node(g, 'a').label, 'Aye');
    assert.equal(node(g, 'b').label, 'b');
  });

  test('node block without any connection still creates a node', () => {
    const g = ir(`lone:\n  label: Lonely\n`);
    assert.equal(g.nodes.length, 1);
    assert.equal(node(g, 'lone').label, 'Lonely');
  });
});

describe('buildIR — edges are undirected, source/target positional', () => {
  test('source/target reflect the order in connections', () => {
    const g = ir(`connections:\n  - [a, b]\n`);
    assert.equal(g.edges[0].source, 'a');
    assert.equal(g.edges[0].target, 'b');
  });

  test('decoration written as [b, a] still attaches to [a, b]', () => {
    const g = ir(`connections:\n  - [a, b]\n? [b, a]\n: { label: same }\n`);
    assert.equal(g.edges[0].label, 'same');
  });

  test('default styles: startStyle=none, endStyle=filledArrow', () => {
    const g = ir(`connections:\n  - [a, b]\n`);
    assert.equal(g.edges[0].startStyle, 'none');
    assert.equal(g.edges[0].endStyle, 'filledArrow');
  });

  test('startStyle/endStyle accept presets', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { startStyle: diamond, endStyle: crowfoot }\n`);
    assert.equal(g.edges[0].startStyle, 'diamond');
    assert.equal(g.edges[0].endStyle, 'crowfoot');
  });

  test('unknown style falls back to default with a warning', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { endStyle: bogus }\n`);
    assert.equal(g.edges[0].endStyle, 'filledArrow');
    assert.ok(g.warnings.some(w => /endStyle desconhecido/.test(w.msg)));
  });
});

describe('buildIR — parallels need a discriminator', () => {
  test('two [a, b] without discriminator is an error', () => {
    const g = ir(`connections:\n  - [a, b]\n  - [a, b]\n`);
    assert.ok(g.errors.some(e => /discriminador/.test(e.msg)));
    assert.equal(g.edges.length, 1); // second one dropped
  });

  test('[a, b, 1] and [a, b, 2] coexist as distinct edges', () => {
    const g = ir(`connections:\n  - [a, b, 1]\n  - [a, b, 2]\n`);
    assert.equal(g.edges.length, 2);
    assert.equal(g.edges[0].parallelKey, '1');
    assert.equal(g.edges[1].parallelKey, '2');
  });

  test('decoration targets each parallel independently', () => {
    const g = ir(`connections:
  - [a, b, 1]
  - [a, b, 2]
? [a, b, 1]
: { label: one }
? [a, b, 2]
: { label: two }
`);
    assert.equal(g.edges.find(e => e.parallelKey === '1').label, 'one');
    assert.equal(g.edges.find(e => e.parallelKey === '2').label, 'two');
  });

  test('mixing base [a,b] with discriminated [a,b,N] is an error', () => {
    const g = ir(`connections:\n  - [a, b]\n  - [a, b, 1]\n`);
    assert.ok(g.errors.some(e => /conflita/.test(e.msg)));
  });
});

describe('buildIR — orphan decoration warning', () => {
  test('decoration without a matching connection becomes a warning', () => {
    const g = ir(`? [a, b]\n: { label: ghost }\n`);
    assert.ok(g.warnings.some(w => /sem aresta correspondente/.test(w.msg)));
    assert.equal(g.edges.length, 0);
  });
});

describe('buildIR — viewLayers / nodeLayers / edgeLayers', () => {
  test('viewLayers list becomes node.layers', () => {
    const g = ir(`a:\n  viewLayers: [public, security]\n`);
    assert.deepEqual(node(g, 'a').layers.sort(), ['public', 'security']);
  });

  test('nodeLayers list maps to weight 0 (yielding under collision)', () => {
    // Legacy default — list form is the "I belong to this layer; I yield"
    // shortcut. Explicit weight via the map form keeps the node anchored.
    const g = ir(`a:\n  nodeLayers: [svc]\n`);
    assert.equal(node(g, 'a').nodeCollision.get('svc'), 0);
  });

  test('nodeLayers map preserves explicit weights, clamped to [0, 1]', () => {
    const g = ir(`a:\n  nodeLayers: { svc: 0.5, dado: 1, neg: -0.3, big: 2 }\n`);
    const m = node(g, 'a').nodeCollision;
    assert.equal(m.get('svc'), 0.5);
    assert.equal(m.get('dado'), 1);
    assert.equal(m.get('neg'), 0);
    assert.equal(m.get('big'), 1);
  });

  test('edgeLayers on an edge maps to edge.edgeCollision', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { edgeLayers: { feixe: 0.5 } }\n`);
    assert.equal(g.edges[0].edgeCollision.get('feixe'), 0.5);
  });

  test('global layer set unions node + edge viewLayers', () => {
    const g = ir(`connections:\n  - [a, b]\na:\n  viewLayers: [public]\n? [a, b]\n: { viewLayers: [bus] }\n`);
    assert.ok(g.layers.includes('public'));
    assert.ok(g.layers.includes('bus'));
  });

  test('warning: aresta declara nodeLayers compartilhada com endpoint', () => {
    // 'a' declara nodeLayers [svc]; aresta a→b também declara [svc].
    // 'a' está em endpointAllowedSet da aresta → colisão neutralizada → warning.
    const g = ir(`connections:\n  - [a, b]\na:\n  nodeLayers: [svc]\n? [a, b]\n: { nodeLayers: [svc] }\n`);
    assert.ok(g.warnings.some(w => /nodeLayers: "svc".*"a".*\(endpoint\).*necessidade geom/.test(w.msg)),
      `esperado warning paradoxal, got: ${JSON.stringify(g.warnings.map(w => w.msg))}`);
  });

  test('warning: aresta declara nodeLayers compartilhada com ancestral', () => {
    // 'a' está dentro de container 'box'. Aresta a→b declara nodeLayers [svc].
    // 'box' (ancestral de a) também declara [svc] → warning identifica ancestral.
    const g = ir(`connections:\n  - [a, b]\nbox:\n  nodeLayers: [svc]\na:\n  parent: box\n? [a, b]\n: { nodeLayers: [svc] }\n`);
    assert.ok(g.warnings.some(w => /nodeLayers: "svc".*"box".*\(ancestral\)/.test(w.msg)),
      `esperado warning paradoxal com role ancestral, got: ${JSON.stringify(g.warnings.map(w => w.msg))}`);
  });

  test('sem warning quando nodeLayers não conflita com endpoint nem ancestral', () => {
    const g = ir(`connections:\n  - [a, b]\nc:\n  nodeLayers: [svc]\n? [a, b]\n: { nodeLayers: [svc] }\n`);
    // 'c' tem svc mas não é endpoint/ancestral de a→b → sem warning paradoxal.
    assert.ok(!g.warnings.some(w => /colisão será ignorada/.test(w.msg)),
      `não esperava warning paradoxal, got: ${JSON.stringify(g.warnings.map(w => w.msg))}`);
  });
});

describe('buildIR — parent / containers', () => {
  test('parent makes the target a container (hasChildren)', () => {
    const g = ir(`a:\n  parent: b\nb:\n  label: B\n`);
    assert.equal(node(g, 'a').parent, 'b');
    assert.equal(node(g, 'b').hasChildren, true);
    assert.equal(node(g, 'b').padding > 0, true);
  });

  test('unknown parent → warning, parent stays null', () => {
    const g = ir(`a:\n  parent: ghost\n`);
    assert.ok(g.warnings.some(w => /parent desconhecido/.test(w.msg)));
    assert.equal(node(g, 'a').parent, null);
  });

  test('parent cycle is detected and broken', () => {
    const g = ir(`a:\n  parent: b\nb:\n  parent: a\n`);
    assert.ok(g.warnings.some(w => /ciclo/.test(w.msg)));
    // One side wins (a → b) the other gets nulled.
    const a = node(g, 'a'), b = node(g, 'b');
    assert.ok(a.parent === null || b.parent === null);
  });
});

describe('buildIR — pin, size, padding', () => {
  test('pin as [x, y]', () => {
    const g = ir(`a:\n  pin: [120, 80]\n`);
    assert.deepEqual(node(g, 'a').pinned, { x: 120, y: 80 });
  });

  test('size as [w, h]', () => {
    const g = ir(`a:\n  size: [200, 60]\n`);
    assert.equal(node(g, 'a').width, 200);
    assert.equal(node(g, 'a').height, 60);
  });

  test('padding overrides the container default', () => {
    const g = ir(`a:\n  parent: outer\n  label: A\nouter:\n  padding: 42\n`);
    assert.equal(node(g, 'outer').padding, 42);
  });
});

describe('buildIR — constraints', () => {
  test('axis-y constraint', () => {
    const g = ir(`a:\n  constraint: { type: axis-y, value: 300 }\n`);
    assert.deepEqual(node(g, 'a').constraint, { type: 'axis', axis: 'y', value: 300 });
  });
  test('circle constraint accepts x/y or cx/cy', () => {
    const g = ir(`a:\n  constraint: { type: circle, x: 0, y: 0, r: 240 }\n`);
    assert.deepEqual(node(g, 'a').constraint, { type: 'circle', cx: 0, cy: 0, r: 240 });
  });
});

describe('buildIR — forces', () => {
  test('attractTo / repelFrom accept tag→weight maps', () => {
    const g = ir(`a:\n  attractTo: { data: 1, cache: 0.5 }\n  repelFrom: { client: 1 }\n`);
    const n = node(g, 'a');
    assert.equal(n.forces.attractTo.data, 1);
    assert.equal(n.forces.attractTo.cache, 0.5);
    assert.equal(n.forces.repelFrom.client, 1);
  });
});

describe('buildIR — options', () => {
  test('title / snapContainerAnchor land in meta', () => {
    const g = ir(`options:\n  title: T\n  snapContainerAnchor: off\n`);
    assert.equal(g.meta.title, 'T');
    assert.equal(g.meta.snapContainerAnchor, false);
  });
  test('snapContainerAnchor on/off coerced to boolean', () => {
    assert.equal(ir(`options:\n  snapContainerAnchor: on\n`).meta.snapContainerAnchor, true);
    assert.equal(ir(`options:\n  snapContainerAnchor: off\n`).meta.snapContainerAnchor, false);
  });
  test('unknown option → warning', () => {
    const g = ir(`options:\n  bogus: 1\n`);
    assert.ok(g.warnings.some(w => /options\.bogus desconhecido/.test(w.msg)));
  });
});

describe('buildIR — edge attrs (snap, onHidden)', () => {
  test('snap defaults to inherit, "on"/"off" accepted', () => {
    const g = ir(`connections:\n  - [a, b]\n  - [c, d]\n? [a, b]\n: { snap: off }\n? [c, d]\n: { snap: on }\n`);
    assert.equal(edge(g, 'a', 'b').snap, 'off');
    assert.equal(edge(g, 'c', 'd').snap, 'on');
  });
  test('onHidden=promote recognised', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { onHidden: promote }\n`);
    assert.equal(g.edges[0].onHidden, 'promote');
  });
  test('onHidden bogus falls back to omit', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { onHidden: bogus }\n`);
    assert.equal(g.edges[0].onHidden, 'omit');
  });
});

describe('buildIR — unknown attribute warnings', () => {
  test('unknown node attr → warning with suggestion', () => {
    const g = ir(`a:\n  labl: oops\n`);
    assert.ok(g.warnings.some(w => /labl/.test(w.msg) && /label/.test(w.msg)));
  });
  test('unknown edge attr → warning', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { laber: oops }\n`);
    assert.ok(g.warnings.some(w => /laber/.test(w.msg)));
  });
});

describe('buildIR — fase 5.1: options.routing meta', () => {
  test('routing default é objeto vazio', () => {
    const g = ir(`connections:\n  - [a, b]\n`);
    assert.deepEqual(g.meta.routing, {});
  });

  test('routing.engine + edgePad numérico aceitos', () => {
    const g = ir(`options:\n  routing:\n    engine: physics\n    edgePad: 6\nconnections:\n  - [a, b]\n`);
    assert.equal(g.meta.routing.engine, 'physics');
    assert.equal(g.meta.routing.edgePad, 6);
    assert.equal(g.warnings.length, 0);
  });

  test('routing.edgePad string "stroke" aceita (resolução fica em runtime)', () => {
    const g = ir(`options:\n  routing:\n    edgePad: stroke\nconnections:\n  - [a, b]\n`);
    assert.equal(g.meta.routing.edgePad, 'stroke');
  });

  test('routing.fission/fusion/snap propagados verbatim', () => {
    const src = `options:
  routing:
    fission:
      trigger: residual
      threshold: 4
      ticks: 5
    fusion:
      manhattanK: 4
      ticks: 10
    snap:
      criterion: nearest
      groups:
        cardinals: on
        vertices: off
connections:
  - [a, b]
`;
    const g = ir(src);
    assert.equal(g.meta.routing.fission.trigger, 'residual');
    assert.equal(g.meta.routing.fission.threshold, 4);
    assert.equal(g.meta.routing.fusion.manhattanK, 4);
    assert.equal(g.meta.routing.snap.criterion, 'nearest');
    // 'on'/'off' são propagados verbatim — coerção pra bool fica nas
    // sub-fases que consomem (5.3+).
    assert.equal(g.meta.routing.snap.groups.cardinals, 'on');
    assert.equal(g.meta.routing.snap.groups.vertices, 'off');
    assert.equal(g.warnings.length, 0);
  });

  test('routing.<chave-desconhecida> → warning com sugestão', () => {
    const g = ir(`options:\n  routing:\n    edgePadd: 6\nconnections:\n  - [a, b]\n`);
    assert.ok(g.warnings.some(w => /edgePadd/.test(w.msg) && /edgePad/.test(w.msg)),
      'warning deveria mencionar a chave errada E sugerir a correta');
  });

  test('routing escalar (não-mapa) → warning', () => {
    const g = ir(`options:\n  routing: 42\nconnections:\n  - [a, b]\n`);
    assert.ok(g.warnings.some(w => /options\.routing/.test(w.msg) && /mapa/.test(w.msg)));
  });
});

describe('buildIR — fase 5.1: node attrs novos', () => {
  test('shape: rect aceito sem warning', () => {
    const g = ir(`a:\n  shape: rect\n`);
    assert.equal(node(g, 'a').shape, 'rect');
    assert.equal(g.warnings.length, 0);
  });

  test('shape: star aceito (validação real fica em 5.2)', () => {
    const g = ir(`a:\n  shape: star\n`);
    assert.equal(node(g, 'a').shape, 'star');
  });

  test('snap como lista heterogênea propagada verbatim', () => {
    const src = `a:
  snap:
    - top
    - corner0
    - {angle: 45}
    - [0.25, 0]
    - {path: 0.75}
`;
    const g = ir(src);
    const n = node(g, 'a');
    assert.ok(Array.isArray(n.snap));
    assert.equal(n.snap.length, 5);
    assert.equal(n.snap[0], 'top');
    assert.deepEqual(n.snap[2], { angle: 45 });
    assert.deepEqual(n.snap[3], [0.25, 0]);
  });

  test('snapGroups, snapAngles, anchors propagados verbatim', () => {
    const g = ir(`a:\n  snapGroups: [cardinals, vertices]\n  snapAngles: [30, 60]\n  anchors:\n    main: top\n`);
    const n = node(g, 'a');
    assert.deepEqual(n.snapGroups, ['cardinals', 'vertices']);
    assert.deepEqual(n.snapAngles, [30, 60]);
    assert.deepEqual(n.anchors, { main: 'top' });
  });

  test('atributo desconhecido em node ainda gera warning (não vazou nos novos)', () => {
    const g = ir(`a:\n  shapee: rect\n`);
    assert.ok(g.warnings.some(w => /shapee/.test(w.msg) && /shape/.test(w.msg)));
  });
});

describe('buildIR — fase 5.1: edge.style', () => {
  test('style.strokeWidth + edgePad aceitos', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { style: { strokeWidth: 3, edgePad: 6 } }\n`);
    const e = g.edges[0];
    assert.deepEqual(e.style, { strokeWidth: 3, edgePad: 6 });
    assert.equal(g.warnings.length, 0);
  });

  test('style.<chave-desconhecida> → warning com sugestão', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { style: { strokWidth: 3 } }\n`);
    assert.ok(g.warnings.some(w => /strokWidth/.test(w.msg) && /strokeWidth/.test(w.msg)));
  });

  test('style.strokeWidth não-numérico → warning + ignora a chave', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { style: { strokeWidth: "abc" } }\n`);
    assert.ok(g.warnings.some(w => /strokeWidth/.test(w.msg) && /número/.test(w.msg)));
    // Outras chaves do mesmo style ainda passam — strokeWidth foi pulado.
    const e = g.edges[0];
    assert.equal(e.style, undefined, 'style sem chaves válidas vira undefined');
  });

  test('style.edgePad negativo → warning', () => {
    const g = ir(`connections:\n  - [a, b]\n? [a, b]\n: { style: { edgePad: -1 } }\n`);
    assert.ok(g.warnings.some(w => /edgePad/.test(w.msg)));
  });
});

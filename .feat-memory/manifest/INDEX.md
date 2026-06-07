# Índice de features

| ID | Nome | Status | Versão | ADRs | Depende |
|---|---|---|---|---|---|
| F-0001 | dsl-to-diagram | shipped | — | ADR-0002,ADR-0003,ADR-0004 | — |
| F-0002 | layout-adapters | shipped | — | ADR-0005 | F-0001 |
| F-0003 | edge-routers | shipped | — | ADR-0005 | F-0001 |
| F-0004 | containers-hierarchy | shipped | — | ADR-0002,ADR-0004 | F-0001 |
| F-0005 | collision-layers | shipped | — | ADR-0005 | F-0001,F-0002 |
| F-0006 | layer-filter | shipped | — | — | F-0001 |
| F-0007 | selection-gestures | shipped | — | — | F-0004 |
| F-0008 | viewport-pan-zoom | shipped | — | — | F-0001 |
| F-0009 | interactive-drag | shipped | — | — | F-0002,F-0007 |
| F-0010 | editor-tabs-highlight | shipped | — | — | F-0001 |
| F-0011 | structured-config | shipped | — | ADR-0007 | F-0010 |
| F-0012 | themes | shipped | — | — | — |
| F-0013 | persistence | shipped | — | ADR-0008 | F-0001 |
| F-0014 | splitter | shipped | — | — | F-0010,F-0013 |
| F-0015 | import-export | shipped | — | — | F-0001,F-0010 |
| F-0016 | edge-endpoint-styles | shipped | — | ADR-0003 | F-0001,F-0003 |
| F-0017 | physics-routing | shipped | — | ADR-0009 | F-0003,F-0005 |
| F-0018 | debug-overlay-export | shipped | — | — | F-0005,F-0008 |
| F-0019 | mobile-layout | shipped | — | — | F-0008,F-0010 |

_Gerado por `feat-memory audit` em 2026-06-07T05:50:25+00:00. Não edite manualmente._

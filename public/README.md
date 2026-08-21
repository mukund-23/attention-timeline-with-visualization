# The attention timeline

Every attention mechanism from May 2017 to December 2025, in the order it was published,
each explained as an answer to a problem that existed at that moment — with honest trade-offs.

Live: _(add Vercel URL after deploy)_

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # -> dist/
```

## Editing content

`CONTENT.md` is the source of truth for all 29 entries. Components never hold prose.

```bash
# edit CONTENT.md, then:
npm run registry   # regenerates src/data/registry.json
npm run build
```

The parser (`scripts/parse.py`, Python 3, no deps) enforces schema completeness and fails loudly
on a missing field. Dates marked `○` in CONTENT.md surface as "(unverified)" in the UI and are
counted in the footer — a date cannot silently ship as certain.

## Structure

```
CONTENT.md              all prose, source of truth
scripts/parse.py        CONTENT.md -> registry.json
src/data/registry.json  generated, committed
src/App.tsx             masthead, mode switch, prologue, closing
src/components/
  EntryCard.tsx         one entry: ledger, dates, tags
  MaskGlyph.tsx         42px attention-pattern glyph for the rail
  viz/
    index.tsx           entry id -> visualizer family
    MaskViz.tsx         mask heatmap + discard overlay      (8 entries)
    PositionViz.tsx     position / RoPE-scaling curves     (10 entries)
    KVViz.tsx           KV wiring + cache bytes             (4 entries)
    RecurrentViz.tsx    retrieval probe simulation          (7 entries)
    FlashViz.tsx        HBM traffic diagram                 (1 entry)
src/styles.css          all styling, no framework
```

## Dating rule

1. arXiv v1 submission date (not v2, not conference date)
2. Fallback: dated public post where no paper exists (NTK-aware scaling)
3. Fallback: artifact release date where the technique shipped before a paper (DSA)
4. A second "became standard" date appears only where the gap is >= 12 months AND a named
   release carries its own date

## Sources

_(source table goes here — see SOURCES section below, 13 rows still pending verification)_

## Stack

Vite + React 18 + TypeScript. No CSS framework, no backend, no runtime data fetching.
All visualizers compute in-browser.

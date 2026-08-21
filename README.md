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

**[SOURCES.md](SOURCES.md)** carries the full table: every entry, its arXiv ID, the v1 submission
timestamp where recorded, and a per-row verification status.

Dates were the part of this assignment most likely to be wrong and easiest to check, so the
verification state is published rather than assumed:

| Status | Meaning | Count |
|---|---|---:|
| `primary` | arXiv abstract page read directly | 18 |
| `secondary` | two or more independent sources agree, primary page not yet read | 10 |
| `user` | supplied by a human who opened the source directly | 1 |

Anything not `primary` renders with a visible **"(unverified)"** label in the app and is counted in
the site footer. The parser propagates this from a `○` marker in `CONTENT.md`, so a date cannot be
presented as certain by accident.

Three entries deserve mention:

- **NTK-aware RoPE scaling** has no paper. It is a Reddit post that became the default
  context-extension method in open-source models for roughly six months.
- **Learned absolute positions** appear in Gehring et al. 1611.02344 (2016-11-07), six months
  before the ConvS2S paper we date to. We follow the field's citation and record the discrepancy.
- **DSA** uses the artifact-release fallback — the model shipped before the report.

## Stack

Vite + React 18 + TypeScript. No CSS framework, no backend, no runtime data fetching.
All visualizers compute in-browser.

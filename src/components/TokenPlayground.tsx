import { useMemo, useState } from 'react'

type Kind = 'dense' | 'window' | 'sink' | 'strided' | 'bigbird' | 'block' | 'topk'

interface Mech {
  id: Kind
  name: string
  entry: string
  param?: [string, number, number, number]
  contentDependent?: boolean
  line: string
}

const MECHS: Mech[] = [
  { id: 'dense', name: 'Full attention', entry: 'scaled-dot-product-attention',
    line: 'Every word can reach every earlier word. Nothing is dropped — and you pay for all of it.' },
  { id: 'strided', name: 'Sparse Transformer', entry: 'sparse-transformer', param: ['Stride', 2, 6, 3],
    line: 'A fixed pattern decided before your sentence existed. It cannot know which of your words mattered.' },
  { id: 'window', name: 'Sliding window', entry: 'longformer', param: ['Window', 1, 12, 4],
    line: 'Each word sees only its neighbours. Distant links survive only by hopping through layers.' },
  { id: 'bigbird', name: 'BigBird', entry: 'bigbird', param: ['Window', 1, 8, 2],
    line: 'Local window, the first words as global anchors, plus random long-range edges.' },
  { id: 'topk', name: 'Top-k', entry: 'top-k-attention', param: ['k', 1, 12, 4], contentDependent: true,
    line: 'Chosen by content rather than position — but every score had to be computed first to find the top k.' },
  { id: 'sink', name: 'Attention sinks', entry: 'attention-sinks', param: ['Window', 1, 12, 4],
    line: 'Sliding window, except the first few words are never evicted. That one difference is the whole paper.' },
  { id: 'block', name: 'Native Sparse Attention', entry: 'native-sparse-attention', param: ['Block', 2, 5, 3],
    line: 'Whole blocks are kept or dropped, because contiguous blocks are what GPUs read efficiently.' },
]

const DEFAULT = 'The cat sat on the mat because it was warm and the sun came through the window'

const STOP = new Set(['the', 'a', 'an', 'of', 'to', 'in', 'on', 'and', 'is', 'was', 'it',
  'that', 'this', 'for', 'as', 'at', 'by', 'with', 'be', 'are', 'were', 'he', 'she', 'they'])

function tokenize(s: string) {
  return s.trim().split(/\s+/).filter(Boolean).slice(0, 26)
}

/** Deterministic salience stand-in: rarity + recency. NOT a model's attention. */
function salience(tokens: string[], i: number, j: number) {
  const t = tokens[j].toLowerCase().replace(/[^a-z0-9]/g, '')
  const rare = STOP.has(t) ? 0 : Math.min(1, t.length / 8)
  const same = t && t === tokens[i].toLowerCase().replace(/[^a-z0-9]/g, '') ? 0.6 : 0
  const recency = 1 / (1 + (i - j) * 0.35)
  return rare * 0.5 + recency * 0.5 + same
}

function visible(kind: Kind, p: number, tokens: string[]) {
  return (i: number, j: number): boolean => {
    if (j > i) return false
    switch (kind) {
      case 'dense': return true
      case 'window': return i - j < p
      case 'sink': return j < 3 || i - j < p
      case 'strided': return i - j < 2 || j % p === 0
      case 'bigbird': return i - j < p || j < 2 || (i * 7 + j * 13) % 9 === 0
      case 'block': {
        const bi = Math.floor(i / p), bj = Math.floor(j / p)
        return bi === bj || bj === 0
      }
      case 'topk': {
        const row: [number, number][] = []
        for (let c = 0; c <= i; c++) row.push([c, salience(tokens, i, c)])
        row.sort((a, b) => b[1] - a[1])
        return row.slice(0, Math.min(p, row.length)).some(r => r[0] === j)
      }
    }
  }
}

export default function TokenPlayground() {
  const [text, setText] = useState(DEFAULT)
  const [mi, setMi] = useState(2)
  const [p, setP] = useState(4)
  const [query, setQuery] = useState<number | null>(null)

  const mech = MECHS[mi]
  const tokens = useMemo(() => tokenize(text), [text])
  const q = query !== null && query < tokens.length ? query : tokens.length - 1

  const { kept, causal, blocked, farthest } = useMemo(() => {
    const f = visible(mech.id, p, tokens)
    let kept = 0, causal = 0
    const blocked: number[] = []
    let farthest: [number, number] | null = null
    for (let i = 0; i < tokens.length; i++) {
      for (let j = 0; j <= i; j++) {
        causal++
        if (f(i, j)) kept++
        else {
          if (i === q) blocked.push(j)
          if (!farthest || i - j > farthest[0] - farthest[1]) farthest = [i, j]
        }
      }
    }
    return { kept, causal, blocked, farthest }
  }, [mech.id, p, tokens, q])

  const f = visible(mech.id, p, tokens)
  const cell = Math.max(11, Math.min(20, Math.floor(420 / Math.max(tokens.length, 1))))

  const selectMech = (n: number) => {
    setMi(n)
    setP(MECHS[n].param ? MECHS[n].param![3] : 0)
  }

  return (
    <section className="tool playground">
      <div className="wrap">
        <h2>Type a sentence. Watch a mechanism throw half of it away.</h2>
        <p className="toollede">
          Every entry below describes a trade. This is the trade, applied to words you chose. Pick a
          word to make it the one doing the looking, then switch mechanisms and see what it can no
          longer reach.
        </p>

        <input className="pgtext" value={text} onChange={e => setText(e.target.value)}
          aria-label="Sentence to visualise" spellCheck={false} />

        <div className="pgmechs" role="group" aria-label="Attention mechanism">
          {MECHS.map((m, n) => (
            <button key={m.id} aria-pressed={n === mi} onClick={() => selectMech(n)}>{m.name}</button>
          ))}
        </div>

        <div className="pgbody">
          <div className="pgleft">
            <p className="label">
              What <b className="pgqword">{tokens[q] ?? '—'}</b> can see
            </p>
            <p className="pgsentence">
              {tokens.map((t, j) => {
                const state = j > q ? 'future' : f(q, j) ? 'seen' : 'blocked'
                return (
                  <button key={j} className={`pgtok ${state}${j === q ? ' isq' : ''}`}
                    onClick={() => setQuery(j)}
                    title={j > q ? 'later in the sentence' : state === 'seen' ? 'visible' : 'cannot be reached'}>
                    {t}
                  </button>
                )
              })}
            </p>

            <p className="pgverdict">
              {blocked.length === 0
                ? <>Nothing is hidden from <b>{tokens[q]}</b>. This is full attention, and this is the bill.</>
                : <>
                    <b>{tokens[q]}</b> cannot reach{' '}
                    <span className="pgcost">
                      {blocked.slice(0, 4).map(j => tokens[j]).join(', ')}
                      {blocked.length > 4 && ` and ${blocked.length - 4} more`}
                    </span>. Those links must travel through later layers, or not at all.
                  </>}
            </p>

            {mech.param && (
              <label className="viz-ctl">
                <span>{mech.param[0]}</span>
                <input type="range" min={mech.param[1]} max={mech.param[2]} step={1}
                  value={p} onChange={e => setP(+e.target.value)} />
                <b>{p}</b>
              </label>
            )}

            <p className="pgline">{mech.line} <a href={`#${mech.entry}`}>Read the entry →</a></p>
          </div>

          <div className="pgright">
            <div className="pgstat">
              <b>{kept}</b> of {causal} pairs kept
              {kept < causal && <> · <span className="pgcost">{causal - kept} dropped</span></>}
            </div>
            <svg width={tokens.length * cell + 1} height={tokens.length * cell + 1}
              viewBox={`0 0 ${tokens.length * cell + 1} ${tokens.length * cell + 1}`}
              role="img" aria-label={`Mask grid: ${kept} of ${causal} word pairs kept`}>
              {tokens.map((_, i) => tokens.map((_, j) => {
                const x = j * cell, y = i * cell
                if (j > i) return <rect key={`${i}-${j}`} x={x} y={y} width={cell - 1} height={cell - 1} fill="none" stroke="#E4E9E7" strokeWidth={0.5} />
                const ok = f(i, j)
                return <rect key={`${i}-${j}`} x={x} y={y} width={cell - 1} height={cell - 1}
                  fill={ok ? '#21506E' : '#B08A2A'} opacity={ok ? (i === q ? 1 : 0.6) : (i === q ? 0.7 : 0.28)} />
              }))}
              <rect x={0} y={q * cell} width={tokens.length * cell} height={cell - 1}
                fill="none" stroke="#14181B" strokeWidth={1} />
            </svg>
            <p className="pgaxis">rows = the word looking · columns = the word looked at</p>
            {farthest && (
              <p className="pgfine">
                Longest broken link in this sentence: <b>{tokens[farthest[0]]}</b> to{' '}
                <b>{tokens[farthest[1]]}</b>, {farthest[0] - farthest[1]} words apart.
              </p>
            )}
          </div>
        </div>

        <p className="pgdisclaimer">
          This shows the <strong>mask</strong> — which word pairs a mechanism permits — and that part
          is exactly true. It does not show attention weights, because there is no model running
          here.{mech.contentDependent && <> Top-k needs content scores to pick its k, so this uses a
          deterministic stand-in based on word rarity and recency. It is not a language model's
          judgement and should not be read as one.</>}
        </p>
      </div>
    </section>
  )
}

import { useState } from 'react'
import registry from './data/registry.json'
import type { Entry, Mode } from './types'
import EntryCard from './components/EntryCard'
import ThreadBar, { THREADS } from './components/ThreadBar'
import KVCalculator from './components/KVCalculator'
import RegimeConfigurator from './components/RegimeConfigurator'
import TokenPlayground from './components/TokenPlayground'
import VantagePoints from './components/VantagePoints'

const entries = registry as Entry[]
const SHORT = ['scaled-dot-product-attention', 'rotary-position-embeddings',
  'grouped-query-attention', 'longformer', 'flashattention', 'gated-deltanet']

export default function App() {
  const [mode, setMode] = useState<Mode>('full')
  const [thread, setThread] = useState<string | null>(null)
  const counts = Object.fromEntries(
    THREADS.map(t => [t.id, entries.filter(e => e.threads.includes(t.id)).length]))
  const shown = mode === 'short' ? entries.filter(e => SHORT.includes(e.id)) : entries
  const pending = entries.filter(e => e.dateUnverified).length

  return (
    <>
      <a className="skip" href="#timeline">Skip to the timeline</a>

      <header className="masthead">
        <div className="wrap">
          <p className="eyebrow">Every mechanism, in the order it arrived</p>
          <h1>Attention was never wrong. It was expensive.</h1>
          <p className="standfirst">
            Twenty-nine mechanisms between May 2017 and December 2025, in the order they were
            published — not the order they get taught. Each one is somebody looking at the bill
            for the last one and trying to pay less of it. Each one gives something up to do it.
          </p>
          <div className="meta">
            <span>29 entries</span>
            <span>2017-05-08 → 2025-12-13</span>
            <span>every date sourced</span>
          </div>
        </div>
      </header>

      <nav className="modebar" aria-label="Reading mode">
        <div className="wrap">
          <div className="modes" role="group">
            <button aria-pressed={mode === 'short'} onClick={() => setMode('short')}>
              Short path — 6
            </button>
            <button aria-pressed={mode === 'full'} onClick={() => setMode('full')}>
              Full timeline — 29
            </button>
          </div>
          <span className="modehint">
            {mode === 'short'
              ? 'The six that answer "how does attention work now". About five minutes.'
              : 'Strictly chronological. Nothing grouped by family.'}
          </span>
        </div>
      </nav>

      {mode === 'full' && (
        <ThreadBar active={thread} onToggle={setThread} counts={counts} />
      )}

      {mode === 'full' && (
        <section className="prologue">
          <div className="wrap">
            <h2>Before the timeline starts</h2>
            <p>
              Attention was not invented by the Transformer. Bahdanau, Cho and Bengio introduced it
              in September 2014 to fix a specific failure: encoder–decoder translation crushed an
              entire source sentence into one fixed-length vector, and quality collapsed as sentences
              got longer. Their fix was to let the decoder look back at every encoder state and score
              each one, so the context vector differed for every output token. Luong, Pham and Manning
              replaced that scoring network with a plain dot product in August 2015, making it a single
              matrix multiply instead of a small neural network.
            </p>
            <p>
              Both still rode on a recurrent network, so training stayed sequential. That is the setup
              for everything below: attention worked, and it was chained to something slow.
            </p>
            <p className="pullquote">
              Every mechanism after 2017 is somebody reading that bill and trying to pay less of it.
            </p>
          </div>
        </section>
      )}

      <TokenPlayground />

      <main className="timeline" id="timeline">
        <div className="wrap">
          {shown.map(e => (
            <EntryCard key={e.id} e={e}
              dim={thread !== null && !e.threads.includes(thread)} />
          ))}
        </div>
      </main>

      <KVCalculator />
      <RegimeConfigurator />
      <VantagePoints />

      <section className="closing">
        <div className="wrap">
          <h2>What the shape of this tells you</h2>
          <h3>It wanted exactness (2017–2019)</h3>
          <p>Attention becomes self-attention, then the whole architecture. Nobody is economising yet — the costs are being discovered, not paid.</p>
          <h3>It wanted cheapness (2019–2021)</h3>
          <p>The quadratic bill arrives and everything attacks it: sparse patterns, low-rank projection, random features, kernel tricks. All approximate. All pay in accuracy.</p>
          <h3>It wanted exactness back (2022)</h3>
          <p>FlashAttention argues the bill was being misread — the binding constraint was memory bandwidth, not arithmetic — and cuts cost while keeping the result exact, paying in kernel complexity instead. Activity in the approximation line drops off over the following years.</p>
          <h3>It wanted length (2023)</h3>
          <p>RoPE is everywhere and RoPE breaks past its training length. Position Interpolation, NTK-aware scaling and YaRN land within ten weeks of each other. Attention sinks explain why streaming had been failing.</p>
          <h3>It wanted memory back (2019, then 2024–2025)</h3>
          <p>The KV cache becomes the binding constraint. Multi-query attention had been sitting unused since 2019; grouped-query makes it palatable, latent attention compresses instead of discarding. In parallel the recurrent branch, dormant since 2020, returns with the delta rule made parallel, then gated, then gated per channel.</p>
          <h3>And then it questioned the premise (2025–)</h3>
          <p>Native and DeepSeek sparse attention revive 2019 ideas with hardware alignment and learned selection. DroPE asks whether the positional machinery every model has carried since 2017 is needed at all after training.</p>

          <p className="thesis">
            Attention was never replaced because it was wrong. Each generation found a different line
            on the bill — compute, bandwidth, cache, context, retention — and traded something to
            shrink it. Once, someone read the bill properly and found a charge that did not need paying.
          </p>

          <h3>The gap is the real lesson</h3>
          <p>
            Multi-query attention waited four years to matter. The delta rule waited three. Sliding
            windows waited three and a half. Sparse attention waited six. In none of those cases did
            the idea improve while it waited — some other constraint changed around it. Model scale,
            context demand, or hardware. If you want to guess what comes next, the useful question is
            not which idea is best. It is which constraint is about to move.
          </p>
        </div>
      </section>

      <footer>
        <div className="wrap">
          <p>
            Dates are arXiv v1 submission dates unless noted. Fallbacks, in order: a dated public post
            where no paper exists, then artifact release date. A second date appears only where a
            mechanism took twelve months or more to reach a named release. Full source table in the
            repository README. {pending} dates are pending primary verification and marked as such.
          </p>
        </div>
      </footer>
    </>
  )
}

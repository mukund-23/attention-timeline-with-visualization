import { useState } from 'react'

interface Pick { axis: string; choice: string; why: string; entry?: string }
interface Regime {
  id: string; label: string; sub: string; framing: string
  picks: Pick[]; avoid: { what: string; why: string }[]
}

const REGIMES: Regime[] = [
  {
    id: 'chat', label: '2K chatbot', sub: 'short turns, latency-sensitive, quality first',
    framing: 'Almost nothing on this timeline after 2021 is for you. At 2K tokens the quadratic cost is affordable and the cache is small, so the mechanisms that trade quality for scale are trading away the only thing you care about.',
    picks: [
      { axis: 'Attention', choice: 'Dense, with FlashAttention kernels', why: 'Exact, and at this length the cost is not a problem. Sparsity would discard pairs to save an expense you are not incurring.', entry: 'flashattention' },
      { axis: 'Position', choice: 'RoPE at default base', why: 'You are inside the trained range, so none of the scaling machinery applies. No interpolation, no base change, nothing to tune.', entry: 'rotary-position-embeddings' },
      { axis: 'KV', choice: 'GQA, or MHA if quality is paramount', why: 'The cache is small enough that MHA is affordable. GQA costs a little quality for throughput; take it only if you are throughput-bound.', entry: 'grouped-query-attention' },
    ],
    avoid: [
      { what: 'MLA', why: 'Substantial implementation and training complexity to solve a cache problem you do not have.' },
      { what: 'Sliding window', why: 'Your context is shorter than a sensible window. You would be adding a mask that masks nothing, or one that hurts.' },
      { what: 'Linear or recurrent attention', why: 'Gives up exact recall to buy length. You have no length to buy.' },
      { what: 'Any RoPE scaling', why: 'Interpolation measurably degrades short-context performance. You are all short context.' },
    ],
  },
  {
    id: 'rag', label: '128K RAG', sub: 'long documents, retrieval accuracy is the product',
    framing: 'The hard part is that a model can have 128K of context and not use it. Extended context and effective context are different numbers, and for retrieval work only the second one counts.',
    picks: [
      { axis: 'Position', choice: 'Trained long natively, or RoPE + YaRN', why: 'YaRN extends furthest per unit of fine-tuning and preserves short-context behaviour via dynamic scaling. Native long training beats any post-hoc extension if you can afford it.', entry: 'yarn' },
      { axis: 'KV', choice: 'GQA at minimum; MLA if training from scratch', why: 'At 128K the cache is the binding constraint on batch size, and batch size is your throughput.', entry: 'multi-head-latent-attention' },
      { axis: 'Attention', choice: 'Dense with FlashAttention, or DSA if adapting a checkpoint', why: 'Retrieval is content-dependent, so content-blind sparsity is the wrong kind. DSA selects by learned relevance and can be retrofitted.', entry: 'deepseek-sparse-attention' },
    ],
    avoid: [
      { what: 'Pure linear or recurrent attention', why: 'A fixed-size state degrades exactly on associative recall, which is the entire job here.' },
      { what: 'ALiBi', why: 'Extrapolates perplexity well while using far context weakly. Perplexity is not your metric.' },
      { what: 'Sliding window alone', why: 'Needle-in-a-haystack is precisely where a local window fails most visibly.' },
      { what: 'Trusting the advertised window', why: 'Measure effective context on your own retrieval task. Models routinely fail well before their stated limit.' },
    ],
  },
  {
    id: 'agent', label: '1M agent', sub: 'long-running, tool-calling, cost per session dominates',
    framing: 'At a million tokens no single mechanism is sufficient and the honest answer is a hybrid. Every strong 2025 model in this regime interleaves cheap layers with a minority of exact-attention layers, which is the field conceding that a fixed state cannot do retrieval.',
    picks: [
      { axis: 'Attention', choice: 'Hybrid — sparse or linear layers, some full-attention layers', why: 'Cheap layers carry the bulk; a minority of full-attention layers preserve exact retrieval. Kimi Linear uses roughly 3:1, though the ratio is empirical and likely task-dependent.', entry: 'kda' },
      { axis: 'KV', choice: 'MLA or DSA', why: 'At 1M tokens the cache dominates everything else in the cost model. Compressing per-token state and reducing attended tokens are complementary, not alternatives.', entry: 'multi-head-latent-attention' },
      { axis: 'Streaming', choice: 'Attention sinks, if the session outlives the window', why: 'Keeps a long-running session fluent at constant memory. It maintains fluency, not recall — pair it with real retrieval.', entry: 'attention-sinks' },
      { axis: 'Position', choice: 'Native long training; extension alone will not carry you', why: 'YaRN to 128K is well-trodden. A million is a different problem, and post-hoc scaling degrades before you get there.', entry: 'yarn' },
    ],
    avoid: [
      { what: 'Dense attention throughout', why: 'Not affordable at this length, whatever your kernels.' },
      { what: 'Pure recurrent architectures', why: 'Constant memory is exactly what you want, and the recall loss is exactly what you cannot have. Hence hybrids.' },
      { what: 'Assuming benchmarks transfer', why: 'Most reported long-context numbers in this regime come from the lab that built the model. Verify on your workload.' },
    ],
  },
]

export default function RegimePicker() {
  const [sel, setSel] = useState(0)
  const r = REGIMES[sel]
  return (
    <section className="tool alt">
      <div className="wrap">
        <h2>Right for one workload, wrong for another</h2>
        <p className="toollede">
          A mechanism that suits a 2K chatbot and fails a 1M agent is not a bad mechanism. Pick a
          regime and the same twenty-nine entries sort into different answers.
        </p>

        <div className="regimetabs" role="tablist">
          {REGIMES.map((x, i) => (
            <button key={x.id} role="tab" aria-selected={i === sel} onClick={() => setSel(i)}>
              <b>{x.label}</b>
              <i>{x.sub}</i>
            </button>
          ))}
        </div>

        <p className="regimeframing">{r.framing}</p>

        <div className="regimecols">
          <div>
            <p className="label">What you would pick</p>
            {r.picks.map(p => (
              <div className="regimepick" key={p.axis}>
                <span className="regimeaxis">{p.axis}</span>
                <p className="regimechoice">
                  {p.entry ? <a href={`#${p.entry}`}>{p.choice}</a> : p.choice}
                </p>
                <p className="regimewhy">{p.why}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="label">What you would not</p>
            {r.avoid.map(a => (
              <div className="regimeavoid" key={a.what}>
                <span className="regimeaxis cost">{a.what}</span>
                <p className="regimewhy">{a.why}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

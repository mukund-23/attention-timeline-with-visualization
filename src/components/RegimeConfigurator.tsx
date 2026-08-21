import { useMemo, useState } from 'react'

interface Rec { axis: string; choice: string; why: string; entry?: string }
interface Avoid { what: string; why: string; entry?: string }

const CTX = [2, 8, 32, 128, 512, 1024] // K tokens

export default function RegimeConfigurator() {
  const [ctxIdx, setCtxIdx] = useState(0)
  const [scratch, setScratch] = useState(false)
  const [retrieval, setRetrieval] = useState(true)
  const [streaming, setStreaming] = useState(false)
  const [tight, setTight] = useState(false)

  const k = CTX[ctxIdx]

  const { recs, avoid, verdict } = useMemo(() => {
    const recs: Rec[] = []
    const avoid: Avoid[] = []

    // --- attention pattern ---
    if (k <= 8) {
      recs.push({ axis: 'Attention', choice: 'Dense, with FlashAttention kernels', entry: 'flashattention',
        why: `At ${k}K the quadratic cost is affordable. Sparsity would discard pairs to save an expense you are not really incurring.` })
      avoid.push({ what: 'Any sparse pattern', entry: 'longformer',
        why: 'Your context is short enough that a mask either masks nothing or costs you real information.' })
    } else if (k <= 128) {
      recs.push({ axis: 'Attention', choice: retrieval ? 'Dense with FlashAttention, or DSA if adapting a checkpoint' : 'Sliding window, or dense if you can afford it',
        entry: retrieval ? 'deepseek-sparse-attention' : 'longformer',
        why: retrieval
          ? 'Retrieval is content-dependent, so content-blind sparsity is the wrong kind. DSA selects by learned relevance and retrofits onto a trained model.'
          : 'If the useful context is genuinely local, a window is linear and drops in without retraining.' })
    } else {
      recs.push({ axis: 'Attention', choice: 'Hybrid — cheap layers plus a minority of full-attention layers', entry: 'kda',
        why: `At ${k >= 1024 ? 'a million tokens' : `${k}K`} no single mechanism is sufficient. Cheap layers carry the bulk; a few exact layers preserve retrieval. Kimi Linear uses roughly 3:1, though the ratio is empirical.` })
      avoid.push({ what: 'Dense attention throughout', entry: 'scaled-dot-product-attention',
        why: 'Not affordable at this length, whatever your kernels.' })
    }

    // --- position ---
    if (k <= 8) {
      recs.push({ axis: 'Position', choice: 'RoPE at default base', entry: 'rotary-position-embeddings',
        why: 'You are inside the trained range, so none of the scaling machinery applies. Nothing to tune.' })
      avoid.push({ what: 'PI, NTK or YaRN scaling', entry: 'position-interpolation',
        why: 'Interpolation measurably degrades short-context quality. You are all short context.' })
    } else if (k <= 128) {
      recs.push({ axis: 'Position', choice: scratch ? 'Train long natively' : 'RoPE + YaRN', entry: 'yarn',
        why: scratch
          ? 'Native long training beats any post-hoc extension if you are paying for pretraining anyway.'
          : 'YaRN extends furthest per unit of fine-tuning and preserves short-context behaviour via dynamic scaling.' })
    } else {
      recs.push({ axis: 'Position', choice: 'Native long training — extension alone will not carry you', entry: 'yarn',
        why: 'YaRN to 128K is well-trodden. Beyond that, post-hoc scaling degrades before you arrive.' })
    }

    // --- KV ---
    if (k <= 8 && !tight) {
      recs.push({ axis: 'KV cache', choice: 'GQA, or MHA if quality is paramount', entry: 'grouped-query-attention',
        why: 'The cache is small at this length. Take GQA only if you are throughput-bound.' })
      avoid.push({ what: 'MLA', entry: 'multi-head-latent-attention',
        why: 'Substantial training and implementation complexity to solve a cache problem you do not have.' })
    } else if (scratch && k >= 32) {
      recs.push({ axis: 'KV cache', choice: 'MLA', entry: 'multi-head-latent-attention',
        why: 'Compressing the cache into a learned latent beats discarding KV heads — but only worth it from scratch, since there is no cheap conversion path.' })
    } else {
      recs.push({ axis: 'KV cache', choice: 'GQA', entry: 'grouped-query-attention',
        why: scratch
          ? 'A tunable point between MHA quality and MQA speed, and the default in most current open models.'
          : 'An existing MHA checkpoint converts by mean-pooling for roughly 5% of pretraining compute. MLA has no equivalent.' })
      if (k >= 32) avoid.push({ what: 'MQA', entry: 'multi-query-attention',
        why: 'Collapsing to one KV head costs more quality than GQA for a marginal further saving.' })
    }

    // --- conditional extras ---
    if (streaming) {
      recs.push({ axis: 'Streaming', choice: 'Attention sinks', entry: 'attention-sinks',
        why: 'Keeps a long-running session fluent at constant memory. It maintains fluency, not recall — pair it with real retrieval.' })
    }
    if (tight && k >= 128) {
      recs.push({ axis: 'Memory', choice: 'A linear or recurrent layer in the stack', entry: 'gated-deltanet',
        why: 'Constant-size state is the only thing that stops the cache growing with the session.' })
    }
    if (retrieval) {
      avoid.push({ what: 'Pure linear or recurrent attention', entry: 'linear-attention',
        why: 'A fixed-size state degrades exactly on associative recall, which is the job you said matters.' })
      if (k >= 32) avoid.push({ what: 'ALiBi', entry: 'alibi',
        why: 'Extrapolates perplexity well while using far context weakly. Perplexity is not your metric.' })
    }
    if (k >= 128) avoid.push({ what: 'Trusting the advertised window', entry: 'yarn',
      why: 'Extended context and effective context are different numbers. Measure on your own task.' })

    const verdict =
      k <= 8
        ? 'Almost nothing on this timeline after 2021 is for you, and that is the correct answer rather than a disappointing one.'
        : k <= 128
          ? 'This is the regime the 2023 context-extension work was built for. The open question is whether your model uses the context it claims to have.'
          : 'No single mechanism covers this. Every strong model in this regime is a hybrid, which is the field conceding that a fixed state cannot do retrieval.'

    return { recs, avoid, verdict }
  }, [k, scratch, retrieval, streaming, tight])

  return (
    <section className="tool alt">
      <div className="wrap">
        <h2>Right for one workload, wrong for another</h2>
        <p className="toollede">
          A mechanism that suits a 2K chatbot and fails a 1M agent is not a bad mechanism. Describe
          what you are building and the same twenty-nine entries sort themselves differently.
        </p>

        <div className="cfg">
          <label className="cfgctx">
            <span>Context length</span>
            <input type="range" min={0} max={CTX.length - 1} step={1} value={ctxIdx}
              onChange={e => setCtxIdx(+e.target.value)} />
            <b>{k >= 1024 ? '1M' : `${k}K`}</b>
          </label>
          <div className="cfgtoggles">
            {([
              ['Training from scratch', scratch, setScratch],
              ['Retrieval accuracy is the product', retrieval, setRetrieval],
              ['Long-running / streaming session', streaming, setStreaming],
              ['Memory-constrained serving', tight, setTight],
            ] as const).map(([label, val, set]) => (
              <label key={label} className="cfgtoggle">
                <input type="checkbox" checked={val}
                  onChange={e => (set as (b: boolean) => void)(e.target.checked)} />
                {label}
              </label>
            ))}
          </div>
        </div>

        <p className="regimeframing">{verdict}</p>

        <div className="regimecols">
          <div>
            <p className="label">What you would pick</p>
            {recs.map(r => (
              <div className="regimepick" key={r.axis + r.choice}>
                <span className="regimeaxis">{r.axis}</span>
                <p className="regimechoice">
                  {r.entry ? <a href={`#${r.entry}`}>{r.choice}</a> : r.choice}
                </p>
                <p className="regimewhy">{r.why}</p>
              </div>
            ))}
          </div>
          <div>
            <p className="label">What you would not</p>
            {avoid.length === 0
              ? <p className="regimewhy">Nothing is clearly ruled out by this configuration.</p>
              : avoid.map(a => (
                <div className="regimeavoid" key={a.what}>
                  <span className="regimeaxis cost">
                    {a.entry ? <a href={`#${a.entry}`}>{a.what}</a> : a.what}
                  </span>
                  <p className="regimewhy">{a.why}</p>
                </div>
              ))}
          </div>
        </div>

        <p className="calcfine">
          These are rules of thumb derived from the trade-offs on this page, not benchmark results.
          They are a starting point for your own measurement, not a substitute for it.
        </p>
      </div>
    </section>
  )
}

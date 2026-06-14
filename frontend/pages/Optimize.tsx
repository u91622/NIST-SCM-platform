import { useState } from 'react'
import { api } from '../lib/api'
import { Skeleton } from '../components/Skeleton'
import { ErrorMsg } from '../components/ErrorMsg'
import { RiskBadge } from '../components/RiskBadge'
import type { OptimizationResult, DatasetCode } from '../types'

export function Optimize({ dataset }: { dataset: DatasetCode }) {
  const [deadline, setDeadline] = useState(30)
  const [budget, setBudget]     = useState(50000)
  const [volume, setVolume]     = useState(100)
  const [result, setResult]     = useState<OptimizationResult|null>(null)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string|null>(null)

  async function run() {
    setLoading(true); setError(null)
    try { setResult(await api.optimize(dataset, deadline, budget, volume) as OptimizationResult) }
    catch(e){ setError(e instanceof Error ? e.message : String(e)) }
    finally { setLoading(false) }
  }

  const INCO_COLOR: Record<string,string> = { DDP:'var(--success)', CIF:'var(--primary)', FOB:'var(--warning)' }
  const MODE_COLOR: Record<string,string>  = { Air:'var(--primary)', Sea:'var(--text-muted)' }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'2rem',maxWidth:900}}>
      <div>
        <h1 style={{fontSize:'1.4rem',fontWeight:700,marginBottom:4}}>Logistics Optimizer</h1>
        <p style={{color:'var(--text-muted)',fontSize:'0.88rem'}}>Enter project constraints — the optimizer computes feasible Air/Sea × Incoterms combinations with cost, lead time & risk trade-offs.</p>
      </div>

      {/* Input form */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-xl)',padding:'1.5rem',display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'1.25rem',alignItems:'end'}}>
        {[
          {label:'Deadline (days)',value:deadline,min:1,max:365,setter:setDeadline,sub:'From order to arrival'},
          {label:'Budget (USD)',value:budget,min:0,max:10000000,step:5000,setter:setBudget,sub:'Total shipment budget'},
          {label:'Volume (units)',value:volume,min:1,max:100000,setter:setVolume,sub:'Units to ship'},
        ].map(f=>(
          <div key={f.label}>
            <label style={{display:'block',fontSize:'0.78rem',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{f.label}</label>
            <input type="number" value={f.value} min={f.min} max={f.max} step={(f as {step?:number}).step||1}
              onChange={e=>f.setter(Number(e.target.value))}
              style={{width:'100%',padding:'0.55rem 0.75rem',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',background:'var(--bg)',color:'var(--text)',fontSize:'0.95rem'}}/>
            <div style={{fontSize:'0.72rem',color:'var(--text-faint)',marginTop:3}}>{f.sub}</div>
          </div>
        ))}
        <div>
          <button onClick={run} disabled={loading}
            style={{width:'100%',padding:'0.6rem 1rem',borderRadius:'var(--radius-md)',border:'none',background:'var(--primary)',color:'white',fontWeight:700,fontSize:'0.9rem',cursor:loading?'wait':'pointer',opacity:loading?0.7:1}}>
            {loading ? 'Computing…' : '◈ Run Optimizer'}
          </button>
        </div>
      </div>

      {error && <ErrorMsg msg={error}/>}
      {loading && <Skeleton h="16rem"/>}

      {result && !loading && (
        <>
          <div>
            <h2 style={{fontSize:'1rem',fontWeight:600,marginBottom:'0.75rem'}}>
              Feasible Scenarios — Deadline: {result.deadline_days}d | Budget: USD {result.budget_usd.toLocaleString()} | {volume} units
            </h2>
            {result.scenarios.length === 0 && (
              <div style={{padding:'1.5rem',textAlign:'center',color:'var(--text-muted)',border:'1px dashed var(--border)',borderRadius:'var(--radius-lg)'}}>
                No feasible scenarios within these constraints. Try increasing budget or deadline.
              </div>
            )}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:'1rem'}}>
              {result.scenarios.map((s,i)=>{
                const [modeLabel,incoLabel] = s.recommended_mode.replace(' (over budget)','').split(' + ')
                const isOverBudget = s.scenario_name.includes('over_budget')
                return (
                  <div key={s.scenario_name} style={{
                    background: i===0 && !isOverBudget ? 'var(--primary-hl)' : 'var(--surface)',
                    border:`1px solid ${i===0 && !isOverBudget ? 'var(--primary)' : 'var(--border)'}`,
                    borderRadius:'var(--radius-xl)',padding:'1.25rem',position:'relative',
                  }}>
                    {i===0 && !isOverBudget && (
                      <span style={{position:'absolute',top:'0.75rem',right:'0.75rem',fontSize:'0.7rem',fontWeight:700,color:'var(--primary)',background:'white',padding:'2px 8px',borderRadius:'var(--radius-full)',border:'1px solid var(--primary)'}}>Recommended</span>
                    )}
                    {isOverBudget && (
                      <span style={{position:'absolute',top:'0.75rem',right:'0.75rem',fontSize:'0.7rem',fontWeight:700,color:'var(--warning)',background:'white',padding:'2px 8px',borderRadius:'var(--radius-full)',border:'1px solid var(--warning)'}}>Over Budget</span>
                    )}
                    <div style={{display:'flex',gap:'0.5rem',alignItems:'center',marginBottom:'0.75rem',flexWrap:'wrap'}}>
                      <span style={{fontWeight:700,fontSize:'1rem',color:MODE_COLOR[modeLabel]||'var(--text)'}}>{modeLabel}</span>
                      <span style={{fontSize:'0.8rem',fontWeight:600,color:INCO_COLOR[incoLabel]||'var(--text)',background:`${INCO_COLOR[incoLabel]||'var(--border)'}22`,padding:'2px 8px',borderRadius:'var(--radius-full)'}}>{incoLabel}</span>
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'0.5rem',marginBottom:'0.75rem'}}>
                      {[
                        {label:'Lead Time',value:`${s.estimated_lead_days}d`},
                        {label:'Total Cost',value:`$${s.estimated_cost_usd.toLocaleString()}`},
                        {label:'Risk Index',value:`${s.risk_score}/100`},
                      ].map(m=>(
                        <div key={m.label} style={{background:'rgba(0,0,0,0.04)',borderRadius:'var(--radius-md)',padding:'0.5rem 0.6rem',textAlign:'center'}}>
                          <div style={{fontSize:'0.68rem',color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{m.label}</div>
                          <div style={{fontWeight:700,fontSize:'0.95rem'}}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                    <p style={{fontSize:'0.78rem',color:'var(--text-muted)',lineHeight:1.5}}>{s.rationale}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Flagged products */}
          {result.flagged_products.length>0 && (
            <div>
              <h2 style={{fontSize:'1rem',fontWeight:600,marginBottom:'0.75rem'}}>
                ⚠ {result.flagged_products.length} High-Risk Products in this Dataset
              </h2>
              <div style={{display:'flex',flexDirection:'column',gap:4,maxHeight:280,overflowY:'auto',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'0.5rem 0'}}>
                {result.flagged_products.map(p=>(
                  <div key={p.id} style={{display:'flex',gap:'0.75rem',alignItems:'center',padding:'0.4rem 0.75rem',borderBottom:'1px solid var(--divider)'}}>
                    <RiskBadge flag={p.risk_flag}/>
                    <span style={{fontSize:'0.83rem',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</span>
                    <span style={{fontSize:'0.75rem',color:'var(--text-faint)',whiteSpace:'nowrap'}}>{p.supplier_count} supplier{p.supplier_count!==1?'s':''}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { Skeleton } from '../components/Skeleton'
import { ErrorMsg } from '../components/ErrorMsg'
import { RiskBadge } from '../components/RiskBadge'
import type { ConcentrationReport, RiskPrediction, DatasetCode } from '../types'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const RISK_COLORS: Record<string,string> = { CRITICAL:'#a12c7b',HIGH:'#964219',MEDIUM:'#d19900',LOW:'#437a22',UNASSIGNED:'#7a7974' }

export function Risk({ dataset }: { dataset: DatasetCode }) {
  const { data: conc, loading: lC, error: eC } = useApi<ConcentrationReport>(
    () => api.getConcentration(dataset, 15) as Promise<ConcentrationReport>, [dataset])
  const { data: ml, loading: lML, error: eML } = useApi<RiskPrediction[]>(
    () => api.mlRisk(dataset) as Promise<RiskPrediction[]>, [dataset])

  const barData = conc?.top_suppliers.slice(0,12).map(s=>({
    name: s.supplier_name.split(' ').slice(0,2).join(' '),
    fullName: s.supplier_name, critical: s.critical_products,
    high: s.high_products, score: s.avg_dependency_score,
  })) || []

  const tdStyle = { padding:'0.5rem 0.75rem', borderBottom:'1px solid var(--divider)', fontSize:'0.83rem', verticalAlign:'middle' as const }
  const thStyle = { ...tdStyle, fontWeight:600, fontSize:'0.75rem', color:'var(--text-muted)', textTransform:'uppercase' as const, letterSpacing:'0.05em', background:'var(--surface)' }

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'2rem'}}>
      <h1 style={{fontSize:'1.4rem',fontWeight:700}}>Risk & ML Analytics</h1>

      {/* Concentration summary cards */}
      {conc && (
        <div style={{display:'flex',gap:'1rem',flexWrap:'wrap'}}>
          {[
            {label:'Single-source',value:conc.single_source_count,accent:'var(--critical)'},
            {label:'Multi-source',value:conc.multi_source_count,accent:'var(--success)'},
            {label:'Unassigned',value:conc.unassigned_count,accent:'var(--text-faint)'},
          ].map(c=>(
            <div key={c.label} style={{flex:'1 1 140px',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'1rem 1.25rem'}}>
              <div style={{fontSize:'0.75rem',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{c.label}</div>
              <div style={{fontSize:'1.8rem',fontWeight:700,color:c.accent}}>{c.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Supplier concentration chart */}
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'1.25rem'}}>
        <h2 style={{fontSize:'1rem',fontWeight:600,marginBottom:'1rem'}}>Supplier Concentration — Avg Dependency Score (top 12)</h2>
        {lC && <Skeleton h="200px"/>}
        {eC && <ErrorMsg msg={eC}/>}
        {conc && !lC && (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} layout="vertical" margin={{left:0,right:20}}>
              <XAxis type="number" tick={{fontSize:11}} domain={[0,100]}/>
              <YAxis type="category" dataKey="name" width={110} tick={{fontSize:11}}/>
              <Tooltip formatter={(v,_,p)=>[`${v} (${p.payload.fullName})`,'']}/>
              <Bar dataKey="score" radius={[0,4,4,0]}>
                {barData.map((d,i)=>(
                  <Cell key={i} fill={d.critical>0?'#a12c7b':d.high>0?'#964219':'var(--primary)'}/>
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ML Risk Predictions */}
      <div>
        <h2 style={{fontSize:'1rem',fontWeight:600,marginBottom:'0.75rem'}}>ML Risk Predictions (top 20 by probability)</h2>
        <p style={{fontSize:'0.8rem',color:'var(--text-muted)',marginBottom:'0.75rem'}}>
          Uses RandomForest (or rule-based fallback). Features: BOM level, supplier count, procurement type, dependency score.
        </p>
        {lML && <Skeleton h="12rem"/>}
        {eML && <ErrorMsg msg={eML}/>}
        {ml && !lML && (
          <div style={{overflowX:'auto',borderRadius:'var(--radius-lg)',border:'1px solid var(--border)'}}>
            <table style={{width:'100%'}}>
              <thead>
                <tr>
                  <th style={thStyle}>Product</th>
                  <th style={thStyle}>Delay Prob.</th>
                  <th style={thStyle}>ML Risk Level</th>
                  <th style={thStyle}>Prob. Bar</th>
                </tr>
              </thead>
              <tbody>
                {ml.slice(0,20).map(r=>(
                  <tr key={r.product_id} style={{transition:'var(--transition)'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--surface)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{...tdStyle,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.product_name}</td>
                    <td style={{...tdStyle,textAlign:'right',fontVariantNumeric:'tabular-nums',fontWeight:600,
                      color:r.predicted_delay_prob>0.8?'var(--critical)':r.predicted_delay_prob>0.55?'var(--warning)':'var(--text)'}}>
                      {(r.predicted_delay_prob*100).toFixed(0)}%
                    </td>
                    <td style={tdStyle}><RiskBadge flag={r.risk_level}/></td>
                    <td style={{...tdStyle,minWidth:100}}>
                      <div style={{background:'var(--divider)',borderRadius:4,height:8,overflow:'hidden'}}>
                        <div style={{
                          height:'100%',width:`${r.predicted_delay_prob*100}%`,
                          background:r.predicted_delay_prob>0.8?RISK_COLORS.CRITICAL:r.predicted_delay_prob>0.55?RISK_COLORS.HIGH:RISK_COLORS.LOW,
                          borderRadius:4,transition:'width 0.4s ease'
                        }}/>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

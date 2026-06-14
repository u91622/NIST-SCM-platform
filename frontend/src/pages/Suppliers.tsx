import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { RiskBadge } from '../components/RiskBadge'
import { Skeleton } from '../components/Skeleton'
import { ErrorMsg } from '../components/ErrorMsg'
import type { SupplierOut, DatasetCode } from '../types'

export function Suppliers({ dataset }: { dataset: DatasetCode }) {
  const { data, loading, error } = useApi<SupplierOut[]>(
    () => api.listSuppliers(dataset) as Promise<SupplierOut[]>, [dataset])

  const tdStyle = { padding:'0.55rem 0.75rem', borderBottom:'1px solid var(--divider)', fontSize:'0.85rem', verticalAlign:'middle' as const }
  const thStyle = { ...tdStyle, fontWeight:600, fontSize:'0.78rem', color:'var(--text-muted)', textTransform:'uppercase' as const, letterSpacing:'0.05em', background:'var(--surface)' }

  return (
    <div>
      <h1 style={{fontSize:'1.4rem',fontWeight:700,marginBottom:'1rem'}}>Suppliers</h1>
      {data && <p style={{color:'var(--text-muted)',fontSize:'0.85rem',marginBottom:'1rem'}}>{data.length} suppliers — sorted by dependency score (highest first)</p>}
      {loading && <div style={{display:'flex',flexDirection:'column',gap:8}}>{Array(10).fill(0).map((_,i)=><Skeleton key={i} h="2.5rem"/>)}</div>}
      {error && <ErrorMsg msg={error}/>}
      {data && !loading && (
        <div style={{overflowX:'auto',borderRadius:'var(--radius-lg)',border:'1px solid var(--border)'}}>
          <table style={{width:'100%'}}>
            <thead>
              <tr>
                <th style={thStyle}>ID</th>
                <th style={{...thStyle,minWidth:200}}>Name</th>
                <th style={thStyle}>City</th>
                <th style={thStyle}>Products</th>
                <th style={thStyle}>Critical</th>
                <th style={thStyle}>High</th>
                <th style={thStyle}>Avg Dep.</th>
                <th style={thStyle}>Top Risk</th>
              </tr>
            </thead>
            <tbody>
              {data.map(s=>{
                const topRisk = s.critical_count>0?'CRITICAL':s.high_count>0?'HIGH':s.product_count>0?'MEDIUM':'UNASSIGNED'
                return (
                  <tr key={s.id} style={{transition:'var(--transition)'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--surface)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{...tdStyle,color:'var(--text-muted)',fontFamily:'monospace',fontSize:'0.78rem'}}>{s.source_id}</td>
                    <td style={{...tdStyle,maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontWeight:500}}>{s.name}</td>
                    <td style={{...tdStyle,color:'var(--text-muted)'}}>{s.city||'—'}</td>
                    <td style={{...tdStyle,textAlign:'center',fontVariantNumeric:'tabular-nums'}}>{s.product_count}</td>
                    <td style={{...tdStyle,textAlign:'center',color:'var(--critical)',fontWeight:600}}>{s.critical_count||'—'}</td>
                    <td style={{...tdStyle,textAlign:'center',color:'var(--warning)',fontWeight:600}}>{s.high_count||'—'}</td>
                    <td style={{...tdStyle,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{s.avg_dependency_score.toFixed(1)}</td>
                    <td style={tdStyle}><RiskBadge flag={topRisk}/></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

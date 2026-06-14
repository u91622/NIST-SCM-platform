import { useState } from 'react'
import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { RiskBadge } from '../components/RiskBadge'
import { Skeleton } from '../components/Skeleton'
import { ErrorMsg } from '../components/ErrorMsg'
import type { ProductListItem, ProductDetail, DatasetCode } from '../types'

const RISKS = ['ALL','CRITICAL','HIGH','MEDIUM','LOW','UNASSIGNED']

export function Products({ dataset }: { dataset: DatasetCode }) {
  const [riskFilter, setRiskFilter] = useState('ALL')
  const [singleSrc, setSingleSrc]   = useState<boolean|undefined>(undefined)
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<ProductDetail|null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const { data, loading, error } = useApi<ProductListItem[]>(
    () => api.listProducts(dataset, {
      risk_flag: riskFilter==='ALL' ? undefined : riskFilter,
      single_source: singleSrc,
      search: search || undefined,
    }) as Promise<ProductListItem[]>,
    [dataset, riskFilter, singleSrc, search])

  async function openDetail(id: number) {
    setDetailLoading(true)
    try { setSelected(await api.getProduct(id) as ProductDetail) }
    catch (e) { console.error(e) }
    finally { setDetailLoading(false) }
  }

  const tdStyle = { padding:'0.55rem 0.75rem', borderBottom:'1px solid var(--divider)', fontSize:'0.85rem', verticalAlign:'middle' as const }
  const thStyle = { ...tdStyle, fontWeight:600, fontSize:'0.78rem', color:'var(--text-muted)', textTransform:'uppercase' as const, letterSpacing:'0.05em', background:'var(--surface)' }

  return (
    <div style={{display:'flex',gap:'1.5rem',minHeight:0}}>
      <div style={{flex:1,minWidth:0}}>
        <h1 style={{fontSize:'1.4rem',fontWeight:700,marginBottom:'1rem'}}>Products</h1>

        {/* Filters */}
        <div style={{display:'flex',gap:'0.75rem',flexWrap:'wrap',marginBottom:'1rem',alignItems:'center'}}>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"
            style={{padding:'0.45rem 0.75rem',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',fontSize:'0.85rem',minWidth:180,background:'var(--bg)',color:'var(--text)'}}/>
          <select value={riskFilter} onChange={e=>setRiskFilter(e.target.value)}
            style={{padding:'0.45rem 0.6rem',borderRadius:'var(--radius-md)',border:'1px solid var(--border)',fontSize:'0.85rem',background:'var(--bg)',color:'var(--text)'}}>
            {RISKS.map(r=><option key={r}>{r}</option>)}
          </select>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:'0.85rem',cursor:'pointer',color:'var(--text-muted)'}}>
            <input type="checkbox" checked={singleSrc===true}
              onChange={e=>setSingleSrc(e.target.checked ? true : undefined)}/>
            Single-source only
          </label>
          {data && <span style={{marginLeft:'auto',fontSize:'0.8rem',color:'var(--text-faint)'}}>{data.length} products</span>}
        </div>

        {loading && <div style={{display:'flex',flexDirection:'column',gap:8}}>{Array(8).fill(0).map((_,i)=><Skeleton key={i} h="2.5rem"/>)}</div>}
        {error && <ErrorMsg msg={error}/>}
        {data && !loading && (
          <div style={{overflowX:'auto',borderRadius:'var(--radius-lg)',border:'1px solid var(--border)'}}>
            <table style={{width:'100%'}}>
              <thead>
                <tr>
                  <th style={thStyle}>ID</th>
                  <th style={{...thStyle,minWidth:200}}>Name</th>
                  <th style={thStyle}>Suppliers</th>
                  <th style={thStyle}>Dep. Score</th>
                  <th style={thStyle}>Risk</th>
                  <th style={thStyle}>Single Src</th>
                </tr>
              </thead>
              <tbody>
                {data.map(p=>(
                  <tr key={p.id} onClick={()=>openDetail(p.id)}
                    style={{cursor:'pointer',transition:'var(--transition)'}}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--surface)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='')}>
                    <td style={{...tdStyle,color:'var(--text-muted)',fontFamily:'monospace',fontSize:'0.78rem'}}>{p.source_id}</td>
                    <td style={{...tdStyle,maxWidth:280,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</td>
                    <td style={{...tdStyle,textAlign:'center'}}>{p.supplier_count}</td>
                    <td style={{...tdStyle,textAlign:'right',fontVariantNumeric:'tabular-nums'}}>{p.dependency_score.toFixed(1)}</td>
                    <td style={tdStyle}><RiskBadge flag={p.risk_flag}/></td>
                    <td style={{...tdStyle,textAlign:'center'}}>{p.single_source ? '✓' : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {(selected || detailLoading) && (
        <div style={{
          width:320,minWidth:320,background:'var(--surface)',border:'1px solid var(--border)',
          borderRadius:'var(--radius-xl)',padding:'1.5rem',height:'fit-content',
          position:'sticky',top:'1rem',boxShadow:'var(--shadow-md)',
        }}>
          <button onClick={()=>setSelected(null)}
            style={{marginLeft:'auto',display:'block',padding:'4px 8px',borderRadius:'var(--radius-sm)',
              border:'1px solid var(--border)',fontSize:'0.8rem',color:'var(--text-muted)',cursor:'pointer',background:'none',marginBottom:'0.75rem'}}>
            ✕ Close
          </button>
          {detailLoading && <Skeleton h="12rem"/>}
          {selected && !detailLoading && (
            <div style={{display:'flex',flexDirection:'column',gap:'0.75rem'}}>
              <div>
                <div style={{fontSize:'0.7rem',color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>Source ID</div>
                <code style={{fontSize:'0.82rem'}}>{selected.source_id}</code>
              </div>
              <div>
                <div style={{fontSize:'0.7rem',color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>Name</div>
                <div style={{fontSize:'0.9rem',fontWeight:600}}>{selected.name}</div>
              </div>
              {selected.description && <div style={{fontSize:'0.83rem',color:'var(--text-muted)'}}>{selected.description}</div>}
              <div style={{display:'flex',gap:8,flexWrap:'wrap',alignItems:'center'}}>
                <RiskBadge flag={selected.risk_flag}/>
                {selected.single_source && <span style={{fontSize:'0.75rem',color:'var(--critical)',fontWeight:600}}>⚠ Single source</span>}
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'0.5rem'}}>
                <div style={{background:'var(--bg)',borderRadius:'var(--radius-md)',padding:'0.6rem 0.75rem'}}>
                  <div style={{fontSize:'0.7rem',color:'var(--text-faint)'}}>Suppliers</div>
                  <div style={{fontWeight:700,fontSize:'1.1rem'}}>{selected.supplier_count}</div>
                </div>
                <div style={{background:'var(--bg)',borderRadius:'var(--radius-md)',padding:'0.6rem 0.75rem'}}>
                  <div style={{fontSize:'0.7rem',color:'var(--text-faint)'}}>Dep. Score</div>
                  <div style={{fontWeight:700,fontSize:'1.1rem'}}>{selected.dependency_score.toFixed(1)}</div>
                </div>
              </div>
              {selected.project && (
                <div>
                  <div style={{fontSize:'0.7rem',color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:2}}>Project</div>
                  <div style={{fontSize:'0.84rem'}}>{selected.project.name}</div>
                </div>
              )}
              {selected.suppliers.length>0 && (
                <div>
                  <div style={{fontSize:'0.7rem',color:'var(--text-faint)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>Suppliers</div>
                  {selected.suppliers.map(s=>(
                    <div key={s.id} style={{fontSize:'0.82rem',padding:'3px 0',borderBottom:'1px solid var(--divider)'}}>
                      <span style={{color:'var(--text-muted)',fontFamily:'monospace',marginRight:6}}>{s.source_id}</span>{s.name}
                    </div>
                  ))}
                </div>
              )}
              {/* Extra attributes */}
              {Object.keys(selected.attributes).length>0 && (
                <details style={{fontSize:'0.8rem'}}>
                  <summary style={{cursor:'pointer',color:'var(--text-muted)',padding:'4px 0'}}>More attributes</summary>
                  <div style={{marginTop:6,display:'flex',flexDirection:'column',gap:3}}>
                    {Object.entries(selected.attributes).map(([k,v])=>v!=null&&(
                      <div key={k}><span style={{color:'var(--text-faint)',marginRight:4}}>{k}:</span>{String(v)}</div>
                    ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

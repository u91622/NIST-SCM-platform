import { useApi } from '../hooks/useApi'
import { api } from '../lib/api'
import { KpiCard } from '../components/KpiCard'
import { Skeleton } from '../components/Skeleton'
import { ErrorMsg } from '../components/ErrorMsg'
import type { AnalyticsOverview, DatasetCode } from '../types'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Legend
} from 'recharts'

const RISK_COLORS: Record<string,string> = {
  CRITICAL:'#a12c7b', HIGH:'#964219', MEDIUM:'#d19900', LOW:'#437a22', UNASSIGNED:'#7a7974'
}

export function Overview({ dataset }: { dataset: DatasetCode }) {
  const { data, loading, error } = useApi<AnalyticsOverview>(
    () => api.getOverview(dataset) as Promise<AnalyticsOverview>, [dataset])

  if (loading) return <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'1rem'}}>{Array(6).fill(0).map((_,i)=><Skeleton key={i} h="6rem"/>)}</div>
  if (error) return <ErrorMsg msg={error} />
  if (!data) return null

  const rb = data.risk_breakdown
  const riskPie = Object.entries(rb).filter(([,v])=>v>0).map(([k,v])=>({name:k,value:v}))

  const procBar = Object.entries(data.procurement_mix).map(([k,v])=>({name:k,count:v}))
  const bomBar  = data.bom_level_counts.filter(b=>b.count>0)

  return (
    <div style={{display:'flex',flexDirection:'column',gap:'2rem'}}>
      <div>
        <h1 style={{fontSize:'clamp(1.2rem,2vw,1.6rem)',fontWeight:700,marginBottom:4}}>Supply Chain Overview</h1>
        <p style={{color:'var(--text-muted)',fontSize:'0.88rem'}}>Dataset: <strong>{data.dataset_code.toUpperCase()}</strong></p>
      </div>

      {/* KPI row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'0.9rem'}}>
        <KpiCard label="Products" value={data.total_products} />
        <KpiCard label="Suppliers" value={data.total_suppliers} />
        <KpiCard label="Projects" value={data.total_projects} />
        <KpiCard label="Single-Source" value={data.single_source_products}
          sub={`${((data.single_source_products/data.total_products)*100).toFixed(1)}% of total`}
          accent="var(--critical)" />
        <KpiCard label="Avg. Dep. Score" value={data.avg_dependency_score.toFixed(1)}
          sub="Higher = more concentrated" accent="var(--warning)" />
        <KpiCard label="Critical Items" value={rb.CRITICAL}
          sub={`+ ${rb.HIGH} HIGH risk`} accent="var(--critical)" />
      </div>

      {/* Charts row */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'1.5rem',flexWrap:'wrap'}}>
        {/* Risk donut */}
        <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'1.25rem'}}>
          <h3 style={{fontSize:'0.9rem',fontWeight:600,marginBottom:'0.75rem'}}>Risk Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={riskPie} cx="50%" cy="50%" innerRadius={55} outerRadius={80}
                dataKey="value" nameKey="name" paddingAngle={3}>
                {riskPie.map(entry=><Cell key={entry.name} fill={RISK_COLORS[entry.name]||'#ccc'}/>)}
              </Pie>
              <Tooltip formatter={(v,n)=>[v,n]}/>
              <Legend iconType="circle" iconSize={8}/>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* BOM levels or procurement mix */}
        {dataset==='gps' && bomBar.length>0 ? (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'1.25rem'}}>
            <h3 style={{fontSize:'0.9rem',fontWeight:600,marginBottom:'0.75rem'}}>BOM Levels</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={bomBar} margin={{left:-10,bottom:0}}>
                <XAxis dataKey="label" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:11}}/>
                <Tooltip/>
                <Bar dataKey="count" fill="var(--primary)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : procBar.length>0 ? (
          <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius-lg)',padding:'1.25rem'}}>
            <h3 style={{fontSize:'0.9rem',fontWeight:600,marginBottom:'0.75rem'}}>Procurement Mix</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={procBar} margin={{left:-10}}>
                <XAxis dataKey="name" tick={{fontSize:11}}/>
                <YAxis tick={{fontSize:11}}/>
                <Tooltip/>
                <Bar dataKey="count" fill="var(--primary)" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : <div/>}
      </div>
    </div>
  )
}

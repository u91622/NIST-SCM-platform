import { useState } from 'react';
import { useApi } from '@/hooks/useApi';
import ErrorMsg from '@/components/ErrorMsg';
import Skeleton from '@/components/Skeleton';
import RiskBadge from '@/components/RiskBadge';
import type { RiskFlag } from '@/types';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  ScatterChart, Scatter, CartesianGrid, Legend,
} from 'recharts';

const BASE = '/api';

// ── tiny helpers ──────────────────────────────────────────────────────────
async function postTrain(dataset: string) {
  const r = await fetch(`${BASE}/ml/train?dataset=${dataset}`, { method: 'POST' });
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.detail||`HTTP ${r.status}`); }
  return r.json();
}
async function getBatch(dataset: string) {
  const r = await fetch(`${BASE}/ml/predict-batch?dataset=${dataset}`);
  if (!r.ok) { const e = await r.json().catch(()=>({})); throw new Error(e.detail||`HTTP ${r.status}`); }
  return r.json();
}

const PROB_COLOR = (p: number) =>
  p >= 80 ? '#ef4444' : p >= 60 ? '#f59e0b' : p >= 40 ? '#3b82f6' : '#22c55e';

// ── Confusion Matrix mini component ──────────────────────────────────────
function ConfMatrix({ cm }: { cm: number[][] }) {
  const labels = ['Low-Risk (0)', 'At-Risk (1)'];
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 6 }}>
        Confusion Matrix (training set)
      </div>
      <table style={{ borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', color: 'var(--muted)', fontWeight: 400 }}></th>
            {labels.map(l => <th key={l} style={{ padding: '4px 8px', color: 'var(--muted)', fontWeight: 600 }}>Pred: {l}</th>)}
          </tr>
        </thead>
        <tbody>
          {cm.map((row, i) => (
            <tr key={i}>
              <td style={{ padding: '4px 8px', color: 'var(--muted)', fontWeight: 600 }}>Act: {labels[i]}</td>
              {row.map((v, j) => (
                <td key={j} style={{
                  padding: '8px 14px', textAlign: 'center', fontWeight: 700, fontSize: 16,
                  background: i === j ? '#dcfce7' : '#fde8e8', borderRadius: 6,
                }}>{v}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────
export default function MLPredict({ dataset }: { dataset: string }) {
  const [training, setTraining] = useState(false);
  const [trainResult, setTrainResult] = useState<any>(null);
  const [trainError, setTrainError] = useState<string | null>(null);

  const [batchData, setBatchData] = useState<any>(null);
  const [batchLoading, setBatchLoading] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [riskFilter, setRiskFilter] = useState('');

  const handleTrain = async () => {
    setTraining(true); setTrainError(null); setTrainResult(null);
    setBatchData(null); setBatchError(null);
    try {
      const res = await postTrain(dataset);
      setTrainResult(res);
      // Auto-load batch predictions after training
      setBatchLoading(true);
      const batch = await getBatch(dataset);
      setBatchData(batch);
    } catch (e: any) {
      setTrainError(e.message);
    } finally {
      setTraining(false); setBatchLoading(false);
    }
  };

  const handleLoadBatch = async () => {
    setBatchLoading(true); setBatchError(null);
    try { setBatchData(await getBatch(dataset)); }
    catch (e: any) { setBatchError(e.message); }
    finally { setBatchLoading(false); }
  };

  // ── Derived chart data ──────────────────────────────────────────────────
  const featData = trainResult
    ? Object.entries(trainResult.feature_importance as Record<string, number>)
        .slice(0, 8)
        .map(([name, val]) => ({
          name: name.replace('proc_type_', '').replace(/_/g, ' '),
          importance: Math.round(val * 100) / 100,
        }))
    : [];

  const items: any[] = batchData?.items ?? [];
  const filtered = items.filter(p =>
    (!search || p.name.toLowerCase().includes(search.toLowerCase())) &&
    (!riskFilter || p.predicted_risk === riskFilter)
  );

  const distData = [
    { name: 'CRITICAL (≥80%)', count: items.filter(i => i.delay_probability >= 80).length, fill: '#ef4444' },
    { name: 'HIGH (60-79%)',   count: items.filter(i => i.delay_probability >= 60 && i.delay_probability < 80).length, fill: '#f59e0b' },
    { name: 'MEDIUM (40-59%)', count: items.filter(i => i.delay_probability >= 40 && i.delay_probability < 60).length, fill: '#3b82f6' },
    { name: 'LOW (<40%)',      count: items.filter(i => i.delay_probability < 40).length, fill: '#22c55e' },
  ].filter(d => d.count > 0);

  const scatterData = items.map(p => ({
    x: p.supplier_count,
    y: p.delay_probability,
    name: p.name,
  }));

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 2 }}>ML Risk Prediction</h1>
          <p style={{ fontSize: 12, color: 'var(--muted)' }}>
            Random Forest classifier · Features: bom_level, procurement_type, supplier_count · {dataset.toUpperCase()}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleTrain} disabled={training}
            style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--primary)', color: 'white',
              border: 'none', fontWeight: 600, fontSize: 13, cursor: training ? 'not-allowed' : 'pointer',
              opacity: training ? 0.6 : 1 }}>
            {training ? '⚙️ Training…' : '🚀 Train Model'}
          </button>
          {!batchData && !training && (
            <button onClick={handleLoadBatch} disabled={batchLoading}
              style={{ padding: '9px 18px', borderRadius: 8, background: 'var(--surface)',
                color: 'var(--primary)', border: '1px solid var(--primary)', fontWeight: 600,
                fontSize: 13, cursor: 'pointer' }}>
              {batchLoading ? 'Loading…' : '📊 Load Predictions'}
            </button>
          )}
        </div>
      </div>

      {trainError && <ErrorMsg msg={trainError} />}
      {batchError && <ErrorMsg msg={batchError} />}

      {/* Training Result */}
      {trainResult && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* KPI cards */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 14 }}>Model Performance</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Training Accuracy', value: `${(trainResult.train_accuracy * 100).toFixed(1)}%`, accent: '#22c55e' },
                { label: 'CV ROC-AUC',        value: `${(trainResult.cv_roc_auc * 100).toFixed(1)}%`,    accent: '#3b82f6' },
                { label: 'Total Samples',     value: trainResult.n_samples },
                { label: 'At-Risk (label=1)', value: trainResult.n_positive, accent: '#ef4444' },
              ].map(k => (
                <div key={k.label} style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase',
                    letterSpacing: .5, marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.accent ?? 'var(--text)' }}>{k.value}</div>
                </div>
              ))}
            </div>
            {trainResult.confusion_matrix && <ConfMatrix cm={trainResult.confusion_matrix} />}
          </div>

          {/* Feature importance bar chart */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Feature Importance</div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 12 }}>
              Higher = stronger predictor of supply delay risk
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={featData} layout="vertical" margin={{ left: 10 }}>
                <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => v.toFixed(2)} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={110} />
                <Tooltip formatter={(v: any) => v.toFixed(4)} />
                <Bar dataKey="importance" radius={[0, 4, 4, 0]} fill="var(--primary)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Batch predictions */}
      {batchLoading && <div>{[1,2,3].map(i => <Skeleton key={i} h={44} mb={6} />)}</div>}
      {batchData && (
        <>
          {/* Distribution + Scatter */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Risk Distribution</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={distData}>
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {distData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>Supplier Count vs Delay Probability</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 10 }}>
                Single-source items cluster at high probability
              </div>
              <ResponsiveContainer width="100%" height={180}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="x" name="Suppliers" type="number" tick={{ fontSize: 11 }} label={{ value: '# Suppliers', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                  <YAxis dataKey="y" name="Delay Prob %" type="number" domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
                  <Tooltip cursor={{ strokeDasharray: '3 3' }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      return <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
                        padding: '8px 12px', borderRadius: 8, fontSize: 11 }}>
                        <div style={{ fontWeight: 600, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.name}</div>
                        <div>Suppliers: {d.x}</div>
                        <div>Delay Prob: {d.y}%</div>
                      </div>;
                    }} />
                  <Scatter data={scatterData} fill="var(--primary)" opacity={0.65} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Table */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)',
              display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginRight: 4 }}>
                All Predictions ({filtered.length})
              </div>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name…"
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
                  background: 'var(--bg)', fontSize: 12, width: 180 }} />
              <select value={riskFilter} onChange={e => setRiskFilter(e.target.value)}
                style={{ padding: '6px 10px', borderRadius: 7, border: '1px solid var(--border)',
                  background: 'var(--bg)', fontSize: 12 }}>
                <option value="">All Levels</option>
                {['CRITICAL','HIGH','MEDIUM','LOW'].map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-offset)', fontSize: 10, fontWeight: 600,
                  color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: .5 }}>
                  {['Name','BOM Lv','Proc Type','Suppliers','Delay Prob','Predicted Risk','Actual Flag'].map(h => (
                    <th key={h} style={{ padding: '9px 14px', textAlign: h === 'Name' ? 'left' : 'center' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 200).map((p: any, i: number) => (
                  <tr key={p.product_id} style={{ fontSize: 12, borderTop: '1px solid var(--border)',
                    background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)' }}>
                    <td style={{ padding: '9px 14px', fontWeight: 500, maxWidth: 240,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'center' }}>{p.bom_level}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'center', fontSize: 11 }}>{p.proc_type}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'center' }}>{p.supplier_count}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'center', fontWeight: 700,
                      fontVariantNumeric: 'tabular-nums', color: PROB_COLOR(p.delay_probability) }}>
                      {p.delay_probability}%
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                      <RiskBadge flag={p.predicted_risk as RiskFlag} />
                    </td>
                    <td style={{ padding: '9px 14px', textAlign: 'center' }}>
                      <RiskBadge flag={p.actual_risk_flag as RiskFlag} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {!batchData && !batchLoading && !training && (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>🤖</div>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>No model trained yet</div>
          <div style={{ fontSize: 12 }}>Click <b>Train Model</b> to fit a Random Forest and score all products.</div>
        </div>
      )}
    </div>
  );
}

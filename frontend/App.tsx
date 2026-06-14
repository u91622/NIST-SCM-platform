import { useState } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/Layout'
import { Overview } from './pages/Overview'
import { Products } from './pages/Products'
import { Suppliers } from './pages/Suppliers'
import { Risk } from './pages/Risk'
import { Optimize } from './pages/Optimize'
import type { DatasetCode } from './types'

export default function App() {
  const [dataset, setDataset] = useState<DatasetCode>('gps')
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout dataset={dataset} setDataset={setDataset} />}>
          <Route index element={<Overview dataset={dataset} />} />
          <Route path="products" element={<Products dataset={dataset} />} />
          <Route path="suppliers" element={<Suppliers dataset={dataset} />} />
          <Route path="risk" element={<Risk dataset={dataset} />} />
          <Route path="optimize" element={<Optimize dataset={dataset} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

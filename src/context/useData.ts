import { useContext } from 'react'
import { DataContext } from './data.context'
import type { DataContextValue } from './data.context'

export function useData(): DataContextValue {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData debe usarse dentro de DataProvider')
  return ctx
}

import { createContext } from 'react'
import type { Dataset, HistoryEntry } from '../lib/csvAnalyzer'

export interface DataContextValue {
  dataset: Dataset | null
  history: HistoryEntry[]
  saveDataset: (dataset: Dataset) => void
  restoreFromHistory: (id: string) => Promise<boolean>
  /** Borra un dataset del historial y del almacén local. */
  removeDataset: (id: string) => Promise<void>
  /** Fusiona el historial de un respaldo importado con el actual. */
  mergeHistory: (entries: HistoryEntry[]) => void
}

export const DataContext = createContext<DataContextValue | null>(null)

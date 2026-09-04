import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { DataContext } from './data.context'
import type { Dataset, HistoryEntry } from '../lib/csvAnalyzer'
import {
  deleteDatasetFromStore,
  getDatasetFromStore,
  saveDatasetToStore,
} from '../lib/datasetStore'
import { apiListDatasets } from '../api/datasets'
import { useAuth } from './useAuth'

const ACTIVE_KEY = 'crm_active_dataset'
const MAX_HISTORY = 500

function readActiveId(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

function writeActiveId(id: string | null) {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* almacenamiento no disponible */
  }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [dataset, setDataset] = useState<Dataset | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  // La fuente de verdad del historial es el backend: al iniciar sesión se
  // traen todos los datasets guardados del usuario.
  useEffect(() => {
    if (!user) return
    let cancelled = false
    apiListDatasets()
      .then((entries) => {
        if (!cancelled) setHistory(entries)
      })
      .catch(() => {
        if (!cancelled) setHistory([])
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Al abrir la app, revincula automáticamente el último CSV activo.
  useEffect(() => {
    const id = readActiveId()
    if (!id) return
    let cancelled = false
    void getDatasetFromStore(id)
      .then((found) => {
        if (cancelled) return
        if (found) {
          setDataset(found)
        } else {
          writeActiveId(null)
          setHistory((prev) =>
            prev.map((e) => (e.id === id ? { ...e, stored: false } : e)),
          )
        }
      })
      .catch(() => {
        if (!cancelled) writeActiveId(null)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const saveDataset = useCallback((next: Dataset) => {
    setDataset(next)
    writeActiveId(next.id)
    setHistory((prev) => {
      const entry: HistoryEntry = {
        id: next.id,
        fileName: next.fileName,
        sizeBytes: next.sizeBytes,
        rowCount: next.rowCount,
        columnCount: next.columnCount,
        uploadedAt: next.uploadedAt,
        processMs: next.processMs,
        stored: false,
        duplicateRows: next.duplicateRows,
        delimiter: next.parseMeta?.delimiter,
      }
      return [entry, ...prev.filter((e) => e.id !== next.id)].slice(0, MAX_HISTORY)
    })

    void saveDatasetToStore(next)
      .then(() => {
        setHistory((prev) =>
          prev.map((e) => (e.id === next.id ? { ...e, stored: true } : e)),
        )
      })
      .catch(() => {
        setHistory((prev) =>
          prev.map((e) => (e.id === next.id ? { ...e, stored: false } : e)),
        )
      })
  }, [])

  const removeDataset = useCallback(async (id: string) => {
    try {
      await deleteDatasetFromStore(id)
    } catch {
      /* si falla el borrado físico, igual se quita del historial */
    }
    setHistory((prev) => prev.filter((e) => e.id !== id))
    setDataset((current) => {
      if (current?.id !== id) return current
      writeActiveId(null)
      return null
    })
  }, [])

  const mergeHistory = useCallback((entries: HistoryEntry[]) => {
    setHistory((prev) => {
      const byId = new Map(prev.map((e) => [e.id, e]))
      for (const entry of entries) byId.set(entry.id, { ...byId.get(entry.id), ...entry })
      return [...byId.values()]
        .sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))
        .slice(0, MAX_HISTORY)
    })
  }, [])

  const restoreFromHistory = useCallback(async (id: string) => {
    try {
      const found = await getDatasetFromStore(id)
      if (!found) return false
      setDataset(found)
      writeActiveId(id)
      return true
    } catch {
      return false
    }
  }, [])

  const value = useMemo(
    () => ({
      dataset,
      history,
      saveDataset,
      restoreFromHistory,
      removeDataset,
      mergeHistory,
    }),
    [dataset, history, saveDataset, restoreFromHistory, removeDataset, mergeHistory],
  )

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

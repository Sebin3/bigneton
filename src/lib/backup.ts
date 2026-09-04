import Papa from 'papaparse'
import type { Dataset, HistoryEntry } from './csvAnalyzer'
import {
  getAllDatasets,
  getUserTables,
  saveDatasetToStore,
  saveUserTable,
  type UserTable,
} from './datasetStore'

const BACKUP_APP = 'big-data'
const BACKUP_VERSION = 1

/** Marca de orden de bytes UTF-8: hace que Excel abra los CSV con acentos correctos. */
const BOM = String.fromCharCode(0xfeff)

export interface BackupFile {
  app: string
  version: number
  exportedAt: string
  history: HistoryEntry[]
  datasets: Dataset[]
  tables: UserTable[]
}

export interface ImportResult {
  datasets: number
  tables: number
  history: HistoryEntry[]
}

function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.append(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function stamp() {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')
}

/** Descarga un respaldo completo: datasets guardados, historial y tablas propias. */
export async function exportBackup(history: HistoryEntry[]): Promise<number> {
  const [datasets, tables] = await Promise.all([getAllDatasets(), getUserTables()])
  const payload: BackupFile = {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    history,
    datasets,
    tables,
  }
  const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' })
  download(blob, `big-data-respaldo-${stamp()}.json`)
  return datasets.length
}

/** Lee un respaldo y lo vuelca en IndexedDB. Devuelve el historial a fusionar. */
export async function importBackup(file: File): Promise<ImportResult> {
  let parsed: unknown
  try {
    parsed = JSON.parse(await file.text())
  } catch {
    throw new Error('El archivo no es un JSON válido.')
  }

  const backup = parsed as Partial<BackupFile>
  if (backup?.app !== BACKUP_APP || !Array.isArray(backup.datasets)) {
    throw new Error('El archivo no es un respaldo de Big Data.')
  }

  const datasets = backup.datasets.filter(
    (d): d is Dataset => Boolean(d?.id && Array.isArray(d.headers) && Array.isArray(d.rows)),
  )
  const tables = (backup.tables ?? []).filter(
    (t): t is UserTable => Boolean(t?.id && Array.isArray(t.fields)),
  )

  for (const dataset of datasets) await saveDatasetToStore(dataset)
  for (const table of tables) await saveUserTable(table)

  const history = Array.isArray(backup.history)
    ? backup.history.map((entry) => ({ ...entry, stored: true }))
    : datasets.map<HistoryEntry>((d) => ({
        id: d.id,
        fileName: d.fileName,
        sizeBytes: d.sizeBytes,
        rowCount: d.rowCount,
        columnCount: d.columnCount,
        uploadedAt: d.uploadedAt,
        processMs: d.processMs,
        duplicateRows: d.duplicateRows,
        stored: true,
      }))

  return { datasets: datasets.length, tables: tables.length, history }
}

/** Exporta las filas de un dataset como CSV, con el separador que se quiera. */
export function exportDatasetCsv(dataset: Dataset, delimiter = ',') {
  const csv = Papa.unparse(
    { fields: dataset.headers, data: dataset.rows.map((r) => dataset.headers.map((h) => r[h] ?? '')) },
    { delimiter },
  )
  // BOM para que Excel respete acentos.
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  download(blob, dataset.fileName.replace(/\.csv$/i, '') + '.csv')
}

/** Exporta filas arbitrarias (tablas creadas en el frontend) como CSV. */
export function exportRowsCsv(
  fileName: string,
  headers: string[],
  rows: Record<string, string>[],
  delimiter = ',',
) {
  const csv = Papa.unparse(
    { fields: headers, data: rows.map((r) => headers.map((h) => r[h] ?? '')) },
    { delimiter },
  )
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8' })
  download(blob, `${fileName}.csv`)
}

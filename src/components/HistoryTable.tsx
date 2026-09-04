import { useState } from 'react'
import { Eye, Loader2 } from 'lucide-react'
import { useData } from '../context/useData'
import { formatBytes, formatDuration } from '../lib/csvAnalyzer'

const full = new Intl.NumberFormat('es-MX')

interface HistoryTableProps {
  activeId?: string
  tall?: boolean
  readOnly?: boolean
}

export default function HistoryTable({
  activeId,
  tall = false,
  readOnly = false,
}: HistoryTableProps) {
  const { history, restoreFromHistory } = useData()
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState('')

  const handleRestore = async (id: string, fileName: string) => {
    if (restoringId) return
    setRestoringId(id)
    setRestoreError('')
    const ok = await restoreFromHistory(id)
    setRestoringId(null)
    if (!ok) {
      setRestoreError(`«${fileName}» ya no está disponible.`)
    }
  }

  return (
    <>
      {restoreError && <p className="restore-error">{restoreError}</p>}

      <div className={`table-scroll ${tall ? 'table-scroll--tall' : ''}`}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Archivo</th>
              <th>Filas</th>
              <th>Columnas</th>
              <th>Tamaño</th>
              <th>Procesado</th>
              <th>Duración</th>
              <th>Estado</th>
              {!readOnly && <th></th>}
            </tr>
          </thead>
          <tbody>
            {history.map((entry, i) => {
              const isActive = entry.id === activeId
              const isRestoring = restoringId === entry.id
              return (
                <tr key={entry.id}>
                  <td>{history.length - i}</td>
                  <td>
                    <strong className="mono">{entry.fileName}</strong>
                  </td>
                  <td>{full.format(entry.rowCount)}</td>
                  <td>{entry.columnCount}</td>
                  <td>{formatBytes(entry.sizeBytes)}</td>
                  <td>
                    {new Date(entry.uploadedAt).toLocaleString('es-MX', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </td>
                  <td>{formatDuration(entry.processMs)}</td>
                  <td>
                    {isActive ? (
                      <span className="active-badge">En pantalla</span>
                    ) : entry.stored ? (
                      <span className="stored-badge">Guardado</span>
                    ) : (
                      <span className="lost-badge">No disponible</span>
                    )}
                  </td>
                  {!readOnly && (
                    <td>
                      {isActive ? null : entry.stored ? (
                      <button
                        className="restore-btn"
                        onClick={() => void handleRestore(entry.id, entry.fileName)}
                        disabled={restoringId !== null}
                        title={`Ver ${entry.fileName} en el panel`}
                      >
                        {isRestoring ? (
                          <Loader2 size={14} className="spin" />
                        ) : (
                          <Eye size={14} />
                        )}
                        Ver
                      </button>
                    ) : (
                        '—'
                      )}
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}

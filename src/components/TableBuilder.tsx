import { useMemo, useRef, useState } from 'react'
import {
  Check,
  Columns3,
  Copy,
  Download,
  Pencil,
  Plus,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { FieldDef, TableRow, UserTable } from '../lib/datasetStore'
import {
  EMPTY_FIELD_DRAFT,
  FIELD_KINDS,
  addField,
  addRow,
  appendRowsFromCsv,
  duplicateRow,
  emptyRow,
  exportTableCsv,
  formatCell,
  isNumericKind,
  removeField,
  removeRow,
  updateRow,
  validateField,
  validateRow,
  type FieldDraft,
} from '../lib/userTables'
import './TableBuilder.css'

/** Un input adaptado al tipo del campo: lista, fecha, número o texto. */
function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string
  onChange: (next: string) => void
}) {
  if (field.kind === 'select') {
    return (
      <select
        value={value}
        aria-label={field.label}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">— sin valor —</option>
        {(field.options ?? []).map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    )
  }
  if (field.kind === 'date') {
    return (
      <input
        type="date"
        value={value}
        aria-label={field.label}
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }
  return (
    <input
      type="text"
      value={value}
      aria-label={field.label}
      inputMode={isNumericKind(field.kind) ? 'decimal' : undefined}
      placeholder={
        field.kind === 'percent' ? '0 - 100' : isNumericKind(field.kind) ? '0' : ''
      }
      onChange={(e) => onChange(e.target.value)}
    />
  )
}

export interface TableBuilderProps {
  table: UserTable
  onChange: (next: UserTable) => void
  onDelete?: (table: UserTable) => void
}

/**
 * Constructor de tablas del frontend: administra columnas, captura filas,
 * importa/exporta CSV y edita en línea. La persistencia la resuelve el padre.
 */
export default function TableBuilder({
  table,
  onChange,
  onDelete,
}: TableBuilderProps) {
  const [rowDraft, setRowDraft] = useState<TableRow>(() => emptyRow(table.fields))
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<TableRow>({})
  const [fieldDraft, setFieldDraft] = useState<FieldDraft>(EMPTY_FIELD_DRAFT)
  const [showFieldForm, setShowFieldForm] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const visibleRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return table.rows
    return table.rows.filter((row) =>
      table.fields.some((field) =>
        (row[field.key] ?? '').toLowerCase().includes(query),
      ),
    )
  }, [table.rows, table.fields, search])

  const commit = (next: UserTable, message = '') => {
    setError('')
    setNotice(message)
    onChange(next)
  }

  const handleAddRow = () => {
    const problem = validateRow(table.fields, rowDraft)
    if (problem) {
      setError(problem)
      return
    }
    commit(addRow(table, rowDraft))
    setRowDraft(emptyRow(table.fields))
  }

  const startEdit = (row: TableRow) => {
    setEditingId(row.id)
    setEditDraft({ ...emptyRow(table.fields), ...row })
    setError('')
  }

  const saveEdit = () => {
    if (!editingId) return
    const problem = validateRow(table.fields, editDraft)
    if (problem) {
      setError(problem)
      return
    }
    commit(updateRow(table, editingId, editDraft))
    setEditingId(null)
  }

  const handleAddField = () => {
    const problem = validateField(table, fieldDraft)
    if (problem) {
      setError(problem)
      return
    }
    commit(addField(table, fieldDraft), `Columna «${fieldDraft.label.trim()}» agregada.`)
    setFieldDraft(EMPTY_FIELD_DRAFT)
    setShowFieldForm(false)
  }

  const handleImport = async (file: File) => {
    try {
      const result = await appendRowsFromCsv(table, file)
      const skipped =
        result.ignored.length > 0
          ? ` Columnas ignoradas: ${result.ignored.join(', ')}.`
          : ''
      commit(result.table, `${result.added} filas importadas.${skipped}`)
    } catch (err) {
      setNotice('')
      setError(err instanceof Error ? err.message : 'No se pudo importar el CSV.')
    }
  }

  return (
    <section className="panel table-builder">
      <div className="panel__head">
        <div>
          <h3>
            <Columns3 size={17} /> {table.name}
          </h3>
          <p>{table.description || 'Tabla creada desde el panel'}</p>
        </div>
        <div className="tb-actions">
          <span className="panel__tag panel__tag--soft">
            {table.rows.length} filas · {table.fields.length} columnas
          </span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              e.target.value = ''
              if (file) void handleImport(file)
            }}
          />
          <button
            type="button"
            className="icon-action"
            title="Importar filas desde CSV"
            aria-label="Importar filas desde CSV"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} />
          </button>
          <button
            type="button"
            className="icon-action"
            title="Exportar a CSV"
            aria-label="Exportar tabla a CSV"
            disabled={table.rows.length === 0}
            onClick={() => exportTableCsv(table)}
          >
            <Download size={16} />
          </button>
          {onDelete && (
            <button
              type="button"
              className="icon-action icon-action--danger"
              title="Eliminar tabla"
              aria-label={`Eliminar la tabla ${table.name}`}
              onClick={() => onDelete(table)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      {error && <p className="restore-error">{error}</p>}
      {!error && notice && <p className="ok-note">{notice}</p>}

      <div className="tb-columns">
        <div className="tb-columns__chips">
          {table.fields.map((field) => (
            <span key={field.key} className="tb-chip" data-kind={field.kind}>
              <strong>{field.label}</strong>
              <small>{field.kind}</small>
              {!field.locked && (
                <button
                  type="button"
                  aria-label={`Quitar la columna ${field.label}`}
                  title="Quitar columna"
                  onClick={() =>
                    commit(
                      removeField(table, field.key),
                      `Columna «${field.label}» eliminada.`,
                    )
                  }
                >
                  <X size={12} />
                </button>
              )}
            </span>
          ))}
          <button
            type="button"
            className="tb-chip tb-chip--add"
            onClick={() => setShowFieldForm((v) => !v)}
          >
            <Plus size={13} /> Nueva columna
          </button>
        </div>

        {showFieldForm && (
          <div className="tb-field-form">
            <label className="tb-field">
              <span>Nombre</span>
              <input
                type="text"
                value={fieldDraft.label}
                placeholder="Ej. Cupón"
                onChange={(e) =>
                  setFieldDraft({ ...fieldDraft, label: e.target.value })
                }
              />
            </label>
            <label className="tb-field">
              <span>Tipo</span>
              <select
                value={fieldDraft.kind}
                onChange={(e) =>
                  setFieldDraft({
                    ...fieldDraft,
                    kind: e.target.value as FieldDraft['kind'],
                  })
                }
              >
                {FIELD_KINDS.map((k) => (
                  <option key={k.kind} value={k.kind}>
                    {k.label}
                  </option>
                ))}
              </select>
              <small>
                {FIELD_KINDS.find((k) => k.kind === fieldDraft.kind)?.hint}
              </small>
            </label>
            {fieldDraft.kind === 'select' && (
              <label className="tb-field tb-field--wide">
                <span>Opciones</span>
                <input
                  type="text"
                  value={fieldDraft.options}
                  placeholder="Activa, Pausada, Cerrada"
                  onChange={(e) =>
                    setFieldDraft({ ...fieldDraft, options: e.target.value })
                  }
                />
              </label>
            )}
            <button type="button" className="btn btn--sm" onClick={handleAddField}>
              <Check size={15} /> Agregar columna
            </button>
          </div>
        )}
      </div>

      <div className="tb-row-form">
        {table.fields.map((field) => (
          <label key={field.key} className="tb-field">
            <span>{field.label}</span>
            <FieldInput
              field={field}
              value={rowDraft[field.key] ?? ''}
              onChange={(next) =>
                setRowDraft((prev) => ({ ...prev, [field.key]: next }))
              }
            />
          </label>
        ))}
        <button type="button" className="btn btn--primary btn--sm" onClick={handleAddRow}>
          <Plus size={15} /> Guardar fila
        </button>
      </div>

      {table.rows.length > 3 && (
        <div className="table-toolbar">
          <label className="table-toolbar__search">
            <input
              type="search"
              value={search}
              placeholder="Filtrar filas…"
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <span className="pagination__info">
            {visibleRows.length} de {table.rows.length} filas
          </span>
        </div>
      )}

      {visibleRows.length > 0 ? (
        <div className="table-scroll">
          <table className="data-table data-table--dense">
            <thead>
              <tr>
                {table.fields.map((field) => (
                  <th key={field.key}>{field.label}</th>
                ))}
                <th className="tb-col-actions">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row) => {
                const editing = editingId === row.id
                return (
                  <tr key={row.id} className={editing ? 'is-editing' : undefined}>
                    {table.fields.map((field) => (
                      <td key={field.key}>
                        {editing ? (
                          <FieldInput
                            field={field}
                            value={editDraft[field.key] ?? ''}
                            onChange={(next) =>
                              setEditDraft((prev) => ({ ...prev, [field.key]: next }))
                            }
                          />
                        ) : (
                          formatCell(field, row[field.key])
                        )}
                      </td>
                    ))}
                    <td className="tb-col-actions">
                      <div className="tb-row-actions">
                        {editing ? (
                          <>
                            <button
                              type="button"
                              className="icon-action"
                              title="Guardar cambios"
                              aria-label="Guardar cambios de la fila"
                              onClick={saveEdit}
                            >
                              <Check size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-action"
                              title="Cancelar"
                              aria-label="Cancelar edición"
                              onClick={() => setEditingId(null)}
                            >
                              <X size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="icon-action"
                              title="Editar fila"
                              aria-label="Editar fila"
                              onClick={() => startEdit(row)}
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-action"
                              title="Duplicar fila"
                              aria-label="Duplicar fila"
                              onClick={() => commit(duplicateRow(table, row.id))}
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              type="button"
                              className="icon-action icon-action--danger"
                              title="Eliminar fila"
                              aria-label="Eliminar fila"
                              onClick={() => commit(removeRow(table, row.id))}
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="no-results">
          {table.rows.length === 0
            ? 'Todavía no hay filas. Captura la primera con el formulario de arriba.'
            : 'Ninguna fila coincide con el filtro.'}
        </p>
      )}
    </section>
  )
}

import Papa from 'papaparse'
import { parseDateValue, parseNum } from './csvAnalyzer'
import { exportRowsCsv } from './backup'
import type {
  FieldDef,
  FieldKind,
  TableGroup,
  TableRow,
  UserTable,
} from './datasetStore'

/* --------------------------- tipos de campo ------------------------------ */

/** Tipos de campo disponibles al construir una tabla desde el frontend. */
export const FIELD_KINDS: { kind: FieldKind; label: string; hint: string }[] = [
  { kind: 'text', label: 'Texto', hint: 'Nombres, códigos o notas' },
  { kind: 'number', label: 'Número', hint: 'Cantidades y conteos' },
  { kind: 'money', label: 'Dinero', hint: 'Se muestra como moneda' },
  { kind: 'percent', label: 'Porcentaje', hint: 'Valor entre 0 y 100' },
  { kind: 'date', label: 'Fecha', hint: 'Selector de calendario' },
  { kind: 'select', label: 'Lista', hint: 'Opciones separadas por coma' },
]

const NUMERIC_KINDS: FieldKind[] = ['number', 'money', 'percent']

export function isNumericKind(kind: FieldKind): boolean {
  return NUMERIC_KINDS.includes(kind)
}

/* ------------------------------- formato --------------------------------- */

const DIACRITICS = new RegExp('[\\u0300-\\u036f]', 'g')

const moneyFmt = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
  maximumFractionDigits: 2,
})
const numberFmt = new Intl.NumberFormat('es-MX')

/** Convierte una etiqueta en una clave segura para usar como columna. */
export function slugify(label: string): string {
  const base = label
    .toLowerCase()
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  return base || 'campo'
}

/** Clave única para un campo nuevo, sin choques con las que ya existen. */
export function uniqueKey(label: string, taken: string[]): string {
  const base = slugify(label)
  if (!taken.includes(base)) return base
  let i = 2
  while (taken.includes(`${base}_${i}`)) i++
  return `${base}_${i}`
}

/** Valor listo para mostrar en la tabla, según el tipo del campo. */
export function formatCell(field: FieldDef, raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return '—'
  const n = parseNum(value)
  switch (field.kind) {
    case 'money':
      return n === null ? value : moneyFmt.format(n)
    case 'number':
      return n === null ? value : numberFmt.format(n)
    case 'percent':
      return n === null ? value : `${numberFmt.format(n)}%`
    case 'date': {
      const date = parseDateValue(value)
      return date
        ? date.toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
        : value
    }
    default:
      return value
  }
}

/** Lee una celda como número; 0 cuando está vacía o no es numérica. */
export function cellNumber(row: TableRow, key: string): number {
  return parseNum((row[key] ?? '').trim()) ?? 0
}

/** Lee una celda como número o null si no hay dato aprovechable. */
export function cellNumberOrNull(row: TableRow, key: string): number | null {
  return parseNum((row[key] ?? '').trim())
}

/** Lee una celda como fecha o null. */
export function cellDate(row: TableRow, key: string): Date | null {
  return parseDateValue((row[key] ?? '').trim())
}

/** Fecha en formato yyyy-mm-dd, el que entiende `<input type="date">`. */
export function toISODate(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/* ----------------------------- filas y campos ---------------------------- */

function touch(table: UserTable): UserTable {
  return { ...table, updatedAt: new Date().toISOString() }
}

export function newRowId(): string {
  return `fila-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
}

/** Borrador vacío con una entrada por campo de la tabla. */
export function emptyRow(fields: FieldDef[]): TableRow {
  const out: TableRow = {}
  for (const field of fields) out[field.key] = ''
  return out
}

/** Normaliza los valores capturados: recorta texto y unifica decimales. */
function normalizeRow(fields: FieldDef[], values: TableRow): TableRow {
  const out: TableRow = {}
  for (const field of fields) {
    const raw = (values[field.key] ?? '').trim()
    if (isNumericKind(field.kind)) {
      const n = parseNum(raw)
      out[field.key] = n === null ? '' : String(n)
    } else if (field.kind === 'date') {
      // Se guarda en ISO para que el selector de fecha lo vuelva a leer.
      const date = parseDateValue(raw)
      out[field.key] = date ? toISODate(date) : raw
    } else {
      out[field.key] = raw
    }
  }
  return out
}

/** Mensaje de error del borrador, o null si la fila es válida. */
export function validateRow(fields: FieldDef[], values: TableRow): string | null {
  const first = fields[0]
  if (first && !(values[first.key] ?? '').trim()) {
    return `Escribe ${first.label.toLowerCase()} para guardar la fila.`
  }
  for (const field of fields) {
    const raw = (values[field.key] ?? '').trim()
    if (!raw) continue
    if (isNumericKind(field.kind)) {
      const n = parseNum(raw)
      if (n === null) return `«${field.label}» debe ser un número.`
      if (field.kind === 'percent' && (n < 0 || n > 100)) {
        return `«${field.label}» debe estar entre 0 y 100.`
      }
      continue
    }
    if (field.kind === 'date' && !parseDateValue(raw)) {
      return `«${field.label}» no es una fecha válida.`
    }
  }
  return null
}

export function addRow(table: UserTable, values: TableRow): UserTable {
  const row: TableRow = { id: newRowId(), ...normalizeRow(table.fields, values) }
  return touch({ ...table, rows: [row, ...table.rows] })
}

export function updateRow(
  table: UserTable,
  id: string,
  values: TableRow,
): UserTable {
  const rows = table.rows.map((row) =>
    row.id === id ? { ...row, ...normalizeRow(table.fields, values), id } : row,
  )
  return touch({ ...table, rows })
}

export function removeRow(table: UserTable, id: string): UserTable {
  return touch({ ...table, rows: table.rows.filter((row) => row.id !== id) })
}

/** Copia una fila para capturar variantes de la misma oferta rápidamente. */
export function duplicateRow(table: UserTable, id: string): UserTable {
  const source = table.rows.find((row) => row.id === id)
  if (!source) return table
  const index = table.rows.indexOf(source)
  const copy: TableRow = { ...source, id: newRowId() }
  const rows = [...table.rows]
  rows.splice(index + 1, 0, copy)
  return touch({ ...table, rows })
}

/* ------------------------------ campos ----------------------------------- */

export interface FieldDraft {
  label: string
  kind: FieldKind
  options: string
}

export const EMPTY_FIELD_DRAFT: FieldDraft = {
  label: '',
  kind: 'text',
  options: '',
}

export function parseOptions(raw: string): string[] {
  return [...new Set(raw.split(',').map((o) => o.trim()).filter(Boolean))]
}

/** Valida un campo nuevo contra los que ya tiene la tabla. */
export function validateField(
  table: UserTable,
  draft: FieldDraft,
): string | null {
  const label = draft.label.trim()
  if (!label) return 'Ponle nombre a la columna.'
  if (label.length > 40) return 'El nombre de la columna es demasiado largo.'
  const clash = table.fields.some(
    (f) => f.label.toLowerCase() === label.toLowerCase(),
  )
  if (clash) return `Ya existe una columna llamada «${label}».`
  if (draft.kind === 'select' && parseOptions(draft.options).length < 2) {
    return 'Una lista necesita al menos dos opciones separadas por coma.'
  }
  return null
}

export function addField(table: UserTable, draft: FieldDraft): UserTable {
  const label = draft.label.trim()
  const field: FieldDef = {
    key: uniqueKey(label, table.fields.map((f) => f.key)),
    label,
    kind: draft.kind,
  }
  if (draft.kind === 'select') field.options = parseOptions(draft.options)
  return touch({ ...table, fields: [...table.fields, field] })
}

/** Quita un campo no bloqueado y limpia su valor en todas las filas. */
export function removeField(table: UserTable, key: string): UserTable {
  const field = table.fields.find((f) => f.key === key)
  if (!field || field.locked) return table
  const rows = table.rows.map((row) => {
    const next: TableRow = {}
    for (const [k, v] of Object.entries(row)) {
      if (k !== key) next[k] = v
    }
    return next
  })
  return touch({
    ...table,
    fields: table.fields.filter((f) => f.key !== key),
    rows,
  })
}

/* ------------------------------- tablas ---------------------------------- */

export interface TableInit {
  name: string
  description?: string
  icon?: string
  group?: TableGroup
  fields: FieldDef[]
}

export function createTable(init: TableInit): UserTable {
  const now = new Date().toISOString()
  const name = init.name.trim()
  return {
    id: `tabla-${slugify(name)}-${Date.now().toString(36)}`,
    name,
    description: init.description?.trim() ?? '',
    icon: init.icon ?? 'table',
    group: init.group ?? 'libre',
    fields: init.fields,
    rows: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function renameTable(
  table: UserTable,
  name: string,
  description: string,
): UserTable {
  return touch({
    ...table,
    name: name.trim() || table.name,
    description: description.trim(),
  })
}

/** Descarga la tabla como CSV usando las etiquetas visibles como encabezados. */
export function exportTableCsv(table: UserTable): void {
  const headers = table.fields.map((f) => f.label)
  const rows = table.rows.map((row) => {
    const out: Record<string, string> = {}
    for (const field of table.fields) out[field.label] = row[field.key] ?? ''
    return out
  })
  exportRowsCsv(slugify(table.name), headers, rows)
}

/* --------------------------- importar desde CSV -------------------------- */

function parseCsv(file: File): Promise<Record<string, string>[]> {
  return new Promise((resolve, reject) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => resolve(result.data ?? []),
      error: () => reject(new Error('No se pudo leer el CSV.')),
    })
  })
}

/** Deduce el tipo de un campo mirando los primeros valores de la columna. */
function guessKind(values: string[]): FieldKind {
  const filled = values.filter(Boolean).slice(0, 60)
  if (filled.length === 0) return 'text'
  if (filled.every((v) => parseNum(v) !== null)) return 'number'
  if (filled.every((v) => parseDateValue(v) !== null)) return 'date'
  return 'text'
}

/**
 * Crea una tabla nueva a partir de un CSV: los encabezados se vuelven campos y
 * cada fila se guarda tal cual, con el tipo deducido por columna.
 */
export async function tableFromCsv(
  file: File,
  init: { name?: string; description?: string; group?: TableGroup } = {},
): Promise<UserTable> {
  const parsed = await parseCsv(file)
  const headers = Object.keys(parsed[0] ?? {}).filter((h) => h.trim())
  if (headers.length === 0) throw new Error('El CSV no trae encabezados.')

  const keys: string[] = []
  const fields: FieldDef[] = headers.map((header) => {
    const key = uniqueKey(header, keys)
    keys.push(key)
    return {
      key,
      label: header.trim(),
      kind: guessKind(parsed.map((row) => (row[header] ?? '').trim())),
    }
  })

  const table = createTable({
    name: init.name?.trim() || file.name.replace(/\.csv$/i, ''),
    description: init.description ?? `Importada de ${file.name}`,
    icon: 'table',
    group: init.group,
    fields,
  })

  const rows = parsed.map((source) => {
    const values: TableRow = {}
    fields.forEach((field, i) => {
      values[field.key] = (source[headers[i]] ?? '').trim()
    })
    return { id: newRowId(), ...normalizeRow(fields, values) }
  })

  return { ...table, rows }
}

/** Agrega filas de un CSV a una tabla existente, casando columnas por nombre. */
export async function appendRowsFromCsv(
  table: UserTable,
  file: File,
): Promise<{ table: UserTable; added: number; ignored: string[] }> {
  const parsed = await parseCsv(file)
  const headers = Object.keys(parsed[0] ?? {}).filter((h) => h.trim())
  if (headers.length === 0) throw new Error('El CSV no trae encabezados.')

  const byName = new Map<string, FieldDef>()
  for (const field of table.fields) {
    byName.set(slugify(field.label), field)
    byName.set(field.key, field)
  }

  const matched = new Map<string, FieldDef>()
  const ignored: string[] = []
  for (const header of headers) {
    const field = byName.get(slugify(header))
    if (field) matched.set(header, field)
    else ignored.push(header)
  }
  if (matched.size === 0) {
    throw new Error('Ninguna columna del CSV coincide con las de la tabla.')
  }

  const rows = parsed.map((source) => {
    const values = emptyRow(table.fields)
    for (const [header, field] of matched) {
      values[field.key] = (source[header] ?? '').trim()
    }
    return { id: newRowId(), ...normalizeRow(table.fields, values) }
  })

  return {
    table: touch({ ...table, rows: [...rows, ...table.rows] }),
    added: rows.length,
    ignored,
  }
}

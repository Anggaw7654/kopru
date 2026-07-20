import type { QueryResult } from '@shared/types/postgres.js'

interface Props {
  result: QueryResult
  orderBy?: string | null
  descending?: boolean
  onSort?: (column: string) => void
  filter?: string
  onFilterChange?: (value: string) => void
}

/**
 * Read-only by design (v1): the grid has no cell editing at all, so there is no
 * path from a stray click to a written row. Data changes are made deliberately
 * from the SQL editor, where they pass the danger assessment.
 */
export function DataGrid({
  result,
  orderBy,
  descending,
  onSort,
  filter,
  onFilterChange,
}: Props): React.JSX.Element {
  const needle = (filter ?? '').toLowerCase()
  const rows =
    needle === ''
      ? result.rows
      : result.rows.filter((row) => row.some((cell) => (cell ?? '').toLowerCase().includes(needle)))

  return (
    <div className="grid">
      {onFilterChange && (
        <input
          className="grid__filter"
          placeholder="Görünen satırlarda filtrele…"
          value={filter ?? ''}
          onChange={(e) => {
            onFilterChange(e.target.value)
          }}
        />
      )}

      <div className="grid__scroll">
        <table className="file-table">
          <thead>
            <tr>
              {result.fields.map((field) => (
                <th
                  key={field.name}
                  className={onSort ? 'sortable' : ''}
                  onClick={() => onSort?.(field.name)}
                >
                  {field.name}
                  {orderBy === field.name && (descending ? ' ▾' : ' ▴')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={`row-${String(rowIndex)}`}>
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${String(rowIndex)}-${String(cellIndex)}`}
                    className={cell === null ? 'null-cell' : ''}
                  >
                    {cell === null ? 'NULL' : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="grid__meta">
        {needle === ''
          ? `${String(result.rowCount)} satır · ${String(result.durationMs)} ms`
          : `${String(rows.length)} / ${String(result.rows.length)} satır eşleşti`}
        {onFilterChange && <em> — filtre yalnızca bu sayfadaki satırlara uygulanır</em>}
      </footer>
    </div>
  )
}

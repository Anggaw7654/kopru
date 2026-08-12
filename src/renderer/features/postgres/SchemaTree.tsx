import { useState } from 'react'
import type { SchemaInfo, TableRef } from '@shared/types/postgres.js'
import { formatSize } from '../files/format.js'
import { useT } from '../../stores/dil.js'

interface Props {
  schemas: SchemaInfo[]
  selected: TableRef | null
  onSelect: (table: TableRef) => void
}

const KIND_ICON: Record<TableRef['kind'], string> = {
  table: '▦',
  view: '◫',
  matview: '◪',
}

export function SchemaTree({ schemas, selected, onSelect }: Props): React.JSX.Element {
  const t = useT()
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (name: string): void => {
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  if (schemas.length === 0) return <p className="hint">{t('Şema bulunamadı.')}</p>

  return (
    <div className="tree">
      {schemas.map((schema) => (
        <div key={schema.name}>
          <button type="button" className="tree__schema" onClick={() => { toggle(schema.name) }}>
            {collapsed.has(schema.name) ? '▸' : '▾'} {schema.name}
            <em>{String(schema.tables.length)}</em>
          </button>

          {!collapsed.has(schema.name) &&
            schema.tables.map((table) => (
              <button
                key={`${table.schema}.${table.name}`}
                type="button"
                className={`tree__table ${
                  selected?.schema === table.schema && selected.name === table.name
                    ? 'tree__table--active'
                    : ''
                }`}
                onClick={() => { onSelect(table) }}
                title={t('{n} satır (tahmini) · {boyut}', { n: table.estimatedRows.toLocaleString(), boyut: formatSize(table.sizeBytes) })}
              >
                {KIND_ICON[table.kind]} {table.name}
              </button>
            ))}
        </div>
      ))}
    </div>
  )
}

import { useState } from 'react'
import type { DirEntry } from '@shared/types/files.js'

interface Props {
  entry: DirEntry
  onApply: (mode: number, recursive: boolean) => void
  onClose: () => void
}

const CLASSES = [
  { label: 'Sahip', shift: 6 },
  { label: 'Grup', shift: 3 },
  { label: 'Diğer', shift: 0 },
] as const

const BITS = [
  { label: 'Oku', value: 4 },
  { label: 'Yaz', value: 2 },
  { label: 'Çalıştır', value: 1 },
] as const

export function PermissionsDialog({ entry, onApply, onClose }: Props): React.JSX.Element {
  const [mode, setMode] = useState(entry.mode & 0o777)
  const [recursive, setRecursive] = useState(false)

  const toggle = (shift: number, value: number): void => {
    setMode((current) => current ^ (value << shift))
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => { e.stopPropagation() }}>
        <h3>İzinler — {entry.name}</h3>

        <table className="perm-table">
          <thead>
            <tr>
              <th />
              {BITS.map((bit) => <th key={bit.label}>{bit.label}</th>)}
            </tr>
          </thead>
          <tbody>
            {CLASSES.map((cls) => (
              <tr key={cls.label}>
                <td>{cls.label}</td>
                {BITS.map((bit) => (
                  <td key={bit.label}>
                    <input
                      type="checkbox"
                      checked={(mode & (bit.value << cls.shift)) !== 0}
                      onChange={() => { toggle(cls.shift, bit.value) }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p className="perm-octal">
          Sekizlik: <code>{mode.toString(8).padStart(3, '0')}</code>
        </p>

        {entry.kind === 'directory' && (
          <label className="checkbox">
            <input
              type="checkbox"
              checked={recursive}
              onChange={(e) => { setRecursive(e.target.checked) }}
            />
            Alt klasör ve dosyalara da uygula
          </label>
        )}

        <div className="row">
          <button type="button" onClick={() => { onApply(mode, recursive) }}>Uygula</button>
          <button type="button" onClick={onClose}>Vazgeç</button>
        </div>
      </div>
    </div>
  )
}

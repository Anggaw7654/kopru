import { useEffect, useState } from 'react'
import type { Profile } from '@shared/types/profile.js'
import type { QueryResult, TableDetail, TableRef } from '@shared/types/postgres.js'
import { usePostgresStore } from '../../stores/postgres.js'
import { useTransferStore } from '../../stores/transfers.js'
import { formatSize } from '../files/format.js'
import { SchemaTree } from './SchemaTree.js'
import { DataGrid } from './DataGrid.js'
import { SqlEditor } from './SqlEditor.js'
import { HealthTab } from './HealthTab.js'
import { useT } from '../../stores/dil.js'

const PAGE_SIZE = 100

type Tab = 'schema' | 'sql' | 'health' | 'backup'

/**
 * Everything scoped to one table lives here so the parent can drop it with a
 * `key`. Selecting another table then starts from a clean slate — no stale rows
 * from the previous table, and no setState-in-effect cascade to clear them.
 */
function TableView({
  profileId,
  database,
  table,
}: {
  profileId: string
  database: string
  table: TableRef
}): React.JSX.Element {
  const t = useT()
  const [detail, setDetail] = useState<TableDetail | null>(null)
  const [rows, setRows] = useState<QueryResult | null>(null)
  const [page, setPage] = useState(0)
  const [orderBy, setOrderBy] = useState<string | null>(null)
  const [descending, setDescending] = useState(false)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fail = (err: unknown): void => {
    setError(err instanceof Error ? err.message : String(err))
  }

  useEffect(() => {
    window.kopru
      .invoke('pg:table-detail', { profileId, database, table })
      .then(setDetail)
      .catch(fail)
  }, [profileId, database, table])

  const loadPage = (nextPage: number, sort: string | null, desc: boolean): void => {
    setBusy(true)
    window.kopru
      .invoke('pg:browse', {
        profileId,
        database,
        table,
        orderBy: sort,
        descending: desc,
        limit: PAGE_SIZE,
        offset: nextPage * PAGE_SIZE,
      })
      .then((result) => {
        setRows(result)
        setFilter('')
      })
      .catch(fail)
      .finally(() => {
        setBusy(false)
      })
  }

  if (error !== null) return <div className="banner banner--error">{error}</div>
  if (detail === null) return <p className="hint">{t('Yükleniyor…')}</p>

  return (
    <>
      <h4>
        {table.schema}.{table.name}
      </h4>
      <p className="hint">
        {t('~{n} satır (planlayıcı tahmini)', { n: table.estimatedRows.toLocaleString() })} ·{' '}
        {formatSize(table.sizeBytes)}
      </p>

      <table className="file-table">
        <thead>
          <tr>
            <th>Kolon</th>
            <th>{t('Tür')}</th>
            <th>{t('Boş olabilir')}</th>
            <th>{t('Varsayılan')}</th>
          </tr>
        </thead>
        <tbody>
          {detail.columns.map((column) => (
            <tr key={column.name}>
              <td>
                {column.isPrimaryKey && '🔑 '}
                {column.name}
              </td>
              <td>{column.type}</td>
              <td>{column.nullable ? t('evet') : t('hayır')}</td>
              <td className="ellipsis">{column.defaultValue ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {detail.indexes.length > 0 && (
        <>
          <h4>{t('İndeksler')}</h4>
          <table className="file-table">
            <thead>
              <tr>
                <th>Ad</th>
                <th>Tarama</th>
                <th>Boyut</th>
                <th>{t('Tanım')}</th>
              </tr>
            </thead>
            <tbody>
              {detail.indexes.map((index) => (
                <tr key={index.name}>
                  <td>{index.name}</td>
                  <td className={index.scans === 0 && !index.isPrimary ? 'hot' : ''}>
                    {index.scans.toLocaleString('tr-TR')}
                  </td>
                  <td>{formatSize(index.sizeBytes)}</td>
                  <td className="ellipsis" title={index.definition}>
                    {index.definition}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <div className="row pg__browse">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setPage(0)
            loadPage(0, orderBy, descending)
          }}
        >
          {t('Veriyi göster')}
        </button>
        {rows !== null && (
          <>
            <button
              type="button"
              disabled={busy || page === 0}
              onClick={() => {
                const previous = page - 1
                setPage(previous)
                loadPage(previous, orderBy, descending)
              }}
            >
              {t('‹ Önceki')}
            </button>
            <span className="hint">
              {String(page * PAGE_SIZE + 1)}–{String(page * PAGE_SIZE + rows.rowCount)}
            </span>
            <button
              type="button"
              disabled={busy || rows.rowCount < PAGE_SIZE}
              onClick={() => {
                const next = page + 1
                setPage(next)
                loadPage(next, orderBy, descending)
              }}
            >
              Sonraki ›
            </button>
          </>
        )}
      </div>

      {rows !== null && (
        <DataGrid
          result={rows}
          orderBy={orderBy}
          descending={descending}
          filter={filter}
          onFilterChange={setFilter}
          onSort={(column) => {
            const desc = orderBy === column ? !descending : false
            setOrderBy(column)
            setDescending(desc)
            setPage(0)
            loadPage(0, column, desc)
          }}
        />
      )}
    </>
  )
}

export function PostgresPanel({ profile }: { profile: Profile }): React.JSX.Element {
  const t = useT()
  const { database, databases, schemas, selectedTable, selectTable, setDatabase } =
    usePostgresStore()
  const setTransfersOpen = useTransferStore((s) => s.setOpen)

  const [tab, setTab] = useState<Tab>('schema')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fail = (err: unknown): void => {
    setError(err instanceof Error ? err.message : String(err))
  }

  useEffect(() => {
    if (!profile.postgres.enabled) return
    // Actions are read off the store rather than the hook result so this effect
    // does not re-run every time any slice of the store changes.
    const store = usePostgresStore.getState()
    store.setDatabase(profile.postgres.database)
    window.kopru
      .invoke('pg:databases', { profileId: profile.id })
      .then(store.setDatabases)
      .catch(fail)
  }, [profile.id, profile.postgres.enabled, profile.postgres.database])

  useEffect(() => {
    if (!profile.postgres.enabled || database === '') return
    window.kopru
      .invoke('pg:schemas', { profileId: profile.id, database })
      .then(usePostgresStore.getState().setSchemas)
      .catch(fail)
  }, [profile.id, profile.postgres.enabled, database])

  if (!profile.postgres.enabled) {
    return (
      <div className="docker__missing">
        <h3>{t('PostgreSQL kapalı')}</h3>
        <pre>
          {t('Bu profil için veritabanı bağlantısı yapılandırılmamış.')}{'\n'}
          {t('Sol taraftan profili Düzenle → PostgreSQL bölümünden açın.')}
        </pre>
      </div>
    )
  }

  const backup = async (): Promise<void> => {
    const proceed = window.confirm(
      t(
        '{db} veritabanının yedeği alınacak (pg_dump -Fc), ardından bilgisayarınıza indirilecek.\n\nBüyük veritabanlarında bu işlem sunucuyu bir süre meşgul eder. Devam edilsin mi?',
        { db: database },
      ),
    )
    if (!proceed) return

    setBusy(true)
    setError(null)
    try {
      const result = await window.kopru.invoke('pg:backup', { profileId: profile.id, database })
      if (result !== null) setTransfersOpen(true)
    } catch (err) {
      fail(err)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="pg">
      <div className="pg__bar">
        <select
          value={database}
          onChange={(e) => {
            setDatabase(e.target.value)
          }}
        >
          {databases.map((db) => (
            <option key={db.name} value={db.name} disabled={!db.connectable}>
              {db.name} ({formatSize(db.sizeBytes)})
            </option>
          ))}
        </select>

        <div className="docker__tabs">
          <button
            type="button"
            className={tab === 'schema' ? 'view-switch--active' : ''}
            onClick={() => {
              setTab('schema')
            }}
          >
            {t('Şema')}
          </button>
          <button
            type="button"
            className={tab === 'sql' ? 'view-switch--active' : ''}
            onClick={() => {
              setTab('sql')
            }}
          >
            SQL
          </button>
          <button
            type="button"
            className={tab === 'health' ? 'view-switch--active' : ''}
            onClick={() => {
              setTab('health')
            }}
          >
            {t('Sağlık')}
          </button>
          <button
            type="button"
            className={tab === 'backup' ? 'view-switch--active' : ''}
            onClick={() => {
              setTab('backup')
            }}
          >
            Yedek
          </button>
        </div>
      </div>

      {error !== null && <div className="banner banner--error">{error}</div>}

      {tab === 'schema' && (
        <div className="pg__body">
          <aside className="pg__tree">
            <SchemaTree schemas={schemas} selected={selectedTable} onSelect={selectTable} />
          </aside>

          <div className="pg__detail">
            {!selectedTable && <p className="hint">{t('Soldan bir tablo seçin.')}</p>}
            {selectedTable && (
              <TableView
                key={`${selectedTable.schema}.${selectedTable.name}`}
                profileId={profile.id}
                database={database}
                table={selectedTable}
              />
            )}
          </div>
        </div>
      )}

      {tab === 'sql' && <SqlEditor profileId={profile.id} database={database} />}
      {tab === 'health' && <HealthTab profileId={profile.id} database={database} />}

      {tab === 'backup' && (
        <div className="section">
          <h4>Yedek al</h4>
          <p className="hint">
            Sunucuda <code>pg_dump -Fc</code> çalıştırılır, oluşan dosya SFTP ile Mac’inize
            indirilir. İlerleme alttaki aktarım kuyruğunda görünür.
          </p>
          <button type="button" disabled={busy} onClick={() => void backup()}>
            {busy ? 'Yedek alınıyor…' : `${database} yedeğini al ve indir`}
          </button>
          <p className="hint">
            {t('Geri yükleme bu sürümde')} <strong>yok</strong>. Yanlışlıkla yapılan bir geri yükleme,
            eksik bir özellikten çok daha fazla zarar verir.
          </p>
        </div>
      )}
    </div>
  )
}

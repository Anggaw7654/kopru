import type { Client } from 'pg'
import type {
  ColumnInfo, DatabaseInfo, IndexInfo, PostgresConfig, SchemaInfo, TableDetail, TableRef,
} from '../../../shared/types/postgres.js'
import { withClient } from './pool.js'

/** All catalog reads are parameterised; identifiers are never interpolated. */

export async function databases(
  profileId: string,
  config: PostgresConfig,
): Promise<DatabaseInfo[]> {
  return withClient(profileId, config.database, config, async (client: Client) => {
    const result = await client.query<{ name: string; size: string; connectable: boolean }>(
      `select datname as name,
              pg_database_size(datname)::text as size,
              datallowconn as connectable
         from pg_database
        where not datistemplate
        order by datname`,
    )
    return result.rows.map((row) => ({
      name: row.name,
      sizeBytes: Number(row.size),
      connectable: row.connectable,
    }))
  })
}

export async function schemas(
  profileId: string,
  database: string,
  config: PostgresConfig,
): Promise<SchemaInfo[]> {
  return withClient(profileId, database, config, async (client: Client) => {
    const result = await client.query<{
      schema: string; name: string; kind: string; rows: string; size: string
    }>(
      `select n.nspname as schema,
              c.relname  as name,
              case c.relkind when 'r' then 'table'
                             when 'p' then 'table'
                             when 'v' then 'view'
                             when 'm' then 'matview' end as kind,
              c.reltuples::bigint::text as rows,
              pg_total_relation_size(c.oid)::text as size
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where c.relkind in ('r','p','v','m')
          and n.nspname not in ('pg_catalog','information_schema')
          and n.nspname not like 'pg_toast%'
        order by n.nspname, c.relname`,
    )

    const grouped = new Map<string, TableRef[]>()
    for (const row of result.rows) {
      const list = grouped.get(row.schema) ?? []
      list.push({
        schema: row.schema,
        name: row.name,
        kind: row.kind as TableRef['kind'],
        // reltuples is a planner estimate and is -1 before the first ANALYZE.
        estimatedRows: Math.max(0, Number(row.rows)),
        sizeBytes: Number(row.size),
      })
      grouped.set(row.schema, list)
    }
    return [...grouped].map(([name, tables]) => ({ name, tables }))
  })
}

export async function tableDetail(
  profileId: string,
  database: string,
  config: PostgresConfig,
  table: TableRef,
): Promise<TableDetail> {
  return withClient(profileId, database, config, async (client: Client) => {
    const columns = await client.query<{
      name: string; type: string; nullable: string; default_value: string | null; is_pk: boolean
    }>(
      `select a.attname as name,
              format_type(a.atttypid, a.atttypmod) as type,
              case when a.attnotnull then 'no' else 'yes' end as nullable,
              pg_get_expr(d.adbin, d.adrelid) as default_value,
              coalesce(pk.is_pk, false) as is_pk
         from pg_attribute a
         left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
         left join (
              select conrelid, unnest(conkey) as attnum, true as is_pk
                from pg_constraint where contype = 'p'
         ) pk on pk.conrelid = a.attrelid and pk.attnum = a.attnum
        where a.attrelid = format('%I.%I', $1::text, $2::text)::regclass
          and a.attnum > 0 and not a.attisdropped
        order by a.attnum`,
      [table.schema, table.name],
    )

    const indexes = await client.query<{
      name: string; definition: string; is_unique: boolean; is_primary: boolean;
      scans: string; size: string
    }>(
      `select i.relname as name,
              pg_get_indexdef(x.indexrelid) as definition,
              x.indisunique  as is_unique,
              x.indisprimary as is_primary,
              coalesce(s.idx_scan, 0)::text as scans,
              pg_relation_size(x.indexrelid)::text as size
         from pg_index x
         join pg_class i on i.oid = x.indexrelid
         left join pg_stat_user_indexes s on s.indexrelid = x.indexrelid
        where x.indrelid = format('%I.%I', $1::text, $2::text)::regclass
        order by i.relname`,
      [table.schema, table.name],
    )

    const columnInfos: ColumnInfo[] = columns.rows.map((row) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable === 'yes',
      defaultValue: row.default_value,
      isPrimaryKey: row.is_pk,
    }))

    const indexInfos: IndexInfo[] = indexes.rows.map((row) => ({
      name: row.name,
      definition: row.definition,
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
      scans: Number(row.scans),
      sizeBytes: Number(row.size),
    }))

    return { table, columns: columnInfos, indexes: indexInfos }
  })
}

/**
 * Builds the paginated browse query. Identifiers are quoted by the server via
 * format('%I'), so a table called `x"; drop …` is impossible to weaponise.
 */
export function browseSql(table: TableRef, orderBy: string | null, descending: boolean): string {
  const quote = (value: string): string => `"${value.replaceAll('"', '""')}"`
  const target = `${quote(table.schema)}.${quote(table.name)}`
  if (orderBy === null) return `select * from ${target}`
  return `select * from ${target} order by ${quote(orderBy)} ${descending ? 'desc' : 'asc'}`
}

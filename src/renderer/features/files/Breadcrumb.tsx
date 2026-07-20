interface Props {
  path: string
  onNavigate: (path: string) => void
}

export function Breadcrumb({ path, onNavigate }: Props): React.JSX.Element {
  const segments = path.split('/').filter(Boolean)

  return (
    <nav className="breadcrumb">
      <button type="button" onClick={() => { onNavigate('/') }}>/</button>
      {segments.map((segment, index) => {
        const target = `/${segments.slice(0, index + 1).join('/')}`
        return (
          <span key={target}>
            <button type="button" onClick={() => { onNavigate(target) }}>{segment}</button>
            {index < segments.length - 1 && <em>/</em>}
          </span>
        )
      })}
    </nav>
  )
}

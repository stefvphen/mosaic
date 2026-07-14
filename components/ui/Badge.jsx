export function Badge({ tone = 'draft', children }) {
  return <span className={`badge badge-${tone}`}>{children}</span>
}

export function Button({
  variant = 'primary',
  size = 'md',
  as: Comp = 'button',
  className = '',
  ...props
}) {
  const cls = [
    'btn',
    `btn-${variant}`,
    size !== 'md' ? `btn-${size}` : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <Comp className={cls} {...props} />
}

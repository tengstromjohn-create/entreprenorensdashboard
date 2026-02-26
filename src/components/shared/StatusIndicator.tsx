interface Props {
  status: 'green' | 'yellow' | 'red'
  label?: string
  size?: 'sm' | 'md'
}

const COLORS = {
  green:  { bg: 'bg-green-100', dot: 'bg-green-500', text: 'text-green-700' },
  yellow: { bg: 'bg-yellow-100', dot: 'bg-yellow-500', text: 'text-yellow-700' },
  red:    { bg: 'bg-red-100', dot: 'bg-red-500', text: 'text-red-700' },
}

export function StatusIndicator({ status, label, size = 'md' }: Props) {
  const c = COLORS[status]
  return (
    <span className={`inline-flex items-center gap-1.5 ${size === 'sm' ? 'text-xs' : 'text-sm'} font-medium ${c.text} ${c.bg} px-2 py-0.5 rounded-full`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {label}
    </span>
  )
}

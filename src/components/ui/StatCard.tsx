interface StatCardProps {
  label: string
  value: number | string
  icon?: React.ReactNode
  color?: string
}

export function StatCard({ label, value, icon, color = 'bg-primary-50 text-primary-600' }: StatCardProps) {
  return (
    <div className="card p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-1">{value}</p>
        </div>
        {icon && (
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}

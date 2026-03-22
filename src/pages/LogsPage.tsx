import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { RefreshCw, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import type { MessageLog } from '../types'

export default function LogsPage() {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<'all' | 'sent' | 'failed'>('all')

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('message_logs')
        .select('*, leads(name, phone), campaigns(name)')
        .order('sent_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data as MessageLog[]
    },
  })

  const filtered = logs.filter((log) => {
    const matchSearch =
      !search ||
      (log.leads as any)?.name?.toLowerCase().includes(search.toLowerCase()) ||
      log.phone.includes(search) ||
      log.message.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || log.status === filterStatus
    return matchSearch && matchStatus
  })

  const sentCount = logs.filter((l) => l.status === 'sent').length
  const failedCount = logs.filter((l) => l.status === 'failed').length

  return (
    <div className="p-6">
      <PageHeader
        title="سجل الرسائل"
        subtitle={`${logs.length} رسالة إجمالاً`}
        action={
          <button className="btn-secondary" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4" />
            تحديث
          </button>
        }
      />

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{logs.length}</p>
          <p className="text-xs text-gray-500 mt-0.5">إجمالي</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{sentCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">أُرسلت</p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{failedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">فشلت</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pr-9"
            placeholder="بحث بالاسم أو الرقم أو الرسالة..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-36"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as 'all' | 'sent' | 'failed')}
        >
          <option value="all">الكل</option>
          <option value="sent">أُرسلت</option>
          <option value="failed">فشلت</option>
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">لا توجد رسائل</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-600">العميل</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الرسالة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الحملة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الوقت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">
                      {(log.leads as any)?.name || '—'}
                    </p>
                    <p className="text-xs text-gray-400 font-mono" dir="ltr">{log.phone}</p>
                  </td>
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-gray-700 truncate">{log.message}</p>
                    {log.error && (
                      <p className="text-xs text-red-500 mt-0.5 truncate">{log.error}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {(log.campaigns as any)?.name || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      className={
                        log.status === 'sent'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-red-100 text-red-700'
                      }
                    >
                      {log.status === 'sent' ? 'أُرسلت' : 'فشل'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap" dir="ltr">
                    {new Date(log.sent_at).toLocaleString('ar-SA')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

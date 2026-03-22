import { useQuery } from '@tanstack/react-query'
import { Users, MessageSquare, Megaphone, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { StatCard } from '../components/ui/StatCard'
import { PageHeader } from '../components/ui/PageHeader'
import { STATUS_LABELS, STATUS_COLORS } from '../lib/utils'
import { Badge } from '../components/ui/Badge'
import type { LeadStatus } from '../types'

const STATUS_ORDER: LeadStatus[] = ['new', 'engaged', 'offered', 'converted']

export default function Dashboard() {
  const { data: leadStats } = useQuery({
    queryKey: ['dashboard-leads'],
    queryFn: async () => {
      const { data } = await supabase
        .from('leads')
        .select('status')
      if (!data) return { total: 0, byStatus: {} as Record<string, number> }

      const byStatus: Record<string, number> = {}
      for (const row of data) {
        byStatus[row.status] = (byStatus[row.status] || 0) + 1
      }
      return { total: data.length, byStatus }
    },
  })

  const { data: todayLogs } = useQuery({
    queryKey: ['dashboard-today'],
    queryFn: async () => {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count } = await supabase
        .from('message_logs')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', today.toISOString())
      return count || 0
    },
  })

  const { data: activeCampaigns } = useQuery({
    queryKey: ['dashboard-campaigns'],
    queryFn: async () => {
      const { count } = await supabase
        .from('campaigns')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'running')
      return count || 0
    },
  })

  const { data: recentLogs } = useQuery({
    queryKey: ['dashboard-recent-logs'],
    queryFn: async () => {
      const { data } = await supabase
        .from('message_logs')
        .select('*, leads(name, phone)')
        .order('sent_at', { ascending: false })
        .limit(5)
      return data || []
    },
  })

  return (
    <div className="p-6">
      <PageHeader title="الرئيسية" subtitle="نظرة عامة على النظام" />

      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard
          label="إجمالي العملاء"
          value={leadStats?.total || 0}
          icon={<Users className="w-5 h-5" />}
          color="bg-blue-50 text-blue-600"
        />
        <StatCard
          label="رسائل اليوم"
          value={todayLogs || 0}
          icon={<MessageSquare className="w-5 h-5" />}
          color="bg-primary-50 text-primary-600"
        />
        <StatCard
          label="حملات نشطة"
          value={activeCampaigns || 0}
          icon={<Megaphone className="w-5 h-5" />}
          color="bg-purple-50 text-purple-600"
        />
        <StatCard
          label="تحولوا"
          value={leadStats?.byStatus?.converted || 0}
          icon={<TrendingUp className="w-5 h-5" />}
          color="bg-green-50 text-green-600"
        />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* CRM Funnel */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">CRM Funnel</h2>
          <div className="space-y-3">
            {STATUS_ORDER.map((status) => {
              const count = leadStats?.byStatus?.[status] || 0
              const total = leadStats?.total || 1
              const pct = Math.round((count / total) * 100)
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <Badge className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</Badge>
                    <span className="text-sm font-medium text-gray-700">{count}</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Recent messages */}
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-4">آخر الرسائل</h2>
          {recentLogs && recentLogs.length > 0 ? (
            <div className="space-y-3">
              {recentLogs.map((log: any) => (
                <div key={log.id} className="flex items-start justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{log.leads?.name || log.phone}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{log.message}</p>
                  </div>
                  <Badge className={log.status === 'sent' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                    {log.status === 'sent' ? 'أُرسلت' : 'فشل'}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 text-center py-8">لا توجد رسائل بعد</p>
          )}
        </div>
      </div>
    </div>
  )
}

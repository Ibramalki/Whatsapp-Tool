import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Users, MessageSquare, UserPlus, UserMinus, Wifi } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui/PageHeader'
import type { WhatsAppGroup } from '../types'

export default function GroupsPage() {
  const qc = useQueryClient()

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ['whatsapp-groups'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('*')
        .order('member_count', { ascending: false })
      if (error) throw error
      return data as WhatsAppGroup[]
    },
  })

  const syncGroups = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/groups/sync', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      return data
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['whatsapp-groups'] })
      toast.success(`تمت المزامنة: ${data.synced} مجموعة`)
    },
    onError: (e: Error) => toast.error(`فشل المزامنة: ${e.message}`),
  })

  const totalMembers = groups.reduce((s, g) => s + (g.member_count || 0), 0)
  const totalMsgs = groups.reduce((s, g) => s + (g.message_count || 0), 0)

  return (
    <div className="p-6">
      <PageHeader
        title="مجموعات واتساب"
        subtitle={`${groups.length} مجموعة • ${totalMembers.toLocaleString('ar')} عضو`}
        action={
          <button
            className="btn-primary"
            onClick={() => syncGroups.mutate()}
            disabled={syncGroups.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${syncGroups.isPending ? 'animate-spin' : ''}`} />
            {syncGroups.isPending ? 'جارٍ المزامنة...' : 'مزامنة المجموعات'}
          </button>
        }
      />

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'المجموعات', value: groups.length, icon: Wifi, color: 'bg-primary-50 text-primary-600' },
          { label: 'إجمالي الأعضاء', value: totalMembers, icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'إجمالي الرسائل', value: totalMsgs, icon: MessageSquare, color: 'bg-purple-50 text-purple-600' },
          { label: 'متوسط الأعضاء', value: groups.length ? Math.round(totalMembers / groups.length) : 0, icon: Users, color: 'bg-amber-50 text-amber-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-gray-500">{label}</p>
              <p className="text-xl font-bold text-gray-900">{value.toLocaleString('ar')}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Groups list */}
      {isLoading ? (
        <div className="card p-12 text-center text-gray-400">جارٍ التحميل...</div>
      ) : groups.length === 0 ? (
        <div className="card p-16 text-center">
          <Wifi className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 mb-1">لا توجد مجموعات بعد</p>
          <p className="text-xs text-gray-300 mb-4">اضغط "مزامنة المجموعات" لجلب مجموعاتك من واتساب</p>
          <button
            className="btn-primary"
            onClick={() => syncGroups.mutate()}
            disabled={syncGroups.isPending}
          >
            <RefreshCw className={`w-4 h-4 ${syncGroups.isPending ? 'animate-spin' : ''}`} />
            مزامنة الآن
          </button>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-600">اسم المجموعة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />الأعضاء</span>
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  <span className="flex items-center gap-1"><MessageSquare className="w-3.5 h-3.5" />الرسائل</span>
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  <span className="flex items-center gap-1"><UserPlus className="w-3.5 h-3.5" />انضموا</span>
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  <span className="flex items-center gap-1"><UserMinus className="w-3.5 h-3.5" />غادروا</span>
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">آخر مزامنة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {groups.map(g => (
                <tr key={g.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900">{g.name}</p>
                      {g.description && (
                        <p className="text-xs text-gray-400 truncate max-w-xs">{g.description}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{(g.member_count || 0).toLocaleString('ar')}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{(g.message_count || 0).toLocaleString('ar')}</td>
                  <td className="px-4 py-3">
                    <span className="text-green-600 font-medium">+{(g.joined_count || 0).toLocaleString('ar')}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-red-500 font-medium">-{(g.left_count || 0).toLocaleString('ar')}</span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(g.synced_at).toLocaleString('ar', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

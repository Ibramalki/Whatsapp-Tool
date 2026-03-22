import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Upload, Send, Plus, Search, Trash2, RefreshCw } from 'lucide-react'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { sendMessage } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import { STATUS_LABELS, STATUS_COLORS, resolveTemplate } from '../lib/utils'
import type { Lead, LeadStatus, CSVRow, Template } from '../types'

const ALL_STATUSES: LeadStatus[] = ['new', 'engaged', 'offered', 'converted']

export default function LeadsPage() {
  const qc = useQueryClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<LeadStatus | 'all'>('all')
  const [sendModal, setSendModal] = useState<Lead | null>(null)
  const [message, setMessage] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [sending, setSending] = useState(false)

  // Fetch leads
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Lead[]
    },
  })

  // Fetch templates for send modal
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await supabase.from('templates').select('*').order('name')
      return (data || []) as Template[]
    },
  })

  // Update lead status
  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from('leads').update({ status }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['leads'] }),
    onError: () => toast.error('فشل تحديث الحالة'),
  })

  // Delete lead
  const deleteLead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('leads').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['leads'] })
      toast.success('تم الحذف')
    },
    onError: () => toast.error('فشل الحذف'),
  })

  // CSV Import
  function handleCSV(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    Papa.parse<CSVRow>(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const rows = results.data
        if (!rows.length) return toast.error('الملف فارغ')

        const insertData = rows
          .filter((r) => r.name && r.phone)
          .map((r) => ({
            name: r.name.trim(),
            phone: r.phone.trim(),
            grade: r.grade?.trim() || null,
            status: 'new' as LeadStatus,
          }))

        if (!insertData.length) {
          return toast.error('لا توجد بيانات صحيحة. تأكد من أعمدة: name, phone')
        }

        const { error } = await supabase
          .from('leads')
          .upsert(insertData, { onConflict: 'phone', ignoreDuplicates: false })

        if (error) {
          toast.error(`خطأ في الاستيراد: ${error.message}`)
        } else {
          toast.success(`تم استيراد ${insertData.length} عميل`)
          qc.invalidateQueries({ queryKey: ['leads'] })
        }
      },
      error: () => toast.error('فشل قراءة الملف'),
    })

    // Reset input
    if (fileRef.current) fileRef.current.value = ''
  }

  // Send message
  async function handleSend() {
    if (!sendModal || !message.trim()) return
    setSending(true)
    try {
      await sendMessage({
        phone: sendModal.phone,
        message: message.trim(),
        lead_id: sendModal.id,
      })
      toast.success('تم الإرسال بنجاح')
      setSendModal(null)
      setMessage('')
      setSelectedTemplate('')
      qc.invalidateQueries({ queryKey: ['logs'] })
    } catch (err) {
      toast.error(`فشل الإرسال: ${err instanceof Error ? err.message : 'خطأ'}`)
    } finally {
      setSending(false)
    }
  }

  // Apply template to message
  function applyTemplate(templateId: string) {
    setSelectedTemplate(templateId)
    const tpl = templates.find((t) => t.id === templateId)
    if (tpl && sendModal) {
      setMessage(resolveTemplate(tpl.content, sendModal))
    }
  }

  // Filter leads
  const filtered = leads.filter((l) => {
    const matchSearch =
      !search ||
      l.name.toLowerCase().includes(search.toLowerCase()) ||
      l.phone.includes(search)
    const matchStatus = filterStatus === 'all' || l.status === filterStatus
    return matchSearch && matchStatus
  })

  return (
    <div className="p-6">
      <PageHeader
        title="العملاء"
        subtitle={`${leads.length} عميل إجمالاً`}
        action={
          <div className="flex gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleCSV}
            />
            <button className="btn-secondary" onClick={() => fileRef.current?.click()}>
              <Upload className="w-4 h-4" />
              استيراد CSV
            </button>
          </div>
        }
      />

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="input pr-9"
            placeholder="بحث بالاسم أو الرقم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-40"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as LeadStatus | 'all')}
        >
          <option value="all">كل الحالات</option>
          {ALL_STATUSES.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <button
          className="btn-secondary"
          onClick={() => qc.invalidateQueries({ queryKey: ['leads'] })}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">جارٍ التحميل...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 mb-2">لا يوجد عملاء</p>
            <p className="text-xs text-gray-300">استورد ملف CSV للبدء</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الاسم</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الرقم</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الصف</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">الحالة</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-900">{lead.name}</td>
                  <td className="px-4 py-3 text-gray-600 font-mono" dir="ltr">{lead.phone}</td>
                  <td className="px-4 py-3 text-gray-600">{lead.grade || '—'}</td>
                  <td className="px-4 py-3">
                    <select
                      className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${STATUS_COLORS[lead.status]}`}
                      value={lead.status}
                      onChange={(e) =>
                        updateStatus.mutate({ id: lead.id, status: e.target.value as LeadStatus })
                      }
                    >
                      {ALL_STATUSES.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        className="p-1.5 text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        title="إرسال رسالة"
                        onClick={() => {
                          setSendModal(lead)
                          setMessage('')
                          setSelectedTemplate('')
                        }}
                      >
                        <Send className="w-4 h-4" />
                      </button>
                      <button
                        className="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                        title="حذف"
                        onClick={() => {
                          if (confirm(`حذف "${lead.name}"؟`)) {
                            deleteLead.mutate(lead.id)
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Send Message Modal */}
      <Modal
        open={!!sendModal}
        onClose={() => setSendModal(null)}
        title={`إرسال رسالة إلى ${sendModal?.name}`}
      >
        {sendModal && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الرقم
              </label>
              <input
                className="input bg-gray-50"
                value={sendModal.phone}
                readOnly
                dir="ltr"
              />
            </div>

            {templates.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  اختر قالباً (اختياري)
                </label>
                <select
                  className="input"
                  value={selectedTemplate}
                  onChange={(e) => applyTemplate(e.target.value)}
                >
                  <option value="">— بدون قالب —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                الرسالة
              </label>
              <textarea
                className="input resize-none"
                rows={4}
                placeholder="اكتب رسالتك هنا..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{message.length} حرف</p>
            </div>

            <div className="flex gap-3 justify-end pt-2">
              <button className="btn-secondary" onClick={() => setSendModal(null)}>
                إلغاء
              </button>
              <button
                className="btn-primary"
                disabled={!message.trim() || sending}
                onClick={handleSend}
              >
                <Send className="w-4 h-4" />
                {sending ? 'جارٍ الإرسال...' : 'إرسال'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

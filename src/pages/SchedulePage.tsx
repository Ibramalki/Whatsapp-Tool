import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Trash2, ChevronRight, ChevronLeft, Sparkles, Calendar, Clock, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import { Badge } from '../components/ui/Badge'
import type { ScheduledMessage, MessageType } from '../types'

const TYPE_LABELS: Record<MessageType, string> = {
  custom: 'مخصصة',
  lesson_content: 'محتوى درس',
  lesson_test: 'اختبار درس',
  tip: 'نصيحة علمية',
}
const TYPE_COLORS: Record<MessageType, string> = {
  custom: 'bg-gray-100 text-gray-700',
  lesson_content: 'bg-blue-100 text-blue-700',
  lesson_test: 'bg-purple-100 text-purple-700',
  tip: 'bg-amber-100 text-amber-700',
}
const TYPE_DOTS: Record<MessageType, string> = {
  custom: 'bg-gray-400',
  lesson_content: 'bg-blue-500',
  lesson_test: 'bg-purple-500',
  tip: 'bg-amber-500',
}

const DAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const MONTHS_AR = ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر']

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

interface FormState {
  title: string
  message_type: MessageType
  content: string
  scheduled_at: string
  ai_topic: string
}

export default function SchedulePage() {
  const qc = useQueryClient()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [modal, setModal] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [form, setForm] = useState<FormState>({
    title: '',
    message_type: 'custom',
    content: '',
    scheduled_at: '',
    ai_topic: '',
  })

  const { data: messages = [] } = useQuery({
    queryKey: ['scheduled-messages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('scheduled_messages')
        .select('*')
        .order('scheduled_at', { ascending: true })
      if (error) throw error
      return data as ScheduledMessage[]
    },
  })

  const createMsg = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.content || !form.scheduled_at) throw new Error('بيانات ناقصة')
      const { error } = await supabase.from('scheduled_messages').insert({
        title: form.title,
        message_type: form.message_type,
        content: form.content,
        scheduled_at: form.scheduled_at,
        ai_topic: form.ai_topic || null,
        ai_generated: !!form.ai_topic,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
      toast.success('تمت جدولة الرسالة')
      closeModal()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMsg = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('scheduled_messages').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scheduled-messages'] })
      toast.success('تم الحذف')
    },
  })

  async function generateWithAI() {
    if (!form.ai_topic.trim()) return toast.error('أدخل موضوعاً للذكاء الاصطناعي')
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: form.ai_topic, messageType: form.message_type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setForm(f => ({ ...f, content: data.content }))
      toast.success('تم توليد المحتوى بالذكاء الاصطناعي')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'فشل توليد المحتوى')
    } finally {
      setAiLoading(false)
    }
  }

  function openModal(dateStr?: string) {
    const dt = dateStr ? `${dateStr}T09:00` : ''
    setForm({ title: '', message_type: 'custom', content: '', scheduled_at: dt, ai_topic: '' })
    setModal(true)
  }

  function closeModal() {
    setModal(false)
  }

  // Calendar helpers
  const daysInMonth = getDaysInMonth(viewYear, viewMonth)
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth)

  // Map messages to date keys
  const msgsByDate: Record<string, ScheduledMessage[]> = {}
  for (const m of messages) {
    const key = m.scheduled_at.slice(0, 10)
    if (!msgsByDate[key]) msgsByDate[key] = []
    msgsByDate[key].push(m)
  }

  const selectedMsgs = selectedDate ? (msgsByDate[selectedDate] || []) : []

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  return (
    <div className="p-6">
      <PageHeader
        title="جدولة الرسائل"
        subtitle="إدارة الرسائل المجدولة مع الذكاء الاصطناعي"
        action={
          <button className="btn-primary" onClick={() => openModal(selectedDate || undefined)}>
            <Plus className="w-4 h-4" />
            رسالة جديدة
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-6">
        {/* Calendar */}
        <div className="col-span-2 card p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-gray-600" />
            </button>
            <h2 className="font-semibold text-gray-900 text-lg">
              {MONTHS_AR[viewMonth]} {viewYear}
            </h2>
            <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_AR.map(d => (
              <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d.slice(0, 3)}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells before first day */}
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={`e${i}`} />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
              const hasMsgs = msgsByDate[dateStr]?.length > 0
              const isToday = dateStr === today.toISOString().slice(0, 10)
              const isSelected = dateStr === selectedDate

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`
                    relative aspect-square flex flex-col items-center justify-start pt-1.5 rounded-xl text-sm font-medium transition-colors
                    ${isSelected ? 'bg-primary-500 text-white' : isToday ? 'bg-primary-50 text-primary-700' : 'hover:bg-gray-50 text-gray-700'}
                  `}
                >
                  {day}
                  {hasMsgs && (
                    <div className="flex gap-0.5 mt-0.5 flex-wrap justify-center">
                      {msgsByDate[dateStr].slice(0, 3).map((m, idx) => (
                        <span
                          key={idx}
                          className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : TYPE_DOTS[m.message_type]}`}
                        />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Legend */}
          <div className="flex gap-4 mt-4 pt-4 border-t border-gray-100">
            {Object.entries(TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${TYPE_DOTS[type as MessageType]}`} />
                <span className="text-xs text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* Selected date messages */}
          {selectedDate && (
            <div className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {new Date(selectedDate + 'T00:00').toLocaleDateString('ar', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                <button onClick={() => openModal(selectedDate)} className="btn-primary text-xs py-1 px-2">
                  <Plus className="w-3 h-3" />
                </button>
              </div>
              {selectedMsgs.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">لا توجد رسائل مجدولة</p>
              ) : (
                <div className="space-y-2">
                  {selectedMsgs.map(m => (
                    <div key={m.id} className="flex items-start justify-between p-2 bg-gray-50 rounded-lg">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Badge className={TYPE_COLORS[m.message_type]}>{TYPE_LABELS[m.message_type]}</Badge>
                          {m.ai_generated && <Sparkles className="w-3 h-3 text-amber-500" />}
                        </div>
                        <p className="text-xs font-medium text-gray-800 truncate">{m.title}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(m.scheduled_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => { if (confirm('حذف الرسالة؟')) deleteMsg.mutate(m.id) }}
                        className="p-1 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming */}
          <div className="card p-4">
            <h3 className="font-semibold text-gray-900 text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              القادمة
            </h3>
            {messages.filter(m => m.status === 'pending').slice(0, 5).length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-3">لا توجد رسائل مجدولة</p>
            ) : (
              <div className="space-y-2">
                {messages.filter(m => m.status === 'pending').slice(0, 5).map(m => (
                  <div key={m.id} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${TYPE_DOTS[m.message_type]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-gray-800 truncate">{m.title}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(m.scheduled_at).toLocaleDateString('ar', { month: 'short', day: 'numeric' })} •{' '}
                        {new Date(m.scheduled_at).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create Modal */}
      <Modal open={modal} onClose={closeModal} title="رسالة مجدولة جديدة" className="max-w-2xl">
        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">نوع الرسالة</label>
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(TYPE_LABELS) as [MessageType, string][]).map(([type, label]) => (
                <button
                  key={type}
                  onClick={() => setForm(f => ({ ...f, message_type: type }))}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    form.message_type === type
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">عنوان الرسالة</label>
            <input
              className="input"
              placeholder="مثال: نصيحة دراسية - الثلاثاء"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">وقت الإرسال</label>
            <input
              className="input"
              type="datetime-local"
              value={form.scheduled_at}
              onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))}
            />
          </div>

          {/* AI Generation */}
          {form.message_type !== 'custom' && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">توليد بالذكاء الاصطناعي</span>
              </div>
              <div className="flex gap-2">
                <input
                  className="input bg-white flex-1"
                  placeholder={
                    form.message_type === 'tip' ? 'مثال: تقنية بومودورو للتركيز' :
                    form.message_type === 'lesson_content' ? 'مثال: الذاكرة طويلة المدى وطرق تعزيزها' :
                    'مثال: نظرية الذكاءات المتعددة'
                  }
                  value={form.ai_topic}
                  onChange={e => setForm(f => ({ ...f, ai_topic: e.target.value }))}
                />
                <button
                  className="btn-primary whitespace-nowrap"
                  onClick={generateWithAI}
                  disabled={aiLoading}
                >
                  <Sparkles className="w-4 h-4" />
                  {aiLoading ? 'جارٍ التوليد...' : 'توليد'}
                </button>
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              محتوى الرسالة
              {form.ai_topic && form.content && (
                <span className="mr-2 text-xs text-amber-600 font-normal flex items-center gap-1 inline-flex">
                  <Sparkles className="w-3 h-3" /> مُولَّد بالذكاء الاصطناعي
                </span>
              )}
            </label>
            <textarea
              className="input resize-none"
              rows={7}
              placeholder="اكتب محتوى الرسالة هنا أو استخدم الذكاء الاصطناعي..."
              value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            />
            <p className="text-xs text-gray-400 mt-1">{form.content.length} حرف</p>
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-secondary" onClick={closeModal}>إلغاء</button>
            <button
              className="btn-primary"
              disabled={createMsg.isPending || !form.title || !form.content || !form.scheduled_at}
              onClick={() => createMsg.mutate()}
            >
              <Calendar className="w-4 h-4" />
              {createMsg.isPending ? 'جارٍ الحفظ...' : 'جدولة الرسالة'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

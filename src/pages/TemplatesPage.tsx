import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { PageHeader } from '../components/ui/PageHeader'
import { Modal } from '../components/ui/Modal'
import type { Template } from '../types'

const VARIABLES = ['{{name}}', '{{phone}}', '{{grade}}']

const PREVIEW_LEAD = { name: 'أحمد محمد', phone: '966501234567', grade: 'الصف العاشر' }

function resolvePreview(content: string): string {
  return content
    .replace(/\{\{name\}\}/g, PREVIEW_LEAD.name)
    .replace(/\{\{phone\}\}/g, PREVIEW_LEAD.phone)
    .replace(/\{\{grade\}\}/g, PREVIEW_LEAD.grade)
}

interface TemplateForm {
  name: string
  content: string
}

export default function TemplatesPage() {
  const qc = useQueryClient()
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<Template | null>(null)
  const [form, setForm] = useState<TemplateForm>({ name: '', content: '' })

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Template[]
    },
  })

  const createTemplate = useMutation({
    mutationFn: async (data: TemplateForm) => {
      const { error } = await supabase.from('templates').insert(data)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('تم إنشاء القالب')
      closeModal()
    },
    onError: () => toast.error('فشل إنشاء القالب'),
  })

  const updateTemplate = useMutation({
    mutationFn: async (data: TemplateForm) => {
      const { error } = await supabase
        .from('templates')
        .update(data)
        .eq('id', editing!.id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('تم التحديث')
      closeModal()
    },
    onError: () => toast.error('فشل التحديث'),
  })

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('templates').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('تم الحذف')
    },
    onError: () => toast.error('فشل الحذف'),
  })

  function openCreate() {
    setForm({ name: '', content: '' })
    setEditing(null)
    setModal('create')
  }

  function openEdit(tpl: Template) {
    setForm({ name: tpl.name, content: tpl.content })
    setEditing(tpl)
    setModal('edit')
  }

  function closeModal() {
    setModal(null)
    setEditing(null)
    setForm({ name: '', content: '' })
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.content.trim()) {
      return toast.error('اسم القالب والمحتوى مطلوبان')
    }
    if (modal === 'edit') {
      updateTemplate.mutate(form)
    } else {
      createTemplate.mutate(form)
    }
  }

  function insertVariable(v: string) {
    setForm((prev) => ({ ...prev, content: prev.content + v }))
  }

  const isPending = createTemplate.isPending || updateTemplate.isPending

  return (
    <div className="p-6">
      <PageHeader
        title="القوالب"
        subtitle={`${templates.length} قالب`}
        action={
          <button className="btn-primary" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            قالب جديد
          </button>
        }
      />

      {isLoading ? (
        <p className="text-gray-400 text-center py-12">جارٍ التحميل...</p>
      ) : templates.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 mb-2">لا توجد قوالب بعد</p>
          <button className="btn-primary mt-3" onClick={openCreate}>
            <Plus className="w-4 h-4" />
            إنشاء أول قالب
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {templates.map((tpl) => (
            <div key={tpl.id} className="card p-5">
              <div className="flex items-start justify-between mb-3">
                <h3 className="font-semibold text-gray-900">{tpl.name}</h3>
                <div className="flex gap-1">
                  <button
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                    onClick={() => openEdit(tpl)}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    onClick={() => {
                      if (confirm(`حذف قالب "${tpl.name}"؟`)) deleteTemplate.mutate(tpl.id)
                    }}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-gray-500 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap">
                {tpl.content}
              </p>
              <div className="mt-3 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400 mb-1">معاينة:</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{resolvePreview(tpl.content)}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        open={!!modal}
        onClose={closeModal}
        title={modal === 'edit' ? 'تعديل القالب' : 'قالب جديد'}
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم القالب</label>
            <input
              className="input"
              placeholder="مثال: رسالة ترحيب"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">محتوى الرسالة</label>
              <div className="flex gap-1">
                {VARIABLES.map((v) => (
                  <button
                    key={v}
                    className="text-xs px-2 py-0.5 bg-primary-50 text-primary-600 rounded hover:bg-primary-100 font-mono"
                    onClick={() => insertVariable(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="input resize-none"
              rows={5}
              placeholder="مرحباً {{name}}، لدينا عرض خاص لك..."
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            />
          </div>

          {form.content && (
            <div className="bg-primary-50 rounded-lg p-3">
              <p className="text-xs text-primary-600 font-medium mb-1">معاينة:</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{resolvePreview(form.content)}</p>
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-secondary" onClick={closeModal}>إلغاء</button>
            <button className="btn-primary" disabled={isPending} onClick={handleSubmit}>
              {isPending ? 'جارٍ الحفظ...' : modal === 'edit' ? 'تحديث' : 'إنشاء'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

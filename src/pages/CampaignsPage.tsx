import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Play, Pause, Trash2, Users, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { startCampaign, processQueue } from '../lib/api'
import { PageHeader } from '../components/ui/PageHeader'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import {
  STATUS_LABELS,
  CAMPAIGN_STATUS_LABELS,
  CAMPAIGN_STATUS_COLORS,
} from '../lib/utils'
import type { Campaign, Template, LeadStatus, AudienceFilter } from '../types'

const ALL_LEAD_STATUSES: LeadStatus[] = ['new', 'engaged', 'offered', 'converted']

interface CampaignForm {
  name: string
  template_id: string
  filter_grades: string[]
  filter_statuses: LeadStatus[]
}

export default function CampaignsPage() {
  const qc = useQueryClient()
  const pollerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState<CampaignForm>({
    name: '',
    template_id: '',
    filter_grades: [],
    filter_statuses: [],
  })
  const [gradeInput, setGradeInput] = useState('')
  const [audienceCount, setAudienceCount] = useState<number | null>(null)
  const [checkingAudience, setCheckingAudience] = useState(false)
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null)

  // Fetch campaigns
  const { data: campaigns = [] } = useQuery({
    queryKey: ['campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*, templates(name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data as Campaign[]
    },
    refetchInterval: activeCampaignId ? 3000 : false,
  })

  // Fetch templates
  const { data: templates = [] } = useQuery({
    queryKey: ['templates'],
    queryFn: async () => {
      const { data } = await supabase.from('templates').select('id, name').order('name')
      return (data || []) as Template[]
    },
  })

  // Fetch unique grades for filter
  const { data: allGrades = [] } = useQuery({
    queryKey: ['grades'],
    queryFn: async () => {
      const { data } = await supabase.from('leads').select('grade')
      const unique = [...new Set((data || []).map((r: any) => r.grade).filter(Boolean))]
      return unique as string[]
    },
  })

  // Stop poller when no running campaign
  useEffect(() => {
    const hasRunning = campaigns.some((c) => c.status === 'running')
    if (!hasRunning) {
      setActiveCampaignId(null)
      if (pollerRef.current) {
        clearInterval(pollerRef.current)
        pollerRef.current = null
      }
    }
  }, [campaigns])

  // Queue poller
  function startPoller(campaignId: string) {
    setActiveCampaignId(campaignId)
    if (pollerRef.current) clearInterval(pollerRef.current)

    pollerRef.current = setInterval(async () => {
      try {
        const result = await processQueue()
        if (result.done) {
          clearInterval(pollerRef.current!)
          pollerRef.current = null
          setActiveCampaignId(null)
          qc.invalidateQueries({ queryKey: ['campaigns'] })
        }
      } catch {
        // ignore transient errors
      }
    }, 5000)
  }

  // Check audience count
  async function checkAudience() {
    setCheckingAudience(true)
    let query = supabase.from('leads').select('*', { count: 'exact', head: true })
    if (form.filter_grades.length > 0) query = query.in('grade', form.filter_grades)
    if (form.filter_statuses.length > 0) query = query.in('status', form.filter_statuses)
    const { count } = await query
    setAudienceCount(count || 0)
    setCheckingAudience(false)
  }

  // Create campaign
  const createCampaign = useMutation({
    mutationFn: async () => {
      const audienceFilter: AudienceFilter = {}
      if (form.filter_grades.length > 0) audienceFilter.grade = form.filter_grades
      if (form.filter_statuses.length > 0) audienceFilter.status = form.filter_statuses

      const { data, error } = await supabase
        .from('campaigns')
        .insert({
          name: form.name.trim(),
          template_id: form.template_id || null,
          audience_filter: audienceFilter,
        })
        .select()
        .single()
      if (error) throw error
      return data as Campaign
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('تم إنشاء الحملة')
      setShowCreate(false)
      setForm({ name: '', template_id: '', filter_grades: [], filter_statuses: [] })
      setAudienceCount(null)
    },
    onError: () => toast.error('فشل إنشاء الحملة'),
  })

  // Start campaign
  async function handleStart(campaign: Campaign) {
    if (!campaign.template_id) {
      return toast.error('يجب اختيار قالب قبل بدء الحملة')
    }
    try {
      const result = await startCampaign(campaign.id)
      toast.success(`بدأت الحملة — ${result.total} رسالة في الطابور`)
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      startPoller(campaign.id)
    } catch (err) {
      toast.error(`فشل بدء الحملة: ${err instanceof Error ? err.message : 'خطأ'}`)
    }
  }

  // Pause campaign
  async function handlePause(id: string) {
    await supabase.from('campaigns').update({ status: 'paused' }).eq('id', id)
    if (pollerRef.current) {
      clearInterval(pollerRef.current)
      pollerRef.current = null
    }
    setActiveCampaignId(null)
    qc.invalidateQueries({ queryKey: ['campaigns'] })
  }

  // Delete campaign
  const deleteCampaign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('campaigns').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['campaigns'] })
      toast.success('تم الحذف')
    },
  })

  function toggleGrade(grade: string) {
    setForm((prev) => ({
      ...prev,
      filter_grades: prev.filter_grades.includes(grade)
        ? prev.filter_grades.filter((g) => g !== grade)
        : [...prev.filter_grades, grade],
    }))
    setAudienceCount(null)
  }

  function toggleStatus(status: LeadStatus) {
    setForm((prev) => ({
      ...prev,
      filter_statuses: prev.filter_statuses.includes(status)
        ? prev.filter_statuses.filter((s) => s !== status)
        : [...prev.filter_statuses, status],
    }))
    setAudienceCount(null)
  }

  return (
    <div className="p-6">
      <PageHeader
        title="الحملات"
        subtitle={`${campaigns.length} حملة`}
        action={
          <button className="btn-primary" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            حملة جديدة
          </button>
        }
      />

      {campaigns.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-gray-400 mb-2">لا توجد حملات بعد</p>
          <button className="btn-primary mt-3" onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" />
            إنشاء أول حملة
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((campaign) => {
            const pct =
              campaign.total_count > 0
                ? Math.round(((campaign.sent_count + campaign.failed_count) / campaign.total_count) * 100)
                : 0

            return (
              <div key={campaign.id} className="card p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                      <Badge className={CAMPAIGN_STATUS_COLORS[campaign.status]}>
                        {CAMPAIGN_STATUS_LABELS[campaign.status]}
                      </Badge>
                    </div>
                    <p className="text-xs text-gray-400">
                      القالب: {(campaign as any).templates?.name || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {campaign.status === 'draft' && (
                      <button
                        className="btn-primary text-xs px-3 py-1.5"
                        onClick={() => handleStart(campaign)}
                      >
                        <Play className="w-3.5 h-3.5" />
                        بدء
                      </button>
                    )}
                    {campaign.status === 'paused' && (
                      <button
                        className="btn-primary text-xs px-3 py-1.5"
                        onClick={() => handleStart(campaign)}
                      >
                        <Play className="w-3.5 h-3.5" />
                        استكمال
                      </button>
                    )}
                    {campaign.status === 'running' && (
                      <button
                        className="btn-secondary text-xs px-3 py-1.5"
                        onClick={() => handlePause(campaign.id)}
                      >
                        <Pause className="w-3.5 h-3.5" />
                        إيقاف مؤقت
                      </button>
                    )}
                    {(campaign.status === 'draft' || campaign.status === 'completed') && (
                      <button
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                        onClick={() => {
                          if (confirm('حذف الحملة؟')) deleteCampaign.mutate(campaign.id)
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Stats */}
                {campaign.total_count > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>
                        {campaign.sent_count} أُرسلت
                        {campaign.failed_count > 0 && ` · ${campaign.failed_count} فشلت`}
                        {' من '}{campaign.total_count}
                      </span>
                      <span>{pct}%</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          campaign.status === 'completed' ? 'bg-primary-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Filter summary */}
                {campaign.audience_filter && Object.keys(campaign.audience_filter).length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {(campaign.audience_filter as AudienceFilter).grade?.map((g) => (
                      <Badge key={g} className="bg-blue-50 text-blue-600">{g}</Badge>
                    ))}
                    {(campaign.audience_filter as AudienceFilter).status?.map((s) => (
                      <Badge key={s} className="bg-gray-100 text-gray-600">{STATUS_LABELS[s]}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Create Campaign Modal */}
      <Modal
        open={showCreate}
        onClose={() => {
          setShowCreate(false)
          setAudienceCount(null)
          setForm({ name: '', template_id: '', filter_grades: [], filter_statuses: [] })
        }}
        title="حملة جديدة"
        className="max-w-2xl"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">اسم الحملة</label>
            <input
              className="input"
              placeholder="مثال: حملة نهاية الفصل"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">القالب</label>
            <select
              className="input"
              value={form.template_id}
              onChange={(e) => setForm((p) => ({ ...p, template_id: e.target.value }))}
            >
              <option value="">— اختر قالباً —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Audience Filter */}
          <div className="border border-gray-200 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-medium text-gray-700 flex items-center gap-2">
              <Users className="w-4 h-4" />
              الجمهور المستهدف
            </h4>

            <div>
              <p className="text-xs text-gray-500 mb-2">الصف (يمكن اختيار أكثر من صف):</p>
              <div className="flex flex-wrap gap-2">
                {allGrades.map((grade) => (
                  <button
                    key={grade}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.filter_grades.includes(grade)
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                    }`}
                    onClick={() => toggleGrade(grade)}
                  >
                    {grade}
                  </button>
                ))}
                {allGrades.length === 0 && (
                  <p className="text-xs text-gray-400">لا توجد صفوف (استورد عملاء أولاً)</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-xs text-gray-500 mb-2">الحالة:</p>
              <div className="flex flex-wrap gap-2">
                {ALL_LEAD_STATUSES.map((status) => (
                  <button
                    key={status}
                    className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                      form.filter_statuses.includes(status)
                        ? 'bg-primary-500 text-white border-primary-500'
                        : 'bg-white text-gray-600 border-gray-300 hover:border-primary-400'
                    }`}
                    onClick={() => toggleStatus(status)}
                  >
                    {STATUS_LABELS[status]}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-xs text-gray-400">
              * إذا لم تختر فلتراً، ستُرسل الحملة لجميع العملاء
            </p>

            <button
              className="btn-secondary text-xs"
              onClick={checkAudience}
              disabled={checkingAudience}
            >
              {checkingAudience ? 'جارٍ الحساب...' : 'معاينة عدد المستهدفين'}
            </button>

            {audienceCount !== null && (
              <div className="bg-primary-50 text-primary-700 text-sm rounded-lg px-3 py-2">
                سيُرسل إلى <strong>{audienceCount}</strong> عميل
              </div>
            )}
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button className="btn-secondary" onClick={() => setShowCreate(false)}>إلغاء</button>
            <button
              className="btn-primary"
              disabled={!form.name.trim() || createCampaign.isPending}
              onClick={() => createCampaign.mutate()}
            >
              {createCampaign.isPending ? 'جارٍ الإنشاء...' : 'إنشاء الحملة'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

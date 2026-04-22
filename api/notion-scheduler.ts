import type { VercelRequest, VercelResponse } from '@vercel/node'
import { createWasender, WasenderAPIError, type RetryConfig } from 'wasenderapi'

const NOTION_VERSION = '2022-06-28'
const NOTION_BASE = 'https://api.notion.com/v1'

function notionHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

async function queryPendingMessages(token: string, dbId: string) {
  const now = new Date().toISOString()

  const res = await fetch(`${NOTION_BASE}/databases/${dbId}/query`, {
    method: 'POST',
    headers: notionHeaders(token),
    body: JSON.stringify({
      filter: {
        and: [
          {
            property: 'Status',
            select: { equals: 'جاهزة للإرسال' },
          },
          {
            property: 'Scheduled Date',
            date: { on_or_before: now },
          },
        ],
      },
    }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Notion query failed (${res.status}): ${JSON.stringify(err)}`)
  }

  return res.json() as Promise<{ results: NotionPage[] }>
}

async function getCommunityGroupId(token: string, communityPageId: string): Promise<string | null> {
  const res = await fetch(`${NOTION_BASE}/pages/${communityPageId}`, {
    headers: notionHeaders(token),
  })

  if (!res.ok) return null

  const page = await res.json()
  const groupIdProp = page?.properties?.['Weissender Group ID']

  if (groupIdProp?.type === 'rich_text') {
    return groupIdProp.rich_text?.[0]?.plain_text?.trim() || null
  }
  if (groupIdProp?.type === 'phone_number') {
    return groupIdProp.phone_number?.trim() || null
  }
  if (groupIdProp?.type === 'title') {
    return groupIdProp.title?.[0]?.plain_text?.trim() || null
  }

  return null
}

async function markAsSent(token: string, pageId: string) {
  await fetch(`${NOTION_BASE}/pages/${pageId}`, {
    method: 'PATCH',
    headers: notionHeaders(token),
    body: JSON.stringify({
      properties: {
        Status: { select: { name: 'تم الإرسال' } },
      },
    }),
  })
}

interface NotionPage {
  id: string
  properties: Record<string, NotionProperty>
}

interface NotionProperty {
  type: string
  title?: Array<{ plain_text: string }>
  rich_text?: Array<{ plain_text: string }>
  select?: { name: string }
  date?: { start: string; end?: string | null }
  relation?: Array<{ id: string }>
  phone_number?: string
}

function extractText(prop: NotionProperty | undefined): string {
  if (!prop) return ''
  if (prop.type === 'title') return prop.title?.map(t => t.plain_text).join('') ?? ''
  if (prop.type === 'rich_text') return prop.rich_text?.map(t => t.plain_text).join('') ?? ''
  return ''
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Vercel cron sends GET; allow POST for manual triggers
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = process.env.NOTION_TOKEN
  const messagesDbId = process.env.NOTION_MESSAGES_DB_ID
  const wasenderKey = process.env.WASENDER_API_KEY

  if (!token) return res.status(500).json({ error: 'NOTION_TOKEN غير مضبوط في Vercel' })
  if (!messagesDbId) return res.status(500).json({ error: 'NOTION_MESSAGES_DB_ID غير مضبوط في Vercel' })
  if (!wasenderKey) return res.status(500).json({ error: 'WASENDER_API_KEY غير مضبوط في Vercel' })

  const retryConfig: RetryConfig = { enabled: true, maxRetries: 3 }
  const wasender = createWasender(wasenderKey, undefined, undefined, undefined, retryConfig)

  const outcomes: Array<{ title: string; status: 'sent' | 'failed' | 'skipped'; reason?: string }> = []

  try {
    const { results: pages } = await queryPendingMessages(token, messagesDbId)

    if (!pages?.length) {
      return res.status(200).json({ processed: 0, outcomes: [] })
    }

    for (const page of pages) {
      const props = page.properties
      const pageId = page.id

      const title = extractText(props['Message Title']) || '(بدون عنوان)'
      const content = extractText(props['Message Content'])

      if (!content.trim()) {
        outcomes.push({ title, status: 'skipped', reason: 'محتوى الرسالة فارغ' })
        continue
      }

      const communityRelation = props['Community']?.relation
      if (!communityRelation?.length) {
        outcomes.push({ title, status: 'skipped', reason: 'لا يوجد مجتمع مرتبط' })
        continue
      }

      const groupId = await getCommunityGroupId(token, communityRelation[0].id)

      if (!groupId) {
        outcomes.push({ title, status: 'failed', reason: 'حقل Weissender Group ID فارغ في المجتمع' })
        continue
      }

      try {
        await wasender.sendText({ to: groupId, text: content })
        await markAsSent(token, pageId)
        outcomes.push({ title, status: 'sent' })
      } catch (err) {
        const reason =
          err instanceof WasenderAPIError
            ? (err.apiMessage ?? `HTTP ${err.statusCode}`)
            : err instanceof Error
              ? err.message
              : String(err)
        outcomes.push({ title, status: 'failed', reason })
      }
    }

    return res.status(200).json({ processed: pages.length, outcomes })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return res.status(500).json({ error: msg })
  }
}

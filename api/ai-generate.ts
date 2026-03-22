import type { VercelRequest, VercelResponse } from '@vercel/node'

const TYPE_PROMPTS: Record<string, string> = {
  lesson_content: `أنت خبير تربوي متخصص في علم الأعصاب وعلم النفس التعليمي. اكتب محتوى تعليمياً مفيداً عن الموضوع المطلوب بناءً على أحدث الأبحاث العلمية. اكتب بأسلوب علمي مفهوم للطلاب. اشمل:
1. مقدمة قصيرة
2. النقاط الرئيسية مع شرح مبسط
3. تطبيق عملي أو مثال
4. المصادر العلمية في النهاية (APA)
اكتب باللغة العربية فقط.`,
  lesson_test: `أنت خبير في التقييم التربوي. أنشئ اختباراً قصيراً (5 أسئلة) عن الموضوع المطلوب بناءً على مبادئ التعلم النشط والأبحاث التربوية. تشمل أسئلة: اختيار من متعدد، صح/خطأ، وسؤال تطبيقي. أضف الإجابات في النهاية. اكتب باللغة العربية فقط.`,
  tip: `أنت باحث في علم النفس التعليمي. اكتب نصيحة دراسية علمية مفيدة تتعلق بالموضوع المطلوب، مستنداً إلى دراسات حقيقية. اجعلها:
- قصيرة ومركزة (150-200 كلمة)
- مدعومة بدليل علمي
- قابلة للتطبيق فوراً
أضف المصدر العلمي في النهاية. اكتب باللغة العربية فقط.`,
  custom: `أنت مساعد تعليمي متخصص. ساعد في كتابة رسالة واضحة ومفيدة باللغة العربية عن الموضوع المطلوب.`,
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY غير مضبوط في Vercel Environment Variables' })
  }

  const { topic, messageType } = req.body as { topic: string; messageType: string }
  if (!topic) return res.status(400).json({ error: 'topic is required' })

  const systemPrompt = TYPE_PROMPTS[messageType] || TYPE_PROMPTS.custom

  try {
    // Use Anthropic API directly via fetch to avoid module init issues
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: `الموضوع: ${topic}` }],
      }),
    })

    if (!response.ok) {
      const errData = await response.json().catch(() => ({ error: { message: response.statusText } }))
      throw new Error(errData?.error?.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    const content = data.content?.[0]?.text || ''
    return res.status(200).json({ content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}

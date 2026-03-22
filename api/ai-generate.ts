import type { VercelRequest, VercelResponse } from '@vercel/node'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

  const { topic, messageType } = req.body as { topic: string; messageType: string }
  if (!topic) return res.status(400).json({ error: 'topic is required' })

  const systemPrompt = TYPE_PROMPTS[messageType] || TYPE_PROMPTS.custom

  try {
    const message = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 1024,
      messages: [{ role: 'user', content: `الموضوع: ${topic}` }],
      system: systemPrompt,
    })

    const content = message.content[0].type === 'text' ? message.content[0].text : ''
    return res.status(200).json({ content })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error'
    return res.status(500).json({ error: msg })
  }
}

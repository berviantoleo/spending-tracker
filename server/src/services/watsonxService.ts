import { RECEIPT_EXTRACTION_PROMPT } from '../prompts/receiptExtraction'

export interface WatsonxReceiptItem {
  description: string
  quantity: number
  unit_price: number | null
  total_price: number | null
}

export interface WatsonxReceiptResult {
  merchant: string | null
  date: string | null         // ISO date YYYY-MM-DD or null
  currency: string | null     // ISO 4217 code
  total: number | null
  items: WatsonxReceiptItem[]
  suggested_category: string | null
  confidence: number          // 0.0 – 1.0
}

// ---------- IAM token cache ----------
let cachedToken: string | null = null
let tokenExpiresAt = 0 // Unix ms

async function getIamToken(): Promise<string> {
  const now = Date.now()
  // Refresh 5 minutes before expiry
  if (cachedToken && now < tokenExpiresAt - 5 * 60 * 1000) {
    return cachedToken
  }

  const apiKey = process.env.WATSONX_API_KEY
  if (!apiKey) throw new Error('WATSONX_API_KEY is not set')

  const response = await fetch('https://iam.cloud.ibm.com/identity/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ibm:params:oauth:grant-type:apikey',
      apikey: apiKey,
    }),
  })

  if (!response.ok) {
    throw new Error(`IAM token fetch failed: ${response.status} ${await response.text()}`)
  }

  const json = (await response.json()) as { access_token: string; expires_in: number }
  cachedToken = json.access_token
  tokenExpiresAt = now + json.expires_in * 1000
  return cachedToken
}

// ---------- Default fallback result ----------
function defaultResult(): WatsonxReceiptResult {
  return {
    merchant: null,
    date: null,
    currency: null,
    total: null,
    items: [],
    suggested_category: null,
    confidence: 0,
  }
}

// ---------- Parse the model's text output ----------
function parseModelOutput(content: string): WatsonxReceiptResult {
  // Strip markdown code fences if present
  const cleaned = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(cleaned) as Partial<WatsonxReceiptResult>

    const VALID_CATEGORIES = [
      'Food', 'Transport', 'Shopping', 'Health',
      'Entertainment', 'Utilities', 'Travel', 'Other',
    ]

    return {
      merchant: typeof parsed.merchant === 'string' ? parsed.merchant : null,
      date: typeof parsed.date === 'string' ? parsed.date : null,
      currency: typeof parsed.currency === 'string' ? parsed.currency.toUpperCase() : null,
      total: typeof parsed.total === 'number' ? parsed.total : null,
      items: Array.isArray(parsed.items)
        ? parsed.items.map((item) => ({
            description: typeof item.description === 'string' ? item.description : '',
            quantity: typeof item.quantity === 'number' ? item.quantity : 1,
            unit_price: typeof item.unit_price === 'number' ? item.unit_price : null,
            total_price: typeof item.total_price === 'number' ? item.total_price : null,
          }))
        : [],
      suggested_category:
        typeof parsed.suggested_category === 'string' &&
        VALID_CATEGORIES.includes(parsed.suggested_category)
          ? parsed.suggested_category
          : null,
      confidence: typeof parsed.confidence === 'number' ? Math.min(1, Math.max(0, parsed.confidence)) : 0,
    }
  } catch {
    return defaultResult()
  }
}

// ---------- Main export ----------
export async function extractReceiptData(
  imageBase64: string,
  mimeType: string
): Promise<WatsonxReceiptResult> {
  const watsonxUrl = process.env.WATSONX_URL
  const modelId = process.env.WATSONX_MODEL_ID
  const projectId = process.env.WATSONX_PROJECT_ID

  if (!watsonxUrl || !modelId || !projectId) {
    throw new Error('WATSONX_URL, WATSONX_MODEL_ID, and WATSONX_PROJECT_ID must be set')
  }

  const iamToken = await getIamToken()

  const endpoint = `${watsonxUrl}/ml/v1/text/chat?version=2023-05-29`

  const body = {
    model_id: modelId,
    project_id: projectId,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: RECEIPT_EXTRACTION_PROMPT,
          },
        ],
      },
    ],
    parameters: {
      max_new_tokens: 1024,
      temperature: 0.0,
    },
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${iamToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`watsonx.ai API error ${response.status}: ${errorText}`)
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = json.choices?.[0]?.message?.content
  if (!content) {
    console.warn('[watsonxService] Empty response from model — returning default result')
    return defaultResult()
  }

  return parseModelOutput(content)
}

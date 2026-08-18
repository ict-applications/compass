import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import db from './db';

export type LlmProvider = 'anthropic' | 'openai' | 'openrouter' | 'self-hosted' | 'ollama';

export interface LlmSettings {
  provider: LlmProvider;
  api_key: string | null;
  model: string;
  base_url: string | null;
}

export function getLlmSettings(): LlmSettings {
  const row = db.prepare('SELECT provider, api_key, model, base_url FROM llm_settings WHERE id = 1').get() as LlmSettings | undefined;
  return row ?? { provider: 'anthropic', api_key: null, model: 'claude-sonnet-4-20250514', base_url: null };
}

export function saveLlmSettings(settings: Partial<LlmSettings>): LlmSettings {
  db.prepare(`
    UPDATE llm_settings
    SET provider   = COALESCE(?, provider),
        api_key    = ?,
        model      = COALESCE(?, model),
        base_url   = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = 1
  `).run(
    settings.provider ?? null,
    settings.api_key ?? null,
    settings.model ?? null,
    settings.base_url ?? null,
  );
  return getLlmSettings();
}

export interface TestResult {
  success: boolean;
  provider: LlmProvider;
  model: string;
  latency_ms: number;
  reply?: string;
  error?: string;
}

export interface ModelInfo {
  id: string;
  name: string;
}

export async function testConnection(overrides?: Partial<LlmSettings>): Promise<TestResult> {
  const base = getLlmSettings();
  const settings: LlmSettings = { ...base, ...overrides };

  // Resolve API key: override > DB > env fallback
  const apiKey = settings.api_key ||
    (settings.provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) ||
    '';

  const start = Date.now();
  try {
    let reply: string;
    if (settings.provider === 'anthropic') {
      reply = await callAnthropic(apiKey, settings.model, 'Reply with exactly one word: OK');
    } else if (settings.provider === 'ollama') {
      const base = settings.base_url || 'http://localhost:11434';
      reply = await callOllama(base, settings.model, 'Reply with exactly one word: OK');
    } else {
      reply = await callOpenAiCompatible(apiKey, settings.model, settings.base_url, 'Reply with exactly one word: OK');
    }
    return {
      success: true,
      provider: settings.provider,
      model: settings.model,
      latency_ms: Date.now() - start,
      reply: reply.trim().slice(0, 120),
    };
  } catch (err) {
    return {
      success: false,
      provider: settings.provider,
      model: settings.model,
      latency_ms: Date.now() - start,
      error: (err as Error).message,
    };
  }
}

export async function getAvailableModels(overrides?: Partial<LlmSettings>): Promise<ModelInfo[]> {
  const base = getLlmSettings();
  const settings: LlmSettings = { ...base, ...overrides };

  const apiKey = settings.api_key ||
    (settings.provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) ||
    '';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);

  try {
    if (settings.provider === 'anthropic') {
      const client = new Anthropic({ apiKey });
      const page = await client.models.list();
      const models: ModelInfo[] = [];
      for await (const m of page) {
        models.push({ id: m.id, name: (m as any).display_name ?? m.id });
      }
      return models;

    } else if (settings.provider === 'ollama') {
      const baseUrl = settings.base_url || 'http://localhost:11434';
      const res = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`, { signal: controller.signal });
      if (!res.ok) throw new Error(`Ollama responded ${res.status}`);
      const data = await res.json() as { models?: { name: string; model: string }[] };
      return (data.models ?? []).map((m) => ({ id: m.model ?? m.name, name: m.name }));

    } else {
      // openai, openrouter, self-hosted — all OpenAI-compatible SDK
      const opts: ConstructorParameters<typeof OpenAI>[0] = { apiKey: apiKey || 'none' };
      if (settings.base_url) opts.baseURL = settings.base_url;
      const client = new OpenAI(opts);
      const page = await client.models.list();
      let ids: string[] = page.data.map((m) => m.id);

      if (settings.provider === 'openai') {
        ids = ids.filter((id) => !/(dall-e|whisper|tts|embedding|babbage|davinci|curie|ada)/i.test(id));
      }
      if (settings.provider === 'openrouter') {
        ids = ids.sort();
      }
      return ids.map((id) => ({ id, name: id }));
    }
  } catch (err) {
    // self-hosted servers commonly have no /models endpoint — return empty list gracefully
    if (settings.provider === 'self-hosted') return [];
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

const SYSTEM_PROMPT = `You are an expert compliance analyst and document auditor.
Your task is to compare a submitted document against an official Standard Operating Procedure (SOP)
and produce a structured compliance report.

You MUST respond with a valid JSON object only, no markdown, no preamble.

The JSON must follow this exact schema:
{
  "compliance_score": <integer 0-100>,
  "executive_summary": "<2-3 sentence overview of compliance status>",
  "matched_sections": [
    {
      "sop_section": "<section title or description from SOP>",
      "document_excerpt": "<relevant excerpt from submitted doc>",
      "compliance_level": "full" | "partial",
      "notes": "<brief note>"
    }
  ],
  "gaps": [
    {
      "severity": "critical" | "major" | "minor",
      "sop_requirement": "<what the SOP requires>",
      "current_status": "<what the submitted doc has or lacks>",
      "gap_description": "<clear description of the gap>",
      "document_section": "<MUST include the page number AND section/heading from the SUBMITTED document where this gap is found. Format: 'Page X – <heading or description>', e.g. 'Page 3 – Grooming Standards', 'Page 7 – Check-in Procedures, Section 2.1'. If you cannot determine a page number, use the nearest identifiable heading plus paragraph position, e.g. 'Introduction, paragraph 2'. If the section is entirely absent from the submitted document, state 'Not present in submitted document'.>"
    }
  ],
  "recommendations": [
    {
      "priority": "high" | "medium" | "low",
      "section": "<MUST include the page number AND heading/section in the SUBMITTED document where this change must be made — e.g. 'Page 4 – Safety Procedures' or 'Page 2 – Escalation Policy, paragraph 3'>",
      "action": "<specific action to take>",
      "suggested_language": "<optional: suggested text or phrasing to add/replace>"
    }
  ],
  "overall_assessment": "compliant" | "partially_compliant" | "non_compliant"
}`;

export interface MatchedSection {
  sop_section: string;
  document_excerpt: string;
  compliance_level: 'full' | 'partial';
  notes: string;
}

export interface Gap {
  severity: 'critical' | 'major' | 'minor';
  sop_requirement: string;
  current_status: string;
  gap_description: string;
  document_section: string;
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  section: string;
  action: string;
  suggested_language?: string;
}

export interface ComplianceReport {
  compliance_score: number;
  executive_summary: string;
  matched_sections: MatchedSection[];
  gaps: Gap[];
  recommendations: Recommendation[];
  overall_assessment: 'compliant' | 'partially_compliant' | 'non_compliant';
  truncated?: boolean;
}

const MAX_CHARS = 80000;

export async function compareDocuments(
  sopText: string,
  submittedText: string,
  sopTitle: string
): Promise<ComplianceReport> {
  const settings = getLlmSettings();

  // Determine effective API key: DB value takes precedence; fall back to env var
  const apiKey = settings.api_key ||
    (settings.provider === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY) ||
    '';

  const noKeyRequired = settings.provider === 'self-hosted' || settings.provider === 'ollama';
  if (!apiKey && !noKeyRequired) {
    throw new Error(`No API key configured for provider "${settings.provider}". Set it in Admin → LLM Settings.`);
  }

  let truncated = false;
  if (sopText.length + submittedText.length > MAX_CHARS) {
    const total = sopText.length + submittedText.length;
    const budget = MAX_CHARS * 0.95;
    sopText = sopText.slice(0, Math.floor((sopText.length / total) * budget));
    submittedText = submittedText.slice(0, Math.floor((submittedText.length / total) * budget));
    truncated = true;
  }

  const userPrompt = `## Official SOP: ${sopTitle}
${sopText}

---

## Submitted Document for Review:
${submittedText}

---

Analyze the submitted document against the official SOP above.
Identify all gaps, missing requirements, non-compliant sections, and provide specific recommendations.
Be thorough, precise, and actionable.

IMPORTANT: For every gap's "document_section" and every recommendation's "section", you MUST include the page number from the submitted document (e.g. "Page 3 – Grooming Standards"). Never leave out the page number.${truncated ? '\n\nNote: Both documents were truncated to fit analysis limits.' : ''}
Return only the JSON object.`;

  let rawText: string;

  if (settings.provider === 'anthropic') {
    rawText = await callAnthropic(apiKey, settings.model, userPrompt);
  } else if (settings.provider === 'ollama') {
    const base = settings.base_url || 'http://localhost:11434';
    rawText = await callOllama(base, settings.model, userPrompt);
  } else {
    rawText = await callOpenAiCompatible(apiKey, settings.model, settings.base_url, userPrompt);
  }

  const cleaned = rawText.trim().replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  const parsed = JSON.parse(cleaned) as ComplianceReport;
  parsed.truncated = truncated;

  if (typeof parsed.compliance_score !== 'number' || !parsed.executive_summary) {
    throw new Error('AI response missing required fields');
  }
  return parsed;
}

async function callAnthropic(apiKey: string, model: string, userPrompt: string): Promise<string> {
  const client = new Anthropic({ apiKey });
  let attempt = 0;
  while (attempt < 2) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      });
      const block = msg.content[0];
      if (block.type !== 'text') throw new Error('Unexpected Anthropic response type');
      return block.text;
    } catch (err) {
      attempt++;
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Anthropic call failed');
}

async function callOpenAiCompatible(
  apiKey: string,
  model: string,
  baseUrl: string | null,
  userPrompt: string
): Promise<string> {
  const clientOptions: ConstructorParameters<typeof OpenAI>[0] = { apiKey: apiKey || 'none' };
  if (baseUrl) clientOptions.baseURL = baseUrl;

  const client = new OpenAI(clientOptions);
  let attempt = 0;
  while (attempt < 2) {
    try {
      const completion = await client.chat.completions.create({
        model,
        max_tokens: 4096,
        temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
      });
      return completion.choices[0]?.message?.content ?? '';
    } catch (err) {
      attempt++;
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('OpenAI-compatible call failed');
}

async function callOllama(baseUrl: string, model: string, userPrompt: string): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/api/chat`;
  let attempt = 0;
  while (attempt < 2) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          stream: false,
          temperature: 0,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Ollama responded ${res.status}: ${text.slice(0, 200)}`);
      }
      const data = await res.json() as { message?: { content?: string } };
      return data.message?.content ?? '';
    } catch (err) {
      attempt++;
      if (attempt >= 2) throw err;
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  throw new Error('Ollama call failed');
}

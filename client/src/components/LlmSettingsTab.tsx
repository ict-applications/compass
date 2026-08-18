import { useState, useEffect, useRef, FormEvent } from 'react';
import { api } from '../api/client';
import Button from './Button';
import Card from './Card';
import LoadingSpinner from './LoadingSpinner';

interface TestResult {
  success: boolean;
  provider: string;
  model: string;
  latency_ms: number;
  reply?: string;
  error?: string;
}

type Provider = 'anthropic' | 'openai' | 'openrouter' | 'self-hosted' | 'ollama';

interface LlmSettings {
  provider: Provider;
  api_key: string | null;
  model: string;
  base_url: string | null;
  has_api_key: boolean;
}

const PROVIDERS: { value: Provider; label: string; icon: string; sublabel?: string }[] = [
  { value: 'anthropic',   label: 'Anthropic',    icon: '🔮' },
  { value: 'openai',      label: 'OpenAI',       icon: '🤖' },
  { value: 'openrouter',  label: 'OpenRouter',   icon: '🔀' },
  { value: 'ollama',      label: 'Ollama',       icon: '🦙', sublabel: 'Native API' },
  { value: 'self-hosted', label: 'Self-hosted',  icon: '🖥️',  sublabel: 'OpenAI-compatible' },
];

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic:     'claude-sonnet-4-20250514',
  openai:        'gpt-4o',
  openrouter:    'anthropic/claude-sonnet-4',
  ollama:        'llama3',
  'self-hosted': 'llama3',
};

const DEFAULT_BASE_URLS: Record<Provider, string> = {
  anthropic:     '',
  openai:        '',
  openrouter:    'https://openrouter.ai/api/v1',
  ollama:        'http://localhost:11434',
  'self-hosted': 'http://localhost:11434/v1',
};

export default function LlmSettingsTab() {
  const [settings, setSettings] = useState<LlmSettings | null>(null);
  const [form, setForm] = useState({ provider: 'anthropic' as Provider, api_key: '', model: '', base_url: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [models, setModels] = useState<{ id: string; name: string }[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState('');
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => { load(); }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  async function load() {
    try {
      const data = await api.get<LlmSettings>('/admin/settings');
      setSettings(data);
      setForm({
        provider: data.provider,
        api_key: data.api_key ?? '',
        model: data.model,
        base_url: data.base_url ?? '',
      });
    } catch {
      setError('Failed to load settings');
    } finally {
      setLoading(false);
    }
  }

  function handleProviderChange(p: Provider) {
    setForm((f) => ({
      ...f,
      provider: p,
      model: DEFAULT_MODELS[p],
      base_url: DEFAULT_BASE_URLS[p],
    }));
    setTestResult(null);
    setModels([]);
    setModelsError('');
    setShowModelDropdown(false);
  }

  async function handleFetchModels() {
    setLoadingModels(true);
    setModelsError('');
    setShowModelDropdown(false);
    const capturedProvider = form.provider;
    try {
      const result = await api.post<{ models: { id: string; name: string }[] }>('/admin/settings/models', {
        provider: form.provider,
        api_key: form.api_key || null,
        model: form.model,
        base_url: form.base_url || null,
      });
      if (form.provider !== capturedProvider) return;
      if (result.models.length === 0) {
        setModelsError('No models returned. Check your connection and credentials.');
      } else {
        setModels(result.models);
        setShowModelDropdown(true);
      }
    } catch (err) {
      if (form.provider === capturedProvider) {
        setModelsError((err as Error).message);
      }
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const updated = await api.post<LlmSettings>('/admin/settings', {
        provider: form.provider,
        api_key: form.api_key || null,
        model: form.model,
        base_url: form.base_url || null,
      });
      setSettings(updated);
      setForm((f) => ({ ...f, api_key: updated.api_key ?? '' }));
      showToast('LLM settings saved');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    setError('');
    try {
      const result = await api.post<TestResult>('/admin/settings/test', {
        provider: form.provider,
        api_key: form.api_key || null,
        model: form.model,
        base_url: form.base_url || null,
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({
        success: false,
        provider: form.provider,
        model: form.model,
        latency_ms: 0,
        error: (err as Error).message,
      });
    } finally {
      setTesting(false);
    }
  }

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  const needsBaseUrl = form.provider === 'openrouter' || form.provider === 'self-hosted' || form.provider === 'ollama';
  const baseUrlRequired = form.provider === 'openrouter' || form.provider === 'self-hosted';
  const providerInfo = PROVIDERS.find((p) => p.value === form.provider);

  if (loading) return <p className="text-slate-500 py-8 text-center">Loading...</p>;

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && (
        <div className="px-4 py-2.5 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Current status */}
      {settings && (
        <Card className="p-4 flex items-center gap-4">
          <div className="text-2xl">{PROVIDERS.find((p) => p.value === settings.provider)?.icon}</div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">Active configuration</p>
            <p className="text-slate-900 font-medium mt-0.5">
              {PROVIDERS.find((p) => p.value === settings.provider)?.label} · {settings.model}
            </p>
            <p className="text-slate-600 text-xs mt-0.5">
              {settings.has_api_key ? `API key set (${settings.api_key})` : 'No API key stored — using environment variable'}
            </p>
          </div>
        </Card>
      )}

      <form onSubmit={handleSave} className="space-y-5">
        {/* Provider selector */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">LLM Provider</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                type="button"
                onClick={() => handleProviderChange(p.value)}
                className={`flex flex-col items-center gap-1 px-3 py-3 rounded-xl border text-sm font-medium transition-all duration-150 ${
                  form.provider === p.value
                    ? 'border-[#BFF143] bg-[#BFF143]/15 text-slate-900 shadow-sm'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:text-slate-900'
                }`}
              >
                <span className="text-xl">{p.icon}</span>
                <span>{p.label}</span>
                {p.sublabel && (
                  <span className="text-[10px] opacity-60 font-normal">{p.sublabel}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Model */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Model name
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1" ref={modelDropdownRef}>
              <input
                value={form.model}
                onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                placeholder={DEFAULT_MODELS[form.provider]}
                required
                className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
              />
              {showModelDropdown && models.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden">
                  <div className="max-h-52 overflow-y-auto">
                    {models.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setForm((f) => ({ ...f, model: m.id }));
                          setShowModelDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-slate-800 hover:bg-slate-50 transition-colors"
                      >
                        <span className="font-medium">{m.name}</span>
                        {m.name !== m.id && (
                          <span className="ml-2 text-xs text-slate-400">{m.id}</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={handleFetchModels}
              disabled={loadingModels || testing}
              className="px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-600 text-sm hover:border-slate-500 hover:text-slate-900 transition-colors disabled:opacity-40 whitespace-nowrap"
            >
              {loadingModels ? <LoadingSpinner size="sm" color="currentColor" /> : '📋 Fetch Models'}
            </button>
          </div>
          {modelsError && (
            <p className="text-red-600 text-xs mt-1">{modelsError}</p>
          )}
          <ModelHints provider={form.provider} onSelect={(m) => setForm((f) => ({ ...f, model: m }))} />
        </div>

        {/* API key */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            API Key
            {form.provider !== 'self-hosted' && (
              <span className="ml-1 text-slate-500 font-normal">(leave blank to use env variable)</span>
            )}
          </label>
          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              value={form.api_key}
              onChange={(e) => setForm((f) => ({ ...f, api_key: e.target.value }))}
              placeholder={settings?.has_api_key ? 'Enter new key to replace, or leave blank to keep current' : 'sk-...'}
              className="w-full px-3 py-2.5 pr-20 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-slate-900 transition-colors"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
        </div>

        {/* Base URL */}
        {needsBaseUrl && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Base URL
              {form.provider === 'openrouter' && (
                <span className="ml-1 text-slate-500 font-normal">(OpenRouter endpoint)</span>
              )}
              {form.provider === 'self-hosted' && (
                <span className="ml-1 text-slate-500 font-normal">(e.g. LM Studio, vLLM)</span>
              )}
              {form.provider === 'ollama' && (
                <span className="ml-1 text-slate-500 font-normal">(optional — defaults to localhost:11434)</span>
              )}
            </label>
            <input
              value={form.base_url}
              onChange={(e) => setForm((f) => ({ ...f, base_url: e.target.value }))}
              placeholder={DEFAULT_BASE_URLS[form.provider]}
              required={baseUrlRequired}
              className="w-full px-3 py-2.5 rounded-lg text-sm text-slate-900 border border-slate-300 bg-white focus:outline-none focus:border-[#BFF143] focus:ring-1 focus:ring-[#BFF143]"
            />
          </div>
        )}

        {error && (
          <p className="text-red-600 text-sm px-3 py-2 rounded-lg bg-red-50 border border-red-200">{error}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button type="submit" loading={saving}>
            {providerInfo?.icon} Save {providerInfo?.label} Settings
          </Button>
          <Button type="button" variant="secondary" onClick={handleTest} disabled={saving || testing || loadingModels}>
            {testing ? <LoadingSpinner size="sm" color="currentColor" /> : '🔌'}
            {testing ? 'Testing…' : 'Test Connection'}
          </Button>
        </div>

        {/* Test result banner */}
        {testResult && (
          <div className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-sm ${
            testResult.success
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}>
            <span className="text-lg leading-none mt-0.5">{testResult.success ? '✅' : '❌'}</span>
            <div className="flex-1 min-w-0">
              {testResult.success ? (
                <>
                  <p className="font-medium">Connected — {testResult.model}</p>
                  <p className="text-xs mt-0.5 opacity-80">
                    Response in {testResult.latency_ms} ms
                    {testResult.reply ? ` · "${testResult.reply}"` : ''}
                  </p>
                </>
              ) : (
                <>
                  <p className="font-medium">Connection failed</p>
                  <p className="text-xs mt-0.5 opacity-80 break-all">{testResult.error}</p>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => setTestResult(null)}
              className="text-current opacity-50 hover:opacity-100 transition-opacity text-base leading-none"
            >
              ✕
            </button>
          </div>
        )}
      </form>

      {/* Provider notes */}
      <ProviderNotes provider={form.provider} />
    </div>
  );
}

function ModelHints({ provider, onSelect }: { provider: Provider; onSelect: (m: string) => void }) {
  const hints: Record<Provider, string[]> = {
    anthropic: [
      'claude-sonnet-4-20250514',
      'claude-opus-4-5',
      'claude-haiku-4-5-20251001',
    ],
    openai: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'o1-mini'],
    openrouter: [
      'anthropic/claude-sonnet-4',
      'openai/gpt-4o',
      'meta-llama/llama-3.3-70b-instruct',
      'google/gemini-2.0-flash-001',
    ],
    ollama: ['llama3', 'llama3.2', 'mistral', 'phi3', 'gemma2', 'qwen2.5'],
    'self-hosted': ['llama3', 'mistral', 'phi3', 'gemma2'],
  };

  return (
    <div className="flex flex-wrap gap-1.5 mt-2">
      {hints[provider].map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onSelect(m)}
          className="text-xs px-2 py-0.5 rounded-full bg-slate-50 border border-slate-200 text-slate-500 hover:text-slate-900 hover:border-slate-400 transition-colors"
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function ProviderNotes({ provider }: { provider: Provider }) {
  const notes: Record<Provider, string> = {
    anthropic:     'Uses the Anthropic Messages API. Get your key at console.anthropic.com.',
    openai:        'Uses the OpenAI Chat Completions API. Get your key at platform.openai.com.',
    openrouter:    'Routes to 200+ models via a unified API. Get your key at openrouter.ai. Base URL: https://openrouter.ai/api/v1',
    ollama:        'Uses Ollama\'s native /api/chat endpoint. No API key needed. Make sure Ollama is running (ollama serve) and the model is pulled (ollama pull llama3). Default URL: http://localhost:11434',
    'self-hosted': 'Works with any OpenAI-compatible server (LM Studio, vLLM, llama.cpp server, etc.). No API key required for most local setups. Base URL should end with /v1.',
  };

  return (
    <p className="text-xs text-slate-500 leading-relaxed border-t border-slate-200 pt-4">
      ℹ️ {notes[provider]}
    </p>
  );
}

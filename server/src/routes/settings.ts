import { Router, Response } from 'express';
import { authenticateToken, requireAdmin, AuthRequest } from '../middleware/auth';
import { getLlmSettings, saveLlmSettings, testConnection, getAvailableModels, LlmProvider } from '../services/aiComparator';

const router = Router();

const VALID_PROVIDERS: LlmProvider[] = ['anthropic', 'openai', 'openrouter', 'self-hosted', 'ollama'];

router.get('/', authenticateToken, requireAdmin, (_req: AuthRequest, res: Response): void => {
  const settings = getLlmSettings();
  // Mask the key: return last 4 chars only
  res.json({
    ...settings,
    api_key: settings.api_key ? `••••••••${settings.api_key.slice(-4)}` : null,
    has_api_key: !!settings.api_key,
  });
});

router.post('/', authenticateToken, requireAdmin, (req: AuthRequest, res: Response): void => {
  const { provider, api_key, model, base_url } = req.body as {
    provider?: string;
    api_key?: string;
    model?: string;
    base_url?: string;
  };

  if (provider && !VALID_PROVIDERS.includes(provider as LlmProvider)) {
    res.status(400).json({ error: `Invalid provider. Must be one of: ${VALID_PROVIDERS.join(', ')}` });
    return;
  }

  if (!model?.trim()) {
    res.status(400).json({ error: 'Model name is required' });
    return;
  }

  if ((provider === 'openrouter' || provider === 'self-hosted') && !base_url?.trim()) {
    res.status(400).json({ error: 'Base URL is required for OpenRouter and self-hosted providers' });
    return;
  }

  // If api_key is the masked placeholder, don't overwrite the stored key
  const isMasked = api_key?.startsWith('••••');
  const keyToSave = isMasked ? getLlmSettings().api_key : (api_key ?? null);

  const updated = saveLlmSettings({
    provider: provider as LlmProvider,
    api_key: keyToSave,
    model: model.trim(),
    base_url: base_url?.trim() || null,
  });

  res.json({
    ...updated,
    api_key: updated.api_key ? `••••••••${updated.api_key.slice(-4)}` : null,
    has_api_key: !!updated.api_key,
  });
});

router.post('/test', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { provider, api_key, model, base_url } = req.body as {
    provider?: string;
    api_key?: string;
    model?: string;
    base_url?: string;
  };

  // Build override from request body (use saved key if masked placeholder sent)
  const isMasked = api_key?.startsWith('••••');
  const resolvedKey = isMasked ? getLlmSettings().api_key : (api_key || null);

  const result = await testConnection({
    ...(provider ? { provider: provider as LlmProvider } : {}),
    ...(resolvedKey !== undefined ? { api_key: resolvedKey } : {}),
    ...(model ? { model } : {}),
    ...(base_url ? { base_url } : {}),
  });

  res.status(result.success ? 200 : 502).json(result);
});

router.post('/models', authenticateToken, requireAdmin, async (req: AuthRequest, res: Response): Promise<void> => {
  const { provider, api_key, model, base_url } = req.body as {
    provider?: string;
    api_key?: string;
    model?: string;
    base_url?: string;
  };

  const isMasked = api_key?.startsWith('••••');
  const resolvedKey = isMasked ? getLlmSettings().api_key : (api_key || null);

  try {
    const models = await getAvailableModels({
      ...(provider ? { provider: provider as LlmProvider } : {}),
      ...(resolvedKey !== undefined ? { api_key: resolvedKey } : {}),
      ...(model ? { model } : {}),
      ...(base_url ? { base_url } : {}),
    });
    res.json({ models });
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

export default router;

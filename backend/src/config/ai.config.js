// src/config/ai.config.js
// AI model routing — right model for right plan + right task

const { config } = require('./env');

// ==================== MODEL SELECTION ====================
const AI_MODELS = {
  // Free tier → Gemini (free API)
  gemini: {
    name: 'gemini-2.0-flash',
    provider: 'google',
    maxTokens: 1000,
    costPer1M: 0,
  },

  // Creator + Pro → Claude Sonnet
  sonnet: {
    name: 'claude-sonnet-4-5',
    provider: 'anthropic',
    maxTokens: 1000,
    costPer1M: 3,
  },

  // Agency deep analysis → Claude Opus
  opus: {
    name: 'claude-opus-4-5',
    provider: 'anthropic',
    maxTokens: 2000,
    costPer1M: 15,
  },

  // Agency bulk tasks → Claude Haiku (fast + cheap)
  haiku: {
    name: 'claude-haiku-4-5-20251001',
    provider: 'anthropic',
    maxTokens: 500,
    costPer1M: 0.25,
  },
};

// Plan → Model mapping
const getModelForPlan = (plan, task = 'default') => {
  const mapping = {
    free: AI_MODELS.gemini,
    creator: AI_MODELS.sonnet,
    pro: AI_MODELS.sonnet,
    agency: {
      default: AI_MODELS.sonnet,
      deep_analysis: AI_MODELS.opus,
      bulk: AI_MODELS.haiku,
      growth: AI_MODELS.opus,
    },
  };

  if (plan === 'agency' && typeof mapping.agency === 'object') {
    return mapping.agency[task] || mapping.agency.default;
  }

  return mapping[plan] || AI_MODELS.gemini;
};

// ==================== CALL AI ====================
const callAI = async (plan, task, messages, systemPrompt) => {
  const model = getModelForPlan(plan, task);

  if (model.provider === 'google') {
    return callGemini(model.name, messages, systemPrompt);
  }

  return callClaude(model.name, messages, systemPrompt, model.maxTokens);
};

// ==================== CALL CLAUDE ====================
const callClaude = async (modelName, messages, systemPrompt, maxTokens = 1000) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelName,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content?.[0]?.text || '';
};

// ==================== CALL GEMINI ====================
const callGemini = async (modelName, messages, systemPrompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('Gemini API key not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  // Convert messages to Gemini format
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents,
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini API error: ${response.status}`);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

module.exports = {
  AI_MODELS,
  getModelForPlan,
  callAI,
  callClaude,
  callGemini,
};

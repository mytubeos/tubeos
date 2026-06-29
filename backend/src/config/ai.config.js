// src/config/ai.config.js

const { config } = require('./env');

const AI_MODELS = {
  gemini: {
    name:        'gemini-2.0-flash',
    provider:    'google',
    maxTokens:   1000,
    costPer1M:   0,
  },
  groq: {
    name:        'llama-3.3-70b-versatile',
    provider:    'groq',
    maxTokens:   1000,
    costPer1M:   0, // free tier
  },
  sonnet: {
    name:        'claude-sonnet-4-5',
    provider:    'anthropic',
    maxTokens:   1000,
    costPer1M:   3,
  },
  opus: {
    name:        'claude-opus-4-5',
    provider:    'anthropic',
    maxTokens:   2000,
    costPer1M:   15,
  },
  haiku: {
    name:        'claude-haiku-4-5-20251001',
    provider:    'anthropic',
    maxTokens:   500,
    costPer1M:   0.25,
  },
};

const getModelForPlan = (plan, task = 'default') => {
  const bulkModel = process.env.GROQ_API_KEY ? AI_MODELS.groq : AI_MODELS.haiku;

  // TEST_MODE=true → sab free model (Groq if available, else Gemini)
  const testMode = process.env.AI_TEST_MODE === 'true';
  const freeModel = process.env.GROQ_API_KEY ? AI_MODELS.groq : AI_MODELS.gemini;
  const paid = testMode ? freeModel : AI_MODELS.sonnet;
  const premium = testMode ? freeModel : AI_MODELS.opus;

  const mapping = {
    free:    AI_MODELS.gemini,
    creator: paid,
    pro:     paid,
    agency: {
      default:       paid,
      deep_analysis: premium,
      bulk:          testMode ? freeModel : bulkModel,
      growth:        premium,
    },
  };

  if (plan === 'agency' && typeof mapping.agency === 'object') {
    return mapping.agency[task] || mapping.agency.default;
  }

  return mapping[plan] || AI_MODELS.gemini;
};

const callAI = async (plan, task, messages, systemPrompt) => {
  const model = getModelForPlan(plan, task);

  if (model.provider === 'google') {
    return callGemini(model.name, messages, systemPrompt);
  }

  if (model.provider === 'groq') {
    return callGroq(model.name, messages, systemPrompt, model.maxTokens);
  }

  return callClaude(model.name, messages, systemPrompt, model.maxTokens);
};

// Vision call — analyze an image with the chosen model.
// imageData: { base64, mimeType }
// Anthropic & Gemini both support vision; Groq llama-3.3 does not — falls back to Gemini.
const callAIVision = async (plan, task, { prompt, systemPrompt, base64, mimeType }) => {
  const model = getModelForPlan(plan, task);

  // Groq vision not available — route to Gemini
  if (model.provider === 'groq') {
    return callGeminiVision('gemini-2.0-flash', prompt, systemPrompt, base64, mimeType);
  }

  if (model.provider === 'google') {
    return callGeminiVision(model.name, prompt, systemPrompt, base64, mimeType);
  }

  return callClaudeVision(model.name, prompt, systemPrompt, base64, mimeType, model.maxTokens);
};

const callClaudeVision = async (modelName, prompt, systemPrompt, base64, mimeType, maxTokens = 1000) => {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      modelName,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: base64 } },
          { type: 'text', text: prompt },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Claude vision error: ${response.status}`);
  }
  const data = await response.json();
  return data.content?.[0]?.text || '';
};

const callGeminiVision = async (modelName, prompt, systemPrompt, base64, mimeType) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: prompt },
        ],
      }],
      generationConfig: { maxOutputTokens: 1000, temperature: 0.7 },
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gemini vision error: ${response.status}`);
  }
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
};

const callClaude = async (modelName, messages, systemPrompt, maxTokens = 1000) => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not configured');
  }

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':    'application/json',
      'x-api-key':       process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      modelName,
      max_tokens: maxTokens,
      system:     systemPrompt,
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

const callGroq = async (modelName, messages, systemPrompt, maxTokens = 1000) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const groqMessages = [];
  if (systemPrompt) groqMessages.push({ role: 'system', content: systemPrompt });
  groqMessages.push(...messages);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model:      modelName,
      messages:   groqMessages,
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error?.message || `Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || '';
};

const callGemini = async (modelName, messages, systemPrompt) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const contents = messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
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
  callAIVision,
  callClaude,
  callGemini,
  callGroq,
};

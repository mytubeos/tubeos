// src/utils/sanitize.utils.js
// Strip prompt-injection markers and control chars from user-supplied text
// before sending it inside an LLM prompt.

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|prompts?|rules?)/gi,
  /disregard\s+(all\s+)?(previous|above|prior)/gi,
  /forget\s+(everything|all\s+previous)/gi,
  /system\s*[:>]\s*/gi,
  /\[\/?(system|assistant|user|inst)\]/gi,
  /<\|im_(start|end)\|>/gi,
  /<\/?(system|assistant|user)>/gi,
  /\bact\s+as\s+(a|an)\s+(different|new|other)\s+(ai|assistant|model)/gi,
];

const sanitizePromptInput = (text, maxLength = 4000) => {
  if (text == null) return '';
  let s = String(text);

  // Strip ASCII control chars except \n, \r, \t — matching control chars is the point here
  // eslint-disable-next-line no-control-regex
  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  // Neutralize known prompt-injection phrases
  for (const re of INJECTION_PATTERNS) {
    s = s.replace(re, '[redacted]');
  }

  // Collapse excessive newlines
  s = s.replace(/\n{4,}/g, '\n\n\n');

  // Cap length
  if (s.length > maxLength) s = s.slice(0, maxLength) + '…';

  return s.trim();
};

// Sanitize an array of strings (e.g. tags)
const sanitizePromptArray = (arr, perItemMax = 100, maxItems = 30) => {
  if (!Array.isArray(arr)) return [];
  return arr.slice(0, maxItems).map((v) => sanitizePromptInput(v, perItemMax));
};

module.exports = { sanitizePromptInput, sanitizePromptArray };

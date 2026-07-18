// src/services/ai-content.service.js
// AI Content Engine
// Generates titles, tags, descriptions, content ideas, Shorts scripts

const { callAI, callAIVision, callCloudflareImageGen } = require('../config/ai.config');
const User = require('../models/user.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const Video = require('../models/video.model');
const { uploadGeneratedThumbnail } = require('./thumbnail.service');
const { setCache, getCache } = require('../config/redis');
const { sanitizePromptInput, sanitizePromptArray } = require('../utils/sanitize.utils');
const logger = require('../config/logger');

// ==================== GENERATE TITLES ====================
const generateTitles = async (userId, { topic, description, tags, channelNiche, count = 5 }) => {
  topic = sanitizePromptInput(topic, 300);
  description = sanitizePromptInput(description, 1000);
  tags = sanitizePromptArray(tags, 50, 20);
  channelNiche = sanitizePromptInput(channelNiche, 100);
  count = Math.min(Math.max(parseInt(count) || 5, 1), 10);

  const user = await User.findById(userId);
  const channel = await YoutubeChannel.findOne({ userId, isPrimary: true });

  const systemPrompt = `You are an expert YouTube SEO strategist.
Generate ${count} high-CTR YouTube video titles.
Rules:
- Each title under 60 characters
- Include power words and numbers when relevant
- Mix clickbait-y and informative styles
- Make them specific, not generic
- Channel niche: ${channelNiche || channel?.description || 'general'}
Return ONLY a valid JSON array with exactly ${count} strings. No explanation, no markdown.`;

  const content = `Topic: ${topic}
${description ? `Description: ${description}` : ''}
${tags?.length ? `Keywords: ${tags.join(', ')}` : ''}`;

  const result = await callAI(user.plan, 'default', [{ role: 'user', content }], systemPrompt);

  const clean = result.replace(/```json|```/g, '').trim();
  const titles = JSON.parse(clean);

  await User.findByIdAndUpdate(userId, { $inc: { 'usage.aiContentUsed': 1 } });
  return { titles, topic };
};

// ==================== GENERATE TAGS ====================
const generateTags = async (userId, { title, description, category }) => {
  title = sanitizePromptInput(title, 200);
  description = sanitizePromptInput(description, 1000);
  category = sanitizePromptInput(category, 50);

  const user = await User.findById(userId);

  const systemPrompt = `You are a YouTube SEO expert.
Generate 15-20 optimized YouTube tags for maximum discoverability.
Rules:
- Mix broad and specific tags
- Include long-tail keywords
- Include both singular and plural forms
- Tags should be 1-5 words each
- Start with most important tags
Return ONLY valid JSON array: ["tag1","tag2",...]
No explanation, no markdown.`;

  const result = await callAI(
    user.plan,
    'default',
    [
      {
        role: 'user',
        content: `Title: ${title}\nDescription: ${description || ''}\nCategory: ${category || 'General'}`,
      },
    ],
    systemPrompt
  );

  const clean = result.replace(/```json|```/g, '').trim();
  const tags = JSON.parse(clean);

  await User.findByIdAndUpdate(userId, { $inc: { 'usage.aiContentUsed': 1 } });
  return { tags, title };
};

// ==================== GENERATE DESCRIPTION ====================
const generateDescription = async (userId, { title, tags, channelName, addTimestamps = false }) => {
  title = sanitizePromptInput(title, 200);
  tags = sanitizePromptArray(tags, 50, 20);
  channelName = sanitizePromptInput(channelName, 100);

  const user = await User.findById(userId);
  const channel = await YoutubeChannel.findOne({ userId, isPrimary: true });

  const chName = channelName || channel?.channelName || 'My Channel';

  const systemPrompt = `You are a YouTube content creator writing an SEO-optimized video description.
Channel: ${chName}
Rules:
- First 2 lines MUST be compelling (shown in search results)
- Include main keywords naturally
- Add call-to-action (subscribe, like, comment)
- Include relevant hashtags at the end (3-5)
${addTimestamps ? '- Add placeholder timestamps section' : ''}
- Keep total length 200-500 words
- Sound natural, not spammy
Write the complete description directly, no extra commentary.`;

  const result = await callAI(
    user.plan,
    'default',
    [
      {
        role: 'user',
        content: `Title: ${title}\nKeywords: ${(tags || []).slice(0, 10).join(', ')}`,
      },
    ],
    systemPrompt
  );

  await User.findByIdAndUpdate(userId, { $inc: { 'usage.aiContentUsed': 1 } });
  return { description: result.trim(), title };
};

// ==================== GENERATE CONTENT IDEAS ====================
const generateContentIdeas = async (userId, { channelId, niche, count = 10 }) => {
  niche = sanitizePromptInput(niche, 100);
  count = Math.min(Math.max(parseInt(count) || 10, 1), 20);
  const cacheKey = `ai:ideas:${channelId}:${niche}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const user = await User.findById(userId);
  const channel = channelId
    ? await YoutubeChannel.findOne({ _id: channelId, userId })
    : await YoutubeChannel.findOne({ userId, isPrimary: true });

  const channelInfo = channel
    ? `Channel: ${channel.channelName} (${channel.stats.subscriberCount} subs)`
    : '';

  const systemPrompt = `You are a YouTube content strategist.
Generate ${count} high-potential video ideas.
${channelInfo}
Niche: ${niche || 'general'}
For each idea include: title, why it works, estimated views potential.
Return ONLY valid JSON array:
[{"title":"string","hook":"why viewers will click","potential":"high|medium|low","format":"tutorial|vlog|review|list|story"}]`;

  const result = await callAI(
    user.plan,
    'default',
    [
      {
        role: 'user',
        content: `Generate ${count} video ideas for niche: ${niche || 'general YouTube content'}`,
      },
    ],
    systemPrompt
  );

  const clean = result.replace(/```json|```/g, '').trim();
  const ideas = JSON.parse(clean);

  const response = { ideas, niche, generatedAt: new Date() };
  await setCache(cacheKey, response, 60 * 60 * 6); // 6hr cache
  return response;
};

// ==================== GENERATE SHORTS SCRIPT ====================
const generateShortsScript = async (userId, { topic, style = 'educational', duration = 60 }) => {
  topic = sanitizePromptInput(topic, 500);
  style = ['educational', 'entertainment', 'trending', 'motivation'].includes(style)
    ? style
    : 'educational';
  duration = Math.min(Math.max(parseInt(duration) || 60, 15), 60);

  const user = await User.findById(userId);

  const styleGuide = {
    educational: 'Quick tip or fact-based, hook + value + CTA',
    entertainment: 'Funny, relatable, story-based',
    trending: 'Trend-jacking, popular format',
    motivation: 'Inspiring, punchy, emotional',
  };

  const systemPrompt = `You are a YouTube Shorts script writer.
Write a ${duration}-second Shorts script.
Style: ${styleGuide[style] || styleGuide.educational}
Format:
- HOOK (0-3s): Attention-grabbing opening line
- CONTENT (3-${duration - 5}s): Main value/story
- CTA (last 3s): Subscribe/comment/share
Rules:
- Script should be speakable in exactly ${duration} seconds (avg 2.5 words/sec = ${Math.round(duration * 2.5)} words max)
- Each section clearly labeled
- Conversational, not robotic
Return as plain text with section labels.`;

  const result = await callAI(
    user.plan,
    'default',
    [{ role: 'user', content: `Write a Shorts script about: ${topic}` }],
    systemPrompt
  );

  await User.findByIdAndUpdate(userId, { $inc: { 'usage.aiContentUsed': 1 } });
  return {
    script: result.trim(),
    topic,
    style,
    estimatedDuration: duration,
    wordCount: result.split(' ').length,
  };
};

// ==================== REPURPOSE LONG VIDEO TO SHORTS ====================
const repurposeToShorts = async (userId, videoId) => {
  const user = await User.findById(userId);
  const video = await Video.findOne({ _id: videoId, userId });

  if (!video) {
    const err = new Error('Video not found');
    err.statusCode = 404;
    throw err;
  }

  const systemPrompt = `You are a YouTube Shorts repurposing expert.
Analyze this video and suggest 3 Shorts ideas extracted from it.
For each Short:
- Suggest which part of the video to use (timestamp hint)
- Write a 60-second script based on that segment
- Suggest a title
Return ONLY valid JSON:
[{"title":"string","timestampHint":"string","script":"string","whyItWorks":"string"}]`;

  const safeTitle = sanitizePromptInput(video.title, 200);
  const safeDescription = sanitizePromptInput(video.description, 500);
  const safeTags = sanitizePromptArray(video.tags, 50, 10);

  const result = await callAI(
    user.plan,
    'default',
    [
      {
        role: 'user',
        content: `Original video title: ${safeTitle}\nDescription: ${safeDescription || 'No description'}\nTags: ${safeTags.join(', ')}`,
      },
    ],
    systemPrompt
  );

  const clean = result.replace(/```json|```/g, '').trim();
  const shorts = JSON.parse(clean);

  return {
    originalVideo: { _id: video._id, title: video.title },
    shortsIdeas: shorts,
  };
};

// ==================== THUMBNAIL SCORE ====================
const scoreThumbnail = async (userId, { thumbnailUrl, title, niche }) => {
  title = sanitizePromptInput(title, 200);
  niche = sanitizePromptInput(niche, 100);

  const user = await User.findById(userId);

  const systemPrompt = `You are a YouTube thumbnail analyzer.
Score this thumbnail and give actionable feedback.
Return ONLY valid JSON:
{
  "score": 0-100,
  "ctrPrediction": "low|medium|high",
  "strengths": ["strength1","strength2"],
  "improvements": ["improvement1","improvement2"],
  "verdict": "brief verdict in 1 sentence"
}`;

  let result;
  if (thumbnailUrl && /^https?:\/\//i.test(thumbnailUrl)) {
    // Fetch the image and pass to a vision model
    try {
      const imgRes = await fetch(thumbnailUrl);
      if (!imgRes.ok) throw new Error(`image fetch ${imgRes.status}`);
      const contentType = imgRes.headers.get('content-type') || 'image/jpeg';
      if (!/^image\//.test(contentType)) throw new Error('URL did not return an image');

      const arrayBuf = await imgRes.arrayBuffer();
      // Cap at 4 MB to protect the AI provider
      if (arrayBuf.byteLength > 4 * 1024 * 1024) {
        throw new Error('Thumbnail image is larger than 4 MB');
      }
      const base64 = Buffer.from(arrayBuf).toString('base64');

      const prompt = `Title: ${title}\nNiche: ${niche || 'general'}\nAnalyze the attached thumbnail.`;
      result = await callAIVision(user.plan, 'default', {
        prompt,
        systemPrompt,
        base64,
        mimeType: contentType,
      });
    } catch (visionErr) {
      logger.warn('[scoreThumbnail] vision failed, falling back to text-only', {
        error: visionErr.message,
      });
      result = await callAI(
        user.plan,
        'default',
        [
          {
            role: 'user',
            content: `Title: ${title}\nNiche: ${niche || 'general'}\n(Image analysis unavailable — score based on title alone.)`,
          },
        ],
        systemPrompt
      );
    }
  } else {
    result = await callAI(
      user.plan,
      'default',
      [
        {
          role: 'user',
          content: `Title: ${title}\nNiche: ${niche || 'general'}\n(No thumbnail provided — score based on title alone.)`,
        },
      ],
      systemPrompt
    );
  }

  const clean = result.replace(/```json|```/g, '').trim();
  await User.findByIdAndUpdate(userId, { $inc: { 'usage.aiContentUsed': 1 } });
  return JSON.parse(clean);
};

// ==================== GENERATE THUMBNAIL IMAGE ====================
const THUMBNAIL_STYLES = {
  bold: 'bold, high-contrast, dramatic lighting, saturated vibrant colors',
  minimal: 'clean, minimal, lots of negative space, modern flat design',
  dramatic: 'cinematic, intense emotion, dark moody lighting with one bright focal highlight',
};

const generateThumbnailImage = async (userId, { title, niche, style }) => {
  title = sanitizePromptInput(title, 200);
  niche = sanitizePromptInput(niche, 100);
  style = THUMBNAIL_STYLES[style] ? style : 'bold';

  const prompt = `Create a professional, eye-catching YouTube thumbnail image (16:9 widescreen) for a video titled "${title}"${niche ? ` in the ${niche} niche` : ''}.
Style: ${THUMBNAIL_STYLES[style]}.
Composition: rule-of-thirds, one clear focal point, bold enough to read at small size, no watermarks or logos.
Leave clean, uncluttered space in the frame — do not render any title text baked into the image, since the creator will add their own text overlay afterward.`;

  const { base64, mimeType } = await callCloudflareImageGen(prompt);
  const buffer = Buffer.from(base64, 'base64');

  const { url } = await uploadGeneratedThumbnail(userId, buffer, mimeType);

  await User.findByIdAndUpdate(userId, { $inc: { 'usage.thumbnailGenUsed': 1 } });
  return { imageUrl: url, title, niche, style };
};

// ==================== MONETIZATION TIPS ====================
const getMonetizationTips = async (userId, channelId) => {
  const user = await User.findById(userId);
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId });

  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 404;
    throw err;
  }

  const cacheKey = `ai:monetization:${channelId}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are a YouTube monetization expert.
Analyze this channel and give 5 specific monetization tips.
Return ONLY valid JSON:
[{"tip":"string","type":"adsense|sponsorship|merchandise|memberships|affiliate","impact":"high|medium|low","action":"specific next step"}]`;

  const result = await callAI(
    user.plan,
    'default',
    [
      {
        role: 'user',
        content: `Channel: ${channel.channelName}\nSubscribers: ${channel.stats.subscriberCount}\nVideos: ${channel.stats.videoCount}\nTotal Views: ${channel.stats.viewCount}`,
      },
    ],
    systemPrompt
  );

  const clean = result.replace(/```json|```/g, '').trim();
  const tips = JSON.parse(clean);

  const response = { channelId, tips, generatedAt: new Date() };
  await setCache(cacheKey, response, 60 * 60 * 24); // 24hr cache
  return response;
};

module.exports = {
  generateTitles,
  generateTags,
  generateDescription,
  generateContentIdeas,
  generateShortsScript,
  repurposeToShorts,
  scoreThumbnail,
  generateThumbnailImage,
  getMonetizationTips,
};

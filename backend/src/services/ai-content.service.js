// src/services/ai-content.service.js
// AI Content Engine
// Generates titles, tags, descriptions, content ideas, Shorts scripts

const { callAI } = require('../config/ai.config');
const User = require('../models/user.model');
const YoutubeChannel = require('../models/youtube-channel.model');
const Video = require('../models/video.model');
const { setCache, getCache } = require('../config/redis');

// ==================== GENERATE TITLES ====================
const generateTitles = async (userId, { topic, description, tags, channelNiche, count = 5 }) => {
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
Return ONLY valid JSON array: ["title1","title2","title3"]
No explanation, no markdown.`;

  const content = `Topic: ${topic}
${description ? `Description: ${description}` : ''}
${tags?.length ? `Keywords: ${tags.join(', ')}` : ''}`;

  const result = await callAI(
    user.plan,
    'default',
    [{ role: 'user', content }],
    systemPrompt
  );

  const clean = result.replace(/```json|```/g, '').trim();
  const titles = JSON.parse(clean);

  return { titles, topic };
};

// ==================== GENERATE TAGS ====================
const generateTags = async (userId, { title, description, category }) => {
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
    [{ role: 'user', content: `Title: ${title}\nDescription: ${description || ''}\nCategory: ${category || 'General'}` }],
    systemPrompt
  );

  const clean = result.replace(/```json|```/g, '').trim();
  const tags = JSON.parse(clean);

  return { tags, title };
};

// ==================== GENERATE DESCRIPTION ====================
const generateDescription = async (userId, { title, tags, channelName, addTimestamps = false }) => {
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
    [{ role: 'user', content: `Title: ${title}\nKeywords: ${(tags || []).slice(0, 10).join(', ')}` }],
    systemPrompt
  );

  return { description: result.trim(), title };
};

// ==================== GENERATE CONTENT IDEAS ====================
const generateContentIdeas = async (userId, { channelId, niche, count = 10 }) => {
  const cacheKey = `ai:ideas:${channelId}:${niche}`;
  const cached = await getCache(cacheKey);
  if (cached) return cached;

  const user = await User.findById(userId);
  const channel = channelId
    ? await YoutubeChannel.findOne({ _id: channelId, userId })
    : await YoutubeChannel.findOne({ userId, isPrimary: true });

  const channelInfo = channel ? `Channel: ${channel.channelName} (${channel.stats.subscriberCount} subs)` : '';

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
    [{ role: 'user', content: `Generate ${count} video ideas for niche: ${niche || 'general YouTube content'}` }],
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

  const result = await callAI(
    user.plan,
    'default',
    [{ role: 'user', content: `Original video title: ${video.title}\nDescription: ${video.description?.substring(0, 500) || 'No description'}\nTags: ${video.tags?.slice(0, 10).join(', ')}` }],
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
  const user = await User.findById(userId);

  const systemPrompt = `You are a YouTube thumbnail analyzer.
Score this thumbnail concept and give actionable feedback.
Return ONLY valid JSON:
{
  "score": 0-100,
  "ctrPrediction": "low|medium|high",
  "strengths": ["strength1","strength2"],
  "improvements": ["improvement1","improvement2"],
  "verdict": "brief verdict in 1 sentence"
}`;

  const result = await callAI(
    user.plan,
    'default',
    [{ role: 'user', content: `Title: ${title}\nNiche: ${niche || 'general'}\nThumbnail URL: ${thumbnailUrl || 'Not provided — analyze title only'}` }],
    systemPrompt
  );

  const clean = result.replace(/```json|```/g, '').trim();
  return JSON.parse(clean);
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
    [{ role: 'user', content: `Channel: ${channel.channelName}\nSubscribers: ${channel.stats.subscriberCount}\nVideos: ${channel.stats.videoCount}\nTotal Views: ${channel.stats.viewCount}` }],
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
  getMonetizationTips,
};

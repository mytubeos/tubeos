import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// youtube.service.js (plain CommonJS) is loaded through Node's native
// require() mechanism -- see tests/integration/auth.service.test.js for why
// createRequire is used instead of `import` for local project files under
// test.
const require = createRequire(import.meta.url);
const youtubeService = require('../../src/services/youtube.service.js');
const YoutubeChannel = require('../../src/models/youtube-channel.model.js');
const User = require('../../src/models/user.model.js');

const createUserWithTwoChannels = async () => {
  const user = await User.create({
    name: 'Creator',
    email: `creator-${Date.now()}-${Math.random()}@example.com`,
    password: 'password123',
    isEmailVerified: true,
    plan: 'agency',
  });

  const primary = await YoutubeChannel.create({
    userId: user._id,
    channelId: `UC${Math.random().toString(36).slice(2, 24)}`,
    channelName: 'Primary Channel',
    isActive: true,
    isPrimary: true,
    isDefault: true,
    oauth: { accessToken: 'a', refreshToken: 'r', expiresAt: new Date(Date.now() + 3600e3) },
  });

  const secondary = await YoutubeChannel.create({
    userId: user._id,
    channelId: `UC${Math.random().toString(36).slice(2, 24)}`,
    channelName: 'Secondary Channel',
    isActive: true,
    isPrimary: false,
    oauth: { accessToken: 'a', refreshToken: 'r', expiresAt: new Date(Date.now() + 3600e3) },
  });

  return { user, primary, secondary };
};

describe('youtube.service.disconnectChannel', () => {
  it('clears isPrimary/isDefault on the disconnected channel itself, not just on the promoted one', async () => {
    // Regression test: disconnectChannel() used to only promote a remaining
    // channel to primary, never clearing the disconnected channel's own
    // isPrimary/isDefault flags. Since handleOAuthCallback's upsert never
    // touches those fields on reconnect, reconnecting this exact channel
    // later would resurrect its stale isPrimary: true alongside whichever
    // channel got promoted here -- two channels marked primary at once,
    // matching the live "both channels show Primary" bug found in QA.
    const { user, primary, secondary } = await createUserWithTwoChannels();

    await youtubeService.disconnectChannel(primary._id.toString(), user._id.toString());

    const disconnected = await YoutubeChannel.findById(primary._id);
    expect(disconnected.isPrimary).toBe(false);
    expect(disconnected.isDefault).toBe(false);
    expect(disconnected.isActive).toBe(false);

    const promoted = await YoutubeChannel.findById(secondary._id);
    expect(promoted.isPrimary).toBe(true);
    expect(promoted.isDefault).toBe(true);
  });

  it('simulated reconnect after disconnect never leaves two channels primary', async () => {
    const { user, primary } = await createUserWithTwoChannels();

    await youtubeService.disconnectChannel(primary._id.toString(), user._id.toString());

    // Simulate handleOAuthCallback's upsert reconnecting the same channel:
    // it flips isActive back to true but never touches isPrimary/isDefault.
    await YoutubeChannel.findByIdAndUpdate(primary._id, {
      isActive: true,
      connectionStatus: 'connected',
    });

    const primaryCount = await YoutubeChannel.countDocuments({
      userId: user._id,
      isActive: true,
      isPrimary: true,
    });
    expect(primaryCount).toBe(1);
  });

  it('does not promote another channel when the disconnected channel was not primary', async () => {
    const { user, primary, secondary } = await createUserWithTwoChannels();

    await youtubeService.disconnectChannel(secondary._id.toString(), user._id.toString());

    const stillPrimary = await YoutubeChannel.findById(primary._id);
    expect(stillPrimary.isPrimary).toBe(true);
  });
});

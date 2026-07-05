// src/utils/email.utils.js
// FIXED: Brevo API integration for OTP, welcome email, password reset
const axios = require('axios');
const { config } = require('../config/env');
const logger = require('../config/logger');

const BREVO_API_KEY = process.env.BREVO_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM_ADDRESS || 'noreply@tubeos.in';
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

// Check if Brevo is configured
const isBrevoConfigured = () => !!BREVO_API_KEY;

// ==================== SEND OTP EMAIL ====================
const sendOTPEmail = async (recipientEmail, recipientName, otp) => {
  if (!isBrevoConfigured()) {
    logger.warn('[sendOTPEmail] Brevo not configured, skipping email');
    return;
  }

  if (!recipientEmail || !otp) {
    throw new Error('Email and OTP are required');
  }

  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">TubeOS</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 0;">AI-Powered YouTube Creator Management</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px 20px; text-align: center;">
          <h2 style="color: #333; margin-top: 0;">Verify Your Email</h2>
          <p style="color: #666; font-size: 16px;">Hi ${recipientName},</p>
          <p style="color: #666; font-size: 14px;">Your OTP for email verification is:</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border: 2px solid #667eea;">
            <p style="font-size: 36px; font-weight: bold; color: #667eea; margin: 0; letter-spacing: 4px;">${otp}</p>
          </div>
          
          <p style="color: #999; font-size: 12px;">This OTP will expire in 10 minutes.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, please ignore this email.</p>
        </div>
        
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">© 2024 TubeOS. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: {
          email: EMAIL_FROM,
          name: 'TubeOS Team',
        },
        to: [
          {
            email: recipientEmail,
            name: recipientName,
          },
        ],
        subject: `Your TubeOS Verification Code: ${otp}`,
        htmlContent: emailContent,
        replyTo: {
          email: EMAIL_FROM,
        },
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('[sendOTPEmail] OTP email sent successfully', { email: recipientEmail });
    return response.data;
  } catch (error) {
    logger.error('[sendOTPEmail] Error sending OTP email', {
      email: recipientEmail,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    throw new Error(`Failed to send OTP email: ${error.message}`, { cause: error });
  }
};

// ==================== SEND PASSWORD RESET EMAIL ====================
const sendPasswordResetEmail = async (recipientEmail, recipientName, resetToken) => {
  if (!isBrevoConfigured()) {
    logger.warn('[sendPasswordResetEmail] Brevo not configured, skipping email');
    return;
  }

  if (!recipientEmail || !resetToken) {
    throw new Error('Email and reset token are required');
  }

  const resetUrl = `${config.cors.clientUrl}/reset-password?token=${resetToken}`;

  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">TubeOS</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 0;">Password Reset Request</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px 20px;">
          <h2 style="color: #333;">Reset Your Password</h2>
          <p style="color: #666; font-size: 14px;">Hi ${recipientName},</p>
          <p style="color: #666; font-size: 14px;">We received a request to reset your TubeOS password. Click the button below to proceed:</p>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" 
               style="background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">
              Reset Password
            </a>
          </div>
          
          <p style="color: #666; font-size: 12px;">Or copy and paste this link in your browser:</p>
          <p style="color: #667eea; font-size: 11px; word-break: break-all;">${resetUrl}</p>
          
          <div style="border-top: 1px solid #ddd; margin-top: 20px; padding-top: 20px;">
            <p style="color: #999; font-size: 12px; margin: 5px 0;">⚠️ This link will expire in 15 minutes.</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">If you didn't request this, please ignore this email.</p>
            <p style="color: #999; font-size: 12px; margin: 5px 0;">Your password will remain unchanged.</p>
          </div>
        </div>
        
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">© 2024 TubeOS. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: {
          email: EMAIL_FROM,
          name: 'TubeOS Security',
        },
        to: [
          {
            email: recipientEmail,
            name: recipientName,
          },
        ],
        subject: 'Reset Your TubeOS Password',
        htmlContent: emailContent,
        replyTo: {
          email: EMAIL_FROM,
        },
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('[sendPasswordResetEmail] Password reset email sent successfully', {
      email: recipientEmail,
    });
    return response.data;
  } catch (error) {
    logger.error('[sendPasswordResetEmail] Error sending password reset email', {
      email: recipientEmail,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    throw new Error(`Failed to send password reset email: ${error.message}`, { cause: error });
  }
};

// ==================== SEND WELCOME EMAIL ====================
const sendWelcomeEmail = async (recipientEmail, recipientName) => {
  if (!isBrevoConfigured()) {
    logger.warn('[sendWelcomeEmail] Brevo not configured, skipping email');
    return;
  }

  if (!recipientEmail) {
    throw new Error('Email is required');
  }

  try {
    const emailContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px 8px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🎉 Welcome to TubeOS!</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 0;">Your AI-Powered YouTube Creator Companion</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 40px 20px;">
          <h2 style="color: #333;">Welcome, ${recipientName}!</h2>
          <p style="color: #666; font-size: 14px;">Your email has been verified and you're all set to start.</p>
          
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin-top: 0;">What's Next?</h3>
            <ul style="color: #666; font-size: 14px;">
              <li>🔌 Connect your YouTube channel</li>
              <li>📊 View analytics and insights</li>
              <li>📅 Schedule videos with optimal timing</li>
              <li>🤖 Get AI-powered content recommendations</li>
              <li>💬 Manage comments and engagement</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.cors.clientUrl}/channels" 
               style="background: #667eea; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold; display: inline-block;">
              Go to Dashboard
            </a>
          </div>
        </div>
        
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="color: #999; font-size: 12px; margin: 0;">Questions? Contact us at ${EMAIL_FROM}</p>
          <p style="color: #999; font-size: 12px; margin: 5px 0;">© 2024 TubeOS. All rights reserved.</p>
        </div>
      </div>
    `;

    const response = await axios.post(
      BREVO_API_URL,
      {
        sender: {
          email: EMAIL_FROM,
          name: 'TubeOS Team',
        },
        to: [
          {
            email: recipientEmail,
            name: recipientName,
          },
        ],
        subject: `Welcome to TubeOS, ${recipientName}! 🎉`,
        htmlContent: emailContent,
        replyTo: {
          email: EMAIL_FROM,
        },
      },
      {
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info('[sendWelcomeEmail] Welcome email sent successfully', { email: recipientEmail });
    return response.data;
  } catch (error) {
    logger.error('[sendWelcomeEmail] Error sending welcome email', {
      email: recipientEmail,
      status: error.response?.status,
      message: error.response?.data?.message || error.message,
    });
    // Don't throw for welcome email - not critical
  }
};

// ==================== SEND WEEKLY REPORT EMAIL ====================
const sendWeeklyReportEmail = async (user, reportData) => {
  if (!isBrevoConfigured()) {
    logger.warn('[sendWeeklyReportEmail] Brevo not configured, skipping');
    return;
  }
  if (!user?.email || !reportData) return;

  const { generateSubjectLine } = require('../services/report.service');
  const subject = generateSubjectLine(user.name, reportData.kpis, reportData.weekRange);

  const html = buildWeeklyReportHtml(user, reportData);

  try {
    await axios.post(
      BREVO_API_URL,
      {
        sender: { email: EMAIL_FROM, name: 'TubeOS Reports' },
        to: [{ email: user.email, name: user.name }],
        subject,
        htmlContent: html,
        replyTo: { email: EMAIL_FROM },
      },
      {
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      }
    );
    logger.info('[sendWeeklyReportEmail] sent', { email: user.email });
  } catch (err) {
    logger.error(`[sendWeeklyReportEmail] failed for ${user.email}`, {
      error: err.response?.data?.message || err.message,
    });
  }
};

// ==================== HTML BUILDER ====================
const buildWeeklyReportHtml = (user, data) => {
  const firstName = user.name?.split(' ')[0] || 'Creator';
  const {
    channel,
    kpis,
    dailyViews,
    topVideos,
    insights,
    actionItems,
    bestTimes,
    milestones,
    healthScore,
    weekRange,
  } = data;

  const fmtNum = (n) =>
    n == null
      ? '—'
      : n >= 1000000
        ? `${(n / 1000000).toFixed(1)}M`
        : n >= 1000
          ? `${(n / 1000).toFixed(1)}K`
          : `${n}`;
  const fmtHrs = (h) => (h >= 1 ? `${Math.round(h)} hr` : `${Math.round(h * 60)} min`);
  const arrow = (c) => (c > 0 ? '↑' : c < 0 ? '↓' : '→');
  const clrChg = (c) => (c > 0 ? '#16a34a' : c < 0 ? '#dc2626' : '#888');
  const insBg = { accent: '#eff6ff', success: '#f0fdf4', warning: '#fffbeb' };
  const insBdr = { accent: '#3b82f6', success: '#22c55e', warning: '#f59e0b' };

  // Daily bar chart — pure CSS divs (works in all email clients)
  const maxViews = Math.max(...dailyViews, 1);
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const barsHtml = dailyViews
    .map((v, i) => {
      const pct = Math.round((v / maxViews) * 60);
      const isHi = v === maxViews;
      return `<td style="text-align:center;vertical-align:bottom;padding:0 3px;width:14%;">
      <div style="height:${pct || 2}px;background:${isHi ? '#4f46e5' : '#a5b4fc'};border-radius:3px 3px 0 0;"></div>
      <div style="font-size:10px;color:#9ca3af;margin-top:3px;">${dayLabels[i]}</div>
    </td>`;
    })
    .join('');

  // KPI cards
  const kpiCards = [
    { label: 'Total Views', value: fmtNum(kpis.views.value), change: kpis.views.change },
    { label: 'Watch Time', value: fmtHrs(kpis.watchTime.value), change: kpis.watchTime.change },
    {
      label: 'New Subscribers',
      value: `+${kpis.subscribers.gained}`,
      change: kpis.subscribers.change,
    },
    { label: 'Click-Through', value: `${kpis.ctr.value}%`, change: kpis.ctr.change },
  ]
    .map(
      (k) => `
    <td style="width:25%;padding:4px;">
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 10px;text-align:center;">
        <div style="font-size:11px;color:#9ca3af;margin-bottom:4px;">${k.label}</div>
        <div style="font-size:20px;font-weight:600;color:#111827;">${k.value}</div>
        <div style="font-size:11px;color:${clrChg(k.change)};margin-top:3px;">${arrow(k.change)} ${Math.abs(k.change)}% vs last week</div>
      </div>
    </td>`
    )
    .join('');

  // Top videos
  const videosHtml = topVideos
    .slice(0, 3)
    .map((v, i) => {
      const rankColors = ['#b45309', '#6b7280', '#78350f'];
      const rankBg = ['#fef3c7', '#f3f4f6', '#fef9c3'];
      const ytUrl = `https://www.youtube.com/watch?v=${v.youtubeVideoId}`;
      return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #f3f4f6;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="width:26px;">
              <div style="width:22px;height:22px;border-radius:4px;background:${rankBg[i]};color:${rankColors[i]};font-size:11px;font-weight:700;text-align:center;line-height:22px;">${i + 1}</div>
            </td>
            <td style="width:64px;padding:0 8px;">
              <div style="width:60px;height:36px;background:#e5e7eb;border-radius:5px;overflow:hidden;">
                ${v.thumbnail?.url ? `<img src="${v.thumbnail.url}" width="60" height="36" style="object-fit:cover;display:block;" alt="">` : '<div style="width:60px;height:36px;background:#d1d5db;"></div>'}
              </div>
            </td>
            <td>
              <div style="font-size:13px;font-weight:500;color:#111827;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:240px;">${v.title}</div>
              <div style="font-size:11px;color:#9ca3af;margin-top:2px;">👁 ${fmtNum(v.performance?.views)} views &nbsp;·&nbsp; 👍 ${fmtNum(v.performance?.likes)}</div>
            </td>
            <td style="text-align:right;">
              <a href="${ytUrl}" style="font-size:11px;color:#4f46e5;text-decoration:none;">Watch ↗</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>`;
    })
    .join('');

  // Insights
  const insightsHtml = insights
    .map(
      (ins) => `
    <div style="background:${insBg[ins.color] || '#f9fafb'};border-left:3px solid ${insBdr[ins.color] || '#6b7280'};border-radius:0 6px 6px 0;padding:12px 14px;margin:8px 0;">
      <div style="font-size:13px;font-weight:600;color:#111827;margin-bottom:3px;">${ins.title}</div>
      <div style="font-size:12px;color:#4b5563;line-height:1.5;">${ins.body}</div>
    </div>`
    )
    .join('');

  // Best times
  const timesHtml =
    bestTimes
      .slice(0, 3)
      .map((slot, i) => {
        const dt = slot.datetime ? new Date(slot.datetime) : null;
        const label = dt
          ? dt.toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })
          : slot.time || '';
        const time = dt
          ? dt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
          : slot.hour || '';
        const bg = i === 0 ? '#f0fdf4' : '#f9fafb';
        const clr = i === 0 ? '#15803d' : '#4f46e5';
        return `
    <div style="background:${bg};border:1px solid ${i === 0 ? '#bbf7d0' : '#e5e7eb'};border-radius:6px;padding:8px 12px;margin:5px 0;display:flex;justify-content:space-between;">
      <div>
        <div style="font-size:12px;font-weight:600;color:${clr};">${label}</div>
        <div style="font-size:11px;color:#9ca3af;">${time}${i === 0 ? ' · Best slot' : ''}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:${clr};">${slot.score}/100</div>
    </div>`;
      })
      .join('') ||
    '<div style="font-size:12px;color:#9ca3af;padding:8px 0;">Sync analytics to unlock best times</div>';

  // Milestones
  const msHtml = milestones
    .slice(0, 3)
    .map(
      (ms) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #f3f4f6;">
      <div style="width:28px;height:28px;border-radius:50%;background:#eff6ff;color:#2563eb;font-size:12px;text-align:center;line-height:28px;flex-shrink:0;">🎯</div>
      <div>
        <div style="font-size:13px;font-weight:500;color:#111827;">${ms.label}</div>
        <div style="font-size:11px;color:#9ca3af;">${ms.needed} more · est. ${ms.estWeeks < 4 ? ms.estWeeks + ' week(s)' : Math.round(ms.estWeeks / 4) + ' month(s)'}</div>
      </div>
    </div>`
    )
    .join('');

  // Action items
  const actionsHtml = actionItems
    .map(
      (item) => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 0;font-size:13px;color:#374151;">
      <span style="color:#4f46e5;flex-shrink:0;font-size:15px;">✓</span>
      <span>${item}</span>
    </div>`
    )
    .join('');

  // Health score bar
  const healthBar = `${'█'.repeat(Math.round(healthScore / 10))}${'░'.repeat(10 - Math.round(healthScore / 10))}`;
  const healthClr = healthScore >= 70 ? '#16a34a' : healthScore >= 40 ? '#d97706' : '#dc2626';

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px 0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">

<table width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

  <!-- HEADER -->
  <tr><td style="background:#1a1033;border-radius:12px 12px 0 0;padding:28px 32px 24px;">
    <table width="100%"><tr>
      <td><span style="color:#fff;font-size:18px;font-weight:600;">⚡ TubeOS</span></td>
      <td style="text-align:right;"><span style="font-size:11px;color:rgba(255,255,255,.4);">Week of ${weekRange}</span></td>
    </tr></table>
    <div style="margin-top:14px;">
      <div style="font-size:11px;color:rgba(255,255,255,.45);letter-spacing:.06em;text-transform:uppercase;margin-bottom:6px;">Weekly Creator Report</div>
      <div style="font-size:22px;font-weight:600;color:#fff;line-height:1.35;">
        ${
          kpis.views.value > 0 || kpis.subscribers.gained > 0
            ? `Good week, ${firstName}! ${kpis.subscribers.gained > 0 ? `Your channel grew <span style="color:#a78bfa;">+${kpis.subscribers.gained} subscriber${kpis.subscribers.gained > 1 ? 's' : ''}</span> this week.` : `You got <span style="color:#a78bfa;">${fmtNum(kpis.views.value)} views</span> this week.`}`
            : `Here's your weekly summary, ${firstName}.`
        }
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,.45);margin-top:6px;">${channel.name} · ${fmtNum(channel.subscribers)} subscribers</div>
    </div>
  </td></tr>

  <!-- BODY -->
  <tr><td style="background:#ffffff;padding:24px 32px;border:1px solid #e5e7eb;border-top:none;">

    <!-- KPI GRID -->
    <div style="font-size:11px;font-weight:500;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;">📊 This week at a glance</div>
    <table width="100%" cellpadding="0" cellspacing="0"><tr>${kpiCards}</tr></table>

    <!-- BAR CHART -->
    <div style="margin-top:16px;">
      <div style="font-size:11px;color:#9ca3af;margin-bottom:6px;">Daily views this week</div>
      <table width="100%" cellpadding="0" cellspacing="0" style="height:76px;"><tr>${barsHtml}</tr></table>
    </div>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;">

    <!-- TOP VIDEOS -->
    <div style="font-size:11px;font-weight:500;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;">🏆 Top performing videos</div>
    <table width="100%" cellpadding="0" cellspacing="0">${videosHtml}</table>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;">

    <!-- AI INSIGHTS -->
    <div style="font-size:11px;font-weight:500;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;">✨ AI insights for you</div>
    ${insightsHtml}

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;">

    <!-- BEST TIMES + MILESTONES -->
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="48%" style="vertical-align:top;padding-right:12px;">
        <div style="font-size:11px;font-weight:500;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;">⏰ Best times to post</div>
        ${timesHtml}
      </td>
      <td width="4%"></td>
      <td width="48%" style="vertical-align:top;">
        <div style="font-size:11px;font-weight:500;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;">🎯 Next milestones</div>
        ${msHtml || '<div style="font-size:12px;color:#9ca3af;">Keep growing!</div>'}
      </td>
    </tr></table>

    <hr style="border:none;border-top:1px solid #f3f4f6;margin:20px 0;">

    <!-- ACTION PLAN -->
    <div style="font-size:11px;font-weight:500;color:#9ca3af;letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px;">📋 This week's action plan</div>
    ${actionsHtml}

    <!-- CTA -->
    <div style="text-align:center;margin:24px 0 4px;">
      <a href="${process.env.CLIENT_URL || 'https://tubeos-eight.vercel.app'}/dashboard"
         style="display:inline-block;background:#4f46e5;color:#fff;padding:13px 32px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
        View Full Dashboard →
      </a>
    </div>

  </td></tr>

  <!-- FOOTER -->
  <tr><td style="background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 12px 12px;padding:16px 32px;">
    <table width="100%"><tr>
      <td>
        <div style="font-size:12px;color:#6b7280;">Channel health score</div>
        <div style="font-size:13px;font-weight:600;color:${healthClr};font-family:monospace;">${healthBar} ${healthScore}/100</div>
      </td>
      <td style="text-align:right;">
        <a href="${process.env.CLIENT_URL || 'https://tubeos-eight.vercel.app'}/settings" style="font-size:11px;color:#9ca3af;text-decoration:none;margin-left:12px;">Change frequency</a>
        <a href="${process.env.CLIENT_URL || 'https://tubeos-eight.vercel.app'}/settings" style="font-size:11px;color:#9ca3af;text-decoration:none;margin-left:12px;">Unsubscribe</a>
      </td>
    </tr></table>
    <div style="margin-top:10px;font-size:11px;color:#d1d5db;text-align:center;">© 2025 TubeOS · AI-Powered YouTube Management</div>
  </td></tr>

</table>
</td></tr>
</table>

</body></html>`;
};

module.exports = {
  sendOTPEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendWeeklyReportEmail,
  isBrevoConfigured,
};

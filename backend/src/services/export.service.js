// src/services/export.service.js
// Builds CSV and PDF analytics reports for download.
// PDF uses pdfkit (pure JS, no binary deps — works on Render).

const PDFDocument = require('pdfkit');
const { ChannelAnalytics } = require('../models/analytics.model');
const YoutubeChannel = require('../models/youtube-channel.model');

// ---------- helpers ----------

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 };

const periodLabel = (period) => {
  const map = {
    '7d': 'Last 7 Days',
    '30d': 'Last 30 Days',
    '90d': 'Last 90 Days',
    '365d': 'Last 365 Days',
  };
  return map[period] || period;
};

const fmtDate = (d) => new Date(d).toISOString().slice(0, 10);

const fmtNum = (n) => (n ?? 0).toLocaleString();

const fmtHours = (mins) => `${((mins ?? 0) / 60).toFixed(1)}h`;

const fmtPct = (n) => `${(n ?? 0).toFixed(2)}%`;

/**
 * Fetch channel name + daily analytics rows for the given period.
 * Throws 403 if channelId does not belong to userId.
 */
const getExportData = async (channelId, userId, period) => {
  const channel = await YoutubeChannel.findOne({ _id: channelId, userId })
    .select('channelName channelId')
    .lean();
  if (!channel) {
    const err = new Error('Channel not found');
    err.statusCode = 403;
    throw err;
  }

  const days = PERIOD_DAYS[period] || 30;
  const since = new Date();
  since.setDate(since.getDate() - days);

  const rows = await ChannelAnalytics.find({ channelId, date: { $gte: since } })
    .sort({ date: 1 })
    .select('date metrics')
    .lean();

  return { rows, channelName: channel.channelName, ytChannelId: channel.channelId };
};

/**
 * Summarise rows into total KPIs.
 */
const summarise = (rows) => {
  const s = {
    views: 0,
    watchMins: 0,
    subs: 0,
    likes: 0,
    comments: 0,
    shares: 0,
    impressions: 0,
    revenue: 0,
  };
  for (const r of rows) {
    const m = r.metrics || {};
    s.views += m.views || 0;
    s.watchMins += m.estimatedMinutesWatched || 0;
    s.subs += m.subscribersGained || 0;
    s.likes += m.likes || 0;
    s.comments += m.comments || 0;
    s.shares += m.shares || 0;
    s.impressions += m.impressions || 0;
    s.revenue += m.estimatedRevenue || 0;
  }
  return s;
};

// ===================== CSV =====================

/**
 * Build a UTF-8 CSV string from daily analytics rows.
 * @returns {string}
 */
const buildCsv = (rows, channelName, period) => {
  const totals = summarise(rows);
  const lines = [];

  // Metadata header
  lines.push(`# TubeOS Analytics Report`);
  lines.push(`# Channel: ${channelName}`);
  lines.push(`# Period: ${periodLabel(period)}`);
  lines.push(`# Generated: ${new Date().toUTCString()}`);
  lines.push('');

  // Totals summary
  lines.push('# SUMMARY');
  lines.push(`Total Views,${totals.views}`);
  lines.push(`Total Watch Time,${fmtHours(totals.watchMins)}`);
  lines.push(`Subscribers Gained,${totals.subs}`);
  lines.push(`Total Likes,${totals.likes}`);
  lines.push(`Total Comments,${totals.comments}`);
  lines.push(`Total Impressions,${totals.impressions}`);
  if (totals.revenue > 0) lines.push(`Estimated Revenue (USD),$${totals.revenue.toFixed(2)}`);
  lines.push('');

  // Daily table
  lines.push('# DAILY BREAKDOWN');
  const header = [
    'Date',
    'Views',
    'Watch Time (hrs)',
    'Subs Gained',
    'Likes',
    'Comments',
    'Shares',
    'Impressions',
    'CTR (%)',
  ];
  if (totals.revenue > 0) header.push('Revenue (USD)');
  lines.push(header.join(','));

  for (const row of rows) {
    const m = row.metrics || {};
    const cols = [
      fmtDate(row.date),
      m.views || 0,
      ((m.estimatedMinutesWatched || 0) / 60).toFixed(1),
      m.subscribersGained || 0,
      m.likes || 0,
      m.comments || 0,
      m.shares || 0,
      m.impressions || 0,
      (m.impressionsCtr || 0).toFixed(2),
    ];
    if (totals.revenue > 0) cols.push((m.estimatedRevenue || 0).toFixed(2));
    lines.push(cols.join(','));
  }

  return lines.join('\n');
};

// ===================== PDF =====================

const BRAND = '#4F46E5'; // indigo brand color
const DARK = '#1E1B4B';
const GRAY = '#6B7280';
const LIGHT_BG = '#F5F3FF';

/**
 * Build a PDF Buffer from daily analytics rows.
 * @returns {Promise<Buffer>}
 */
const buildPdf = (rows, channelName, period) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100; // usable width
    const totals = summarise(rows);

    // ---- Header bar ----
    doc.rect(50, 30, W, 70).fill(BRAND);
    doc
      .fillColor('white')
      .font('Helvetica-Bold')
      .fontSize(20)
      .text('TubeOS Analytics Report', 65, 45);
    doc
      .fillColor('#C7D2FE')
      .font('Helvetica')
      .fontSize(10)
      .text(
        `${channelName}  •  ${periodLabel(period)}  •  Generated ${fmtDate(new Date())}`,
        65,
        74
      );

    // ---- Summary KPI boxes ----
    doc.moveDown(4);
    const kpis = [
      { label: 'Views', value: fmtNum(totals.views) },
      { label: 'Watch Time', value: fmtHours(totals.watchMins) },
      { label: 'Subs Gained', value: fmtNum(totals.subs) },
      { label: 'Likes', value: fmtNum(totals.likes) },
    ];
    if (totals.revenue > 0) kpis.push({ label: 'Revenue', value: `$${totals.revenue.toFixed(2)}` });

    const boxW = (W - (kpis.length - 1) * 10) / kpis.length;
    const boxY = 120;
    kpis.forEach((kpi, i) => {
      const x = 50 + i * (boxW + 10);
      doc.rect(x, boxY, boxW, 55).fill(LIGHT_BG);
      doc
        .fillColor(BRAND)
        .font('Helvetica-Bold')
        .fontSize(16)
        .text(kpi.value, x + 8, boxY + 8, { width: boxW - 16 });
      doc
        .fillColor(GRAY)
        .font('Helvetica')
        .fontSize(9)
        .text(kpi.label, x + 8, boxY + 36, { width: boxW - 16 });
    });

    // ---- Section title ----
    doc
      .fillColor(DARK)
      .font('Helvetica-Bold')
      .fontSize(12)
      .text('Daily Breakdown', 50, boxY + 75);
    doc
      .moveTo(50, boxY + 92)
      .lineTo(50 + W, boxY + 92)
      .strokeColor(BRAND)
      .lineWidth(1)
      .stroke();

    // ---- Table ----
    const tableTop = boxY + 100;
    const cols = [
      { label: 'Date', width: 72 },
      { label: 'Views', width: 55 },
      { label: 'Watch (h)', width: 58 },
      { label: 'Subs', width: 45 },
      { label: 'Likes', width: 45 },
      { label: 'Comments', width: 60 },
      { label: 'Impressions', width: 68 },
      { label: 'CTR', width: 42 },
    ];

    // Header row
    let cx = 50;
    doc.rect(50, tableTop, W, 18).fill(BRAND);
    cols.forEach((col) => {
      doc
        .fillColor('white')
        .font('Helvetica-Bold')
        .fontSize(8)
        .text(col.label, cx + 3, tableTop + 4, { width: col.width - 4 });
      cx += col.width;
    });

    // Data rows
    let rowY = tableTop + 18;
    const ROW_H = 16;
    let shade = false;

    for (const row of rows) {
      // New page if needed
      if (rowY + ROW_H > doc.page.height - 50) {
        doc.addPage();
        rowY = 50;
        // Repeat header
        cx = 50;
        doc.rect(50, rowY, W, 18).fill(BRAND);
        cols.forEach((col) => {
          doc
            .fillColor('white')
            .font('Helvetica-Bold')
            .fontSize(8)
            .text(col.label, cx + 3, rowY + 4, { width: col.width - 4 });
          cx += col.width;
        });
        rowY += 18;
      }

      const m = row.metrics || {};
      const values = [
        fmtDate(row.date),
        fmtNum(m.views),
        ((m.estimatedMinutesWatched || 0) / 60).toFixed(1),
        fmtNum(m.subscribersGained),
        fmtNum(m.likes),
        fmtNum(m.comments),
        fmtNum(m.impressions),
        fmtPct(m.impressionsCtr),
      ];

      if (shade) doc.rect(50, rowY, W, ROW_H).fill('#F9FAFB');
      shade = !shade;

      cx = 50;
      values.forEach((val, i) => {
        doc
          .fillColor('#374151')
          .font('Helvetica')
          .fontSize(8)
          .text(String(val), cx + 3, rowY + 3, { width: cols[i].width - 4 });
        cx += cols[i].width;
      });

      rowY += ROW_H;
    }

    // ---- Footer ----
    const footerY = doc.page.height - 35;
    doc
      .fillColor(GRAY)
      .font('Helvetica')
      .fontSize(8)
      .text('Generated by TubeOS • tubeos.saas@gmail.com', 50, footerY, {
        align: 'center',
        width: W,
      });

    doc.end();
  });
};

// ===================== REPORT PDF =====================

/**
 * Build a PDF for the weekly/monthly email report.
 * reportData is the object returned by gatherReportData / gatherMonthlyReportData.
 * @param {object} reportData
 * @param {object} user  — { name, email }
 * @returns {Promise<Buffer>}
 */
const buildReportPdf = (reportData, user) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const W = doc.page.width - 100;
    const { channel, kpis, topVideos, insights, actionItems, healthScore, weekRange, reportType } =
      reportData;
    const firstName = user?.name?.split(' ')[0] || 'Creator';
    const typeLabel = reportType === 'monthly' ? 'Monthly' : 'Weekly';

    // ---- Header ----
    doc.rect(50, 30, W, 75).fill('#1a1033');
    doc.fillColor('white').font('Helvetica-Bold').fontSize(22).text('⚡ TubeOS', 65, 44);
    doc
      .fillColor('#a78bfa')
      .font('Helvetica')
      .fontSize(11)
      .text(`${typeLabel} Creator Report`, 65, 72);
    doc
      .fillColor('rgba(255,255,255,0.5)')
      .fontSize(9)
      .text(`${channel?.name || ''} · ${weekRange}`, 65, 90);

    // ---- Greeting ----
    const greetY = 125;
    doc
      .fillColor('#111827')
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(
        kpis.subscribers.gained > 0
          ? `Great ${typeLabel.toLowerCase()}, ${firstName}! You gained +${kpis.subscribers.gained} subscribers.`
          : `Here's your ${typeLabel.toLowerCase()} summary, ${firstName}.`,
        50,
        greetY,
        { width: W }
      );

    // ---- KPI boxes ----
    const kpiY = greetY + 36;
    const kpiList = [
      {
        label: 'Views',
        value: fmtNum(kpis.views.value),
        change: kpis.views.change,
      },
      {
        label: 'Watch Time',
        value: `${Math.round(kpis.watchTime?.value || 0)}h`,
        change: kpis.watchTime?.change,
      },
      {
        label: 'Subs Gained',
        value: `+${kpis.subscribers.gained}`,
        change: kpis.subscribers.change,
      },
      {
        label: 'CTR',
        value: `${kpis.ctr.value}%`,
        change: kpis.ctr.change,
      },
    ];
    const kpiBoxW = (W - 15) / 4;
    kpiList.forEach((k, i) => {
      const x = 50 + i * (kpiBoxW + 5);
      doc.rect(x, kpiY, kpiBoxW, 56).fill('#F5F3FF');
      doc
        .fillColor(BRAND)
        .font('Helvetica-Bold')
        .fontSize(15)
        .text(k.value, x + 8, kpiY + 8, {
          width: kpiBoxW - 16,
        });
      doc
        .fillColor(GRAY)
        .font('Helvetica')
        .fontSize(8)
        .text(k.label, x + 8, kpiY + 32, {
          width: kpiBoxW - 16,
        });
      if (k.change != null) {
        const chgClr = k.change > 0 ? '#16a34a' : k.change < 0 ? '#dc2626' : GRAY;
        const arrow = k.change > 0 ? '↑' : k.change < 0 ? '↓' : '→';
        doc
          .fillColor(chgClr)
          .fontSize(8)
          .text(`${arrow} ${Math.abs(k.change)}%`, x + 8, kpiY + 42, { width: kpiBoxW - 16 });
      }
    });

    // ---- Top Videos ----
    let y = kpiY + 70;
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text('🏆 Top Performing Videos', 50, y);
    doc
      .moveTo(50, y + 16)
      .lineTo(50 + W, y + 16)
      .strokeColor(BRAND)
      .lineWidth(0.5)
      .stroke();
    y += 22;

    const vids = (topVideos || []).slice(0, 5);
    vids.forEach((v, i) => {
      doc
        .fillColor('#374151')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(`${i + 1}.`, 50, y, { width: 18 });
      doc
        .fillColor('#111827')
        .font('Helvetica')
        .fontSize(9)
        .text((v.title || '').slice(0, 65), 68, y, { width: W - 100 });
      doc
        .fillColor(GRAY)
        .fontSize(8)
        .text(
          `👁 ${fmtNum(v.performance?.views || 0)} views  ·  👍 ${fmtNum(v.performance?.likes || 0)} likes`,
          68,
          y + 12,
          { width: W - 100 }
        );
      y += 28;
    });

    if (!vids.length) {
      doc.fillColor(GRAY).font('Helvetica').fontSize(9).text('No published videos yet.', 50, y);
      y += 20;
    }

    // ---- AI Insights ----
    y += 8;
    if (y > doc.page.height - 150) {
      doc.addPage();
      y = 50;
    }
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text('✨ AI Insights', 50, y);
    doc
      .moveTo(50, y + 16)
      .lineTo(50 + W, y + 16)
      .strokeColor(BRAND)
      .lineWidth(0.5)
      .stroke();
    y += 22;

    const insClr = { accent: '#3b82f6', success: '#16a34a', warning: '#d97706' };
    (insights || []).forEach((ins) => {
      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 50;
      }
      const clr = insClr[ins.color] || GRAY;
      doc.rect(50, y, 3, 38).fill(clr);
      doc
        .fillColor('#111827')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text(ins.title || '', 60, y, { width: W - 10 });
      doc
        .fillColor('#4b5563')
        .font('Helvetica')
        .fontSize(8)
        .text(ins.body || '', 60, y + 14, { width: W - 10 });
      y += 48;
    });

    // ---- Action Items ----
    y += 4;
    if (y > doc.page.height - 130) {
      doc.addPage();
      y = 50;
    }
    doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11).text('📋 Action Plan', 50, y);
    doc
      .moveTo(50, y + 16)
      .lineTo(50 + W, y + 16)
      .strokeColor(BRAND)
      .lineWidth(0.5)
      .stroke();
    y += 22;

    (actionItems || []).forEach((item) => {
      doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text('✓', 50, y, { width: 16 });
      doc
        .fillColor('#374151')
        .font('Helvetica')
        .fontSize(9)
        .text(item, 66, y, { width: W - 16 });
      y += 18;
    });

    // ---- Health Score ----
    y += 10;
    if (y > doc.page.height - 60) {
      doc.addPage();
      y = 50;
    }
    const healthClr = healthScore >= 70 ? '#16a34a' : healthScore >= 40 ? '#d97706' : '#dc2626';
    doc.rect(50, y, W, 40).fill('#F9FAFB');
    doc
      .fillColor('#6b7280')
      .font('Helvetica')
      .fontSize(9)
      .text('Channel Health Score', 60, y + 8);
    doc
      .fillColor(healthClr)
      .font('Helvetica-Bold')
      .fontSize(14)
      .text(`${healthScore}/100`, 60, y + 20);
    const barW = Math.round((healthScore / 100) * (W - 120));
    doc.rect(W - 60, y + 14, barW, 12).fill(healthClr);

    // ---- Footer ----
    const footerY = doc.page.height - 35;
    doc
      .fillColor(GRAY)
      .font('Helvetica')
      .fontSize(8)
      .text(
        `Generated by TubeOS  •  ${new Date().toDateString()}  •  ${user?.email || ''}`,
        50,
        footerY,
        { align: 'center', width: W }
      );

    doc.end();
  });
};

module.exports = { getExportData, buildCsv, buildPdf, buildReportPdf, periodLabel, fmtDate };

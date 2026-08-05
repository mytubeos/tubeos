import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

// See tests/integration/auth.service.test.js for why createRequire is used
// instead of `import` for local project files under test.
const require = createRequire(import.meta.url);
const {
  getReportBrand,
  buildCsv,
  buildPdf,
  buildReportPdf,
} = require('../../src/services/export.service.js');

const row = (overrides = {}) => ({
  date: new Date('2026-08-01'),
  metrics: {
    views: 10,
    estimatedMinutesWatched: 60,
    subscribersGained: 1,
    likes: 2,
    comments: 1,
    shares: 0,
    impressions: 100,
    impressionsCtr: 5,
    ...overrides,
  },
});

describe('export.service.getReportBrand', () => {
  it('returns the company name + color for an entitled, enabled Agency user', () => {
    const brand = getReportBrand({
      plan: 'agency',
      branding: { enabled: true, companyName: 'Acme Media', primaryColor: '#111111' },
    });
    expect(brand).toEqual({ companyName: 'Acme Media', color: '#111111' });
  });

  it('returns empty when branding is disabled, even on Agency plan', () => {
    const brand = getReportBrand({
      plan: 'agency',
      branding: { enabled: false, companyName: 'Acme Media' },
    });
    expect(brand).toEqual({});
  });

  it('returns empty for a non-Agency plan even if branding.enabled is somehow true', () => {
    // Read-time gate — guards against a stale flag surviving a downgrade.
    const brand = getReportBrand({
      plan: 'pro',
      branding: { enabled: true, companyName: 'Acme Media' },
    });
    expect(brand).toEqual({});
  });

  it('omits empty fields rather than returning blank strings', () => {
    const brand = getReportBrand({ plan: 'agency', branding: { enabled: true } });
    expect(brand).toEqual({});
  });

  it('handles a user with no branding sub-object at all', () => {
    expect(getReportBrand({ plan: 'agency' })).toEqual({});
    expect(getReportBrand({})).toEqual({});
  });
});

describe('export.service.buildCsv — white-label substitution', () => {
  it('defaults to "Vezrin" when no brand is passed (regression guard)', () => {
    const csv = buildCsv([row()], 'Test Channel', '30d');
    expect(csv).toContain('# Vezrin Analytics Report');
  });

  it('uses the company name instead when a brand is passed', () => {
    const csv = buildCsv([row()], 'Test Channel', '30d', { companyName: 'Acme Media' });
    expect(csv).toContain('# Acme Media Analytics Report');
    expect(csv).not.toContain('Vezrin');
  });
});

describe('export.service.buildPdf / buildReportPdf — resolve cleanly with and without a brand', () => {
  // PDFKit's content streams aren't reliably plain-text-searchable (confirmed
  // empirically — even known-present strings don't show up in a raw buffer
  // scan), so these assert the functions still produce a real, valid PDF
  // rather than asserting on buffer contents.
  const isPdfBuffer = (buf) => Buffer.isBuffer(buf) && buf.subarray(0, 4).toString() === '%PDF';

  it('buildPdf resolves to a valid PDF with the default branding', async () => {
    const buf = await buildPdf([row()], 'Test Channel', '30d');
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it('buildPdf resolves to a valid PDF with a custom brand', async () => {
    const buf = await buildPdf([row()], 'Test Channel', '30d', {
      companyName: 'Acme Media',
      color: '#ff0000',
    });
    expect(isPdfBuffer(buf)).toBe(true);
  });

  it('buildReportPdf resolves to a valid PDF with and without a brand', async () => {
    const reportData = {
      channel: { name: 'Test Channel' },
      kpis: {
        views: { value: 1000, change: 5 },
        watchTime: { value: 20, change: 2 },
        subscribers: { gained: 10, change: 1 },
        ctr: { value: 4.5, change: 0.1 },
      },
      topVideos: [],
      insights: [],
      actionItems: [],
      milestones: [],
      bestTimes: [],
      healthScore: 80,
      weekRange: 'Aug 1 - Aug 7',
      reportType: 'weekly',
    };
    const user = { name: 'Raj', email: 'raj@example.com' };

    const defaultBuf = await buildReportPdf(reportData, user);
    expect(isPdfBuffer(defaultBuf)).toBe(true);

    const brandedBuf = await buildReportPdf(reportData, user, { companyName: 'Acme Media' });
    expect(isPdfBuffer(brandedBuf)).toBe(true);
  });
});

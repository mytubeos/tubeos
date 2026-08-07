import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/api/ai.api', () => ({
  aiApi: { analyzeSEO: vi.fn() },
}))

import { aiApi } from '../../src/api/ai.api'
import { SEOAnalysisPanel } from '../../src/components/features/SEOAnalysisPanel'

describe('SEOAnalysisPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('requires a title before analyzing', async () => {
    const user = userEvent.setup()
    render(<SEOAnalysisPanel title="" description="" tags="" />)

    await user.click(screen.getByRole('button', { name: /analyze seo/i }))

    expect(aiApi.analyzeSEO).not.toHaveBeenCalled()
  })

  it('analyzes with the title/description/tags-array payload from props', async () => {
    aiApi.analyzeSEO.mockResolvedValue({
      data: {
        data: {
          score: 72,
          titleScore: 80,
          descriptionScore: 60,
          tagsScore: 75,
          suggestions: [],
        },
      },
    })
    const user = userEvent.setup()
    render(
      <SEOAnalysisPanel
        title="How I grew 10k subs"
        description="A short story"
        tags="growth, youtube, tips"
      />
    )

    await user.click(screen.getByRole('button', { name: /analyze seo/i }))

    await waitFor(() =>
      expect(aiApi.analyzeSEO).toHaveBeenCalledWith({
        title: 'How I grew 10k subs',
        description: 'A short story',
        tags: ['growth', 'youtube', 'tips'],
      })
    )
  })

  it('shows the score, sub-scores and suggestions on success', async () => {
    aiApi.analyzeSEO.mockResolvedValue({
      data: {
        data: {
          score: 45,
          titleScore: 30,
          descriptionScore: 50,
          tagsScore: 55,
          suggestions: [{ area: 'title', issue: 'Too generic', fix: 'Add a number or hook' }],
        },
      },
    })
    const user = userEvent.setup()
    render(<SEOAnalysisPanel title="My Video" description="" tags="" />)

    await user.click(screen.getByRole('button', { name: /analyze seo/i }))

    expect(await screen.findByText('45')).toBeInTheDocument()
    expect(screen.getByText(/title 30/i)).toBeInTheDocument()
    expect(screen.getByText(/description 50/i)).toBeInTheDocument()
    expect(screen.getByText(/tags 55/i)).toBeInTheDocument()
    expect(screen.getByText('Too generic')).toBeInTheDocument()
    expect(screen.getByText(/add a number or hook/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /re-analyze seo/i })).toBeInTheDocument()
  })

  it('shows an error toast and no crash when the request fails', async () => {
    aiApi.analyzeSEO.mockRejectedValue({ response: { data: { message: 'Usage limit reached' } } })
    const user = userEvent.setup()
    render(<SEOAnalysisPanel title="My Video" description="" tags="" />)

    await user.click(screen.getByRole('button', { name: /analyze seo/i }))

    await waitFor(() => expect(aiApi.analyzeSEO).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/overall seo score/i)).not.toBeInTheDocument()
  })
})

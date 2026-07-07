import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/store/channelStore', () => ({
  useChannelStore: vi.fn(),
}))

vi.mock('../../src/api/ai.api', () => ({
  aiApi: {
    getInbox: vi.fn(),
    syncComments: vi.fn(),
    generateReply: vi.fn(),
    postReply: vi.fn(),
    bulkGenerateReplies: vi.fn(),
    updateCommentStatus: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const { CommentInbox } = await import('../../src/pages/comments/CommentInbox')
const { useChannelStore } = await import('../../src/store/channelStore')
const { aiApi } = await import('../../src/api/ai.api')
const toast = (await import('react-hot-toast')).default

const commentWithAiReply = {
  _id: 'comment1',
  authorName: 'Viewer One',
  text: 'Great video!',
  status: 'pending_reply',
  sentiment: { label: 'positive' },
  publishedAt: new Date().toISOString(),
  aiReply: { text: 'Thanks so much for watching!' },
}

beforeEach(() => {
  useChannelStore.mockReturnValue({ activeChannel: { _id: 'c1' } })
  aiApi.getInbox.mockResolvedValue({
    data: { data: [commentWithAiReply], meta: { stats: {}, pagination: { total: 1 } } },
  })
})

describe('CommentInbox — Post Reply regression', () => {
  // CommentInbox debounces its search box with a real 400ms setTimeout that
  // re-fetches and briefly flips back to the loading/shimmer view. Under CPU
  // contention that timer can fire mid-interaction, unmounting the button a
  // queued click was headed for and silently swallowing it. Fake timers
  // keep that debounce from firing on its own so the click sequence below
  // (expand card -> click Post Reply) is deterministic.
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // Regression test for a real bug: CommentCard's "Post Reply" button used to
  // be wired to dead state instead of calling aiApi.postReply, so clicking it
  // silently did nothing. This confirms the fix (CommentCard -> onPostReply
  // -> CommentInbox.handlePostReply -> aiApi.postReply) stays working.
  it('posts the reply to YouTube and marks the comment as replied', async () => {
    aiApi.postReply.mockResolvedValueOnce({})
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<CommentInbox />)

    const card = await screen.findByText('Viewer One')
    await user.click(card)

    const postButton = await screen.findByRole('button', { name: /post reply/i })
    await user.click(postButton)

    await waitFor(() => expect(aiApi.postReply).toHaveBeenCalledWith('comment1'))
    expect(toast.success).toHaveBeenCalledWith('Reply posted!')
    // "Replied" also appears as a status-filter button label, so scope to
    // the badge span the CommentCard renders next to the author name.
    await waitFor(() =>
      expect(screen.getByText('Replied', { selector: 'span' })).toBeInTheDocument()
    )
    expect(screen.queryByRole('button', { name: /post reply/i })).not.toBeInTheDocument()
  })

  it('shows an error toast when posting the reply fails', async () => {
    aiApi.postReply.mockRejectedValueOnce(new Error('YouTube API error'))
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
    render(<CommentInbox />)

    const card = await screen.findByText('Viewer One')
    await user.click(card)

    const postButton = await screen.findByRole('button', { name: /post reply/i })
    await user.click(postButton)

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('Failed to post reply'))
    expect(screen.queryByText('Replied', { selector: 'span' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /post reply/i })).toBeInTheDocument()
  })
})

describe('CommentInbox — empty states', () => {
  it('prompts to connect a channel when none is active', () => {
    useChannelStore.mockReturnValue({ activeChannel: null })
    render(<CommentInbox />)

    expect(screen.getByText('Connect a YouTube channel to manage comments')).toBeInTheDocument()
  })

  it('shows a "no comments found" state with a sync shortcut', async () => {
    aiApi.getInbox.mockResolvedValue({
      data: { data: [], meta: { stats: {}, pagination: { total: 0 } } },
    })
    render(<CommentInbox />)

    expect(await screen.findByText('No comments found')).toBeInTheDocument()
  })
})

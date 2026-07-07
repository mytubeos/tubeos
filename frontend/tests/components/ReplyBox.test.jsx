import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../src/api/ai.api', () => ({
  aiApi: {
    generateReply: vi.fn(),
    postReply: vi.fn(),
  },
}))

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}))

const { ReplyBox } = await import('../../src/components/features/ReplyBox')
const { aiApi } = await import('../../src/api/ai.api')
const toast = (await import('react-hot-toast')).default

describe('ReplyBox', () => {
  it('disables the Post button while the reply box is empty', () => {
    render(<ReplyBox commentId="c1" commentText="hi" />)

    expect(screen.getByRole('button', { name: /^post$/i })).toBeDisabled()
  })

  it('fills the textarea with the AI-generated reply', async () => {
    aiApi.generateReply.mockResolvedValueOnce({
      data: { data: { aiReply: { text: 'Thanks for the kind words!' } } },
    })
    const user = userEvent.setup()
    render(<ReplyBox commentId="c1" commentText="hi" />)

    await user.click(screen.getByRole('button', { name: /ai reply/i }))

    expect(await screen.findByDisplayValue('Thanks for the kind words!')).toBeInTheDocument()
    expect(aiApi.generateReply).toHaveBeenCalledWith('c1', 'friendly')
  })

  it('posts the typed reply and clears the box on success', async () => {
    aiApi.postReply.mockResolvedValueOnce({})
    const onReplied = vi.fn()
    const user = userEvent.setup()
    render(<ReplyBox commentId="c1" commentText="hi" onReplied={onReplied} />)

    await user.type(screen.getByPlaceholderText(/write a reply/i), 'Thank you!')
    await user.click(screen.getByRole('button', { name: /^post$/i }))

    expect(aiApi.postReply).toHaveBeenCalledWith('c1', 'Thank you!')
    expect(toast.success).toHaveBeenCalledWith('Reply posted to YouTube!')
    expect(await screen.findByPlaceholderText(/write a reply/i)).toHaveValue('')
    expect(onReplied).toHaveBeenCalled()
  })

  it('switches the tone used for the next AI generation', async () => {
    aiApi.generateReply.mockResolvedValueOnce({
      data: { data: { aiReply: { text: 'Haha nice one!' } } },
    })
    const user = userEvent.setup()
    render(<ReplyBox commentId="c1" commentText="hi" />)

    await user.click(screen.getByRole('button', { name: /funny/i }))
    await user.click(screen.getByRole('button', { name: /ai reply/i }))

    expect(aiApi.generateReply).toHaveBeenCalledWith('c1', 'funny')
  })
})

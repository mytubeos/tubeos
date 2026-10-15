import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { DeleteAccount } from '../../src/pages/DeleteAccount'
import { ContentReportButton } from '../../src/components/features/ContentReportButton'
import { useAuthStore } from '../../src/store/authStore'
import api from '../../src/api/axios'
vi.mock('../../src/api/axios', () => ({ default: { post: vi.fn() } }))
const renderPage = (element) => render(<MemoryRouter>{element}</MemoryRouter>)
beforeEach(() => {
  useAuthStore.setState({ user: { email: 'test@example.com' }, isAuthenticated: true })
})
describe('account and safety controls', () => {
  it('requires password and explicit confirmation before submitting deletion, then signs out', async () => {
    const user = userEvent.setup()
    api.post.mockResolvedValueOnce({ data: {} })
    renderPage(<DeleteAccount />)
    const button = screen.getByRole('button', { name: 'Delete my account' })
    expect(button).toBeDisabled()
    await user.type(screen.getByLabelText('Current password'), 'current-password')
    expect(button).toBeDisabled()
    await user.click(screen.getByRole('checkbox'))
    await user.click(button)
    await screen.findByRole('status')
    expect(api.post).toHaveBeenCalledWith('/auth/delete-account', { password: 'current-password' })
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
  it('provides an outside-app deletion path even when signed out', () => {
    useAuthStore.setState({ isAuthenticated: false, user: null })
    renderPage(<DeleteAccount />)
    expect(screen.getByRole('link', { name: 'hello@vezrin.com' }).getAttribute('href')).toContain(
      'mailto:'
    )
    expect(screen.getByRole('link', { name: /Sign in to request/ })).toHaveAttribute(
      'href',
      '/login'
    )
  })
  it('keeps a failed safety report open for retry and confirms only after the API accepts it', async () => {
    const user = userEvent.setup()
    api.post.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: {} })
    renderPage(<ContentReportButton />)
    await user.click(screen.getByRole('button', { name: 'Report AI content' }))
    await user.type(screen.getByLabelText('Report details'), 'The generated thumbnail was unsafe')
    await user.click(screen.getByRole('button', { name: 'Send report' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not send')
    expect(screen.getByLabelText('Report details')).toHaveValue(
      'The generated thumbnail was unsafe'
    )
    await user.click(screen.getByRole('button', { name: 'Send report' }))
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Report received'))
  })
})

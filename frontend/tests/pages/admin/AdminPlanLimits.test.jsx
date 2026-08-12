import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../src/api/admin.api', () => ({
  default: { getLimits: vi.fn(), updateLimits: vi.fn() },
}))

import adminAPI from '../../../src/api/admin.api'
import { AdminPlanLimits } from '../../../src/pages/admin/AdminPlanLimits'

const SAMPLE_LIMITS = {
  free: { uploads: 0, aiReplies: 10, aiContent: 20, bulkReplies: 0, thumbnailGen: 5 },
  creator: { uploads: 5, aiReplies: 500, aiContent: 500, bulkReplies: 0, thumbnailGen: 5 },
  pro: { uploads: 20, aiReplies: 1200, aiContent: 2000, bulkReplies: 100, thumbnailGen: 15 },
  agency: {
    uploads: null,
    aiReplies: null,
    aiContent: null,
    bulkReplies: null,
    thumbnailGen: 50,
  },
}

describe('AdminPlanLimits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    adminAPI.getLimits.mockResolvedValue({ data: { data: SAMPLE_LIMITS } })
  })

  it('renders every plan with its real limits, showing Unlimited for null fields', async () => {
    render(<AdminPlanLimits />)

    await screen.findByText('Free')
    expect(screen.getByText('Creator')).toBeInTheDocument()
    expect(screen.getByText('Pro')).toBeInTheDocument()
    expect(screen.getByText('Max')).toBeInTheDocument() // agency's display name

    const agencyRow = screen.getByText('Max').closest('tr')
    // agency: everything unlimited except thumbnailGen (50)
    expect(within(agencyRow).getAllByText('Unlimited')).toHaveLength(4)
    expect(within(agencyRow).getByText('50')).toBeInTheDocument()

    const freeRow = screen.getByText('Free').closest('tr')
    expect(within(freeRow).getByText('20')).toBeInTheDocument() // aiContent
    expect(within(freeRow).getByText('5')).toBeInTheDocument() // thumbnailGen
  })

  it('opens the edit modal pre-filled with the current values', async () => {
    const user = userEvent.setup()
    render(<AdminPlanLimits />)
    await screen.findByText('Creator')

    const creatorRow = screen.getByText('Creator').closest('tr')
    await user.click(within(creatorRow).getByTitle('Edit'))

    expect(screen.getByText('Edit Creator limits')).toBeInTheDocument()
    expect(screen.getByLabelText('AI Content/mo')).toHaveValue(500)
    expect(screen.getByLabelText('Uploads/mo')).toHaveValue(5)
  })

  it('disables the number input and submits null when Unlimited is checked', async () => {
    const user = userEvent.setup()
    adminAPI.updateLimits.mockResolvedValue({ data: { data: {} } })
    render(<AdminPlanLimits />)
    await screen.findByText('Pro')

    await user.click(within(screen.getByText('Pro').closest('tr')).getByTitle('Edit'))

    const aiContentInput = screen.getByLabelText('AI Content/mo')
    const unlimitedCheckboxes = screen.getAllByRole('checkbox')
    // AI Content is the 3rd field (uploads, aiReplies, aiContent, bulkReplies, thumbnailGen)
    await user.click(unlimitedCheckboxes[2])

    expect(aiContentInput).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(adminAPI.updateLimits).toHaveBeenCalledWith(
        'pro',
        expect.objectContaining({ aiContent: null })
      )
    )
  })

  it('edits a plain number field and saves the full payload', async () => {
    const user = userEvent.setup()
    adminAPI.updateLimits.mockResolvedValue({ data: { data: {} } })
    render(<AdminPlanLimits />)
    await screen.findByText('Free')

    await user.click(within(screen.getByText('Free').closest('tr')).getByTitle('Edit'))

    const thumbInput = screen.getByLabelText('Thumbnails/mo')
    await user.clear(thumbInput)
    await user.type(thumbInput, '8')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    await waitFor(() =>
      expect(adminAPI.updateLimits).toHaveBeenCalledWith(
        'free',
        expect.objectContaining({ thumbnailGen: 8, aiContent: 20 })
      )
    )
  })

  it('rejects a negative value without calling the API', async () => {
    const user = userEvent.setup()
    render(<AdminPlanLimits />)
    await screen.findByText('Free')

    await user.click(within(screen.getByText('Free').closest('tr')).getByTitle('Edit'))

    const uploadsInput = screen.getByLabelText('Uploads/mo')
    await user.clear(uploadsInput)
    await user.type(uploadsInput, '-3')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(adminAPI.updateLimits).not.toHaveBeenCalled()
  })
})

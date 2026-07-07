import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Modal, ConfirmModal } from '../../src/components/ui/Modal'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={() => {}} title="Hello">
        content
      </Modal>
    )

    expect(container).toBeEmptyDOMElement()
  })

  it('renders the title and children when open', () => {
    render(
      <Modal isOpen onClose={() => {}} title="Edit video">
        <p>Body content</p>
      </Modal>
    )

    expect(screen.getByText('Edit video')).toBeInTheDocument()
    expect(screen.getByText('Body content')).toBeInTheDocument()
  })

  it('calls onClose when the close (X) button is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal isOpen onClose={onClose} title="Edit video">
        content
      </Modal>
    )

    await user.click(screen.getByRole('button'))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when the Escape key is pressed', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <Modal isOpen onClose={onClose} title="Edit video">
        content
      </Modal>
    )

    await user.keyboard('{Escape}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('locks body scroll while open and restores it on close', () => {
    const { rerender } = render(
      <Modal isOpen onClose={() => {}} title="Edit video">
        content
      </Modal>
    )
    expect(document.body.style.overflow).toBe('hidden')

    rerender(
      <Modal isOpen={false} onClose={() => {}} title="Edit video">
        content
      </Modal>
    )
    expect(document.body.style.overflow).toBe('')
  })
})

describe('ConfirmModal', () => {
  it('calls onConfirm from the confirm button and onClose from cancel', async () => {
    const onConfirm = vi.fn()
    const onClose = vi.fn()
    const user = userEvent.setup()
    render(
      <ConfirmModal
        isOpen
        onClose={onClose}
        onConfirm={onConfirm}
        title="Delete video?"
        confirmLabel="Delete"
      />
    )

    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

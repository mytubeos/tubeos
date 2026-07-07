import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Input, Select } from '../../src/components/ui/Input'

describe('Input', () => {
  it('renders the label and calls onChange when typed into', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(<Input label="Email" name="email" value="" onChange={onChange} />)

    await user.type(screen.getByLabelText('Email'), 'a')

    expect(onChange).toHaveBeenCalled()
  })

  it('marks required fields with an asterisk', () => {
    render(<Input label="Email" name="email" value="" onChange={() => {}} required />)

    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('shows an error message instead of the hint when both are set', () => {
    render(
      <Input
        label="Email"
        name="email"
        value=""
        onChange={() => {}}
        error="Invalid email"
        hint="We'll never share this"
      />
    )

    expect(screen.getByText('Invalid email')).toBeInTheDocument()
    expect(screen.queryByText("We'll never share this")).not.toBeInTheDocument()
  })

  it('disables the input when disabled is set', () => {
    render(<Input label="Email" name="email" value="" onChange={() => {}} disabled />)

    expect(screen.getByLabelText('Email')).toBeDisabled()
  })
})

describe('Select', () => {
  it('renders all provided options and reflects the selected value', () => {
    render(
      <Select
        label="Plan"
        name="plan"
        value="pro"
        onChange={() => {}}
        options={[
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
        ]}
      />
    )

    expect(screen.getByRole('combobox', { name: 'Plan' })).toHaveValue('pro')
    expect(screen.getByRole('option', { name: 'Free' })).toBeInTheDocument()
  })

  it('calls onChange when a new option is selected', async () => {
    const onChange = vi.fn()
    const user = userEvent.setup()
    render(
      <Select
        label="Plan"
        name="plan"
        value="free"
        onChange={onChange}
        options={[
          { value: 'free', label: 'Free' },
          { value: 'pro', label: 'Pro' },
        ]}
      />
    )

    await user.selectOptions(screen.getByRole('combobox', { name: 'Plan' }), 'pro')

    expect(onChange).toHaveBeenCalled()
  })
})

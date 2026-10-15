import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { AxiosError } from 'axios'
import api from '../../src/api/axios'
import { useAuthStore } from '../../src/store/authStore'
import { Login } from '../../src/pages/auth/Login'

const originalAdapter = api.defaults.adapter
afterEach(() => {
  api.defaults.adapter = originalAdapter
  useAuthStore.setState({ user: null, accessToken: null, isAuthenticated: false, isLoading: false })
})

describe('login with the real auth store and HTTP interceptors', () => {
  it('shows a 401 error, retains input, and permits a successful retry into dashboard', async () => {
    let attempts = 0
    api.defaults.adapter = async (config) => {
      attempts++
      if (attempts === 1)
        throw new AxiosError('Unauthorized', 'ERR_BAD_REQUEST', config, null, {
          status: 401,
          data: { message: 'Invalid email or password' },
          config,
        })
      return {
        status: 200,
        config,
        headers: {},
        data: {
          data: {
            user: { _id: 'test-user', name: 'Test user' },
            accessToken: 'test-access',
            refreshToken: 'test-refresh',
          },
        },
      }
    }
    const user = userEvent.setup()
    render(
      <MemoryRouter initialEntries={['/login']}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<h1>Dashboard reached</h1>} />
        </Routes>
      </MemoryRouter>
    )
    await user.type(screen.getByLabelText('Email Address'), 'review-test@example.com')
    await user.type(screen.getByLabelText('Password'), 'incorrect-test-password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    expect(await screen.findByText('Invalid email or password')).toBeInTheDocument()
    expect(screen.getByLabelText('Email Address')).toHaveValue('review-test@example.com')
    expect(screen.getByLabelText('Password')).toHaveValue('incorrect-test-password')
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled()
    await user.clear(screen.getByLabelText('Password'))
    await user.type(screen.getByLabelText('Password'), 'correct-test-password')
    await user.click(screen.getByRole('button', { name: 'Sign In' }))
    await waitFor(() => expect(screen.getByText('Dashboard reached')).toBeInTheDocument())
    expect(localStorage.getItem('accessToken')).toBe('test-access')
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(attempts).toBe(2)
  })
})

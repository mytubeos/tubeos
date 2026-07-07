import { defineConfig } from '@vite-pwa/assets-generator/config'

export default defineConfig({
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[64, 'favicon.ico']],
    },
    maskable: {
      sizes: [512],
      padding: 0.1,
      resizeOptions: { background: '#06060A' },
    },
    apple: {
      sizes: [180],
      padding: 0.1,
      resizeOptions: { background: '#06060A' },
    },
  },
  images: ['public/icon.svg'],
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-vite-plugin'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    TanStackRouterVite({
      routesDirectory: './app/routes',
      generatedRouteTree: './app/routeTree.gen.ts',
    }),
  ],
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './app'),
    },
    extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
  },
  optimizeDeps: {
    exclude: ['convex', '@pathfinder-ide/react'],
    include: [
      'convex/react',
      '@react-three/fiber',
      '@react-three/drei',
      '@react-three/postprocessing',
      'three',
    ],
  },
  server: {
    port: 3000,
    fs: {
      // Use strict mode and only allow current directory
      strict: true,
      allow: [path.resolve(__dirname)],
      // Explicitly deny backend directory
      deny: [path.resolve(__dirname, 'backend')],
    },
    watch: {
      ignored: [
        '**/backend/**',
        '**/venv/**',
        '**/.venv/**',
        '**/node_modules/**',
        '**/backend/**/*',
      ],
    },
  },
})

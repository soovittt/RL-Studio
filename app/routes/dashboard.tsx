import { createFileRoute, Navigate } from '@tanstack/react-router'
import { Dashboard } from '~/components/Dashboard'

export const Route = createFileRoute('/dashboard')({
  component: Dashboard,
})

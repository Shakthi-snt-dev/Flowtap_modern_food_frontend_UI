import React from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAppSelector } from '@flowtap/store'
import { PageLoader } from '../components/common/Spinner'

interface ProtectedRouteProps {
  requireTenant?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requireTenant = false }) => {
  const { token, isLoading } = useAppSelector((s) => s.auth)
  const { tenant, bootstrapped } = useAppSelector((s) => s.tenant)

  if (isLoading) return <PageLoader />
  if (!token) return <Navigate to="/login" replace />
  if (requireTenant && !bootstrapped) return <PageLoader />
  if (requireTenant && !tenant) return <Navigate to="/onboarding" replace />
  return <Outlet />
}

export const OnboardingRoute: React.FC = () => {
  const { token } = useAppSelector((s) => s.auth)
  const { tenant, bootstrapped } = useAppSelector((s) => s.tenant)

  if (!token) return <Navigate to="/login" replace />
  if (!bootstrapped) return <PageLoader />
  if (tenant) return <Navigate to="/" replace />
  return <Outlet />
}

export const GuestRoute: React.FC = () => {
  const { token } = useAppSelector((s) => s.auth)
  if (token) return <Navigate to="/" replace />
  return <Outlet />
}

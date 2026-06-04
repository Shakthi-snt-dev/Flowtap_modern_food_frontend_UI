import React, { useEffect, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { MailCheck, ArrowLeft, Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { authApi } from '@flowtap/api-core'
import toast from 'react-hot-toast'

export const VerifyEmailPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'idle' | 'verifying' | 'success' | 'error'>(
    token ? 'verifying' : 'idle'
  )
  const [isResending, setIsResending] = useState(false)

  useEffect(() => {
    if (token) {
      handleVerify(token)
    }
  }, [token])

  const handleVerify = async (t: string) => {
    setStatus('verifying')
    try {
      await authApi.verifyEmail(t)
      setStatus('success')
      toast.success('Email verified successfully!')
    } catch {
      setStatus('error')
      toast.error('Verification failed. The link may be invalid or expired.')
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    try {
      const email = localStorage.getItem('pendingEmail') ?? ''
      await authApi.resendVerification(email)
      toast.success('Verification email sent!')
    } catch {
      toast.error('Failed to resend email. Please try again.')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
      <div className="w-full max-w-md">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-10 text-center">
          
          {status === 'verifying' && (
            <>
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <Loader2 className="w-10 h-10 text-blue-600 dark:text-blue-400 animate-spin" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Verifying your email</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-8">Please wait while we validate your link...</p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Email Verified!</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-8">Your account is now active. You can now login to your dashboard.</p>
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors"
              >
                Go to Login
              </button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Verification Failed</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-8">The link is invalid or has expired. Please request a new verification link below.</p>
              <button
                onClick={handleResend}
                disabled={isResending}
                className="w-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-4"
              >
                {isResending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isResending ? 'Sending...' : 'Resend Verification Link'}
              </button>
            </>
          )}

          {status === 'idle' && (
            <>
              <div className="w-20 h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                <MailCheck className="w-10 h-10 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">Check your email</h1>
              <p className="text-gray-500 dark:text-gray-400 mb-2">We sent a verification link to your email address.</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mb-8">Click the link in the email to verify your account.</p>
              <button
                onClick={handleResend}
                disabled={isResending}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mb-4"
              >
                {isResending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isResending ? 'Sending...' : 'Resend email'}
              </button>
            </>
          )}

          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}

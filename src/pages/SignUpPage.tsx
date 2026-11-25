import { Navigate, useLocation } from 'react-router-dom'

// Sign in and sign up share one email-code form on /sign-in.
export default function SignUpPage() {
  const { search } = useLocation()
  return <Navigate to={`/sign-in${search}`} replace />
}

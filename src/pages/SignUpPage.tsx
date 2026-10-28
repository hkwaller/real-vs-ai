import { Navigate, useLocation } from 'react-router-dom'

export default function SignUpPage() {
  const { search } = useLocation()
  return <Navigate to={`/sign-in${search}`} replace />
}

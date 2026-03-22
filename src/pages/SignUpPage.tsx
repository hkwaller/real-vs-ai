import React from 'react'
import { SignUp } from '@clerk/react'
import GameLayout from '@/components/GameLayout'

const SignUpPage: React.FC = () => (
  <GameLayout>
    <div className="flex justify-center">
      <SignUp routing="path" path="/sign-up" fallbackRedirectUrl="/dashboard" />
    </div>
  </GameLayout>
)

export default SignUpPage

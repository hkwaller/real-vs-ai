import React from 'react'
import { SignIn } from '@clerk/react'
import GameLayout from '@/components/GameLayout'

const SignInPage: React.FC = () => (
  <GameLayout>
    <div className="flex justify-center">
      <SignIn routing="path" path="/sign-in" fallbackRedirectUrl="/dashboard" />
    </div>
  </GameLayout>
)

export default SignInPage

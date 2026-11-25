import React from 'react'
import { SignIn } from '@clerk/react'
import GameLayout from '@/components/GameLayout'
import { clerkAppearance } from '@/lib/clerkAppearance'

const SignInPage: React.FC = () => (
  <GameLayout>
    <div className="flex justify-center">
      <SignIn
        withSignUp
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl="/dashboard"
        appearance={clerkAppearance}
      />
    </div>
  </GameLayout>
)

export default SignInPage

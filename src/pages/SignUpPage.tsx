import React from 'react'
import { SignUp } from '@clerk/react'
import GameLayout from '@/components/GameLayout'
import { clerkAppearance } from '@/lib/clerkAppearance'

const SignUpPage: React.FC = () => (
  <GameLayout>
    <div className="flex justify-center">
      <SignUp
        routing="path"
        path="/sign-up"
        fallbackRedirectUrl="/dashboard"
        appearance={clerkAppearance}
      />
    </div>
  </GameLayout>
)

export default SignUpPage

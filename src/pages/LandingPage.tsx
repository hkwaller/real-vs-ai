import React from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, Variants } from 'framer-motion'
import { useAuth, UserButton } from '@clerk/react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import GameLayout from '@/components/GameLayout'
import DailyChallengeCard from '@/components/DailyChallengeCard'
import { User, Zap, LayoutDashboard } from 'lucide-react'

const LandingPage: React.FC = () => {
  const navigate = useNavigate()
  const { isSignedIn, isLoaded } = useAuth()

  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  }

  const itemVariants: Variants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: 'spring',
        stiffness: 100,
      },
    },
  }

  return (
    <GameLayout>
      {/* Top-right auth nav */}
      {isLoaded && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-3">
          {isSignedIn ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-sm"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Button>
              <UserButton />
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/sign-in')}
              className="text-sm"
            >
              Sign In
            </Button>
          )}
        </div>
      )}

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="flex flex-col items-center text-center space-y-8"
      >
        <motion.div variants={itemVariants} className="space-y-2">
          <h1 className="text-6xl md:text-8xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 drop-shadow-lg">
            Real vs AI
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            Can you tell the difference? Challenge your friends in the ultimate Turing Test game.
          </p>
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl"
        >
          <Card
            className="text-white group hover:border-indigo-500/50 transition-colors cursor-pointer"
            onClick={() => navigate('/create')}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <Zap className="w-6 h-6 text-yellow-400 group-hover:animate-pulse" />
                Host Game
              </CardTitle>
              <CardDescription>
                Create a room and invite players
                <span className="block mt-1 text-green-400/80">First 3 games free — no account needed</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="neon" size="xl" className="w-full">
                Create Game
              </Button>
            </CardContent>
          </Card>

          <Card
            className="group hover:border-pink-500/50 transition-colors cursor-pointer text-white"
            onClick={() => navigate('/join')}
          >
            <CardHeader>
              <CardTitle className="flex items-center justify-center gap-2 text-2xl">
                <User className="w-6 h-6 text-pink-400 group-hover:animate-bounce" />
                Join Game
              </CardTitle>
              <CardDescription>Enter a code to join a lobby</CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                size="xl"
                className="w-full hover:bg-pink-500/10 hover:text-pink-400 hover:border-pink-500/50 text-black"
              >
                Join Room
              </Button>
            </CardContent>
          </Card>

          <DailyChallengeCard />
        </motion.div>

        <motion.div
          variants={itemVariants}
          className="pt-8 flex gap-8 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span>Live Multiplayer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            <span>Realtime Voting</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
            <span>Global Leaderboard</span>
          </div>
        </motion.div>
      </motion.div>
    </GameLayout>
  )
}

export default LandingPage

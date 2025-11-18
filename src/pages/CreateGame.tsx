import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import GameLayout from '@/components/GameLayout';
import { supabase } from '@/lib/supabase';
import { Loader2, Settings, Clock, Images, Play } from 'lucide-react';

const CreateGame: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [rounds, setRounds] = useState<number | string>(5);
  const [timeLimit, setTimeLimit] = useState<number | string>(15);

  const generateGameCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreateGame = async () => {
    setLoading(true);
    const code = generateGameCode();

    try {
      const { error } = await supabase
        .from('real_vs_ai_games')
        .insert([
          {
            id: code,
            status: 'waiting',
            settings: {
              rounds: Number(rounds),
              timeLimit: Number(timeLimit),
            },
            current_round: 0
          }
        ]);

      if (error) throw error;

      // Also create the rounds now? Or later?
      // For now, let's just go to lobby. We can generate rounds when starting the game.
      navigate(`/lobby/${code}`);
    } catch (error) {
      console.error('Error creating game:', error);
      alert('Failed to create game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GameLayout>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-6 h-6 text-indigo-400" />
              Game Settings
            </CardTitle>
            <CardDescription>Configure your match</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Images className="w-4 h-4 text-muted-foreground" />
                Number of Rounds
              </label>
              <Input
                type="number"
                min="1"
                max="20"
                value={rounds}
                onChange={(e) => setRounds(e.target.value)}
                className="bg-slate-900/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" />
                Time Limit (seconds)
              </label>
              <Input
                type="number"
                min="5"
                max="60"
                value={timeLimit}
                onChange={(e) => setTimeLimit(e.target.value)}
                className="bg-slate-900/50"
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="neon" 
              size="lg" 
              className="w-full" 
              onClick={handleCreateGame}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Create Lobby
                </>
              )}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </GameLayout>
  );
};

export default CreateGame;

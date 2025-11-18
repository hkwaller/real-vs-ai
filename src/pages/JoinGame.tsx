import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import GameLayout from '@/components/GameLayout';
import { supabase } from '@/lib/supabase';
import { Loader2, UserPlus, Smile } from 'lucide-react';

const EMOJIS = ['😀', '😎', '🤖', '👻', '👽', '👾', '🐱', '🐶', '🦊', '🦁', '🦄', '🐲'];

const JoinGame: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [code, setCode] = useState(searchParams.get('code') || '');
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(EMOJIS[0]);
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code || !name) return;
    setLoading(true);

    try {
      // Check if game exists
      const { data: game, error: gameError } = await supabase
        .from('real_vs_ai_games')
        .select('id')
        .eq('id', code.toUpperCase())
        .single();

      if (gameError || !game) {
        alert('Game not found!');
        setLoading(false);
        return;
      }

      // Join game
      const { data: player, error: playerError } = await supabase
        .from('real_vs_ai_players')
        .insert([
          {
            game_id: code.toUpperCase(),
            name: name,
            emoji: selectedEmoji
          }
        ])
        .select()
        .single();

      if (playerError) throw playerError;

      // Save player ID to local storage so we can identify them later
      localStorage.setItem('real_vs_ai_player_id', player.id);
      localStorage.setItem('real_vs_ai_game_id', code.toUpperCase());

      navigate(`/play/${code.toUpperCase()}`);
    } catch (error) {
      console.error('Error joining game:', error);
      alert('Failed to join game. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <GameLayout>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md mx-auto"
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="w-6 h-6 text-pink-400" />
              Join Game
            </CardTitle>
            <CardDescription>Enter your details to join the fun</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Game Code</label>
              <Input
                placeholder="ABCD"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="text-center text-2xl tracking-widest uppercase font-mono bg-slate-900/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Your Name</label>
              <Input
                placeholder="Enter your name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={12}
                className="bg-slate-900/50"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Smile className="w-4 h-4 text-muted-foreground" />
                Choose Avatar
              </label>
              <div className="grid grid-cols-6 gap-2">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedEmoji(emoji)}
                    className={`text-2xl p-2 rounded-lg transition-all ${
                      selectedEmoji === emoji 
                        ? 'bg-indigo-500/20 ring-2 ring-indigo-500 scale-110' 
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              variant="neon" 
              size="lg" 
              className="w-full" 
              onClick={handleJoin}
              disabled={loading || !code || !name}
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                'Join Game'
              )}
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </GameLayout>
  );
};

export default JoinGame;

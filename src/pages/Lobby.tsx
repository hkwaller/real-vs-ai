import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import GameLayout from '@/components/GameLayout';
import { supabase } from '@/lib/supabase';
import { Users, Play, Check } from 'lucide-react';

interface Player {
  id: string;
  name: string;
  emoji: string;
  game_id: string;
  score: number;
}

const Lobby: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!code) return;

    // Fetch initial players
    const fetchPlayers = async () => {
      const { data } = await supabase
        .from('real_vs_ai_players')
        .select('*')
        .eq('game_id', code);
      if (data) setPlayers(data as Player[]);
    };

    fetchPlayers();

    // Subscribe to new players
    const channel = supabase
      .channel('lobby_players')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'real_vs_ai_players',
        filter: `game_id=eq.${code}`
      }, (payload) => {
        setPlayers((current) => [...current, payload.new as Player]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  const copyCode = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const startGame = async () => {
    if (!code) return;
    // Update game status to playing
    await supabase
      .from('real_vs_ai_games')
      .update({ status: 'playing' })
      .eq('id', code);
    
    navigate(`/game/${code}`);
  };

  const joinUrl = `${window.location.origin}/join?code=${code}`;

  return (
    <GameLayout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-5xl">
        {/* Left Column: Game Info & QR */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="space-y-6"
        >
          <Card className="h-full flex flex-col justify-center items-center text-center p-8 space-y-6">
            <div>
              <h2 className="text-xl text-muted-foreground uppercase tracking-widest mb-2">Join Code</h2>
              <div 
                className="text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 cursor-pointer hover:scale-105 transition-transform"
                onClick={copyCode}
              >
                {code}
              </div>
              {copied && <span className="text-green-400 text-sm flex items-center justify-center gap-1 mt-2"><Check className="w-3 h-3"/> Copied!</span>}
            </div>

            <div className="p-4 bg-white rounded-xl shadow-2xl shadow-indigo-500/20">
              <QRCodeSVG value={joinUrl} size={200} />
            </div>

            <p className="text-sm text-muted-foreground">Scan to join</p>
          </Card>
        </motion.div>

        {/* Right Column: Player List */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col h-full"
        >
          <Card className="flex-1 flex flex-col text-white">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className="w-6 h-6 text-indigo-400" />
                  Players Joined
                </div>
                <span className="bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full text-sm">
                  {players.length}
                </span>
              </CardTitle>
              <CardDescription>Waiting for everyone to join...</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto min-h-[300px]">
              <div className="grid grid-cols-2 gap-3">
                <AnimatePresence>
                  {players.map((player) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="bg-slate-900/50 border border-slate-800 p-3 rounded-lg flex items-center gap-3"
                    >
                      <span className="text-2xl">{player.emoji}</span>
                      <span className="font-medium truncate">{player.name}</span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {players.length === 0 && (
                  <div className="col-span-2 text-center text-muted-foreground py-10 italic">
                    Waiting for players...
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter className="pt-6">
              <Button 
                variant="neon" 
                size="xl" 
                className="w-full" 
                onClick={startGame}
                disabled={players.length === 0}
              >
                <Play className="mr-2 h-5 w-5" />
                Start Game
              </Button>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </GameLayout>
  );
};

export default Lobby;

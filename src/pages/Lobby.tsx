import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useUser } from '@clerk/react';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import GameLayout from '@/components/GameLayout';
import { Users, Play, Check } from 'lucide-react';
import {
  RoomProvider,
  useOthers,
  useMutation,
  useStatus,
  useStorage,
  LiveList,
  LiveMap,
  LiveObject,
} from '@/liveblocks.config';

interface GameSettings {
  rounds: number;
  timeLimit: number;
  revealMode: 'instant' | 'after_round';
}

// Inner component that uses Liveblocks hooks
const LobbyContent: React.FC<{ code: string; settings: GameSettings; isSubscribed: boolean }> = ({ code, settings, isSubscribed }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  // Real-time player list from Liveblocks presence (non-host connections)
  const others = useOthers();
  const players = others
    .filter((o) => !o.presence.isHost)
    .map((o) => ({
      id: o.presence.playerId,
      name: o.presence.name,
      emoji: o.presence.emoji,
    }));

  // Gate mutations on WebSocket being fully connected AND storage hydrated from server.
  // status === 'connected' fires when the socket opens, but storage arrives slightly later.
  const status = useStatus();
  const storageLoaded = useStorage((root) => root.gameStatus) !== null;
  const isReady = status === 'connected' && storageLoaded;

  // Actively write settings to storage once connected — don't rely on initialStorage,
  // which is ignored if a stale room already exists on the Liveblocks server.
  const writeSettings = useMutation(
    ({ storage }, s: GameSettings) => {
      const settingsObj = storage.get('settings');
      settingsObj.set('rounds', s.rounds);
      settingsObj.set('timeLimit', s.timeLimit);
      settingsObj.set('revealMode', s.revealMode);
    },
    [],
  );

  const writeHostIsPro = useMutation(
    ({ storage }, pro: boolean) => {
      storage.get('hostIsPro').set('value', pro);
    },
    [],
  );

  useEffect(() => {
    if (!isReady) return;
    writeSettings(settings);
    writeHostIsPro(isSubscribed);
  }, [isReady]);

  const startGame = useMutation(({ storage }) => {
    storage.get('gameStatus').set('value', 'playing');
  }, []);

  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleStart = () => {
    if (!isReady) return;
    startGame();
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
              {copied && (
                <span className="text-green-400 text-sm flex items-center justify-center gap-1 mt-2">
                  <Check className="w-3 h-3" /> Copied!
                </span>
              )}
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
                onClick={handleStart}
                disabled={players.length === 0 || !isReady}
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

// Outer component that mounts RoomProvider
const Lobby: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const { user } = useUser();
  const settings = (location.state as GameSettings | null) ?? {
    rounds: 10,
    timeLimit: 15,
    revealMode: 'instant' as const,
  };

  const isSubscribed =
    (user?.publicMetadata as { subscriptionStatus?: string } | undefined)?.subscriptionStatus ===
    'active';

  if (!code) return null;

  return (
    <RoomProvider
      id={code}
      initialPresence={{
        name: 'Host',
        emoji: '👑',
        playerId: 'host',
        isHost: true,
        hasVoted: false,
        currentVote: null,
        timeRemaining: null,
      }}
      initialStorage={{
        gameStatus: new LiveObject({ value: 'waiting' }),
        settings: new LiveObject({
          rounds: settings.rounds,
          timeLimit: settings.timeLimit,
          revealMode: settings.revealMode,
        }),
        currentRoundIndex: new LiveObject({ value: 0 }),
        rounds: new LiveList([]),
        votes: new LiveMap(),
        scores: new LiveMap(),
        players: new LiveList([]),
        hostIsPro: new LiveObject({ value: false }),
      }}
    >
      <LobbyContent code={code} settings={settings} isSubscribed={isSubscribed} />
    </RoomProvider>
  );
};

export default Lobby;

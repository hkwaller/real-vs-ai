import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import GameLayout from '@/components/GameLayout';
import { Users, Play, Check, Copy, Rocket } from 'lucide-react';
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

const LobbyContent: React.FC<{ code: string; settings: GameSettings }> = ({ code, settings }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const others = useOthers();
  const players = others
    .filter((o) => !o.presence.isHost)
    .map((o) => ({
      id: o.presence.playerId,
      name: o.presence.name,
      emoji: o.presence.emoji,
    }));

  const status = useStatus();
  const storageLoaded = useStorage((root) => root.gameStatus) !== null;
  const isReady = status === 'connected' && storageLoaded;

  const writeSettings = useMutation(
    ({ storage }, s: GameSettings) => {
      const settingsObj = storage.get('settings');
      settingsObj.set('rounds', s.rounds);
      settingsObj.set('timeLimit', s.timeLimit);
      settingsObj.set('revealMode', s.revealMode);
    },
    [],
  );

  useEffect(() => {
    if (!isReady) return;
    writeSettings(settings);
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {/* Left: Code + QR */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
        >
          <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-8 flex flex-col items-center gap-8">
            <div className="text-center">
              <p className="mission-label mb-3">Mission Code</p>
              <div
                className="font-space-mono text-7xl font-bold text-[#FF6B1A] tracking-[0.15em] cursor-pointer hover:text-[#FF8C42] transition-colors text-glow-orange"
                onClick={copyCode}
              >
                {code}
              </div>
              <button
                onClick={copyCode}
                className="mt-3 flex items-center gap-2 mx-auto font-orbitron text-xs text-[#8B97C8] hover:text-[#F5F0E8] transition-colors uppercase tracking-widest"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-[#00FFE5]" />
                    <span className="text-[#00FFE5]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    Copy Code
                  </>
                )}
              </button>
            </div>

            <div className="p-3 bg-white border-4 border-[#FF6B1A]">
              <QRCodeSVG value={joinUrl} size={160} />
            </div>

            <p className="font-space-mono text-xs text-[#8B97C8]">// Scan to join mission</p>

            {/* Settings summary */}
            <div className="w-full border-t border-[#2A3468] pt-6 space-y-2">
              <p className="mission-label mb-3">Mission Parameters</p>
              {[
                ['Rounds', settings.rounds],
                ['Time Limit', `${settings.timeLimit}s`],
                ['Reveal Mode', settings.revealMode === 'instant' ? 'Instant' : 'After Round'],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between items-center">
                  <span className="font-space-mono text-xs text-[#8B97C8]">{label}</span>
                  <span className="font-space-mono text-xs text-[#FF6B1A] font-bold">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Right: Player list */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex flex-col"
        >
          <div className="corner-bracket bg-[#111840] border border-[#2A3468] p-6 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="mission-label mb-1">Roster</p>
                <h2 className="font-orbitron text-xl font-bold text-[#F5F0E8] uppercase tracking-wide">
                  Active Operatives
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#8B97C8]" />
                <span className="font-space-mono text-lg font-bold text-[#00FFE5]">
                  {players.length}
                </span>
              </div>
            </div>

            <div className="flex-1 min-h-[240px] overflow-y-auto">
              <div className="grid grid-cols-2 gap-2">
                <AnimatePresence>
                  {players.map((player) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="bg-[#1A2355] border border-[#2A3468] p-3 flex items-center gap-3"
                    >
                      <span className="text-2xl">{player.emoji}</span>
                      <span className="font-space-mono text-sm text-[#F5F0E8] truncate">
                        {player.name}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {players.length === 0 && (
                  <div className="col-span-2 flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-2 h-2 rounded-full bg-[#2A3468] animate-pulse" />
                    <p className="font-space-mono text-xs text-[#8B97C8]">
                      // Awaiting operatives...
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[#2A3468]">
              <Button
                size="xl"
                className="w-full"
                onClick={handleStart}
                disabled={players.length === 0 || !isReady}
              >
                <Rocket className="mr-2 h-5 w-5" />
                Launch Mission
              </Button>
              {!isReady && (
                <p className="font-space-mono text-xs text-[#8B97C8] text-center mt-3">
                  // Connecting to server...
                </p>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </GameLayout>
  );
};

const Lobby: React.FC = () => {
  const { code } = useParams<{ code: string }>();
  const location = useLocation();
  const settings = (location.state as GameSettings | null) ?? {
    rounds: 10,
    timeLimit: 15,
    revealMode: 'instant' as const,
  };

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
      }}
    >
      <LobbyContent code={code} settings={settings} />
    </RoomProvider>
  );
};

export default Lobby;

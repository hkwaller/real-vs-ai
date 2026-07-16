import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import GameLayout from '@/components/GameLayout';
import { Check, Copy, Link2 } from 'lucide-react';
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
import { useAdFree } from '@/hooks/useAdFree';

interface GameSettings {
  rounds: number;
  timeLimit: number;
  revealMode: 'instant' | 'after_round';
}

const LobbyContent: React.FC<{ code: string; settings: GameSettings }> = ({ code, settings }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

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

  const writeSettings = useMutation(({ storage }, s: GameSettings) => {
    const settingsObj = storage.get('settings');
    settingsObj.set('rounds', s.rounds);
    settingsObj.set('timeLimit', s.timeLimit);
    settingsObj.set('revealMode', s.revealMode);
  }, []);

  useEffect(() => {
    if (!isReady) return;
    writeSettings(settings);
  }, [isReady]);

  // Host perk: stamp the host's ad-free status into the room so in-game ads are
  // suppressed for everyone when the host is ad-free.
  const { isAdFree: hostIsAdFree } = useAdFree();
  const startGame = useMutation(
    ({ storage }, hostAdFree: boolean) => {
      storage.set('hostAdFree', hostAdFree);
      storage.get('gameStatus').set('value', 'playing');
    },
    [],
  );

  const joinUrl = `${window.location.origin}/join?code=${code}`;

  const copy = (what: 'code' | 'link') => {
    navigator.clipboard.writeText(what === 'code' ? code : joinUrl);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleStart = () => {
    if (!isReady) return;
    startGame(hostIsAdFree);
    navigate(`/game/${code}`);
  };

  const settingsSummary = `${settings.rounds} rounds · ${settings.timeLimit}s each · ${
    settings.revealMode === 'instant' ? 'live votes' : 'votes at the end'
  }`;

  return (
    <GameLayout className="max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-[0.9fr_1.1fr] gap-6 w-full">
        {/* Left: Code + QR */}
        <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <div className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-8 flex flex-col items-center gap-6 h-full">
            <p className="text-[#9AA3D0] text-center">
              Join at <span className="font-display font-bold text-[#FFF8F0]">{window.location.host}</span> with code
            </p>
            <div className="font-display font-extrabold text-[88px] leading-none tracking-wide text-[#FF8552]">
              {code}
            </div>

            <div className="bg-white rounded-[20px] p-4">
              <QRCodeSVG value={joinUrl} size={160} />
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => copy('code')}>
                {copied === 'code' ? <Check className="w-4 h-4 text-[#57E6D2]" /> : <Copy className="w-4 h-4" />}
                Copy code
              </Button>
              <Button variant="ghost" size="sm" onClick={() => copy('link')}>
                {copied === 'link' ? <Check className="w-4 h-4 text-[#57E6D2]" /> : <Link2 className="w-4 h-4" />}
                Copy link
              </Button>
            </div>

            <p className="font-body text-sm text-[#6E77A8] mt-auto">{settingsSummary}</p>
          </div>
        </motion.div>

        {/* Right: Player list */}
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-col">
          <div className="rounded-[28px] border border-white/[0.07] bg-[#1F2450] p-8 flex flex-col flex-1">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display font-extrabold text-3xl text-[#FFF8F0]">Who's in</h2>
              <span className="flex items-center gap-2 rounded-full bg-[#57E6D2]/15 px-3 py-1.5">
                <span className="w-2 h-2 rounded-full bg-[#57E6D2] animate-pulse" />
                <span className="font-body font-semibold text-sm text-[#57E6D2]">
                  {players.length} {players.length === 1 ? 'player' : 'players'}
                </span>
              </span>
            </div>

            <div className="flex-1 min-h-[240px]">
              <div className="grid grid-cols-2 gap-3">
                <AnimatePresence>
                  {players.map((player) => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.5 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                      className="rounded-[16px] bg-white/5 px-4 py-3 flex items-center gap-3"
                    >
                      <span className="text-[30px] leading-none">{player.emoji}</span>
                      <span className="font-display font-bold text-[17px] text-[#FFF8F0] truncate">
                        {player.name}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
                <div className="rounded-[16px] border border-dashed border-white/15 px-4 py-3 flex items-center text-[#6E77A8]">
                  <span className="font-body text-sm">Waiting for more…</span>
                </div>
              </div>
            </div>

            <Button
              size="xl"
              className="w-full mt-6"
              onClick={handleStart}
              disabled={players.length === 0 || !isReady}
            >
              Start the game ▶
            </Button>
            {!isReady && (
              <p className="font-body text-sm text-[#6E77A8] text-center mt-3">Connecting…</p>
            )}
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
        hostAdFree: false,
      }}
    >
      <LobbyContent code={code} settings={settings} />
    </RoomProvider>
  );
};

export default Lobby;

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { ArrowRight, NO_EMOJI, Wordmark } from '@/components/Brand';
import { Check, Copy, Link2 } from 'lucide-react';
import {
  RoomProvider,
  useOthers,
  useMutation,
  useStatus,
  useStorage,
  useEventListener,
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

  const bossPlayerId = useStorage((root) => root.bossPlayerId ?? null);

  // Tapping a player promotes them to boss; tapping the boss again clears it.
  const setBoss = useMutation(({ storage }, id: string | null) => {
    storage.set('bossPlayerId', id);
  }, []);

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

  // The boss can kick the game off from their own device.
  useEventListener(({ event }) => {
    if (event.type !== 'BOSS_START') return;
    if (!bossPlayerId || event.playerId !== bossPlayerId) return;
    handleStart();
  });

  const settingsSummary = `${settings.rounds} rounds · ${settings.timeLimit} sec each · ${
    settings.revealMode === 'instant' ? 'live votes' : 'votes after the round'
  }`;

  return (
    <main className="min-h-dvh lg:h-dvh grid grid-rows-[auto_auto] lg:grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)] bg-paper text-ink overflow-hidden">
      {/* Orange: how to join */}
      <section className="bg-side-a text-ink px-4 md:px-14 pt-8 pb-10 grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_auto] gap-8 md:gap-12 min-h-0">
        <div className="flex flex-col justify-between gap-8 min-w-0">
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4 type-label text-[clamp(14px,1.3vw,20px)]">
              <Wordmark className="text-[clamp(18px,1.6vw,24px)]" />
              <span className="text-right">{settingsSummary}</span>
            </div>
            <p className="type-display text-[clamp(28px,3.6vw,56px)] leading-[0.95] break-words">
              Join at {window.location.host}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="type-label text-[clamp(14px,1.3vw,20px)]">Party code</span>
            <span className="type-display text-[clamp(110px,17vw,290px)] leading-[0.76] tracking-[-0.02em]">
              {code}
            </span>
          </div>
        </div>
        <div className="flex flex-row md:flex-col items-end md:items-stretch justify-between gap-4 self-end">
          <div className="bg-paper p-4 w-[clamp(140px,17vw,300px)] aspect-square">
            <QRCodeSVG value={joinUrl} size={256} className="w-full h-full" bgColor="#FFFFFF" fgColor="#0E0E0E" />
          </div>
          <div className="flex flex-col sm:flex-row md:flex-col gap-2">
            <Button variant="ink" size="sm" onClick={() => copy('code')}>
              {copied === 'code' ? <Check strokeWidth={3} /> : <Copy strokeWidth={3} />}
              {copied === 'code' ? 'Copied' : 'Copy code'}
            </Button>
            <Button variant="ink" size="sm" onClick={() => copy('link')}>
              {copied === 'link' ? <Check strokeWidth={3} /> : <Link2 strokeWidth={3} />}
              {copied === 'link' ? 'Copied' : 'Copy link'}
            </Button>
          </div>
        </div>
      </section>

      {/* Blue: who's in */}
      <section className="bg-side-b text-paper px-4 md:px-14 pt-8 pb-8 flex flex-col gap-6 min-h-0">
        <div className="flex items-baseline gap-6">
          <h2 className="type-display text-[clamp(32px,3vw,48px)] leading-none">Who's in</h2>
          <span className="type-display text-[clamp(32px,3vw,48px)] leading-none text-side-a">
            {players.length}
          </span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 flex-1 min-h-0">
          <div className="flex flex-col gap-4 min-w-0">
            <ul className="flex flex-wrap gap-3 overflow-y-auto max-h-full">
              <AnimatePresence>
                {players.map((player) => {
                  const isBoss = player.id === bossPlayerId;
                  return (
                    <motion.li
                      key={player.id}
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <button
                        type="button"
                        onClick={() => setBoss(isBoss ? null : player.id)}
                        aria-pressed={isBoss}
                        title={isBoss ? 'Remove boss' : 'Make boss'}
                        className="type-name h-16 px-[22px] text-[clamp(20px,1.8vw,26px)] bg-paper text-ink inline-flex items-center gap-3 hover:bg-on-blue-muted transition-colors"
                      >
                        <span className="max-w-[12ch] truncate">{player.name}</span>
                        {isBoss && (
                          <span className="type-label bg-side-a text-ink px-2 py-1 text-[13px] tracking-[0.06em]">
                            Boss
                          </span>
                        )}
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
              <li className="h-16 px-[22px] border-[3px] border-dashed border-slot-line-blue text-on-blue-muted inline-flex items-center font-bold text-lg uppercase">
                Waiting for more…
              </li>
            </ul>
            <p className="font-medium text-base text-on-blue-muted max-w-[60ch]">
              {bossPlayerId
                ? 'Tap the boss again to hand control back to this screen.'
                : 'Tap a player to make them boss. They can start and run the game from their phone.'}
            </p>
          </div>

          <div className="flex flex-col items-stretch lg:items-end gap-2 shrink-0">
            <Button
              size="xl"
              className="h-24 px-11 text-[clamp(26px,2.2vw,34px)]"
              onClick={handleStart}
              disabled={players.length === 0 || !isReady}
            >
              Start <ArrowRight />
            </Button>
            {!isReady && <p className="type-label text-sm text-on-blue-muted">Connecting…</p>}
            {isReady && players.length === 0 && (
              <p className="type-label text-sm text-on-blue-muted">Waiting for the first player</p>
            )}
          </div>
        </div>
      </section>
    </main>
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
        emoji: NO_EMOJI,
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
        bossPlayerId: null,
      }}
    >
      <LobbyContent code={code} settings={settings} />
    </RoomProvider>
  );
};

export default Lobby;

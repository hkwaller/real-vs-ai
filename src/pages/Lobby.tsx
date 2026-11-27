import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Wordmark } from '@/components/Brand';
import { Check, Copy, Link2 } from 'lucide-react';
import { PartyRoomProvider, hostGuestKey, usePartyRoom } from '@/hooks/usePartyRoom';
import type { Settings as GameSettings } from '@/lib/partyRoom';
import { useAdFree } from '@/hooks/useAdFree';

const LobbyContent: React.FC<{ code: string; settings: GameSettings }> = ({ code, settings }) => {
  const navigate = useNavigate();
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  const { state, online, me, status, send } = usePartyRoom();
  const isHost = !!state && !!me && state.hostId === me;
  // Another screen is hosting this code right now.
  const codeTaken = !!state && !!me && !!state.hostId && state.hostId !== me && online.has(state.hostId);
  const isReady = status === 'connected' && isHost;

  const players = (state?.players ?? []).filter((p) => online.has(p.id));
  const bossPlayerId = state?.bossId ?? null;

  // Tapping a player promotes them to boss; tapping the boss again clears it.
  const setBoss = (id: string | null) => send({ type: 'setBoss', playerId: id });

  // Claim the room with this lobby's settings. Host perk: the host's ad-free status
  // is stamped into the room so in-game ads are suppressed for everyone.
  const { isAdFree: hostIsAdFree } = useAdFree();
  useEffect(() => {
    if (status !== 'connected' || !state || codeTaken) return;
    send({ type: 'open', settings, hostAdFree: hostIsAdFree });
    // Re-send only when the connection or entitlement changes, not on every snapshot.
  }, [status, !!state, codeTaken, hostIsAdFree]);

  // The game is on (started here or by the boss's phone): move the big screen over.
  useEffect(() => {
    if (isHost && state?.status === 'playing') navigate(`/game/${code}`);
  }, [isHost, state?.status]);

  const joinUrl = `${window.location.origin}/join?code=${code}`;

  const copy = (what: 'code' | 'link') => {
    navigator.clipboard.writeText(what === 'code' ? code : joinUrl);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleStart = () => {
    if (!isReady) return;
    send({ type: 'start' });
  };

  if (codeTaken) {
    return (
      <main className="min-h-dvh bg-side-a text-ink px-4 md:px-14 py-10 flex flex-col justify-center gap-8">
        <span className="type-label text-[clamp(14px,1.3vw,20px)]">Party code {code}</span>
        <h1 className="type-display text-[clamp(44px,6vw,96px)] leading-[0.9]">This code is already in a game.</h1>
        <div>
          <Button variant="ink" size="lg" onClick={() => navigate('/create')}>
            Start a new party <ArrowRight />
          </Button>
        </div>
      </main>
    );
  }

  const settingsSummary = `${settings.rounds} rounds · ${settings.timeLimit} sec each · ${
    settings.revealMode === 'instant' ? 'live votes' : 'votes after the round'
  }`;

  return (
    <main className="min-h-dvh lg:h-dvh grid grid-rows-[auto_auto] lg:grid-rows-[minmax(0,1.5fr)_minmax(0,1fr)] bg-paper text-ink overflow-x-clip lg:overflow-hidden">
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
            <span className="type-display text-[18vw] md:text-[clamp(110px,17vw,290px)] leading-[0.76] tracking-[-0.02em]">
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
      <section className="bg-side-b text-paper px-4 md:px-14 pt-8 pb-40 lg:pb-8 flex flex-col gap-6 min-h-0">
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

          {/* Below lg the page scrolls, so Start stays pinned to the bottom of the screen. */}
          <div className="max-lg:fixed max-lg:inset-x-0 max-lg:bottom-0 max-lg:z-10 max-lg:bg-side-b max-lg:px-4 md:max-lg:px-14 max-lg:pt-3 max-lg:pb-[max(16px,env(safe-area-inset-bottom))] flex flex-col items-stretch lg:items-end gap-2 shrink-0">
            <Button
              size="xl"
              className="h-20 lg:h-24 px-11 text-[clamp(26px,2.2vw,34px)]"
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
  const [hostKey] = useState(hostGuestKey);
  const location = useLocation();
  const settings = (location.state as GameSettings | null) ?? {
    rounds: 10,
    timeLimit: 15,
    revealMode: 'instant' as const,
  };

  if (!code) return null;

  return (
    <PartyRoomProvider code={code} guestKey={hostKey}>
      <LobbyContent code={code} settings={settings} />
    </PartyRoomProvider>
  );
};

export default Lobby;

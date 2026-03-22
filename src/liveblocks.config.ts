import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";
import { LiveList, LiveMap, LiveObject } from "@liveblocks/client";

const client = createClient({
  publicApiKey: import.meta.env.VITE_LIVEBLOCKS_PUBLIC_KEY,
});

export type Presence = {
  name: string;
  emoji: string;
  playerId: string;
  isHost: boolean;
  hasVoted: boolean;
  currentVote: "A" | "B" | null;
  timeRemaining: number | null; // seconds left when the player voted
};

export type Storage = {
  gameStatus: LiveObject<{ value: "waiting" | "playing" | "finished" }>;
  settings: LiveObject<{
    rounds: number;
    timeLimit: number;
    revealMode: "instant" | "after_round";
  }>;
  currentRoundIndex: LiveObject<{ value: number }>;
  rounds: LiveList<{ id: string; realImageUrl: string; aiImageUrl: string }>;
  votes: LiveMap<string, "A" | "B">;
  scores: LiveMap<string, number>;
  players: LiveList<{ id: string; name: string; emoji: string }>;
};

type RoomEvent =
  | { type: "ROUND_REVEALED" }
  | { type: "GAME_OVER" }
  | { type: "PLAYER_KICKED"; playerId: string };

export const {
  RoomProvider,
  useRoom,
  useMyPresence,
  useUpdateMyPresence,
  useOthers,
  useSelf,
  useStorage,
  useMutation,
  useEventListener,
  useBroadcastEvent,
  useStatus,
} = createRoomContext<Presence, Storage, never, RoomEvent>(client);

export { LiveList, LiveMap, LiveObject };

import { Redis } from "@upstash/redis";
import { ExclusionRule } from "./derangement";

export interface Participant {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  wishlist: string[];
}

export interface AnonymousQuestion {
  id: string;
  fromUserId: string; // เก็บเฉพาะฝั่ง Server ห้ามส่งให้ผู้รับเด็ดขาด
  toUserId: string;
  question: string;
  answer?: string;
  createdAt: number;
}

export interface Room {
  code: string;
  name: string;
  budget: string;
  eventDate: string;
  hostId: string;
  participants: Participant[];
  exclusions: ExclusionRule[];
  drawn: boolean;
  assignments: Map<string, Participant>;
  questions: AnonymousQuestion[];
  createdAt: number;
}

interface SerializedRoom extends Omit<Room, "assignments"> {
  assignments: Record<string, Participant>;
}

const ROOM_KEY_PREFIX = "room:";

const globalForStore = globalThis as unknown as {
  buddyRoomsV2?: Map<string, Room>;
};

const memoryStore: Map<string, Room> =
  globalForStore.buddyRoomsV2 ?? new Map<string, Room>();

if (process.env.NODE_ENV !== "production") {
  globalForStore.buddyRoomsV2 = memoryStore;
}

function getRedisClient(): Redis | null {
  if (
    process.env.UPSTASH_REDIS_REST_URL &&
    process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return Redis.fromEnv();
  }
  return null;
}

function serializeRoom(room: Room): SerializedRoom {
  return {
    ...room,
    assignments: Object.fromEntries(room.assignments.entries()),
  };
}

function deserializeRoom(raw: SerializedRoom): Room {
  return {
    ...raw,
    assignments: new Map<string, Participant>(
      Object.entries(raw.assignments ?? {})
    ),
  };
}

export async function getRoom(code: string): Promise<Room | null> {
  const normalized = code.toUpperCase();
  const redis = getRedisClient();

  if (redis) {
    const raw = await redis.get<SerializedRoom>(`${ROOM_KEY_PREFIX}${normalized}`);
    return raw ? deserializeRoom(raw) : null;
  }

  return memoryStore.get(normalized) ?? null;
}

export async function saveRoom(room: Room): Promise<void> {
  const normalized = room.code.toUpperCase();
  const redis = getRedisClient();

  if (redis) {
    await redis.set(`${ROOM_KEY_PREFIX}${normalized}`, serializeRoom(room));
    return;
  }

  memoryStore.set(normalized, room);
}

export async function hasRoom(code: string): Promise<boolean> {
  const normalized = code.toUpperCase();
  const redis = getRedisClient();

  if (redis) {
    const exists = await redis.exists(`${ROOM_KEY_PREFIX}${normalized}`);
    return exists === 1;
  }

  return memoryStore.has(normalized);
}

export async function deleteRoom(code: string): Promise<void> {
  const normalized = code.toUpperCase();
  const redis = getRedisClient();

  if (redis) {
    await redis.del(`${ROOM_KEY_PREFIX}${normalized}`);
    return;
  }

  memoryStore.delete(normalized);
}

export function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

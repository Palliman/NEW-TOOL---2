export interface EggData {
  id: number;
  eggSprite: string;
  creatureSprite: string;
  type: string;
  name?: string;
}

export interface Incubator {
  slotId: number;
  eggId: number | null;
  startTime: number | null;
  duration: number;
  status: 'empty' | 'incubating' | 'ready' | 'hatched';
}

export interface CreatureInstance {
  id: string;
  eggId: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  type: string;
  lastInteractionTime: number;
  nearbyCreatures: CreatureInstance[];
}

export interface EmojiReaction {
  id: string;
  emoji: string;
  x: number;
  y: number;
  createdAt: number;
  duration: number;
}

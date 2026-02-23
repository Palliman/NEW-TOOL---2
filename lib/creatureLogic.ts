import { CreatureInstance } from './types';
import { BIOME_WIDTH, BIOME_HEIGHT, CREATURE_SIZE } from './constants';

export const updateCreaturePosition = (
  creature: CreatureInstance,
  dt: number
): CreatureInstance => {
  let x = creature.x + creature.vx * dt;
  let y = creature.y + creature.vy * dt;
  let vx = creature.vx;
  let vy = creature.vy;

  // Boundary collision with bounce
  if (x < 0 || x + CREATURE_SIZE > BIOME_WIDTH) {
    vx *= -1;
    x = Math.max(0, Math.min(BIOME_WIDTH - CREATURE_SIZE, x));
  }
  if (y < 0 || y + CREATURE_SIZE > BIOME_HEIGHT) {
    vy *= -1;
    y = Math.max(0, Math.min(BIOME_HEIGHT - CREATURE_SIZE, y));
  }

  return { ...creature, x, y, vx, vy };
};

export const setRandomDirection = (
  creature: CreatureInstance,
  speed: number
): CreatureInstance => {
  const angle = Math.random() * Math.PI * 2;
  return {
    ...creature,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
  };
};

export const getCreaturesInProximity = (
  creature: CreatureInstance,
  otherCreatures: CreatureInstance[],
  radius: number
): CreatureInstance[] => {
  return otherCreatures.filter((other) => {
    if (other.id === creature.id) return false;

    const dx = creature.x - other.x;
    const dy = creature.y - other.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance < radius;
  });
};

export const shouldCreaturesInteract = (
  creature: CreatureInstance,
  other: CreatureInstance,
  interactionThreshold: number,
  lastInteractionTime: number
): boolean => {
  const dx = creature.x - other.x;
  const dy = creature.y - other.y;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return (
    distance < 60 && // proximity radius
    Date.now() - lastInteractionTime > interactionThreshold
  );
};

export const getInteractionEmoji = (
  creatureType: string,
  otherType: string,
  emojiMap: any
): string => {
  let emojis: string[] = [];

  if (creatureType === otherType) {
    emojis = emojiMap.same;
  } else {
    emojis = emojiMap.clash;
  }

  return emojis[Math.floor(Math.random() * emojis.length)];
};

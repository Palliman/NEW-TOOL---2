'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HatcheryBiome } from '@/components/HatcheryBiome';
import { IncubatorPanel } from '@/components/IncubatorPanel';
import { EggCase } from '@/components/EggCase';
import { Incubator, CreatureInstance, EggData, EmojiReaction } from '@/lib/types';
import {
  INCUBATION_DURATION,
  MAX_INCUBATORS,
  EGGS,
  BIOME_WIDTH,
  BIOME_HEIGHT,
  COLORS,
  CREATURE_UPDATE_INTERVAL,
  CREATURE_SPEED,
  CREATURE_SIZE,
  DIRECTION_CHANGE_INTERVAL,
  IDLE_DURATION,
  PROXIMITY_RADIUS,
  EMOJI_DURATION,
  INTERACTION_THRESHOLD,
  EMOJI_REACTIONS,
} from '@/lib/constants';

export default function Home() {
  const [selectedEgg, setSelectedEgg] = useState<EggData | null>(null);
  const [incubators, setIncubators] = useState<Incubator[]>([
    { slotId: 0, eggId: null, startTime: null, duration: INCUBATION_DURATION, status: 'empty' },
  ]);
  const [creatures, setCreatures] = useState<CreatureInstance[]>([]);
  const [emojiReactions, setEmojiReactions] = useState<EmojiReaction[]>([]);
  const creaturesRef = useRef<CreatureInstance[]>(creatures);
  const emojiReactionsRef = useRef<EmojiReaction[]>(emojiReactions);
  const directionTimersRef = useRef<{ [key: string]: NodeJS.Timeout }>({});
  const lastInteractionRef = useRef<{ [key: string]: number }>({});

  // Keep refs in sync
  useEffect(() => {
    creaturesRef.current = creatures;
  }, [creatures]);

  useEffect(() => {
    emojiReactionsRef.current = emojiReactions;
  }, [emojiReactions]);

  // Add incubator
  const handleAddIncubator = () => {
    if (incubators.length < MAX_INCUBATORS) {
      const newSlotId = Math.max(...incubators.map((i) => i.slotId), -1) + 1;
      setIncubators([
        ...incubators,
        {
          slotId: newSlotId,
          eggId: null,
          startTime: null,
          duration: INCUBATION_DURATION,
          status: 'empty',
        },
      ]);
    }
  };

  // Assign egg to incubator
  const handleSlotClick = (slotId: number) => {
    if (selectedEgg) {
      setIncubators(
        incubators.map((inc) =>
          inc.slotId === slotId && inc.status === 'empty'
            ? {
                ...inc,
                eggId: selectedEgg.id,
                startTime: Date.now(),
                status: 'incubating',
              }
            : inc
        )
      );
    }
  };

  // Spawn creature from ready incubator
  const handleSpawnClick = (slotId: number) => {
    const incubator = incubators.find((i) => i.slotId === slotId);
    if (incubator && incubator.status === 'ready' && incubator.eggId) {
      const egg = EGGS.find((e) => e.id === incubator.eggId);
      if (egg) {
        const newCreature: CreatureInstance = {
          id: `creature-${Date.now()}-${Math.random()}`,
          eggId: egg.id,
          x: Math.random() * (BIOME_WIDTH - CREATURE_SIZE),
          y: Math.random() * (BIOME_HEIGHT - CREATURE_SIZE),
          vx: 0,
          vy: 0,
          type: egg.type,
          lastInteractionTime: Date.now(),
          nearbyCreatures: [],
        };

        setCreatures([...creatures, newCreature]);

        // Reset incubator
        setIncubators(
          incubators.map((inc) =>
            inc.slotId === slotId
              ? {
                  ...inc,
                  eggId: null,
                  startTime: null,
                  status: 'empty',
                }
              : inc
          )
        );

        // Set initial direction
        setRandomDirection(newCreature.id);
      }
    }
  };

  // Set random direction for creature
  const setRandomDirection = (creatureId: string) => {
    if (directionTimersRef.current[creatureId]) {
      clearTimeout(directionTimersRef.current[creatureId]);
    }

    const creature = creaturesRef.current.find((c) => c.id === creatureId);
    if (creature) {
      const angle = Math.random() * Math.PI * 2;
      creature.vx = Math.cos(angle) * CREATURE_SPEED;
      creature.vy = Math.sin(angle) * CREATURE_SPEED;

      // Schedule next direction change
      const nextChange =
        DIRECTION_CHANGE_INTERVAL + Math.random() * 3000 + IDLE_DURATION;
      directionTimersRef.current[creatureId] = setTimeout(
        () => setRandomDirection(creatureId),
        nextChange
      );
    }
  };

  // Movement loop
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const dt = CREATURE_UPDATE_INTERVAL / 1000;

      setCreatures((prevCreatures) => {
        const updated = prevCreatures.map((creature) => {
          let x = creature.x + creature.vx * dt;
          let y = creature.y + creature.vy * dt;

          // Boundary collision
          if (x < 0 || x + CREATURE_SIZE > BIOME_WIDTH) {
            creature.vx *= -1;
            x = Math.max(0, Math.min(BIOME_WIDTH - CREATURE_SIZE, x));
          }
          if (y < 0 || y + CREATURE_SIZE > BIOME_HEIGHT) {
            creature.vy *= -1;
            y = Math.max(0, Math.min(BIOME_HEIGHT - CREATURE_SIZE, y));
          }

          return { ...creature, x, y };
        });

        // Check proximity for interactions
        updated.forEach((creature) => {
          updated.forEach((other) => {
            if (creature.id === other.id) return;

            const dx = creature.x - other.x;
            const dy = creature.y - other.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < PROXIMITY_RADIUS) {
              const lastInteraction = lastInteractionRef.current[creature.id] || 0;
              if (now - lastInteraction > INTERACTION_THRESHOLD) {
                // Determine emoji
                let emojis: string[] = [];
                if (creature.type === other.type) {
                  emojis = EMOJI_REACTIONS.same;
                } else {
                  emojis = EMOJI_REACTIONS.clash;
                }

                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                const reactionId = `reaction-${Date.now()}-${Math.random()}`;

                setEmojiReactions((prev) => [
                  ...prev,
                  {
                    id: creature.id,
                    emoji,
                    x: creature.x,
                    y: creature.y,
                    createdAt: now,
                    duration: EMOJI_DURATION,
                  },
                ]);

                lastInteractionRef.current[creature.id] = now;

                // Remove emoji after duration
                setTimeout(() => {
                  setEmojiReactions((prev) =>
                    prev.filter((r) => r.id !== reactionId)
                  );
                }, EMOJI_DURATION);
              }
            }
          });
        });

        return updated;
      });

      // Update incubators
      setIncubators((prevIncubators) =>
        prevIncubators.map((inc) => {
          if (inc.status === 'incubating' && inc.startTime) {
            const elapsed = now - inc.startTime;
            if (elapsed >= inc.duration) {
              return { ...inc, status: 'ready' };
            }
          }
          return inc;
        })
      );
    }, CREATURE_UPDATE_INTERVAL);

    return () => clearInterval(interval);
  }, []);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4" style={{ background: `linear-gradient(135deg, ${COLORS.sky} 0%, ${COLORS.lightSky} 100%)` }}>
      {/* Title Bar */}
      <div className="mb-4 text-center" style={{ textShadow: `3px 3px 0 ${COLORS.black}`, color: COLORS.white }}>
        <h1 className="text-2xl font-bold mb-1">EGG HATCHERY BIOME</h1>
        <p className="text-xs" style={{ fontSize: '10px' }}>Select eggs • Place in incubators • Watch them hatch!</p>
      </div>

      {/* Main Game Area */}
      <div className="flex gap-4 flex-wrap md:flex-nowrap justify-center">
        {/* Left: Egg Case */}
        <EggCase
          selectedEggId={selectedEgg?.id || null}
          onSelectEgg={setSelectedEgg}
        />

        {/* Center: Hatchery Biome */}
        <HatcheryBiome creatures={creatures} emojiReactions={emojiReactions} />

        {/* Right: Incubator Panel */}
        <IncubatorPanel
          incubators={incubators}
          selectedEgg={selectedEgg}
          onAddIncubator={handleAddIncubator}
          onSlotClick={handleSlotClick}
          onSpawnClick={handleSpawnClick}
        />
      </div>

      {/* Footer Info */}
      <div className="mt-6 text-xs text-center pixel-border p-2" style={{ background: 'rgba(0, 0, 0, 0.6)', color: COLORS.white, maxWidth: '600px' }}>
        <div>Creatures interact when close • Same type = happy • Different types = conflict</div>
        <div className="mt-1">Max 10 incubators • 30 second hatch time • 255 unique creatures</div>
      </div>
    </main>
  );
}

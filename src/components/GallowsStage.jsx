import React from 'react';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import { GALLOWS_POS } from '../engine/movementConfig.js';
import VillagerPuppetRig from './VillagerPuppetRig.jsx';

export default function GallowsStage({ players = [], accusedId = null, phase = 'LOBBY' }) {
  // Players who died by hanging remain suspended on the gallows until GAME_OVER
  const hangedPlayers = players
    .filter((p) => !p.alive && p.deathInfo?.cause === 'lynch')
    .sort((a, b) => (a.deathInfo?.hangSlot ?? 0) - (b.deathInfo?.hangSlot ?? 0));

  const inTrial = phase === 'DAY_DEFENSE' || phase === 'DAY_VERDICT';
  const accused = accusedId ? players.find((p) => p.id === accusedId && p.alive) : null;

  return (
    <div
      style={{
        left: `${GALLOWS_POS.x}px`,
        top: `${GALLOWS_POS.y}px`,
        transform: 'translate(-50%, -62%)',
        zIndex: GALLOWS_POS.y - 4,
      }}
      className="pointer-events-none absolute w-[360px] h-[240px] flex items-center justify-center select-none"
    >
      {/* Back wooden gallows structure */}
      <img
        src={ASSET_PATHS.gallowsBack}
        alt="Giá Treo Cổ Sân Đình"
        draggable={false}
        className="w-full h-full object-contain drop-shadow-[0_10px_14px_rgba(0,0,0,0.65)]"
      />

      {/* Hanged corpses dangling across the horizontal crossbeam */}
      {hangedPlayers.map((p, idx) => {
        const slotIdx = p.deathInfo?.hangSlot ?? idx;
        const offX = GALLOWS_POS.slotOffsetsX[slotIdx % GALLOWS_POS.slotOffsetsX.length] || 0;
        const yJitter = Math.floor(slotIdx / 4) * 14;
        return (
          <div
            key={p.id}
            style={{
              left: `calc(50% + ${offX}px)`,
              top: `${32 + yJitter}px`,
              transformOrigin: 'top center',
            }}
            className="absolute -translate-x-1/2 flex flex-col items-center anim-sway-hang z-20"
          >
            <img
              src={ASSET_PATHS.gallowsNoose}
              alt=""
              draggable={false}
              className="w-10 h-14 object-contain -mb-5 relative z-20"
            />
            <div className="relative grayscale contrast-110 brightness-90">
              <VillagerPuppetRig avatarId={p.avatarId} size={74} pose="hanging" emoteHead={true} />
              <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-red-950/95 border border-[#140f0e] px-1.5 py-0.2 text-[9px] font-black text-red-200 shadow">
                ☠️ {p.name}
              </span>
            </div>
          </div>
        );
      })}

      {/* Trial phase banner when accused is standing on the gallows */}
      {inTrial && accused && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30 rounded-full bg-red-600/95 border-2 border-[#140f0e] px-3 py-0.5 text-[11px] font-black text-white whitespace-nowrap shadow-lg animate-pulse">
          ⚖️ {accused.name} trên Giá Treo Cổ
        </div>
      )}
    </div>
  );
}

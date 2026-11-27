import React from 'react';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import { getVillagerMotion } from '../data/villagerMotion.js';
import { VILLAGER_PARTS_META, VILLAGER_PROP_MODE } from '../data/villagerRigConfig.js';

/**
 * 7-Layer Cutout Puppet Rig cho 22 dân làng Ma Chó:
 * Sử dụng các mảnh PNG tách rời (arm-b, leg-b, leg-a, torso, head, arm-a, prop/sheep)
 * điều khiển khớp xương bằng GPU CSS @keyframes thuần trên transform.
 */
export default function VillagerPuppetRig({
  avatarId = 'drunkard',
  size = 96,
  pose = 'walk', // 'walk' | 'run' | 'jump' | 'punch' | 'kick' | 'hit' | 'hanging' | 'corpse'
  emoteHead = false,
}) {
  const slug = getVillagerMotion(avatarId).slug;
  const meta = VILLAGER_PARTS_META[slug] || {};
  const propMode = VILLAGER_PROP_MODE[slug] || 'hand_front';

  const hasPart = (name) => Boolean(meta[name]);
  const src = (name) => ASSET_PATHS.characterPart(avatarId, name);

  const poseClass = `rig-pose-${pose}`;
  const useEmoteHead = emoteHead || ['punch', 'kick', 'hit', 'hanging', 'corpse'].includes(pose);
  const headPart = useEmoteHead && hasPart('head-emote') ? 'head-emote' : 'head-neutral';

  // Compute proportional box heights relative to 96px reference rig
  const headH = Math.round(size * 0.44);
  const torsoH = Math.round(size * 0.27);
  const armH = Math.round(size * 0.27);
  const legH = Math.round(size * 0.22);

  const widthFromAspect = (partName, targetH) => {
    const aspect = meta[partName]?.aspect || 0.7;
    return Math.max(8, Math.round(targetH * aspect));
  };

  const showHeldProp = propMode !== 'skip' && propMode !== 'sheep_pet' && hasPart('prop');
  const propW = widthFromAspect('prop', Math.round(size * 0.34));
  const propH = Math.round(size * 0.34);

  return (
    <div
      className={`relative select-none pointer-events-none ${poseClass}`}
      style={{ width: size, height: size }}
    >
      {/* Optional Shepherd's Sheep trailing behind Bé Chăn Cừu */}
      {propMode === 'sheep_pet' && hasPart('sheep') && pose !== 'hanging' && (
        <img
          src={src('sheep')}
          alt=""
          draggable={false}
          className="rig-sheep absolute bottom-[3%] -left-[12%] z-[1] object-contain"
          style={{ width: Math.round(size * 0.34), height: Math.round(size * 0.28) }}
        />
      )}

      {/* Main Articulated Body Group (tilts & squashes smoothly on GPU) */}
      <div className="rig-body relative w-full h-full" style={{ transformOrigin: '50% 88%' }}>
        {/* LAYER 1: Back Arm (Behind Torso) */}
        {hasPart('arm-b') && (
          <img
            src={src('arm-b')}
            alt=""
            draggable={false}
            className="rig-arm-b absolute z-[2] object-contain"
            style={{
              width: widthFromAspect('arm-b', armH),
              height: armH,
              left: '56%',
              top: '44%',
              transformOrigin: '45% 12%',
            }}
          />
        )}

        {/* LAYER 2: Back Leg */}
        {hasPart('leg-b') && (
          <img
            src={src('leg-b')}
            alt=""
            draggable={false}
            className="rig-leg-b absolute z-[3] object-contain"
            style={{
              width: widthFromAspect('leg-b', legH),
              height: legH,
              left: '50%',
              bottom: '4%',
              transformOrigin: '45% 12%',
            }}
          />
        )}

        {/* LAYER 3: Front Leg (Shoe pre-flipped right) */}
        {hasPart('leg-a') && (
          <img
            src={src('leg-a')}
            alt=""
            draggable={false}
            className="rig-leg-a absolute z-[4] object-contain"
            style={{
              width: widthFromAspect('leg-a', legH),
              height: legH,
              left: '34%',
              bottom: '4%',
              transformOrigin: '45% 12%',
            }}
          />
        )}

        {/* LAYER 4: Torso */}
        {hasPart('torso') && (
          <img
            src={src('torso')}
            alt=""
            draggable={false}
            className="rig-torso absolute left-1/2 -translate-x-1/2 z-[5] object-contain"
            style={{
              width: widthFromAspect('torso', torsoH),
              height: torsoH,
              bottom: '20%',
              transformOrigin: '50% 80%',
            }}
          />
        )}

        {/* LAYER 5: Head (with Follow-through Neck Delay!) */}
        {hasPart(headPart) && (
          <img
            src={src(headPart)}
            alt=""
            draggable={false}
            className="rig-head absolute left-1/2 -translate-x-1/2 z-[6] object-contain"
            style={{
              width: widthFromAspect(headPart, headH),
              height: headH,
              bottom: '41%',
              transformOrigin: '48% 88%',
            }}
          />
        )}

        {/* LAYER 6: Hip Basket / Front Arm + Held Prop */}
        {propMode === 'hip_basket' && showHeldProp && (
          <img
            src={src('prop')}
            alt=""
            draggable={false}
            className="rig-prop absolute z-[7] object-contain"
            style={{
              width: Math.round(propW * 0.9),
              height: Math.round(propH * 0.9),
              left: '48%',
              bottom: '20%',
              transformOrigin: '25% 50%',
            }}
          />
        )}

        {hasPart('arm-a') && (
          <div
            className="rig-arm-a absolute z-[8]"
            style={{
              width: widthFromAspect('arm-a', armH),
              height: armH,
              left: '28%',
              top: '44%',
              transformOrigin: '52% 14%',
            }}
          >
            <img src={src('arm-a')} alt="" draggable={false} className="w-full h-full object-contain" />
            {showHeldProp && propMode !== 'hip_basket' && (
              <img
                src={src('prop')}
                alt=""
                draggable={false}
                className="rig-prop absolute object-contain pointer-events-none"
                style={{
                  width: propW,
                  height: propH,
                  left: propMode === 'shoulder_heavy' ? '-20%' : '35%',
                  top: propMode === 'shoulder_heavy' ? '-45%' : propMode === 'hand_cane' ? '15%' : '-10%',
                  transform: propMode === 'shoulder_heavy' ? 'rotate(-16deg)' : 'rotate(8deg)',
                  transformOrigin: '25% 75%',
                }}
              />
            )}
            {propMode === 'sheep_pet' && hasPart('crook') && (
              <img
                src={src('crook')}
                alt=""
                draggable={false}
                className="absolute object-contain pointer-events-none"
                style={{
                  width: widthFromAspect('crook', Math.round(size * 0.44)),
                  height: Math.round(size * 0.44),
                  left: '45%',
                  top: '-30%',
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

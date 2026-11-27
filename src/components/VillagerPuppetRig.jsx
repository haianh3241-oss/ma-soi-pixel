import React from 'react';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import { getVillagerMotion } from '../data/villagerMotion.js';
import { VILLAGER_PARTS_META, VILLAGER_PROP_MODE } from '../data/villagerRigConfig.js';

/**
 * 7-Layer Cutout Puppet Rig cho 22 dân làng Ma Chó:
 * Tất cả tọa độ khớp & tâm xoay được tính bằng px nguyên tuyệt đối (không dùng -translate-x-1/2 + keyframe transform chồng nhau)
 * để đảm bảo không bao giờ vỡ/lệch bộ phận cơ thể trên trình duyệt Mobile (iOS Safari / Android Chrome).
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

  const headH = Math.round(size * 0.44);
  const torsoH = Math.round(size * 0.27);
  const armH = Math.round(size * 0.27);
  const legH = Math.round(size * 0.22);

  const widthFromAspect = (partName, targetH) => {
    const aspect = meta[partName]?.aspect || 0.7;
    return Math.max(8, Math.round(targetH * aspect));
  };

  const headW = widthFromAspect(headPart, headH);
  const torsoW = widthFromAspect('torso', torsoH);
  const armAW = widthFromAspect('arm-a', armH);
  const armBW = widthFromAspect('arm-b', armH);
  const legAW = widthFromAspect('leg-a', legH);
  const legBW = widthFromAspect('leg-b', legH);

  const showHeldProp = propMode !== 'skip' && propMode !== 'sheep_pet' && hasPart('prop');
  const propH = Math.round(size * 0.34);
  const propW = widthFromAspect('prop', propH);
  const crookH = Math.round(size * 0.44);
  const crookW = widthFromAspect('crook', crookH);

  const originPx = (w, h, xr, yr) => `${Math.round(w * xr)}px ${Math.round(h * yr)}px`;
  const noSquishStyle = { maxWidth: 'none', maxHeight: 'none' };

  return (
    <div
      className={`relative select-none pointer-events-none overflow-visible ${poseClass}`}
      style={{ width: size, height: size }}
    >
      {/* Optional Shepherd's Sheep trailing behind Bé Chăn Cừu */}
      {propMode === 'sheep_pet' && hasPart('sheep') && pose !== 'hanging' && (
        <img
          src={src('sheep')}
          alt=""
          draggable={false}
          className="rig-sheep absolute z-[1] object-contain"
          style={{
            ...noSquishStyle,
            width: Math.round(size * 0.34),
            height: Math.round(size * 0.28),
            left: Math.round(-size * 0.12),
            bottom: Math.round(size * 0.03),
          }}
        />
      )}

      {/* Main Articulated Body Group (1 single GPU plane keeps Mobile parts locked cleanly) */}
      <div
        className="rig-body relative w-full h-full overflow-visible"
        style={{ transformOrigin: originPx(size, size, 0.5, 0.88) }}
      >
        {/* LAYER 1: Back Arm (Behind Torso) */}
        {hasPart('arm-b') && (
          <img
            src={src('arm-b')}
            alt=""
            draggable={false}
            className="rig-arm-b absolute z-[2] object-contain"
            style={{
              ...noSquishStyle,
              width: armBW,
              height: armH,
              left: Math.round(size * 0.55),
              top: Math.round(size * 0.44),
              transformOrigin: originPx(armBW, armH, 0.45, 0.12),
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
              ...noSquishStyle,
              width: legBW,
              height: legH,
              left: Math.round(size * 0.49),
              bottom: Math.round(size * 0.04),
              transformOrigin: originPx(legBW, legH, 0.45, 0.12),
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
              ...noSquishStyle,
              width: legAW,
              height: legH,
              left: Math.round(size * 0.34),
              bottom: Math.round(size * 0.04),
              transformOrigin: originPx(legAW, legH, 0.45, 0.12),
            }}
          />
        )}

        {/* LAYER 4: Torso (Centered strictly in px) */}
        {hasPart('torso') && (
          <img
            src={src('torso')}
            alt=""
            draggable={false}
            className="rig-torso absolute z-[5] object-contain"
            style={{
              ...noSquishStyle,
              width: torsoW,
              height: torsoH,
              left: Math.round((size - torsoW) / 2),
              bottom: Math.round(size * 0.2),
              transformOrigin: originPx(torsoW, torsoH, 0.5, 0.8),
            }}
          />
        )}

        {/* LAYER 5: Head (Centered strictly in px, zero translateX conflict) */}
        {hasPart(headPart) && (
          <img
            src={src(headPart)}
            alt=""
            draggable={false}
            className="rig-head absolute z-[6] object-contain"
            style={{
              ...noSquishStyle,
              width: headW,
              height: headH,
              left: Math.round((size - headW) / 2),
              bottom: Math.round(size * 0.41),
              transformOrigin: originPx(headW, headH, 0.48, 0.88),
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
              ...noSquishStyle,
              width: Math.round(propW * 0.9),
              height: Math.round(propH * 0.9),
              left: Math.round(size * 0.48),
              bottom: Math.round(size * 0.2),
              transformOrigin: originPx(Math.round(propW * 0.9), Math.round(propH * 0.9), 0.25, 0.5),
            }}
          />
        )}

        {hasPart('arm-a') && (
          <div
            className="rig-arm-a absolute z-[8] overflow-visible"
            style={{
              width: armAW,
              height: armH,
              left: Math.round(size * 0.27),
              top: Math.round(size * 0.44),
              transformOrigin: originPx(armAW, armH, 0.52, 0.14),
            }}
          >
            <img
              src={src('arm-a')}
              alt=""
              draggable={false}
              className="w-full h-full object-contain"
              style={noSquishStyle}
            />
            {showHeldProp && propMode !== 'hip_basket' && (
              <img
                src={src('prop')}
                alt=""
                draggable={false}
                className="rig-prop absolute object-contain pointer-events-none"
                style={{
                  ...noSquishStyle,
                  width: propW,
                  height: propH,
                  left: propMode === 'shoulder_heavy' ? Math.round(-armAW * 0.35) : Math.round(armAW * 0.32),
                  top:
                    propMode === 'shoulder_heavy'
                      ? Math.round(-armH * 0.45)
                      : propMode === 'hand_cane'
                        ? Math.round(armH * 0.14)
                        : Math.round(-armH * 0.12),
                  transform: propMode === 'shoulder_heavy' ? 'rotate(-16deg)' : 'rotate(8deg)',
                  transformOrigin: originPx(propW, propH, 0.25, 0.75),
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
                  ...noSquishStyle,
                  width: crookW,
                  height: crookH,
                  left: Math.round(armAW * 0.4),
                  top: Math.round(-armH * 0.3),
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

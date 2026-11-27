import React from 'react';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import { getVillagerMotion } from '../data/villagerMotion.js';
import { VILLAGER_PARTS_META, VILLAGER_PROP_MODE } from '../data/villagerRigConfig.js';

/**
 * 7-Layer Cutout Puppet Rig cho 22 dân làng Ma Chó:
 * Tất cả khớp vai, cổ, hông được neo theo biên thân áo thực tế (Socket Tuck sâu) bằng px nguyên tuyệt đối
 * để khi chạy nhanh, nhảy hay xoay người không bao giờ hở hoặc bay rời bộ phận.
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
  const torsoH = Math.round(size * 0.29);
  const armH = Math.round(size * 0.25);
  const legH = Math.round(size * 0.23);

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

  // Anchor neck, shoulders & hips directly onto torso bounding box so parts tuck snugly inside garments
  const torsoLeft = Math.round((size - torsoW) / 2);
  const torsoBottom = Math.round(size * 0.19);
  const torsoTop = size - torsoBottom - torsoH;

  const armTop = torsoTop + Math.round(torsoH * 0.08);
  const armALeft = Math.round(torsoLeft - armAW * 0.22);
  const armBLeft = Math.round(torsoLeft + torsoW - armBW * 0.78);

  const legBottom = Math.round(size * 0.05);
  const legALeft = Math.round(torsoLeft + torsoW * 0.14);
  const legBLeft = Math.round(torsoLeft + torsoW * 0.5);

  const headLeft = Math.round((size - headW) / 2);
  const headBottom = torsoBottom + torsoH - Math.round(size * 0.08);

  const showHeldProp = propMode !== 'skip' && propMode !== 'sheep_pet' && hasPart('prop');
  const propH = Math.round(size * 0.31);
  const propW = widthFromAspect('prop', propH);
  const crookH = Math.round(size * 0.4);
  const crookW = widthFromAspect('crook', crookH);

  const originPx = (w, h, xr, yr) => `${Math.round(w * xr)}px ${Math.round(h * yr)}px`;
  const noSquishStyle = { maxWidth: 'none', maxHeight: 'none' };

  return (
    <div
      className={`relative select-none pointer-events-none overflow-visible ${poseClass}`}
      style={{ width: size, height: size }}
    >
      {/* Optional Shepherd's Sheep trailing closely behind Bé Chăn Cừu */}
      {propMode === 'sheep_pet' && hasPart('sheep') && pose !== 'hanging' && (
        <img
          src={src('sheep')}
          alt=""
          draggable={false}
          className="rig-sheep absolute z-[1] object-contain"
          style={{
            ...noSquishStyle,
            width: Math.round(size * 0.32),
            height: Math.round(size * 0.26),
            left: Math.round(-size * 0.07),
            bottom: Math.round(size * 0.04),
          }}
        />
      )}

      {/* Main Articulated Body Group (1 single GPU plane keeps Mobile parts locked cleanly) */}
      <div
        className="rig-body relative w-full h-full overflow-visible"
        style={{ transformOrigin: originPx(size, size, 0.5, 0.88) }}
      >
        {/* LAYER 1: Back Arm (Tucked smoothly behind back shoulder) */}
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
              left: armBLeft,
              top: armTop,
              transformOrigin: originPx(armBW, armH, 0.45, 0.16),
            }}
          />
        )}

        {/* LAYER 2: Back Leg (Tucked deep inside trouser waist) */}
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
              left: legBLeft,
              bottom: legBottom,
              transformOrigin: originPx(legBW, legH, 0.45, 0.14),
            }}
          />
        )}

        {/* LAYER 3: Front Leg (Shoe pre-flipped right, tucked deep behind torso hem) */}
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
              left: legALeft,
              bottom: legBottom,
              transformOrigin: originPx(legAW, legH, 0.45, 0.14),
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
              left: torsoLeft,
              bottom: torsoBottom,
              transformOrigin: originPx(torsoW, torsoH, 0.5, 0.8),
            }}
          />
        )}

        {/* LAYER 5: Head (Overlaps torso collar snugly) */}
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
              left: headLeft,
              bottom: headBottom,
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
              width: Math.round(propW * 0.88),
              height: Math.round(propH * 0.88),
              left: Math.round(torsoLeft + torsoW * 0.58),
              bottom: torsoBottom,
              transformOrigin: originPx(Math.round(propW * 0.88), Math.round(propH * 0.88), 0.25, 0.5),
            }}
          />
        )}

        {hasPart('arm-a') && (
          <div
            className="rig-arm-a absolute z-[8] overflow-visible"
            style={{
              width: armAW,
              height: armH,
              left: armALeft,
              top: armTop,
              transformOrigin: originPx(armAW, armH, 0.5, 0.16),
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
                  left: propMode === 'shoulder_heavy' ? Math.round(-armAW * 0.28) : Math.round(armAW * 0.2),
                  top:
                    propMode === 'shoulder_heavy'
                      ? Math.round(-armH * 0.36)
                      : propMode === 'hand_cane'
                        ? Math.round(armH * 0.12)
                        : Math.round(-armH * 0.04),
                  transform: propMode === 'shoulder_heavy' ? 'rotate(-14deg)' : 'rotate(6deg)',
                  transformOrigin: originPx(propW, propH, 0.25, 0.78),
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
                  left: Math.round(armAW * 0.28),
                  top: Math.round(-armH * 0.25),
                }}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

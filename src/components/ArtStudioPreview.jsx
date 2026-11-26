import React, { useMemo, useState } from 'react';
import { ArrowLeft, Sun, Moon, Users, Eye, Sparkles, Grid, Sliders, Play } from 'lucide-react';
import { ROLES, VILLAGERS } from '../../shared/constants.js';
import { ARENA_LAYOUT, ASSET_PATHS } from '../../graphics-pack/themeConfig.js';
import { getVillagerMotion } from '../data/villagerMotion.js';
import PixelVillager from './PixelVillager.jsx';
import RoleIcon from './RoleIcon.jsx';

export default function ArtStudioPreview({ onExit }) {
  const [tab, setTab] = useState('arena'); // 'arena' | 'assets'
  const [isNight, setIsNight] = useState(true);
  const [playerCount, setPlayerCount] = useState(8);
  const [eyeMode, setEyeMode] = useState('mixed'); // 'mixed' | 'awake' | 'sleep' | 'wolf' | 'dead'
  const [assetBg, setAssetBg] = useState('checker'); // 'checker' | 'dark' | 'light'
  const [globalEmoteKey, setGlobalEmoteKey] = useState(null);
  const [assetPreviewState, setAssetPreviewState] = useState('idle'); // 'idle' | 'still' | 'sleep'

  // Live Arena Layout Sliders (matching themeConfig.js ARENA_LAYOUT)
  const [centerYRatio, setCenterYRatio] = useState(ARENA_LAYOUT.centerYOffsetRatio);
  const [rxRatio, setRxRatio] = useState(ARENA_LAYOUT.ellipseRxRatio);
  const [ryRatio, setRyRatio] = useState(ARENA_LAYOUT.ellipseRyRatio);
  const [spriteSize, setSpriteSize] = useState(ARENA_LAYOUT.spriteSizeDesktop);

  const samplePlayers = useMemo(() => {
    return VILLAGERS.slice(0, playerCount).map((v, idx) => ({
      id: v.id,
      name: v.name,
      avatarId: v.id,
      alive: eyeMode === 'dead' ? idx % 2 === 1 : true,
      eyeState:
        !isNight
          ? 'awake'
          : eyeMode === 'mixed'
            ? idx === 1 || idx === 5
              ? 'wolf'
              : 'sleep'
            : eyeMode === 'dead'
              ? 'sleep'
              : eyeMode,
    }));
  }, [playerCount, eyeMode, isNight]);

  const assetBgStyle =
    assetBg === 'checker'
      ? {
          backgroundImage:
            'linear-gradient(45deg, #2b3148 25%, transparent 25%), linear-gradient(-45deg, #2b3148 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #2b3148 75%), linear-gradient(-45deg, transparent 75%, #2b3148 75%)',
          backgroundSize: '16px 16px',
          backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px',
          backgroundColor: '#1d2235',
        }
      : assetBg === 'light'
        ? { backgroundColor: '#f1f5f9', color: '#0f172a' }
        : { backgroundColor: '#0e1324' };

  return (
    <div className="min-h-dvh w-full bg-[#0d1224] text-slate-100 flex flex-col">
      {/* Top Studio Bar */}
      <header className="px-3 py-2 bg-[#161b30] border-b-2 border-[#090b14] flex flex-wrap items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onExit}
            className="ggd-btn bg-[#272f52] text-white px-2.5 py-1.5 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Về Trang Chủ</span>
          </button>
          <div>
            <div className="font-brand text-sm text-amber-300">🎨 PHÒNG THỬ ĐỒ HỌA — MA CHÓ</div>
            <div className="text-[10.5px] text-slate-400">
              Thay ảnh trong <code className="text-sky-300">graphics-pack/assets/</code> để xem ngay
            </div>
          </div>
        </div>

        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => setTab('arena')}
            className={`ggd-btn px-3 py-1.5 text-xs ${
              tab === 'arena' ? 'bg-amber-400 text-black' : 'bg-[#252d4d] text-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Sân Làng Thực Tế</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('assets')}
            className={`ggd-btn px-3 py-1.5 text-xs ${
              tab === 'assets' ? 'bg-amber-400 text-black' : 'bg-[#252d4d] text-slate-200'
            }`}
          >
            <Grid className="w-3.5 h-3.5" />
            <span>Kiểm Tra Tất Cả Ảnh</span>
          </button>
        </div>
      </header>

      {tab === 'arena' ? (
        <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
          {/* Live Stage Preview */}
          <div className="relative flex-1 min-h-[420px] overflow-hidden bg-[#0b0e1a]">
            <div
              className="absolute inset-0 bg-cover bg-center transition-opacity duration-700"
              style={{
                backgroundImage: `url('${isNight ? ASSET_PATHS.nightBackground : ASSET_PATHS.dayBackground}')`,
              }}
            />

            {/* Campfire Center */}
            <div
              className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-none"
              style={{ top: `calc(50% + ${centerYRatio * 100}%)` }}
            >
              <img
                src={isNight ? ASSET_PATHS.campfireLit : ASSET_PATHS.campfireOut}
                alt="Campfire"
                className={`w-20 h-20 object-contain ${isNight ? 'anim-fire' : ''}`}
              />
            </div>

            {/* Villager Ring */}
            {samplePlayers.map((p, idx) => {
              const angle = (idx / Math.max(1, samplePlayers.length)) * Math.PI * 2 - Math.PI / 2;
              const xPct = Math.cos(angle) * rxRatio * 100;
              const yPct = Math.sin(angle) * ryRatio * 100;
              const depthNorm = (Math.sin(angle) + 1) / 2;
              const zOrder = 30 + Math.round(depthNorm * 40);
              const scale = 0.9 + depthNorm * 0.16;

              return (
                <div
                  key={p.id}
                  style={{
                    left: `calc(50% + ${xPct}%)`,
                    top: `calc(50% + ${centerYRatio * 100 + yPct}%)`,
                    transform: `translate(-50%, -50%) scale(${scale})`,
                    zIndex: zOrder,
                  }}
                  className="absolute flex flex-col items-center"
                >
                  <PixelVillager
                    avatarId={p.avatarId}
                    alive={p.alive}
                    size={spriteSize}
                    isNight={isNight}
                    eyeState={p.eyeState}
                    emoteKey={globalEmoteKey}
                    staggerIndex={idx}
                    enablePoke={true}
                  />
                  <span className="sc-nameplate mt-0.5 px-2.5 py-0.5 text-[10px] font-extrabold text-white whitespace-nowrap">
                    {p.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right Controls & Config Output */}
          <aside className="w-full lg:w-80 bg-[#14192d] border-t-2 lg:border-t-0 lg:border-l-2 border-[#090b14] p-3.5 flex flex-col gap-3 overflow-y-auto shrink-0">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsNight(false)}
                className={`ggd-btn flex-1 py-2 text-xs ${
                  !isNight ? 'bg-sky-400 text-black' : 'bg-[#252d4d] text-slate-200'
                }`}
              >
                <Sun className="w-4 h-4" /> Ban Ngày
              </button>
              <button
                type="button"
                onClick={() => setIsNight(true)}
                className={`ggd-btn flex-1 py-2 text-xs ${
                  isNight ? 'bg-indigo-500 text-white' : 'bg-[#252d4d] text-slate-200'
                }`}
              >
                <Moon className="w-4 h-4" /> Ban Đêm
              </button>
            </div>

            <div className="ggd-card-dark p-2.5 flex flex-col gap-2 text-xs">
              <label className="flex justify-between font-bold">
                <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Số người quanh lửa</span>
                <span className="text-amber-300">{playerCount}</span>
              </label>
              <input
                type="range"
                min="4"
                max="16"
                value={playerCount}
                onChange={(e) => setPlayerCount(Number(e.target.value))}
                className="w-full accent-amber-400"
              />

              <label className="font-bold flex items-center gap-1 mt-1">
                <Eye className="w-3.5 h-3.5" /> Trạng thái hiển thị
              </label>
              <select
                value={eyeMode}
                onChange={(e) => setEyeMode(e.target.value)}
                className="px-input text-xs py-1.5"
              >
                <option value="mixed">Hỗn hợp (Ngủ + 2 Sói mắt đỏ)</option>
                <option value="awake">Tất cả mở mắt</option>
                <option value="sleep">Tất cả ngủ (zZ)</option>
                <option value="wolf">Tất cả mắt đỏ Sói</option>
                <option value="dead">Xen kẽ Bia mộ Hồn ma</option>
              </select>

              <button
                type="button"
                onClick={() => setGlobalEmoteKey((k) => (k || 0) + 1)}
                className="ggd-btn bg-[#d65539] text-white py-2 text-xs mt-1"
              >
                <Play className="w-3.5 h-3.5" /> Diễn thử cả sân (Emote)
              </button>
            </div>

            <div className="ggd-card-dark p-2.5 flex flex-col gap-2 text-xs">
              <div className="font-bold text-amber-300 flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5" /> Căn chỉnh vòng tròn (themeConfig.js)
              </div>
              <label className="flex justify-between">
                <span>Dịch tâm dọc (centerYOffsetRatio)</span>
                <b>{centerYRatio.toFixed(2)}</b>
              </label>
              <input
                type="range"
                min="-0.1"
                max="0.18"
                step="0.01"
                value={centerYRatio}
                onChange={(e) => setCenterYRatio(parseFloat(e.target.value))}
                className="accent-sky-400"
              />
              <label className="flex justify-between">
                <span>Bán kính ngang (ellipseRxRatio)</span>
                <b>{rxRatio.toFixed(2)}</b>
              </label>
              <input
                type="range"
                min="0.2"
                max="0.44"
                step="0.01"
                value={rxRatio}
                onChange={(e) => setRxRatio(parseFloat(e.target.value))}
                className="accent-sky-400"
              />
              <label className="flex justify-between">
                <span>Bán kính dọc (ellipseRyRatio)</span>
                <b>{ryRatio.toFixed(2)}</b>
              </label>
              <input
                type="range"
                min="0.14"
                max="0.36"
                step="0.01"
                value={ryRatio}
                onChange={(e) => setRyRatio(parseFloat(e.target.value))}
                className="accent-sky-400"
              />
              <label className="flex justify-between">
                <span>Cỡ nhân vật (px)</span>
                <b>{spriteSize}px</b>
              </label>
              <input
                type="range"
                min="44"
                max="120"
                step="2"
                value={spriteSize}
                onChange={(e) => setSpriteSize(Number(e.target.value))}
                className="accent-sky-400"
              />
              <div className="text-[10.5px] text-slate-400 mt-1">
                Chạm vào bất kỳ nhân vật nào bên trái để test hiệu ứng Poke!
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto p-4 max-w-6xl mx-auto w-full flex flex-col gap-5">
          {/* Background Checker Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs text-slate-300">
              Bấm vào từng nhân vật để test hiệu ứng chạm. Kiểm tra viền cắt trên các nền khác nhau:
            </div>
            <div className="flex gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setAssetBg('checker')}
                className={`ggd-btn px-2.5 py-1 ${assetBg === 'checker' ? 'bg-amber-400 text-black' : 'bg-[#252d4d]'}`}
              >
                Nền caro trong suốt
              </button>
              <button
                type="button"
                onClick={() => setAssetBg('dark')}
                className={`ggd-btn px-2.5 py-1 ${assetBg === 'dark' ? 'bg-amber-400 text-black' : 'bg-[#252d4d]'}`}
              >
                Nền tối
              </button>
              <button
                type="button"
                onClick={() => setAssetBg('light')}
                className={`ggd-btn px-2.5 py-1 ${assetBg === 'light' ? 'bg-amber-400 text-black' : 'bg-[#252d4d]'}`}
              >
                Nền sáng
              </button>
            </div>
          </div>

          {/* 22 Characters */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
              <h2 className="font-brand text-sm text-amber-300">
                1. BỘ 22 DÂN LÀNG (graphics-pack/assets/ma-cho/&lt;slug&gt;/)
              </h2>
              <div className="flex gap-1 text-[11px]">
                {[
                  ['idle', 'Idle WebP'],
                  ['still', 'Icon 112px'],
                  ['sleep', 'Ngủ (sleep.png)'],
                ].map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAssetPreviewState(mode)}
                    className={`ggd-btn px-2 py-1 ${
                      assetPreviewState === mode ? 'bg-[#d65539] text-white' : 'bg-[#2a211f] text-slate-200'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
              {VILLAGERS.map((v, idx) => {
                const m = getVillagerMotion(v.id);
                return (
                  <div
                    key={v.id}
                    style={assetBgStyle}
                    className="rounded-xl border-2 border-[#090b14] p-2.5 flex flex-col items-center gap-1"
                  >
                    <PixelVillager
                      avatarId={v.id}
                      size={88}
                      still={assetPreviewState === 'still'}
                      eyeState={assetPreviewState === 'sleep' ? 'sleep' : 'awake'}
                      staggerIndex={idx}
                      enablePoke={true}
                    />
                    <div className="text-xs font-extrabold text-center">{v.name}</div>
                    <div className="text-[10px] text-amber-300/85 text-center leading-tight">{m.reaction}</div>
                    <code className="text-[10px] bg-black/50 text-sky-300 px-1.5 py-0.5 rounded">
                      {m.slug}
                    </code>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Props */}
          <section>
            <h2 className="font-brand text-sm text-amber-300 mb-2">
              2. VẬT THỂ & NỀN (backgrounds/ &amp; props/)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div style={assetBgStyle} className="rounded-xl border-2 border-[#090b14] p-2.5 flex flex-col items-center gap-1">
                <img src={ASSET_PATHS.campfireLit} alt="campfire_lit" className="w-20 h-20 object-contain" />
                <div className="text-xs font-bold">Lửa trại cháy</div>
                <code className="text-[10px] bg-black/50 text-sky-300 px-1.5 rounded">props/campfire_lit.png</code>
              </div>
              <div style={assetBgStyle} className="rounded-xl border-2 border-[#090b14] p-2.5 flex flex-col items-center gap-1">
                <PixelVillager avatarId="youth" alive={false} size={80} enablePoke={true} />
                <div className="text-xs font-bold">Bia mộ &amp; Hồn ma</div>
                <code className="text-[10px] bg-black/50 text-sky-300 px-1.5 rounded">props/ghost_tombstone.png</code>
              </div>
              <div className="rounded-xl border-2 border-[#090b14] bg-[#161c33] p-2 flex flex-col items-center gap-1">
                <img src={ASSET_PATHS.dayBackground} alt="bg_day" className="w-full h-20 object-cover rounded" />
                <code className="text-[10px] bg-black/50 text-sky-300 px-1.5 rounded">backgrounds/bg_day.jpg</code>
              </div>
              <div className="rounded-xl border-2 border-[#090b14] bg-[#161c33] p-2 flex flex-col items-center gap-1">
                <img src={ASSET_PATHS.nightBackground} alt="bg_night" className="w-full h-20 object-cover rounded" />
                <code className="text-[10px] bg-black/50 text-sky-300 px-1.5 rounded">backgrounds/bg_night.jpg</code>
              </div>
            </div>
          </section>

          {/* 11 Role Icons */}
          <section className="pb-6">
            <h2 className="font-brand text-sm text-amber-300 mb-2">
              3. ICON 11 VAI TRÒ (graphics-pack/assets/roles/&lt;id&gt;.png — Tùy chọn, chưa có sẽ dùng Emoji)
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Object.values(ROLES).map((role) => (
                <div
                  key={role.id}
                  style={assetBgStyle}
                  className="rounded-xl border-2 border-[#090b14] p-2.5 flex flex-col items-center gap-1"
                >
                  <RoleIcon role={role} className="w-12 h-12" emojiClass="text-3xl" />
                  <div className="text-xs font-extrabold text-center" style={{ color: role.color }}>
                    {role.name}
                  </div>
                  <code className="text-[10px] bg-black/50 text-sky-300 px-1.5 rounded">
                    {role.id}.png
                  </code>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

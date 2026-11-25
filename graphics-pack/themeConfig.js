// ============================================================================
// CẤU HÌNH ĐỒ HỌA TẬP TRUNG — GAME "MA CHÓ"
// Bạn thiết kế có thể chỉnh vị trí vòng tròn, kích thước nhân vật và hiệu ứng chạm
// ngay tại file này mà không cần đụng vào code logic của game!
// ============================================================================

export const BRAND = {
  title: 'MA CHÓ',
  badge: '2D PARTY GAME EDITION',
};

// Đường dẫn ảnh (tương ứng với các thư mục bên trong graphics-pack/assets/)
export const ASSET_PATHS = {
  dayBackground: '/backgrounds/bg_day.jpg',
  nightBackground: '/backgrounds/bg_night.jpg',
  lobbyBackground: '/backgrounds/bg_night.jpg',
  character: (id) => `/characters/${id}.png`,
  characterState: (id, state) => `/characters/${id}_${state}.png`, // state: 'sleep' | 'talk' | 'poke'
  campfireLit: '/props/campfire_lit.png',
  campfireOut: '/props/campfire_out.png',
  ghostTombstone: '/props/ghost_tombstone.png',
  roleIcon: (roleId) => `/roles/${roleId}.png`,
  throwable: (itemId) => `/throwables/${itemId}.png`,
};

// Cấu hình Sprite Sheet nhiều khung hình (tùy chọn — nếu bạn thiết kế vẽ dải ngang nhiều frame)
// Ví dụ: { drunkard: { idleFrames: 4, sleepFrames: 2, fps: 6 } }
// Nếu để trống {}, game tự động dùng hoạt ảnh thở/ngủ/nói/chạm mượt cho ảnh đơn!
export const SPRITE_SHEETS = {};

// Căn chỉnh vị trí vòng tròn nhân vật & kích thước trên nền quảng trường
// (Bạn có thể mở màn hình ?preview=art để kéo thanh trượt tìm số đẹp rồi dán vào đây!)
export const ARENA_LAYOUT = {
  centerYOffsetRatio: 0.04, // Dịch tâm vòng tròn xuống nhẹ để hở bầu trời phía trên
  ellipseRxRatio: 0.31,     // Bán kính ngang của vòng tròn (so với chiều rộng màn hình)
  ellipseRyRatio: 0.24,     // Bán kính dọc của vòng tròn (tạo góc nhìn 2.5D xiên)
  spriteSizeDesktop: 84,    // Kích thước nhân vật trên máy tính (px)
  spriteSizeTablet: 68,     // Kích thước nhân vật trên tablet / màn hình vừa (px)
  spriteSizeMobile: 54,     // Kích thước nhân vật trên điện thoại (px)
};

// Hiệu ứng khi chạm vào từng nhân vật trong 22 dân làng
// anim: 'anim-poke-tickle' | 'anim-poke-chop' | 'anim-poke-stagger' | 'anim-poke-spin'
export const POKE_EFFECTS = {
  drunkard:   { anim: 'anim-poke-stagger', sfx: 'glass',     particles: ['🍾', '💚', '✨', '🥴'], caption: 'CHOANG!' },
  florist:    { anim: 'anim-poke-tickle',  sfx: 'chime',     particles: ['🌸', '🌺', '🌼', '💮'], caption: 'Hihi nhột!' },
  butcher:    { anim: 'anim-poke-chop',    sfx: 'chop',      particles: ['🔪', '💥', '💢', '🥩'], slash: true, caption: 'PHẬP!' },
  waterpipe:  { anim: 'anim-poke-stagger', sfx: 'waterpipe', particles: ['💨', '☁️', '💨', '🌫️'], caption: 'ROẸT~' },
  smoker:     { anim: 'anim-poke-tickle',  sfx: 'cough',     particles: ['💨', '🚬', '💭', '💨'], caption: 'Khụ khụ!' },
  madman:     { anim: 'anim-poke-spin',    sfx: 'boing',     particles: ['💫', '⭐', '🔩', '🤪'], caption: 'BOONG!' },
  glutton:    { anim: 'anim-poke-tickle',  sfx: 'pop',       particles: ['🍗', '🦴', '😋', '🍖'], caption: 'Ngoạm!' },
  beggar:     { anim: 'anim-poke-tickle',  sfx: 'coin',      particles: ['🪙', '🪰', '🥣', '✨'], caption: 'Keng keng!' },
  blacksmith: { anim: 'anim-poke-chop',    sfx: 'anvil',     particles: ['🔥', '✨', '⚡', '🔨'], slash: true, caption: 'KENG!' },
  oldman:     { anim: 'anim-poke-stagger', sfx: 'woodblock', particles: ['🦯', '💢', '💨', '😤'], caption: 'Cốc cốc!' },
  oldwoman:   { anim: 'anim-poke-tickle',  sfx: 'pop',       particles: ['👓', '😲', '🧶', '✨'], caption: 'Ối giời!' },
  kid:        { anim: 'anim-poke-spin',    sfx: 'boing',     particles: ['🪨', '💨', '😜', '⭐'], caption: 'CHÍU!' },
  youth:      { anim: 'anim-poke-tickle',  sfx: 'chime',     particles: ['✨', '⚡', '😎', '🌟'], caption: 'Ngầu!' },
  grocer:     { anim: 'anim-poke-tickle',  sfx: 'coin',      particles: ['🪙', '📒', '💰', '✨'], caption: 'Tính sổ!' },
  farmer:     { anim: 'anim-poke-chop',    sfx: 'chop',      particles: ['🌾', '🌱', '🌾', '💦'], slash: true, caption: 'Phập!' },
  baker:      { anim: 'anim-poke-tickle',  sfx: 'pop',       particles: ['🥖', '🥐', '💨', '✨'], caption: 'Thơm lừng!' },
  fisher:     { anim: 'anim-poke-chop',    sfx: 'splash',    particles: ['🐟', '💦', '💧', '🐠'], caption: 'Búng!' },
  tailor:     { anim: 'anim-poke-tickle',  sfx: 'scissor',   particles: ['✂️', '🎀', '🧵', '✨'], caption: 'Xoẹt xoẹt!' },
  lumberjack: { anim: 'anim-poke-chop',    sfx: 'chop',      particles: ['🪵', '💥', '🪓', '🍂'], slash: true, caption: 'CỐP!' },
  herbalist:  { anim: 'anim-poke-tickle',  sfx: 'chime',     particles: ['🌿', '✨', '🍃', '💚'], caption: 'Thơm mát!' },
  watchman:   { anim: 'anim-poke-chop',    sfx: 'woodblock', particles: ['🏮', '✨', '🔔', '💛'], caption: 'CỐC CỐC!' },
  shepherd:   { anim: 'anim-poke-tickle',  sfx: 'boing',     particles: ['🐑', '💨', '🌿', '✨'], caption: 'Beee~' },
};

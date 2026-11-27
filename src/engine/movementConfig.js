// ============================================================================
// CẤU HÌNH ĐIỀU KHIỂN, VẬT LÝ 2.5D & SÂN ĐÌNH — GAME "MA CHÓ"
// Mọi thông số bên dưới đều có thể tự chỉnh sửa trực tiếp hoặc qua Menu ESC!
// ============================================================================

export const WORLD_WIDTH = 1600;
export const WORLD_HEIGHT = 900;

export const DEFAULT_MOVEMENT_CONFIG = {
  // Tốc độ di chuyển cơ bản (đơn vị world/giây trong không gian chuẩn 1600x900)
  walkSpeed: 235,
  runMultiplier: 1.55,
  nightWolfSpeedMultiplier: 1.24,
  ghostSpeedMultiplier: 1.22,
  joystickRunThreshold: 0.78, // Kéo > 78% bán kính Joystick sẽ tự chuyển sang Run
  joystickDeadzone: 0.12,

  // Nhảy trục Z
  jumpVelocity: 455,
  gravity: 1380,

  // Đấm & Đá vật lý (Party Brawl — 0% ảnh hưởng máu hay kết quả Ma Sói)
  punchRange: 98,
  punchForce: 390,
  punchCooldownMs: 420,
  punchDurationMs: 260,

  kickRange: 120,
  kickForce: 660,
  kickJumpVz: 275,
  kickCooldownMs: 850,
  kickDurationMs: 360,
  kickHitstunMs: 380,

  meleeAutoAimDeg: 125, // Góc quạt tự ngắm nhẹ về mục tiêu đứng gần trước mặt
  knockbackDrag: 8.5,

  // Va chạm mềm ở bàn chân (giữ đầu/mũ tạo chiều sâu 2.5D)
  colliderRadius: 22,

  // Tầm sử dụng kỹ năng / Cắn ban đêm khi tới gần mục tiêu đang ngủ
  nightActionRange: 118,

  // Đồng bộ mạng
  networkSendHz: 16,
};

// Tâm đống lửa & Sân gạch đỏ Bát Tràng (khớp ARENA_LAYOUT centerYOffsetRatio: 0.11 -> 0.61 * 900 = 549)
export const CAMPFIRE_POS = { x: 800, y: 549 };

// Vị trí Giá Treo Cổ ở phía Bắc Sân Đình (khoảng trống giữa Cây Đa và Thềm Đình)
export const GALLOWS_POS = {
  x: 745,
  y: 252,
  standY: 295, // Tọa độ nhân vật đứng trăn trối trước Giá Treo Cổ
  slotOffsetsX: [-68, -22, 24, 70], // 4 vị trí dây treo xác qua các ngày
};

// Giới hạn đi lại trên Sân Đình (hình elip + cắt mép trên/dưới khớp tường bao & mái tiền cảnh)
export const ARENA_WALKABLE_BOUNDS = {
  cx: 800,
  cy: 552,
  rx: 685,
  ry: 300,
  minX: 115,
  maxX: 1485,
  minY: 272,
  maxY: 838,
};

// Các vật thể có Collision rắn trên Sân Đình 2.5D
export const ARENA_COLLIDERS = [
  { id: 'campfire', label: 'Đống lửa trại', shape: 'circle', x: 800, y: 552, r: 44 },
  { id: 'well', label: 'Giếng đá cổ', shape: 'circle', x: 222, y: 636, r: 58 },
  { id: 'banyan', label: 'Gốc cây đa', shape: 'circle', x: 272, y: 404, r: 78 },
  { id: 'tea_stall', label: 'Quán trà tre', shape: 'circle', x: 1388, y: 492, r: 66 },
  { id: 'temple_steps', label: 'Thềm Đình Làng', shape: 'aabb', minX: 915, maxX: 1300, minY: 180, maxY: 342 },
  { id: 'gallows_base', label: 'Chân Giá Treo Cổ', shape: 'aabb', minX: 625, maxX: 865, minY: 195, maxY: 282 },
];

// Tính tọa độ xếp vòng tròn quanh đống lửa (Spawn Lobby / Đầu Ngày / Xếp hàng Ngủ)
export function getRingSpawnPosition(index, total, radiusScale = 1) {
  const count = Math.max(1, total);
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  const rx = 390 * radiusScale;
  const ry = 195 * radiusScale;
  return {
    x: Math.round(CAMPFIRE_POS.x + Math.cos(angle) * rx),
    y: Math.round(CAMPFIRE_POS.y + Math.sin(angle) * ry),
  };
}

// Tính tọa độ xếp vòng cung dưới chân Giá Treo Cổ khi xử án (DAY_DEFENSE / DAY_VERDICT)
export function getTrialAudiencePosition(index, total) {
  const count = Math.max(1, total);
  const t = count === 1 ? 0.5 : index / (count - 1);
  const angle = Math.PI * (0.15 + t * 0.7); // Hình vòng cung phía dưới Giá Treo Cổ
  return {
    x: Math.round(GALLOWS_POS.x + Math.cos(angle) * 340),
    y: Math.round(GALLOWS_POS.standY + 125 + Math.sin(angle) * 185),
  };
}

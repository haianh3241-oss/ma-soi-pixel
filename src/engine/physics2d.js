import {
  ARENA_COLLIDERS,
  ARENA_WALKABLE_BOUNDS,
  DEFAULT_MOVEMENT_CONFIG,
} from './movementConfig.js';

export const LEFT_CODES = new Set(['KeyA', 'ArrowLeft']);
export const RIGHT_CODES = new Set(['KeyD', 'ArrowRight']);
export const UP_CODES = new Set(['KeyW', 'ArrowUp']);
export const DOWN_CODES = new Set(['KeyS', 'ArrowDown']);

/**
 * Xử lý ưu tiên phím nhấn sau cùng (SOCD Last-Key Priority) theo mã phím cứng e.code
 * để chống kẹt hướng khi bật Unikey/Telex hoặc nhấn đồng thời 2 phím ngược chiều.
 */
export function resolveDirectionalAxes(horizStack, vertStack) {
  const lastH = horizStack.length > 0 ? horizStack[horizStack.length - 1] : null;
  const lastV = vertStack.length > 0 ? vertStack[vertStack.length - 1] : null;
  const ix = lastH ? (RIGHT_CODES.has(lastH) ? 1 : -1) : 0;
  const iy = lastV ? (DOWN_CODES.has(lastV) ? 1 : -1) : 0;
  return { ix, iy };
}

/**
 * Chuẩn hóa Vector2 để nhân vật di chuyển chéo không nhanh hơn di chuyển thẳng.
 * @param {number} ix
 * @param {number} iy
 * @returns {{ x: number, y: number, magnitude: number }}
 */
export function normalizeInputVector(ix, iy) {
  const rawX = Number(ix) || 0;
  const rawY = Number(iy) || 0;
  const mag = Math.hypot(rawX, rawY);
  if (mag < 1e-5) {
    return { x: 0, y: 0, magnitude: 0 };
  }
  const clampedMag = Math.min(1, mag);
  return {
    x: rawX / mag,
    y: rawY / mag,
    magnitude: clampedMag,
  };
}

/**
 * Mô phỏng nhảy trục Z tách biệt thân khỏi bóng đổ mặt đất.
 */
export function stepJumpPhysics(actor, dt, gravity = DEFAULT_MOVEMENT_CONFIG.gravity) {
  let z = actor.z || 0;
  let vz = actor.vz || 0;
  let justLanded = false;

  if (z > 0 || vz > 0) {
    z += vz * dt;
    vz -= gravity * dt;
    if (z <= 0) {
      z = 0;
      vz = 0;
      justLanded = true;
    }
  }

  return { z, vz, justLanded };
}

/**
 * Giải quyết va chạm mượt (Wall Sliding) — không cho xuyên tường bao Sân Đình hoặc vật cản rắn.
 */
export function resolveWorldCollisions(
  posX,
  posY,
  radius = DEFAULT_MOVEMENT_CONFIG.colliderRadius,
  {
    ignoreObstacles = false,
    bounds = ARENA_WALKABLE_BOUNDS,
    colliders = ARENA_COLLIDERS,
  } = {}
) {
  let x = Number.isFinite(posX) ? posX : bounds.cx;
  let y = Number.isFinite(posY) ? posY : bounds.cy;

  // 1. Giữ trong hình chữ nhật an toàn
  x = Math.max(bounds.minX + radius, Math.min(bounds.maxX - radius, x));
  y = Math.max(bounds.minY + radius, Math.min(bounds.maxY - radius, y));

  // 2. Giữ bên trong hàng rào elip của Sân Đình (trượt êm dọc theo cung elip)
  const effRx = Math.max(40, bounds.rx - radius);
  const effRy = Math.max(40, bounds.ry - radius);
  const dxE = (x - bounds.cx) / effRx;
  const dyE = (y - bounds.cy) / effRy;
  const distE = Math.hypot(dxE, dyE);
  if (distE > 1) {
    x = bounds.cx + (dxE / distE) * effRx;
    y = bounds.cy + (dyE / distE) * effRy;
  }

  if (ignoreObstacles) {
    return { x, y };
  }

  // 3. Đẩy trượt ra ngoài các vật cản rắn (Circle & AABB) — lặp 2 pass để tránh kẹt góc
  for (let pass = 0; pass < 2; pass++) {
    for (const col of colliders) {
      if (col.shape === 'circle') {
        const minDist = col.r + radius;
        const dx = x - col.x;
        const dy = y - col.y;
        const d = Math.hypot(dx, dy);
        if (d < minDist) {
          if (d < 1e-4) {
            y = col.y + minDist;
          } else {
            x = col.x + (dx / d) * minDist;
            y = col.y + (dy / d) * minDist;
          }
        }
      } else if (col.shape === 'aabb') {
        const nearestX = Math.max(col.minX, Math.min(col.maxX, x));
        const nearestY = Math.max(col.minY, Math.min(col.maxY, y));
        const dx = x - nearestX;
        const dy = y - nearestY;
        const d = Math.hypot(dx, dy);

        if (d < radius) {
          if (d > 1e-4) {
            x = nearestX + (dx / d) * radius;
            y = nearestY + (dy / d) * radius;
          } else {
            // Điểm tâm nằm lọt hẳn trong AABB -> đẩy ra cạnh gần nhất
            const left = Math.abs(x - col.minX);
            const right = Math.abs(col.maxX - x);
            const top = Math.abs(y - col.minY);
            const bottom = Math.abs(col.maxY - y);
            const m = Math.min(left, right, top, bottom);
            if (m === bottom) y = col.maxY + radius;
            else if (m === top) y = col.minY - radius;
            else if (m === left) x = col.minX - radius;
            else x = col.maxX + radius;
          }
        }
      }
    }
  }

  return { x, y };
}

/**
 * Tìm các mục tiêu nằm trong hình quạt Đấm/Đá phía trước (có Soft Auto-Aim kiểu Soul Knight).
 */
export function findMeleeTargetsInCone({
  attacker,
  actors,
  dirX,
  dirY,
  range,
  coneDeg = DEFAULT_MOVEMENT_CONFIG.meleeAutoAimDeg,
  excludeIds = new Set(),
}) {
  const norm = normalizeInputVector(dirX, dirY);
  const fx = norm.magnitude > 0 ? norm.x : attacker.facing >= 0 ? 1 : -1;
  const fy = norm.magnitude > 0 ? norm.y : 0;
  const minCos = Math.cos(((coneDeg / 2) * Math.PI) / 180);

  const candidates = [];
  for (const target of actors) {
    if (!target || target.id === attacker.id || excludeIds.has(target.id)) continue;
    const dx = target.x - attacker.x;
    const dy = target.y - attacker.y;
    const dist = Math.hypot(dx, dy);
    if (dist > range) continue;

    if (dist < 28) {
      candidates.push({ target, dist, nx: fx, ny: fy });
      continue;
    }
    const nx = dx / dist;
    const ny = dy / dist;
    const dot = nx * fx + ny * fy;
    if (dot >= minCos) {
      candidates.push({ target, dist, nx, ny });
    }
  }

  // Fallback nhẹ: nếu không có ai trong quạt trước mặt nhưng có người đứng rất sát (< 52u)
  if (candidates.length === 0) {
    for (const target of actors) {
      if (!target || target.id === attacker.id || excludeIds.has(target.id)) continue;
      const dx = target.x - attacker.x;
      const dy = target.y - attacker.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= Math.min(54, range * 0.6)) {
        const nx = dist > 1e-4 ? dx / dist : fx;
        const ny = dist > 1e-4 ? dy / dist : fy;
        candidates.push({ target, dist, nx, ny });
      }
    }
  }

  candidates.sort((a, b) => a.dist - b.dist);
  return candidates;
}

/**
 * Cập nhật 1 bước vật lý cho nhân vật (Input 8 hướng chuẩn hóa + Knockback + Nhảy Z + Va chạm mượt).
 */
export function stepActorPhysics(actor, input, dt, options = {}) {
  const cfg = { ...DEFAULT_MOVEMENT_CONFIG, ...(options.config || {}) };
  const clampedDt = Math.min(0.05, Math.max(0.001, dt));
  const hitstunFactor = options.isStunned ? 0.85 : 0;

  const vec = normalizeInputVector(input.ix, input.iy);
  const canMove = options.canMove !== false;
  const isMoving = canMove && vec.magnitude > 0;
  const isRunning = isMoving && Boolean(input.isRunning);

  let baseSpeed = options.speedOverride || cfg.walkSpeed;
  if (isRunning) baseSpeed *= cfg.runMultiplier;

  const moveVx = isMoving ? vec.x * baseSpeed * (1 - hitstunFactor) : 0;
  const moveVy = isMoving ? vec.y * baseSpeed * (1 - hitstunFactor) : 0;

  let kx = actor.kx || 0;
  let ky = actor.ky || 0;

  const rawX = actor.x + (moveVx + kx) * clampedDt;
  const rawY = actor.y + (moveVy + ky) * clampedDt;

  // Giảm tốc knockback theo hàm mũ mượt
  const decay = Math.exp(-cfg.knockbackDrag * clampedDt);
  kx *= decay;
  ky *= decay;
  if (Math.hypot(kx, ky) < 6) {
    kx = 0;
    ky = 0;
  }

  const jump = stepJumpPhysics(actor, clampedDt, cfg.gravity);
  const obsOpts = { ignoreObstacles: Boolean(options.ignoreObstacles) };
  // Separate X then Y wall-slide pass for ultra-smooth diagonal gliding along obstacles
  const stepX = resolveWorldCollisions(rawX, actor.y, cfg.colliderRadius, obsOpts);
  const resolved = resolveWorldCollisions(stepX.x, rawY, cfg.colliderRadius, obsOpts);

  // Cập nhật hướng nhìn ưu tiên theo Input di chuyển hoặc chuột nếu đứng yên
  let facing = actor.facing || 1;
  if (isMoving && Math.abs(vec.x) > 0.15) {
    facing = vec.x > 0 ? 1 : -1;
  } else if (typeof input.lookDx === 'number' && Math.abs(input.lookDx) > 8 && !isMoving) {
    facing = input.lookDx > 0 ? 1 : -1;
  }

  return {
    x: resolved.x,
    y: resolved.y,
    z: jump.z,
    vz: jump.vz,
    justLanded: jump.justLanded,
    vx: moveVx + kx,
    vy: moveVy + ky,
    kx,
    ky,
    facing,
    isMoving,
    isRunning,
  };
}

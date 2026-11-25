export const VILLAGERS = [
  { id: 'drunkard', name: 'Gã Bợm Rượu', tag: 'Chai rượu nát', bg: '#701a75', accent: '#4ade80' },
  { id: 'madman', name: 'Thằng Điên', tag: 'Nồi úp đầu', bg: '#7f1d1d', accent: '#f59e0b' },
  { id: 'glutton', name: 'Anh Chàng Tham Ăn', tag: 'Ôm đùi gà', bg: '#78350f', accent: '#fb923c' },
  { id: 'beggar', name: 'Gã Ăn Xin', tag: 'Bát mẻ', bg: '#44403c', accent: '#a8a29e' },
  { id: 'smoker', name: 'Gã Nghiện Thuốc Lá', tag: 'Phì phèo khói', bg: '#312e81', accent: '#94a3b8' },
  { id: 'waterpipe', name: 'Anh Hút Thuốc Lào', tag: 'Điếu cày tre', bg: '#14532d', accent: '#84cc16' },
  { id: 'blacksmith', name: 'Anh Thợ Rèn', tag: 'Búa tạ', bg: '#3f3f46', accent: '#ef4444' },
  { id: 'oldman', name: 'Ông Già', tag: 'Râu bạc', bg: '#1e293b', accent: '#cbd5e1' },
  { id: 'oldwoman', name: 'Bà Cụ', tag: 'Khăn choàng', bg: '#581c87', accent: '#e9d5ff' },
  { id: 'kid', name: 'Trẻ Con', tag: 'Mũ chong chóng', bg: '#0369a1', accent: '#38bdf8' },
  { id: 'youth', name: 'Anh Thanh Niên', tag: 'Khăn quàng đỏ', bg: '#0f766e', accent: '#2dd4bf' },
  { id: 'grocer', name: 'Anh Tạp Hóa', tag: 'Ôm sổ nợ', bg: '#365314', accent: '#bef264' },
  { id: 'florist', name: 'Cô Bán Hoa', tag: 'Giỏ hoa tươi', bg: '#831843', accent: '#f472b6' },
  { id: 'butcher', name: 'Anh Bán Thịt', tag: 'Dao phay', bg: '#7f1d1d', accent: '#fca5a5' },
  { id: 'farmer', name: 'Bác Nông Dân', tag: 'Nón rơm', bg: '#713f12', accent: '#facc15' },
  { id: 'baker', name: 'Chị Thợ Bánh', tag: 'Ổ bánh mì', bg: '#9a3412', accent: '#fdba74' },
  { id: 'fisher', name: 'Anh Đánh Cá', tag: 'Cần câu trúc', bg: '#1e3a8a', accent: '#60a5fa' },
  { id: 'tailor', name: 'Cô Thợ May', tag: 'Kính & cuộn chỉ', bg: '#701a75', accent: '#e879f9' },
  { id: 'lumberjack', name: 'Chú Tiều Phu', tag: 'Áo caro & rìu', bg: '#7c2d12', accent: '#f87171' },
  { id: 'herbalist', name: 'Cô Thảo Dược', tag: 'Giỏ lá thuốc', bg: '#064e3b', accent: '#34d399' },
  { id: 'watchman', name: 'Anh Gác Đêm', tag: 'Đèn lồng', bg: '#172554', accent: '#fde047' },
  { id: 'shepherd', name: 'Bé Chăn Cừu', tag: 'Gậy móc & cừu', bg: '#3f6212', accent: '#fef08a' },
];

export const ROLES = {
  villager: {
    id: 'villager',
    name: 'Dân Làng',
    team: 'village',
    teamName: 'Phe Dân Làng',
    color: '#4ade80',
    icon: '🧑‍🌾',
    summary: 'Không có kỹ năng ban đêm. Dùng trí tuệ, lá phiếu và khả năng quan sát để tìm ra Ma Sói.',
    winCondition: 'Tiêu diệt toàn bộ phe Ma Sói.',
    hasNightAction: false,
  },
  mayor: {
    id: 'mayor',
    name: 'Thị Trưởng',
    team: 'village',
    teamName: 'Phe Dân Làng',
    color: '#fbbf24',
    icon: '🎖️',
    summary: 'Lá phiếu treo cổ và phán quyết giữ/hủy án vào ban ngày của Thị Trưởng luôn được tính bằng 2 PHIẾU.',
    winCondition: 'Tiêu diệt toàn bộ phe Ma Sói.',
    hasNightAction: false,
  },
  seer: {
    id: 'seer',
    name: 'Tiên Tri',
    team: 'village',
    teamName: 'Phe Dân Làng',
    color: '#60a5fa',
    icon: '🔮',
    summary: 'Mỗi đêm chọn 1 người để soi xem họ thuộc phe Ma Sói hay Không phải Sói.',
    winCondition: 'Tiêu diệt toàn bộ phe Ma Sói.',
    hasNightAction: true,
  },
  guard: {
    id: 'guard',
    name: 'Bảo Vệ',
    team: 'village',
    teamName: 'Phe Dân Làng',
    color: '#38bdf8',
    icon: '🛡️',
    summary: 'Mỗi đêm chọn 1 người (kể cả bản thân) để che chở khỏi nanh vuốt Ma Sói. Không được bảo vệ cùng 1 người 2 đêm liên tiếp.',
    winCondition: 'Tiêu diệt toàn bộ phe Ma Sói.',
    hasNightAction: true,
  },
  witch: {
    id: 'witch',
    name: 'Phù Thủy',
    team: 'village',
    teamName: 'Phe Dân Làng',
    color: '#c084fc',
    icon: '🧪',
    summary: 'Sở hữu 1 bình Cứu (cứu nạn nhân bị Sói cắn đêm đó) và 1 bình Độc (giết thêm 1 người bất kỳ). Mỗi bình dùng 1 lần cả ván.',
    winCondition: 'Tiêu diệt toàn bộ phe Ma Sói.',
    hasNightAction: true,
  },
  hunter: {
    id: 'hunter',
    name: 'Thợ Săn',
    team: 'village',
    teamName: 'Phe Dân Làng',
    color: '#fb923c',
    icon: '🏹',
    summary: 'Khi thiệt mạng (bất kể ban đêm hay bị treo cổ), được nổ súng bắn kéo theo 1 người chơi còn sống trước khi ngã xuống.',
    winCondition: 'Tiêu diệt toàn bộ phe Ma Sói.',
    hasNightAction: false,
  },
  elder: {
    id: 'elder',
    name: 'Già Làng',
    team: 'village',
    teamName: 'Phe Dân Làng',
    color: '#eab308',
    icon: '👴',
    summary: 'Có 2 mạng trước nanh vuốt Ma Sói (lần cắn đầu không chết). CẢNH BÁO: Nếu Dân Làng treo cổ nhầm, hoặc Phù Thủy/Thợ Săn giết nhầm Già Làng, toàn bộ chức năng phe Dân mất quyền năng!',
    winCondition: 'Tiêu diệt toàn bộ phe Ma Sói.',
    hasNightAction: false,
  },
  cupid: {
    id: 'cupid',
    name: 'Thần Tình Yêu',
    team: 'village',
    teamName: 'Phe Dân Làng',
    color: '#f472b6',
    icon: '💘',
    summary: 'Đêm đầu tiên bắn mũi tên ghép đôi 2 người thành Cặp Đôi. Nếu 1 người chết, người kia cũng chết theo vì thất tình.',
    winCondition: 'Tiêu diệt toàn bộ phe Ma Sói (hoặc thắng cùng Cặp Đôi nếu bạn ghép chính mình với Sói).',
    hasNightAction: true,
  },
  werewolf: {
    id: 'werewolf',
    name: 'Ma Sói',
    team: 'wolf',
    teamName: 'Phe Ma Sói',
    color: '#f87171',
    icon: '🐺',
    summary: 'Mỗi đêm thức dậy, bàn bạc qua Voice/Chat kín với đồng loại và chọn 1 nạn nhân để cắn.',
    winCondition: 'Số Ma Sói còn sống lớn hơn hoặc bằng tổng số người chơi khác còn sống.',
    hasNightAction: true,
  },
  cursed_wolf: {
    id: 'cursed_wolf',
    name: 'Sói Nguyền',
    team: 'wolf',
    teamName: 'Phe Ma Sói',
    color: '#dc2626',
    icon: '🩸',
    summary: 'Đi săn cùng bầy Sói. Duy nhất 1 lần trong ván, có thể nguyền rủa để BIẾN nạn nhân bị Sói cắn đêm đó thành Ma Sói thay vì giết chết!',
    winCondition: 'Số Ma Sói còn sống lớn hơn hoặc bằng tổng số người chơi khác còn sống.',
    hasNightAction: true,
  },
  jester: {
    id: 'jester',
    name: 'Kẻ Chán Đời',
    team: 'third',
    teamName: 'Phe Thứ Ba',
    color: '#e879f9',
    icon: '🤡',
    summary: 'Chán sống nhưng thích diễn kịch! Mục tiêu duy nhất của bạn là lừa Dân Làng chốt án TREO CỔ bạn vào ban ngày.',
    winCondition: 'Thắng NGAY LẬP TỨC nếu bị Dân Làng treo cổ ở Pha Phán Quyết!',
    hasNightAction: false,
  },
};

export const INTERACTIONS = [
  { id: 'egg', label: 'Ném trứng', emoji: '🥚', type: 'throw', roastType: 'hostile', sfx: 'splat' },
  { id: 'poop', label: 'Ném phân', emoji: '💩', type: 'throw', roastType: 'hostile', sfx: 'splat' },
  { id: 'tomato', label: 'Ném cà chua', emoji: '🍅', type: 'throw', roastType: 'hostile', sfx: 'splat' },
  { id: 'badminton', label: 'Đập cầu lông', emoji: '🏸', type: 'throw', roastType: 'hostile', sfx: 'smash' },
  { id: 'beer', label: 'Cụng ly bia', emoji: '🍻', type: 'throw', roastType: 'friendly', sfx: 'clink' },
  { id: 'flower', label: 'Tặng hoa', emoji: '💐', type: 'throw', roastType: 'love', sfx: 'chime' },
  { id: 'heart', label: 'Thả tim', emoji: '💖', type: 'throw', roastType: 'love', sfx: 'chime' },
  { id: 'raise_hand', label: 'Giơ tay nói', emoji: '✋', type: 'self', roastType: 'neutral', sfx: 'pop' },
  { id: 'suspect', label: 'Nghi hoặc', emoji: '🤔', type: 'self', roastType: 'neutral', sfx: 'pop' },
  { id: 'shock', label: 'Hốt hoảng', emoji: '😱', type: 'self', roastType: 'neutral', sfx: 'pop' },
  { id: 'laugh', label: 'Cười lăn', emoji: '😂', type: 'self', roastType: 'neutral', sfx: 'pop' },
];

export const SUSPECT_TAGS = [
  { id: 'wolf', label: 'Nghi Sói', icon: '🐺', color: '#ef4444' },
  { id: 'trust', label: 'Đáng tin', icon: '✅', color: '#22c55e' },
  { id: 'unsure', label: 'Khó đoán', icon: '❓', color: '#eab308' },
  { id: 'seer', label: 'Tiên Tri?', icon: '🔮', color: '#60a5fa' },
  { id: 'guard', label: 'Bảo Vệ?', icon: '🛡️', color: '#38bdf8' },
  { id: 'mayor', label: 'Thị Trưởng?', icon: '🎖️', color: '#fbbf24' },
  { id: 'jester', label: 'Chán Đời?', icon: '🤡', color: '#e879f9' },
];

export const ROAST_STICKERS = [
  { id: 'ngu', label: 'NGU', icon: '🧠', color: '#ef4444', desc: 'Pha bóp team đi vào lòng đất' },
  { id: 'do_cho', label: 'ĐỒ CHÓ', icon: '🐶', color: '#f97316', desc: 'Sống lỗi / cắn ngay người vừa cụng bia' },
  { id: 'ngoc_nghech', label: 'NGỐC NGHẾCH', icon: '🤡', color: '#eab308', desc: 'Ngây thơ vô số tội, bị dắt mũi' },
  { id: 'bong', label: 'BÓNG', icon: '💅', color: '#ec4899', desc: 'Thả tim tặng hoa tung tóe khắp làng' },
  { id: 'oscar', label: 'OSCAR', icon: '🎭', color: '#a855f7', desc: 'Diễn xuất lừa cả làng không chớp mắt' },
  { id: 'detective', label: 'THÁM TỬ', icon: '🕵️', color: '#38bdf8', desc: 'Soi đâu trúng đó, gánh cả đội' },
  { id: 'blind', label: 'XẠ THỦ MÙ', icon: '🏹', color: '#fb7185', desc: 'Bắn nhầm hoặc vote lệch nhịp toàn tập' },
  { id: 'heartbroken', label: 'CHẾT VÌ TÌNH', icon: '💔', color: '#f43f5e', desc: 'Chết theo người thương đầy bi tráng' },
];

export const PHASES = {
  LOBBY: 'LOBBY',
  ROLE_REVEAL: 'ROLE_REVEAL',
  NIGHT: 'NIGHT',
  DAWN: 'DAWN',
  HUNTER_SHOT: 'HUNTER_SHOT',
  DAY_DISCUSS: 'DAY_DISCUSS',
  DAY_DEFENSE: 'DAY_DEFENSE',
  DAY_VERDICT: 'DAY_VERDICT',
  GAME_OVER: 'GAME_OVER',
};

export function getBalancedRoles(playerCount) {
  const counts = {
    villager: 0,
    mayor: 0,
    seer: 0,
    guard: 0,
    witch: 0,
    hunter: 0,
    elder: 0,
    cupid: 0,
    werewolf: 1,
    cursed_wolf: 0,
    jester: 0,
  };

  if (playerCount <= 4) {
    counts.werewolf = 1;
    counts.seer = 1;
    counts.guard = 1;
    counts.villager = Math.max(1, playerCount - 3);
    return counts;
  }
  if (playerCount === 5) {
    return { ...counts, werewolf: 1, seer: 1, guard: 1, mayor: 1, villager: 1 };
  }
  if (playerCount === 6) {
    return { ...counts, werewolf: 2, seer: 1, guard: 1, witch: 1, villager: 1 };
  }
  if (playerCount === 7) {
    return { ...counts, werewolf: 2, seer: 1, guard: 1, witch: 1, mayor: 1, villager: 1 };
  }
  if (playerCount === 8) {
    return { ...counts, werewolf: 1, cursed_wolf: 1, seer: 1, guard: 1, witch: 1, hunter: 1, mayor: 1, jester: 1 };
  }
  if (playerCount === 9) {
    return { ...counts, werewolf: 1, cursed_wolf: 1, seer: 1, guard: 1, witch: 1, hunter: 1, cupid: 1, mayor: 1, jester: 1 };
  }
  if (playerCount === 10) {
    return { ...counts, werewolf: 2, cursed_wolf: 1, seer: 1, guard: 1, witch: 1, hunter: 1, elder: 1, cupid: 1, mayor: 1 };
  }
  if (playerCount === 11) {
    return { ...counts, werewolf: 2, cursed_wolf: 1, seer: 1, guard: 1, witch: 1, hunter: 1, elder: 1, cupid: 1, mayor: 1, jester: 1 };
  }
  // 12+
  const wolves = Math.floor(playerCount / 3.5);
  counts.cursed_wolf = 1;
  counts.werewolf = Math.max(1, wolves - 1);
  counts.seer = 1;
  counts.guard = 1;
  counts.witch = 1;
  counts.hunter = 1;
  counts.elder = 1;
  counts.cupid = 1;
  counts.mayor = 1;
  counts.jester = 1;
  const assigned = Object.values(counts).reduce((a, b) => a + b, 0);
  counts.villager = Math.max(0, playerCount - assigned);
  return counts;
}

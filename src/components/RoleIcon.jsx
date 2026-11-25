import React, { useState } from 'react';
import { ASSET_PATHS } from '../../graphics-pack/themeConfig.js';

// Remember which role PNGs are not present yet so we don't flicker on re-render
const missingRoleIcons = new Set();

export default function RoleIcon({ role, className = 'w-6 h-6', emojiClass = 'text-xl leading-none' }) {
  const [failed, setFailed] = useState(() => !role?.id || missingRoleIcons.has(role.id));

  if (!role) return null;

  if (failed) {
    return <span className={emojiClass}>{role.icon}</span>;
  }

  return (
    <img
      src={ASSET_PATHS.roleIcon(role.id)}
      alt={role.name}
      draggable={false}
      onError={() => {
        missingRoleIcons.add(role.id);
        setFailed(true);
      }}
      className={`${className} object-contain inline-block select-none`}
    />
  );
}

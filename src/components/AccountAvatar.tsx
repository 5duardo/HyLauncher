import { useEffect, useMemo, useState } from "react";
import type { Account } from "../lib/types";
import { getPremiumAvatarUrls } from "../lib/accountAvatar";

interface AccountAvatarProps {
  account: Account;
  size?: number;
  className?: string;
}

function OfflineSteveAvatar({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 8 8"
      shapeRendering="crispEdges"
      style={{ display: "block", borderRadius: "inherit" }}
      aria-hidden
    >
      <rect x="0" y="0" width="8" height="2" fill="#2c160e" />
      <rect x="0" y="2" width="1" height="1" fill="#2c160e" />
      <rect x="1" y="2" width="6" height="1" fill="#d29574" />
      <rect x="7" y="2" width="1" height="1" fill="#2c160e" />
      <rect x="0" y="3" width="8" height="1" fill="#d29574" />
      <rect x="0" y="4" width="1" height="1" fill="#d29574" />
      <rect x="1" y="4" width="1" height="1" fill="#ffffff" />
      <rect x="2" y="4" width="1" height="1" fill="#3c52a1" />
      <rect x="3" y="4" width="2" height="1" fill="#d29574" />
      <rect x="5" y="4" width="1" height="1" fill="#3c52a1" />
      <rect x="6" y="4" width="1" height="1" fill="#ffffff" />
      <rect x="7" y="4" width="1" height="1" fill="#d29574" />
      <rect x="0" y="5" width="3" height="1" fill="#d29574" />
      <rect x="3" y="5" width="2" height="1" fill="#b06c50" />
      <rect x="5" y="5" width="3" height="1" fill="#d29574" />
      <rect x="0" y="6" width="2" height="1" fill="#d29574" />
      <rect x="2" y="6" width="4" height="1" fill="#58311f" />
      <rect x="6" y="6" width="2" height="1" fill="#d29574" />
      <rect x="0" y="7" width="8" height="1" fill="#d29574" />
    </svg>
  );
}

export function AccountAvatar({ account, size = 36, className }: AccountAvatarProps) {
  const urls = useMemo(
    () => (account.mode === "premium" ? getPremiumAvatarUrls(account, size) : []),
    [account, size]
  );
  const [urlIndex, setUrlIndex] = useState(0);

  useEffect(() => {
    setUrlIndex(0);
  }, [account.id, account.username, account.uuid, account.skinUrl]);

  if (account.mode === "offline") {
    return <OfflineSteveAvatar size={size} />;
  }

  const src = urls[urlIndex] ?? urls[urls.length - 1];

  return (
    <img
      className={className}
      src={src}
      alt={`Skin de ${account.username}`}
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => {
        setUrlIndex((i) => (i < urls.length - 1 ? i + 1 : i));
      }}
    />
  );
}

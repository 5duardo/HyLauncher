import type { Account } from "./types";

export function normalizeUuid(uuid: string): string {
  return uuid.replace(/-/g, "");
}

/** Avatar URLs for premium accounts — tries several services, ends on Steve head (never initials). */
export function getPremiumAvatarUrls(account: Account, size = 36): string[] {
  const uuid = normalizeUuid(account.uuid);
  const user = encodeURIComponent(account.username);
  const urls: string[] = [];

  if (account.skinUrl) urls.push(account.skinUrl);

  urls.push(
    `https://mc-heads.net/avatar/${uuid}/${size}`,
    `https://mc-heads.net/avatar/${user}/${size}`,
    `https://minotar.net/helm/${user}/${size}.png`,
    `https://crafthead.net/avatar/${uuid}/${size}`,
    `https://minotar.net/avatar/${user}/${size}.png`,
    `https://minotar.net/avatar/MHF_Steve/${size}.png`
  );

  return [...new Set(urls)];
}

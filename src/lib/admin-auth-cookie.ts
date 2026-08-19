const adminTokenCookieName = 'admin_token';

export function saveAdminTokenCookie(accessToken: string) {
  if (typeof document === 'undefined') return;

  const secureAttribute = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${adminTokenCookieName}=${encodeURIComponent(accessToken)}; path=/; max-age=86400; SameSite=Lax${secureAttribute}`;
}

export function clearAdminTokenCookie() {
  if (typeof document === 'undefined') return;

  const secureAttribute = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${adminTokenCookieName}=; path=/; max-age=0; SameSite=Lax${secureAttribute}`;
}

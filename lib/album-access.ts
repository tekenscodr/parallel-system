/** Albums require the national administrator role; ADMIN is intentionally excluded. */
export function canAccessAlbums(user: { role: string } | null | undefined): boolean {
  return user?.role?.toUpperCase() === "ADMIN_NATIONAL";
}

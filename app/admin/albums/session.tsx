"use client";

import { createContext, useContext } from "react";
import type { AdminUser } from "@/lib/admin-auth";

const AlbumUserContext = createContext<AdminUser | null>(null);

export function AlbumSessionProvider({ user, children }: { user: AdminUser; children: React.ReactNode }) {
  return <AlbumUserContext.Provider value={user}>{children}</AlbumUserContext.Provider>;
}

export function useAlbumUser() {
  const user = useContext(AlbumUserContext);
  if (!user) throw new Error("Album pages require an authenticated session.");
  return user;
}

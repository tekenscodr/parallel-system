import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { canAccessAlbums } from "@/lib/album-access";
import { AlbumSessionProvider } from "./session";

export const dynamic = "force-dynamic";

export default async function AlbumsLayout({ children }: { children: React.ReactNode }) {
  const session = await getAuthenticatedAdmin(new Request("http://localhost/admin/albums", {
    headers: await headers(),
  }));
  if (!session) redirect("/admin/login");
  if (!canAccessAlbums(session.user)) redirect("/admin/dashboard");
  return <AlbumSessionProvider user={session.user}>{children}</AlbumSessionProvider>;
}

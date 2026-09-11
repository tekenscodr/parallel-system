import { NextResponse } from "next/server";
import { getAuthenticatedAdmin } from "@/lib/admin-auth";
import { saveUploadedExecutiveImage } from "@/lib/image-upload";

export async function POST(req: Request) {
  try {
    const session = await getAuthenticatedAdmin(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }

    const contentType = req.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Expected multipart/form-data with an image file." },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const voterId = (formData.get("voterId") as string) || null;

    if (!file || typeof file === "string" || file.size === 0) {
      return NextResponse.json(
        { error: "No valid image file provided." },
        { status: 400 }
      );
    }

    const { imageUrl, filename, size } = await saveUploadedExecutiveImage(file, voterId);

    return NextResponse.json({
      success: true,
      imageUrl,
      filename,
      size,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Image upload failed";
    console.error("Upload route error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

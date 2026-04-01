import { NextResponse } from "next/server";

import { auth } from "@/auth";

export async function GET() {
  const session = await auth();

  if (!session?.accessToken) {
    return NextResponse.json(
      { detail: "Oturum bulunamadı veya access token üretilemedi." },
      { status: 401 }
    );
  }

  return NextResponse.json({
    accessToken: session.accessToken,
  });
}

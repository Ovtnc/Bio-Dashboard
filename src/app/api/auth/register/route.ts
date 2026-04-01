import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { registerRequestSchema } from "@/lib/schemas/api";

export async function POST(request: Request) {
  try {
    const requestPayload = registerRequestSchema.safeParse(await request.json());
    if (!requestPayload.success) {
      return NextResponse.json(
        {
          message:
            requestPayload.error.issues[0]?.message ?? "Geçersiz kayıt bilgileri gönderildi.",
        },
        { status: 400 }
      );
    }
    const { name, email, password } = requestPayload.data;

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "Bu e-posta ile kayıtlı bir kullanıcı zaten var." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "Researcher",
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return NextResponse.json(
      {
        message: "Kayıt başarılı.",
        user,
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { message: "Kayıt işlemi sırasında bir hata oluştu." },
      { status: 500 }
    );
  }
}

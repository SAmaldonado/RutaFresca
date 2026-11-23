import { NextResponse } from "next/server";
import { getCurrentUserWithProfile } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUserWithProfile();
  if (!user) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({
    user: {
      id: user.id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
      role: user.role,
      preferredChannel: user.preferredChannel,
      buyerOrg: user.buyerOrg,
      producer: user.producer,
      transporter: user.transporter,
    },
  });
}

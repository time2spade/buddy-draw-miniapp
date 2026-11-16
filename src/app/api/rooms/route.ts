import { NextResponse } from "next/server";
import { extractBearerToken, verifyLineIdToken } from "@/lib/lineVerify";
import { generateRoomCode, hasRoom, saveRoom, Room } from "@/lib/roomStore";

export async function POST(req: Request) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyLineIdToken(token);
    const body = (await req.json()) as {
      roomName?: string;
      budget?: string;
      eventDate?: string;
    };

    const roomName = body.roomName?.trim() || "ห้องจับฉลากบัดดี้";
    const budget = body.budget?.trim() || "ไม่จำกัดงบ";
    const eventDate = body.eventDate?.trim() || "";

    let code = generateRoomCode();
    while (await hasRoom(code)) {
      code = generateRoomCode();
    }

    const newRoom: Room = {
      code,
      name: roomName,
      budget,
      eventDate,
      hostId: user.sub,
      participants: [
        {
          userId: user.sub,
          displayName: user.name || "ผู้สร้างห้อง",
          pictureUrl: user.picture,
          wishlist: [],
        },
      ],
      exclusions: [],
      drawn: false,
      assignments: new Map(),
      questions: [],
      createdAt: Date.now(),
    };

    await saveRoom(newRoom);

    return NextResponse.json({ code: newRoom.code });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 400 }
    );
  }
}

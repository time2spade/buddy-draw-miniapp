import { NextResponse } from "next/server";
import { extractBearerToken, verifyLineIdToken } from "@/lib/lineVerify";
import { deleteRoom, getRoom, saveRoom } from "@/lib/roomStore";
import { createBuddyAssignmentsWithExclusions } from "@/lib/derangement";

export async function GET(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyLineIdToken(token);
    const { code } = await context.params;
    const room = await getRoom(code);

    if (!room) {
      return NextResponse.json({ error: "ไม่พบห้องจับฉลากนี้" }, { status: 404 });
    }

    const me = room.participants.find((p) => p.userId === user.sub);
    const myBuddyRef = room.drawn ? room.assignments.get(user.sub) ?? null : null;
    // ดึง Wish List ล่าสุดของบัดดี้ที่เราจับได้
    const myBuddyLatest = myBuddyRef
      ? room.participants.find((p) => p.userId === myBuddyRef.userId) ?? myBuddyRef
      : null;

    // คำถามที่ฉันแอบถามบัดดี้ของฉัน
    const questionsAskedByMe = room.questions
      .filter((q) => q.fromUserId === user.sub)
      .map((q) => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
      }));

    // คำถามลับที่มีคนส่งมาถามฉัน (ห้ามส่ง fromUserId กลับไปเด็ดขาด!)
    const questionsForMe = room.questions
      .filter((q) => q.toUserId === user.sub)
      .map((q) => ({
        id: q.id,
        question: q.question,
        answer: q.answer,
      }));

    // ส่งรายการ Exclusions เฉพาะให้ Host ดูเพื่อจัดการก่อนสุ่ม
    const exclusionsView =
      room.hostId === user.sub
        ? room.exclusions.map((ex) => ({
            giverId: ex.giverId,
            excludedId: ex.excludedId,
            giverName:
              room.participants.find((p) => p.userId === ex.giverId)?.displayName || "",
            excludedName:
              room.participants.find((p) => p.userId === ex.excludedId)?.displayName || "",
          }))
        : [];

    return NextResponse.json({
      code: room.code,
      name: room.name,
      budget: room.budget,
      eventDate: room.eventDate,
      isHost: room.hostId === user.sub,
      isJoined: Boolean(me),
      myWishlist: me?.wishlist ?? [],
      drawn: room.drawn,
      participants: room.participants.map((p) => ({
        // ส่ง id เฉพาะให้ Host เพื่อใช้ตั้งค่า Exclusions ก่อนสุ่ม
        id: room.hostId === user.sub ? p.userId : undefined,
        displayName: p.displayName,
        pictureUrl: p.pictureUrl,
      })),
      exclusions: exclusionsView,
      myBuddy: myBuddyLatest
        ? {
            displayName: myBuddyLatest.displayName,
            pictureUrl: myBuddyLatest.pictureUrl,
            wishlist: myBuddyLatest.wishlist,
          }
        : null,
      questionsAskedByMe,
      questionsForMe,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 401 }
    );
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyLineIdToken(token);
    const { code } = await context.params;
    const room = await getRoom(code);

    if (!room) {
      return NextResponse.json({ error: "ไม่พบห้องจับฉลากนี้" }, { status: 404 });
    }

    const body = (await req.json()) as {
      action:
        | "join"
        | "update_wishlist"
        | "add_exclusion"
        | "remove_exclusion"
        | "draw"
        | "ask_buddy"
        | "answer_question";
      wishlist?: string[];
      giverId?: string;
      excludedId?: string;
      question?: string;
      questionId?: string;
      answer?: string;
    };

    if (body.action === "join") {
      if (room.drawn) {
        return NextResponse.json({ error: "ห้องนี้จับฉลากไปแล้ว" }, { status: 400 });
      }
      if (!room.participants.some((p) => p.userId === user.sub)) {
        room.participants.push({
          userId: user.sub,
          displayName: user.name || "ผู้เข้าร่วม",
          pictureUrl: user.picture,
          wishlist: [],
        });
        await saveRoom(room);
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "update_wishlist") {
      const me = room.participants.find((p) => p.userId === user.sub);
      if (!me) {
        return NextResponse.json({ error: "คุณยังไม่ได้เข้าร่วมห้อง" }, { status: 400 });
      }
      me.wishlist = (body.wishlist ?? [])
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 10);
      await saveRoom(room);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "add_exclusion") {
      if (room.hostId !== user.sub) {
        return NextResponse.json({ error: "เฉพาะผู้สร้างห้องเท่านั้น" }, { status: 403 });
      }
      if (room.drawn) {
        return NextResponse.json({ error: "สุ่มไปแล้วแก้ไขไม่ได้" }, { status: 400 });
      }
      const { giverId, excludedId } = body;
      if (!giverId || !excludedId || giverId === excludedId) {
        return NextResponse.json({ error: "ข้อมูลข้อยกเว้นไม่ถูกต้อง" }, { status: 400 });
      }
      const exists = room.exclusions.some(
        (e) => e.giverId === giverId && e.excludedId === excludedId
      );
      if (!exists) {
        room.exclusions.push({ giverId, excludedId });
        await saveRoom(room);
      }
      return NextResponse.json({ ok: true });
    }

    if (body.action === "remove_exclusion") {
      if (room.hostId !== user.sub) {
        return NextResponse.json({ error: "เฉพาะผู้สร้างห้องเท่านั้น" }, { status: 403 });
      }
      room.exclusions = room.exclusions.filter(
        (e) => !(e.giverId === body.giverId && e.excludedId === body.excludedId)
      );
      await saveRoom(room);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "draw") {
      if (room.hostId !== user.sub) {
        return NextResponse.json(
          { error: "เฉพาะผู้สร้างห้องเท่านั้นที่กดสุ่มได้" },
          { status: 403 }
        );
      }
      if (room.drawn) {
        return NextResponse.json({ error: "สุ่มไปแล้ว" }, { status: 400 });
      }
      room.assignments = createBuddyAssignmentsWithExclusions(
        room.participants,
        room.exclusions
      );
      room.drawn = true;
      await saveRoom(room);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "ask_buddy") {
      if (!room.drawn) {
        return NextResponse.json({ error: "ยังไม่ได้สุ่มจับคู่" }, { status: 400 });
      }
      const myBuddy = room.assignments.get(user.sub);
      if (!myBuddy) {
        return NextResponse.json({ error: "ไม่พบข้อมูลบัดดี้ของคุณ" }, { status: 400 });
      }
      const qText = body.question?.trim();
      if (!qText) {
        return NextResponse.json({ error: "กรุณาพิมพ์คำถาม" }, { status: 400 });
      }
      room.questions.push({
        id: Math.random().toString(36).slice(2, 10),
        fromUserId: user.sub,
        toUserId: myBuddy.userId,
        question: qText,
        createdAt: Date.now(),
      });
      await saveRoom(room);
      return NextResponse.json({ ok: true });
    }

    if (body.action === "answer_question") {
      const target = room.questions.find(
        (q) => q.id === body.questionId && q.toUserId === user.sub
      );
      if (!target) {
        return NextResponse.json({ error: "ไม่พบคำถามนี้" }, { status: 404 });
      }
      target.answer = body.answer?.trim() || "";
      await saveRoom(room);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ code: string }> }
) {
  try {
    const token = extractBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await verifyLineIdToken(token);
    const { code } = await context.params;
    const room = await getRoom(code);

    if (!room) {
      return NextResponse.json({ error: "ไม่พบห้องจับฉลากนี้" }, { status: 404 });
    }

    if (room.hostId !== user.sub) {
      return NextResponse.json(
        { error: "เฉพาะผู้สร้างห้องเท่านั้นที่ลบห้องได้" },
        { status: 403 }
      );
    }

    await deleteRoom(code);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Server error" },
      { status: 400 }
    );
  }
}

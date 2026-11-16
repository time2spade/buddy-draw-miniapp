"use client";

import { useEffect, useState, useCallback } from "react";
import liff from "@line/liff";

interface RoomParticipant {
  id?: string;
  displayName: string;
  pictureUrl?: string;
}

interface ExclusionView {
  giverId: string;
  excludedId: string;
  giverName: string;
  excludedName: string;
}

interface QAItem {
  id: string;
  question: string;
  answer?: string;
}

interface RoomState {
  code: string;
  name: string;
  budget: string;
  eventDate: string;
  isHost: boolean;
  isJoined: boolean;
  myWishlist: string[];
  drawn: boolean;
  participants: RoomParticipant[];
  exclusions: ExclusionView[];
  myBuddy: {
    displayName: string;
    pictureUrl?: string;
    wishlist: string[];
  } | null;
  questionsAskedByMe: QAItem[];
  questionsForMe: QAItem[];
}

export default function HomePage() {
  const [ready, setReady] = useState(false);
  const [idToken, setIdToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string>("");

  // Create room form
  const [roomNameInput, setRoomNameInput] = useState("ปาร์ตี้ปีใหม่ 🎁");
  const [budgetInput, setBudgetInput] = useState("500 บาท");
  const [eventDateInput, setEventDateInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");

  // Room state
  const [room, setRoom] = useState<RoomState | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Wishlist & Exclusions & Q&A inputs
  const [wishInput, setWishInput] = useState("");
  const [exGiver, setExGiver] = useState("");
  const [exExcluded, setExExcluded] = useState("");
  const [askInput, setAskInput] = useState("");
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  const fetchRoom = useCallback(async (code: string, token: string) => {
    const res = await fetch(`/api/rooms/${code}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "โหลดข้อมูลห้องไม่สำเร็จ");
    setRoom(data);
  }, []);

  useEffect(() => {
    async function init() {
      try {
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
        if (!liffId) {
          throw new Error("ยังไม่ได้ตั้งค่า NEXT_PUBLIC_LIFF_ID ใน .env.local");
        }
        await liff.init({ liffId });
        if (!liff.isLoggedIn()) {
          liff.login();
          return;
        }
        const token = liff.getIDToken();
        if (!token) {
          throw new Error("ไม่ได้รับ ID Token (กรุณาเปิด scope 'openid' ใน Console แล้วเปิดแอปใหม่)");
        }
        const profile = await liff.getProfile();
        setIdToken(token);
        setDisplayName(profile.displayName);

        const params = new URLSearchParams(window.location.search);
        const roomCode = params.get("room");
        if (roomCode && token) {
          await fetchRoom(roomCode, token);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "เชื่อมต่อ LIFF ไม่สำเร็จ");
      } finally {
        setReady(true);
      }
    }
    init();
  }, [fetchRoom]);

  async function callRoomAction(payload: Record<string, unknown>, targetCode?: string) {
    if (!idToken) return;
    const code = targetCode || room?.code;
    if (!code) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${code}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchRoom(code, idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ดำเนินการไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateRoom() {
    if (!idToken) {
      setError("ยังไม่พบ ID Token กรุณาเปิดแอปผ่านลิงก์ LINE ใหม่อีกครั้ง");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          roomName: roomNameInput,
          budget: budgetInput,
          eventDate: eventDateInput,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      await fetchRoom(data.code, idToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างห้องไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  }

  async function handleShareInvite() {
    if (!room) return;
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    const inviteUrl = `https://miniapp.line.me/${liffId}?room=${room.code}`;
    const msg = `🎁 มาจับฉลากบัดดี้ห้อง "${room.name}" กัน!\n💰 งบ: ${room.budget}\n🔑 รหัสห้อง: ${room.code}\nกดเข้าห้องเลย: ${inviteUrl}`;

    if (liff.isApiAvailable("shareTargetPicker")) {
      await liff.shareTargetPicker([{ type: "text", text: msg }]);
    } else {
      await navigator.clipboard.writeText(inviteUrl);
      alert("คัดลอกลิงก์เชิญเพื่อนแล้ว!");
    }
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center text-emerald-200 animate-pulse">
          กำลังเชื่อมต่อ LINE MINI App...
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md p-5 space-y-5 pb-12">
      <header className="text-center space-y-1 pt-2">
        <div className="text-4xl">🎁</div>
        <h1 className="text-2xl font-bold text-amber-300">Buddy Draw</h1>
        <p className="text-sm text-emerald-200/80">
          สวัสดีคุณ {displayName || "เพื่อนใหม่"}
        </p>
      </header>

      {error && (
        <div className="rounded-xl bg-red-500/20 border border-red-400/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {!room ? (
        <div className="space-y-5">
          <section className="rounded-2xl bg-emerald-900/60 border border-emerald-700/50 p-4 space-y-3">
            <h2 className="font-semibold text-amber-200">สร้างห้องจับฉลากใหม่</h2>
            <div className="space-y-2">
              <label className="block text-xs text-emerald-200/80">ชื่องาน / ห้อง</label>
              <input
                type="text"
                value={roomNameInput}
                onChange={(e) => setRoomNameInput(e.target.value)}
                className="w-full rounded-xl bg-emerald-950/80 border border-emerald-700 px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-xs text-emerald-200/80">งบของขวัญ</label>
                <input
                  type="text"
                  value={budgetInput}
                  onChange={(e) => setBudgetInput(e.target.value)}
                  placeholder="เช่น 500 บาท"
                  className="w-full rounded-xl bg-emerald-950/80 border border-emerald-700 px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-emerald-200/80">วันแลกของขวัญ</label>
                <input
                  type="date"
                  value={eventDateInput}
                  onChange={(e) => setEventDateInput(e.target.value)}
                  className="w-full rounded-xl bg-emerald-950/80 border border-emerald-700 px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
            <button
              onClick={handleCreateRoom}
              disabled={loading}
              className="w-full rounded-xl bg-amber-400 text-emerald-950 font-semibold py-2.5 text-sm hover:bg-amber-300 disabled:opacity-50"
            >
              {loading ? "กำลังสร้าง..." : "สร้างห้องเลย"}
            </button>
          </section>

          <section className="rounded-2xl bg-emerald-900/60 border border-emerald-700/50 p-4 space-y-3">
            <h2 className="font-semibold text-emerald-100">เข้าห้องด้วยรหัส</h2>
            <div className="flex gap-2">
              <input
                type="text"
                value={joinCodeInput}
                onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
                placeholder="รหัส 6 หลัก เช่น A1B2C3"
                maxLength={6}
                className="flex-1 rounded-xl bg-emerald-950/80 border border-emerald-700 px-3 py-2 text-sm uppercase tracking-wider focus:outline-none focus:border-amber-400"
              />
              <button
                onClick={() => callRoomAction({ action: "join" }, joinCodeInput.trim().toUpperCase())}
                disabled={loading}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
              >
                เข้าร่วม
              </button>
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          {/* ข้อมูลห้อง + รายชื่อผู้เข้าร่วม */}
          <section className="rounded-2xl bg-emerald-900/60 border border-emerald-700/50 p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-amber-300">{room.name}</h2>
                <p className="text-xs text-emerald-200/80">
                  รหัส: <span className="font-mono font-bold text-white">{room.code}</span> · งบ:{" "}
                  {room.budget}
                  {room.eventDate ? ` · วันงาน: ${room.eventDate}` : ""}
                </p>
              </div>
              <button
                onClick={() => idToken && fetchRoom(room.code, idToken)}
                className="rounded-lg bg-emerald-800 px-2.5 py-1 text-xs hover:bg-emerald-700"
              >
                รีเฟรช
              </button>
            </div>

            {!room.isJoined && !room.drawn && (
              <button
                onClick={() => callRoomAction({ action: "join" })}
                disabled={loading}
                className="w-full rounded-xl bg-amber-400 text-emerald-950 font-semibold py-2.5 text-sm"
              >
                กดยืนยันเข้าร่วมจับฉลาก
              </button>
            )}

            <div className="space-y-2">
              <p className="text-xs font-medium text-emerald-200">
                ผู้เข้าร่วม ({room.participants.length} คน)
              </p>
              <div className="flex flex-wrap gap-2">
                {room.participants.map((p, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-1.5 rounded-full bg-emerald-950/70 border border-emerald-700/50 px-2.5 py-1 text-xs"
                  >
                    {p.pictureUrl && (
                      <img src={p.pictureUrl} alt={p.displayName} className="h-4 w-4 rounded-full" />
                    )}
                    <span>{p.displayName}</span>
                  </div>
                ))}
              </div>
            </div>

            {!room.drawn && (
              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleShareInvite}
                  className="flex-1 rounded-xl bg-emerald-700 py-2.5 text-xs font-semibold hover:bg-emerald-600"
                >
                  ชวนเพื่อนเข้ากลุ่ม LINE
                </button>
                {room.isHost && (
                  <button
                    onClick={() => callRoomAction({ action: "draw" })}
                    disabled={loading || room.participants.length < 2}
                    className="flex-1 rounded-xl bg-amber-400 text-emerald-950 py-2.5 text-xs font-bold hover:bg-amber-300 disabled:opacity-50"
                  >
                    สุ่มจับคู่เลย!
                  </button>
                )}
              </div>
            )}
          </section>

          {/* Wish List ของตัวเอง */}
          {room.isJoined && (
            <section className="rounded-2xl bg-emerald-900/60 border border-emerald-700/50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-200">
                📝 Wish List ของฉัน (เพื่อให้บัดดี้ดู)
              </h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={wishInput}
                  onChange={(e) => setWishInput(e.target.value)}
                  placeholder="เช่น แก้วเก็บความเย็น, บัตรของขวัญ..."
                  className="flex-1 rounded-xl bg-emerald-950/80 border border-emerald-700 px-3 py-2 text-xs focus:outline-none focus:border-amber-400"
                />
                <button
                  onClick={() => {
                    if (!wishInput.trim()) return;
                    const next = [...room.myWishlist, wishInput.trim()];
                    setWishInput("");
                    callRoomAction({ action: "update_wishlist", wishlist: next });
                  }}
                  className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold hover:bg-emerald-500"
                >
                  เพิ่ม
                </button>
              </div>
              {room.myWishlist.length > 0 && (
                <ul className="space-y-1.5">
                  {room.myWishlist.map((item, idx) => (
                    <li
                      key={idx}
                      className="flex items-center justify-between rounded-lg bg-emerald-950/60 px-3 py-1.5 text-xs"
                    >
                      <span>• {item}</span>
                      <button
                        onClick={() => {
                          const next = room.myWishlist.filter((_, i) => i !== idx);
                          callRoomAction({ action: "update_wishlist", wishlist: next });
                        }}
                        className="text-red-300 hover:text-red-200"
                      >
                        ลบ
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ตั้งค่า Exclusions (เฉพาะ Host ก่อนสุ่ม) */}
          {room.isHost && !room.drawn && room.participants.length >= 2 && (
            <section className="rounded-2xl bg-emerald-900/60 border border-emerald-700/50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-200">
                🚫 กฎห้ามจับได้กัน (Exclusions)
              </h3>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={exGiver}
                  onChange={(e) => setExGiver(e.target.value)}
                  className="rounded-xl bg-emerald-950/80 border border-emerald-700 px-2 py-2 text-xs"
                >
                  <option value="">เลือกผู้ให้...</option>
                  {room.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
                <select
                  value={exExcluded}
                  onChange={(e) => setExExcluded(e.target.value)}
                  className="rounded-xl bg-emerald-950/80 border border-emerald-700 px-2 py-2 text-xs"
                >
                  <option value="">ห้ามจับได้...</option>
                  {room.participants.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => {
                  if (!exGiver || !exExcluded) return;
                  callRoomAction({
                    action: "add_exclusion",
                    giverId: exGiver,
                    excludedId: exExcluded,
                  });
                }}
                className="w-full rounded-xl bg-emerald-700 py-2 text-xs font-semibold hover:bg-emerald-600"
              >
                เพิ่มเงื่อนไขห้ามจับคู่
              </button>

              {room.exclusions.length > 0 && (
                <ul className="space-y-1.5">
                  {room.exclusions.map((ex, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between rounded-lg bg-emerald-950/60 px-3 py-1.5 text-xs"
                    >
                      <span>
                        {ex.giverName} ⛔ {ex.excludedName}
                      </span>
                      <button
                        onClick={() =>
                          callRoomAction({
                            action: "remove_exclusion",
                            giverId: ex.giverId,
                            excludedId: ex.excludedId,
                          })
                        }
                        className="text-red-300"
                      >
                        ลบ
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {/* ผลจับฉลาก + Wish List บัดดี้ + ถามคำถามลับ */}
          {room.drawn && room.myBuddy && (
            <section className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-rose-500/20 border border-amber-400/50 p-5 space-y-4">
              <div className="text-center space-y-3">
                <p className="text-sm text-amber-200">🎉 จับฉลากเรียบร้อยแล้ว!</p>
                {!revealed ? (
                  <button
                    onClick={() => setRevealed(true)}
                    className="w-full rounded-xl bg-amber-400 text-emerald-950 font-bold py-3 text-sm shadow-lg hover:bg-amber-300"
                  >
                    แตะเพื่อเปิดดูบัดดี้ของคุณ 👀
                  </button>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-emerald-200">คุณต้องซื้อของขวัญให้:</p>
                    <div className="flex flex-col items-center gap-2">
                      {room.myBuddy.pictureUrl && (
                        <img
                          src={room.myBuddy.pictureUrl}
                          alt={room.myBuddy.displayName}
                          className="h-16 w-16 rounded-full border-2 border-amber-300"
                        />
                      )}
                      <p className="text-xl font-bold text-white">{room.myBuddy.displayName}</p>
                    </div>

                    <div className="rounded-xl bg-emerald-950/60 p-3 text-left space-y-1.5">
                      <p className="text-xs font-semibold text-amber-200">
                        🎁 Wish List ของ {room.myBuddy.displayName}:
                      </p>
                      {room.myBuddy.wishlist.length > 0 ? (
                        <ul className="space-y-1 text-xs text-emerald-100">
                          {room.myBuddy.wishlist.map((w, i) => (
                            <li key={i}>• {w}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-emerald-200/60">ยังไม่ได้เพิ่มรายการของที่อยากได้</p>
                      )}
                    </div>

                    {/* ส่งคำถามลับหาบัดดี้ */}
                    <div className="rounded-xl bg-emerald-950/60 p-3 text-left space-y-2">
                      <p className="text-xs font-semibold text-amber-200">
                        🕵️ แอบถามคำถามลับ (อีกฝ่ายไม่รู้ว่าใครถาม)
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={askInput}
                          onChange={(e) => setAskInput(e.target.value)}
                          placeholder="เช่น ชอบสีอะไร? ใส่เสื้อไซส์ไหน?"
                          className="flex-1 rounded-lg bg-emerald-900/70 border border-emerald-700 px-2.5 py-1.5 text-xs"
                        />
                        <button
                          onClick={() => {
                            if (!askInput.trim()) return;
                            const q = askInput.trim();
                            setAskInput("");
                            callRoomAction({ action: "ask_buddy", question: q });
                          }}
                          className="rounded-lg bg-amber-400 text-emerald-950 px-3 py-1.5 text-xs font-bold"
                        >
                          ถาม
                        </button>
                      </div>
                      {room.questionsAskedByMe.map((qa) => (
                        <div key={qa.id} className="rounded-lg bg-emerald-900/50 p-2 text-xs space-y-0.5">
                          <p className="text-amber-200">ถาม: {qa.question}</p>
                          <p className="text-emerald-100">
                            คำตอบ: {qa.answer || "รออีกฝ่ายตอบกลับ..."}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* กล่องคำถามลับที่ส่งมาถามเรา */}
          {room.drawn && room.questionsForMe.length > 0 && (
            <section className="rounded-2xl bg-emerald-900/60 border border-emerald-700/50 p-4 space-y-3">
              <h3 className="text-sm font-semibold text-amber-200">
                💌 คำถามลับจากบัดดี้ของคุณ
              </h3>
              {room.questionsForMe.map((qa) => (
                <div key={qa.id} className="rounded-xl bg-emerald-950/60 p-3 space-y-2 text-xs">
                  <p className="font-medium text-white">“{qa.question}”</p>
                  {qa.answer ? (
                    <p className="text-emerald-300">ตอบแล้ว: {qa.answer}</p>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={answerDrafts[qa.id] ?? ""}
                        onChange={(e) =>
                          setAnswerDrafts((prev) => ({ ...prev, [qa.id]: e.target.value }))
                        }
                        placeholder="พิมพ์คำตอบ..."
                        className="flex-1 rounded-lg bg-emerald-900/70 border border-emerald-700 px-2.5 py-1.5"
                      />
                      <button
                        onClick={() =>
                          callRoomAction({
                            action: "answer_question",
                            questionId: qa.id,
                            answer: answerDrafts[qa.id] ?? "",
                          })
                        }
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold"
                      >
                        ตอบ
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}
        </div>
      )}
    </main>
  );
}

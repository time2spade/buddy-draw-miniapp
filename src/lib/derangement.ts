export interface ExclusionRule {
  giverId: string;
  excludedId: string;
}

/**
 * สุ่มจับคู่แบบ Backtracking พร้อมเงื่อนไข:
 * 1) ห้ามจับได้ตัวเอง
 * 2) เคารพกฎ Exclusions (ใครห้ามจับได้ใคร)
 */
export function createBuddyAssignmentsWithExclusions<T extends { userId: string }>(
  participants: T[],
  exclusions: ExclusionRule[]
): Map<string, T> {
  if (participants.length < 2) {
    throw new Error("ต้องมีผู้เข้าร่วมอย่างน้อย 2 คนขึ้นไป");
  }

  const blockedMap = new Map<string, Set<string>>();
  for (const p of participants) {
    blockedMap.set(p.userId, new Set([p.userId])); // ห้ามจับได้ตัวเองเสมอ
  }
  for (const rule of exclusions) {
    blockedMap.get(rule.giverId)?.add(rule.excludedId);
  }

  // เรียงผู้ให้จากคนที่มีข้อจำกัดมากที่สุดก่อนเพื่อให้ Backtracking หาคำตอบได้เร็ว
  const givers = [...participants].sort((a, b) => {
    const aBlocked = blockedMap.get(a.userId)?.size ?? 0;
    const bBlocked = blockedMap.get(b.userId)?.size ?? 0;
    return bBlocked - aBlocked;
  });

  const usedReceivers = new Set<string>();
  const result = new Map<string, T>();

  function backtrack(index: number): boolean {
    if (index === givers.length) return true;

    const giver = givers[index];
    const blocked = blockedMap.get(giver.userId) ?? new Set();

    // สุ่มลำดับผู้รับที่เป็นไปได้
    const candidates = participants.filter(
      (r) => !usedReceivers.has(r.userId) && !blocked.has(r.userId)
    );
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }

    for (const receiver of candidates) {
      usedReceivers.add(receiver.userId);
      result.set(giver.userId, receiver);
      if (backtrack(index + 1)) return true;
      usedReceivers.delete(receiver.userId);
      result.delete(giver.userId);
    }

    return false;
  }

  if (!backtrack(0)) {
    throw new Error(
      "เงื่อนไขข้อยกเว้นแน่นเกินไป ไม่สามารถจับคู่ให้ครบทุกคนได้ กรุณาลดข้อยกเว้นบางข้อ"
    );
  }

  return result;
}

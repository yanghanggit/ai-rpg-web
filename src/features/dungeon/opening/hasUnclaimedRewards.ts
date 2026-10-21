import type { DungeonPartyMember } from "../useDungeonParty";

/**
 * 这个成员还有候选卡没领（`SpoilsComponent` 在、候选还有、且一张都没领）。
 *
 * 两处共用这一份判据，让"还有东西没拿"在全屏只有一种说法（提醒色）：奖励选项与「结束本间」。
 * 两处都只是**提醒**：离开本间就再也领不到（服务端把领卡绑在当前非战斗房间上），界面绝不阻止。
 */
export function hasUnclaimedRewards(member: DungeonPartyMember): boolean {
  return (
    member.spoils !== null &&
    member.spoils.candidateCards.length > 0 &&
    member.spoils.claimedCards.length === 0
  );
}

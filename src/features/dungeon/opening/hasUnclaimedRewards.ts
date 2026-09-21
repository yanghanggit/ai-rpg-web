import type { DungeonPartyMember } from "../useDungeonParty";

/**
 * 这个成员还有候选卡没领（`SpoilsComponent` 在、候选还有、且一张都没领）。
 *
 * 两处共用这一份判据，让「还有东西没拿」在全屏只有一个说法（提醒色）：
 * - 角色卡上那颗按钮 → 提醒色 + `!`（"这里还有东西等你拿"）；
 * - 正文里那张「结束本间」（「回到地图」卡）→ 同样提醒色（"再做这一步就永久失去了"）。
 *
 * 两处都只是**提醒**：服务端把领卡硬绑在"当前房间还是这间开场房"，所以没领就是失去——
 * 这是设计要的惩罚，界面绝不阻止（见 `OpeningRoomPanel` 的单向门说明）。
 */
export function hasUnclaimedRewards(member: DungeonPartyMember): boolean {
  return (
    member.spoils !== null &&
    member.spoils.candidateCards.length > 0 &&
    member.spoils.claimedCards.length === 0
  );
}

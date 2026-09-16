import { displayName } from "../../components/displayName";
import Modal from "../../components/Modal";
import CardItem from "../cards/CardItem";
import type { Card } from "../cards/types";

/**
 * 某个队伍成员的奖励（Spoils）浮窗：**竖排**候选卡，每张一个「挑选」。
 *
 * 奖励是当场要做的决策，但不再摊在页面上——角色卡上只留一个「奖励」按钮，点开才展开，
 * 与「先看到角色、再看到奖励卡」的渐进式流程一致。
 *
 * 领卡**按成员各自算**：`claimed=true` 后候选保留供回看，这时不再给「挑选」按钮，
 * 只标一句提示（组件本身由页面作为「已生成」守卫保留）。
 */
export default function SpoilsDialog({
  memberName,
  spoils,
  busy,
  error,
  onPick,
  onClose,
}: {
  /** 角色原始名（标题副标题显示用）。 */
  memberName: string;
  /** 该成员的奖励：候选 + 是否已领取。 */
  spoils: { cards: Card[]; claimed: boolean };
  /** 领卡任务在跑时为 true：禁用所有「挑选」（同一条后端管道一次只放一个）。 */
  busy: boolean;
  /** 领卡失败的原因（展示在浮窗内，不落到页面动作区）。 */
  error: string | null;
  onPick: (cardName: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal
      title="奖励"
      meta={`${displayName(memberName)} · ${spoils.cards.length} 张`}
      onClose={onClose}
    >
      {spoils.claimed ? <p className="muted">（已领取，以下为本次候选，仅供参考）</p> : null}
      {error ? <p className="error">领卡失败：{error}</p> : null}

      <ul className="card-tiles card-tiles--stack">
        {spoils.cards.map((card) => (
          <CardItem
            key={card.uuid}
            card={card}
            action={
              spoils.claimed ? null : (
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`挑选 ${card.name}`}
                  onClick={() => onPick(card.name)}
                >
                  挑选
                </button>
              )
            }
          />
        ))}
      </ul>
    </Modal>
  );
}

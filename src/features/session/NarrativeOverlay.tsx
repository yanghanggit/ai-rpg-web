import type { Schemas } from "../../api/types";
import Modal from "../../components/Modal";
import SessionMessageList from "./SessionMessageList";

/**
 * 「全部叙事」浮层：列出本局所有事件（每条显示 谁 / 何地 / 什么事）。
 *
 * 数据直接来自调用方已经在轮询的消息，**不发请求**——所以打开是瞬时的。
 */
export default function NarrativeOverlay({
  messages,
  onClose,
}: {
  messages: Schemas["SessionMessage"][];
  onClose: () => void;
}) {
  return (
    <Modal title="全部叙事" meta={`共 ${messages.length} 条`} onClose={onClose}>
      <SessionMessageList messages={messages} emptyHint="这一局还没有产生任何事件。" />
    </Modal>
  );
}

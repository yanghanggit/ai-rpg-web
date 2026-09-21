import { describeApiError } from "../../api/describeApiError";

/**
 * 就绪状态下**场景卡正文的唯一措辞**：开场房与战斗开局共用，避免两处各写一套（加载 / 失败 / 空
 * 叙述的说法迟早分叉）。
 *
 * 顺序就是用户看到的优先级：有真正的叙述就给叙述；没叙述但请求失败就给失败原因；还在请求就说
 * 加载中；都没有才是真的空。
 */
export function stageNarrativeBody(
  narrative: string | null,
  load: { isPending: boolean; isError: boolean; error: unknown },
): string {
  if (narrative !== null) {
    return narrative;
  }
  if (load.isError) {
    return `无法获取环境叙述：${describeApiError(load.error)}`;
  }
  if (load.isPending) {
    return "加载中…";
  }
  return "（暂无环境描写）";
}

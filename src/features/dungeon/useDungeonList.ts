/**
 * 可用副本列表（**静态模型数据**）。
 *
 * `GET /api/home/dungeon-list/v1/` 读取的是「这台服务器上已生成的全部副本」
 * （磁盘 JSON，见后端 `services/dungeon_state.py`），不是当前对局的运行状态——
 * 所以「生成副本」成功后失效本查询就能看到新副本。
 */
import { $api } from "../../api/query";

export function useDungeonList() {
  return $api.useQuery("get", "/api/home/dungeon-list/v1/", undefined, {
    select: (data) => data.dungeons,
  });
}

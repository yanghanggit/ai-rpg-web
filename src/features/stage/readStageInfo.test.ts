import { describe, expect, it } from "vitest";
import { COMPONENT } from "../entities/componentNames";
import { readStageInfo } from "./readStageInfo";

describe("readStageInfo", () => {
  it("读出 StageComponent.name 与 EnvironmentComponent.narrative", () => {
    expect(
      readStageInfo({
        name: "场景.酒吧大厅",
        data: {
          [COMPONENT.Stage]: { name: "场景.酒吧大厅" },
          [COMPONENT.Environment]: { name: "场景.酒吧大厅", narrative: "灯火幽微。" },
        },
      }),
    ).toEqual({ name: "场景.酒吧大厅", narrative: "灯火幽微。" });
  });

  it("没有 EnvironmentComponent 时 narrative 为 null（不猜）", () => {
    const info = readStageInfo({
      name: "场景.酒吧大厅",
      data: { [COMPONENT.Stage]: { name: "场景.酒吧大厅" } },
    });
    expect(info.narrative).toBeNull();
  });

  it("StageComponent 缺失或 name 非法时退回实体名", () => {
    expect(readStageInfo({ name: "场景.阁楼隔间", data: {} })).toEqual({
      name: "场景.阁楼隔间",
      narrative: null,
    });
    expect(
      readStageInfo({
        name: "场景.阁楼隔间",
        data: { [COMPONENT.Stage]: { name: 5 } },
      }),
    ).toEqual({ name: "场景.阁楼隔间", narrative: null });
  });
});

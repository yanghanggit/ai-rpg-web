import { describe, expect, it } from "vitest";
import { COMPONENT } from "../entities/componentNames";
import { readStageInfo } from "./readStageInfo";

describe("readStageInfo", () => {
  it("读出 StageComponent.name 与 EnvironmentComponent.narrative", () => {
    expect(
      readStageInfo({
        name: "场景.佣兵公会",
        data: {
          [COMPONENT.Stage]: { name: "场景.佣兵公会" },
          [COMPONENT.Environment]: { name: "场景.佣兵公会", narrative: "灯火幽微。" },
        },
      }),
    ).toEqual({ name: "场景.佣兵公会", narrative: "灯火幽微。" });
  });

  it("没有 EnvironmentComponent 时 narrative 为 null（不猜）", () => {
    const info = readStageInfo({
      name: "场景.佣兵公会",
      data: { [COMPONENT.Stage]: { name: "场景.佣兵公会" } },
    });
    expect(info.narrative).toBeNull();
  });

  it("StageComponent 缺失或 name 非法时退回实体名", () => {
    expect(readStageInfo({ name: "场景.铁匠铺", data: {} })).toEqual({
      name: "场景.铁匠铺",
      narrative: null,
    });
    expect(
      readStageInfo({
        name: "场景.铁匠铺",
        data: { [COMPONENT.Stage]: { name: 5 } },
      }),
    ).toEqual({ name: "场景.铁匠铺", narrative: null });
  });
});

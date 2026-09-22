import { describe, expect, it } from "vitest";
import { COMPONENT } from "../entities/componentNames";
import { readStageInfo } from "./readStageInfo";

describe("readStageInfo", () => {
  it("读出 StageComponent.name 与 EnvironmentComponent.narrative", () => {
    expect(
      readStageInfo({
        name: "场景.门厅",
        components: [
          { name: COMPONENT.Stage, data: { name: "场景.门厅" } },
          { name: COMPONENT.Environment, data: { name: "场景.门厅", narrative: "灯火幽微。" } },
        ],
      }),
    ).toEqual({ name: "场景.门厅", narrative: "灯火幽微。" });
  });

  it("没有 EnvironmentComponent 时 narrative 为 null（不猜）", () => {
    const info = readStageInfo({
      name: "场景.门厅",
      components: [{ name: COMPONENT.Stage, data: { name: "场景.门厅" } }],
    });
    expect(info.narrative).toBeNull();
  });

  it("StageComponent 缺失或 name 非法时退回实体名", () => {
    expect(readStageInfo({ name: "场景.二楼卧室", components: [] })).toEqual({
      name: "场景.二楼卧室",
      narrative: null,
    });
    expect(
      readStageInfo({
        name: "场景.二楼卧室",
        components: [{ name: COMPONENT.Stage, data: { name: 5 } }],
      }),
    ).toEqual({ name: "场景.二楼卧室", narrative: null });
  });
});

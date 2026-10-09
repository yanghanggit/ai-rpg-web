/**
 * mock 用的内存道具状态（背包 / 储物箱 / 穿戴中时装）。
 *
 * 真实后端里道具挂在实体上（玩家 `InventoryComponent`、世界储物箱 `StorageComponent`、
 * 角色 `WornCostumeComponent`），由 move / craft 动作改写；mock 里直接改这几份数组，
 * 让 `pnpm dev:mock` 下「移动 / 合成后列表变化」可见。行为对齐后端：
 * - 移动按名字逐个搬；
 * - 写入容器时按堆叠身份合并：材料按名称、消耗品按名称 + 效果提示词，装备/时装不堆叠；
 * - 合成按名字逐个消耗 `MaterialItem` 的 `count`，并把产物按同一规则并入储物箱。
 */
import type { Schemas } from "../api/types";
import { COMPONENT } from "../features/entities/componentNames";
import {
  npcEntityFixtures,
  playerEntityFixture,
  runtimeInventoryFixture,
  runtimeStorageFixture,
  wornCostumesFixture,
} from "./fixtures";
import { appendMockSessionMessage } from "./sessionMessages";

type RawItem = Record<string, unknown>;
type Workshop = "consumable" | "gear" | "costume";

const STORAGE_ENTITY = "世界.储物箱";

const CRAFTED_ITEMS: Record<Workshop, RawItem> = {
  consumable: {
    name: "消耗品.回气散",
    uuid: "mock-crafted-consumable",
    type: "ConsumableItem",
    description: "（mock）工坊合成的消耗品。",
    count: 1,
    on_use_prompt: ["（mock）恢复少量体力。"],
    resources: [],
  },
  gear: {
    name: "装备.符纹刀",
    uuid: "mock-crafted-gear",
    type: "GearItem",
    description: "（mock）工坊锻造的装备。",
    count: 1,
    resources: [],
    cards: [],
  },
  costume: {
    name: "时装.玄狐裘",
    uuid: "mock-crafted-costume",
    type: "CostumeItem",
    description: "（mock）工坊缝制的时装。",
    count: 1,
    resources: [],
  },
};

const CRAFT_LABELS: Record<Workshop, string> = {
  consumable: "消耗品",
  gear: "装备",
  costume: "时装",
};

function clone<T>(value: T): T {
  return structuredClone(value);
}

/**
 * 堆叠身份键：对齐后端 `models/utils.py::_item_stack_key`。
 * 材料按名称，消耗品按名称 + 效果提示词；其余（装备 / 时装）不堆叠，返回 `undefined`。
 */
function stackKey(item: RawItem): string | undefined {
  if (item.type === "MaterialItem") {
    return JSON.stringify(["MaterialItem", item.name]);
  }
  if (item.type === "ConsumableItem") {
    const prompt = Array.isArray(item.on_use_prompt) ? item.on_use_prompt : [];
    return JSON.stringify(["ConsumableItem", item.name, prompt]);
  }
  return undefined;
}

/**
 * 把一件道具并入容器：可堆叠且已有同身份条目时累加数量，否则追加。
 * 对齐后端 `models/utils.py::append_item_with_stacking`（保留已有条目的 uuid 等字段）。
 */
function addItem(target: RawItem[], item: RawItem): void {
  const key = stackKey(item);
  if (key !== undefined) {
    const existing = target.find((candidate) => stackKey(candidate) === key);
    if (existing !== undefined) {
      const base = typeof existing.count === "number" ? existing.count : 1;
      const incoming = typeof item.count === "number" ? item.count : 1;
      existing.count = base + incoming;
      return;
    }
  }
  target.push(item);
}

let inventory: RawItem[] = clone(runtimeInventoryFixture);
let storage: RawItem[] = clone(runtimeStorageFixture);
let worn: { wearer: string; item: RawItem }[] = clone(wornCostumesFixture);

/** 储物箱世界实体名（group 端点先解析它，details 再按名字取）。 */
export function readMockStorageEntityName(): string {
  return STORAGE_ENTITY;
}

/** 玩家实体：在 fixture 组件之外补一份当前 `InventoryComponent`。 */
export function readMockPlayerEntity(): Schemas["EntitySerialization"] {
  return {
    name: playerEntityFixture.name,
    components: [
      ...playerEntityFixture.components,
      {
        name: COMPONENT.Inventory,
        data: { name: playerEntityFixture.name, items: clone(inventory) },
      },
    ],
  };
}

/** 储物箱世界实体（当前库存）。 */
export function readMockStorageEntity(): Schemas["EntitySerialization"] {
  return {
    name: STORAGE_ENTITY,
    components: [
      { name: COMPONENT.Storage, data: { name: STORAGE_ENTITY, items: clone(storage) } },
    ],
  };
}

/**
 * 任意角色的完整实体：玩家 = 夹具 + 背包，NPC = 夹具；若其穿着时装则附上
 * `WornCostumeComponent`。未知名字返回 `null`。
 */
export function readMockActorEntity(name: string): Schemas["EntitySerialization"] | null {
  const base =
    name === playerEntityFixture.name
      ? readMockPlayerEntity()
      : npcEntityFixtures.find((entity) => entity.name === name);
  if (base === undefined) {
    return null;
  }
  const entity = clone(base);
  const wornEntry = worn.find((entry) => entry.wearer === name);
  if (wornEntry === undefined) {
    return entity;
  }
  entity.components.push({
    name: COMPONENT.WornCostume,
    data: { name, item: clone(wornEntry.item) },
  });
  return entity;
}

/** 穿戴中时装实体（group `WornCostumeComponent` 用）。 */
export function readMockWornEntities(): Schemas["EntitySerialization"][] {
  return worn.map(({ wearer, item }) => ({
    name: wearer,
    components: [{ name: COMPONENT.WornCostume, data: { name: wearer, item: clone(item) } }],
  }));
}

/** 按名字把一件道具从一处移到另一处；找不到返回 `false`。 */
export function moveMockItem(name: string, to: "inventory" | "storage"): boolean {
  const [from, target] = to === "inventory" ? [storage, inventory] : [inventory, storage];
  const index = from.findIndex((item) => item.name === name);
  if (index === -1) {
    return false;
  }
  const [moved] = from.splice(index, 1);
  if (moved !== undefined) {
    addItem(target, moved);
  }
  return true;
}

/** 把一批道具并入随身背包（对齐后端 `collect_loot` 的合并语义，供战利品收取使用）。 */
export function addMockInventoryItems(items: RawItem[]): void {
  for (const item of items) {
    addItem(inventory, item);
  }
}

/** 按名字逐个消耗储物箱材料（每个名字扣 1），并把产物放回储物箱。 */
export function craftMockItem(workshop: Workshop, materials: string[]): void {
  for (const name of materials) {
    const index = storage.findIndex((item) => item.name === name && item.type === "MaterialItem");
    if (index === -1) {
      continue;
    }
    const item = storage[index];
    const count = typeof item?.count === "number" ? item.count : 1;
    if (item === undefined) {
      continue;
    }
    if (count <= 1) {
      storage.splice(index, 1);
    } else {
      item.count = count - 1;
    }
  }

  const crafted = clone(CRAFTED_ITEMS[workshop]);
  addItem(storage, crafted);
  appendMockSessionMessage({
    type: "announce",
    message: `（mock）工坊完成一件${CRAFT_LABELS[workshop]}：${String(crafted.name)}。`,
    actor: "旁白",
    stage: "场景.门厅",
    content: `工坊完成一件${CRAFT_LABELS[workshop]}。`,
  });
}

/** 复位成初始 fixture（测试之间隔离）。 */
export function resetMockItems(): void {
  inventory = clone(runtimeInventoryFixture);
  storage = clone(runtimeStorageFixture);
  worn = clone(wornCostumesFixture);
}

/**
 * 从储物箱取一件时装穿到目标角色身上；若其已穿着先归还旧时装（与后端交换语义一致）。
 * 储物箱里没有该时装时返回 `false`。
 */
export function wearMockCostume(target: string, costumeName: string): boolean {
  const index = storage.findIndex(
    (item) => item.name === costumeName && item.type === "CostumeItem",
  );
  if (index === -1) {
    return false;
  }
  const [costume] = storage.splice(index, 1);
  if (costume === undefined) {
    return false;
  }

  const existing = worn.findIndex((entry) => entry.wearer === target);
  if (existing !== -1) {
    const old = worn[existing];
    if (old !== undefined) {
      addItem(storage, old.item);
    }
    worn.splice(existing, 1);
  }

  worn.push({ wearer: target, item: costume });
  return true;
}

/** 脱下目标角色的时装并归还储物箱；未穿着时返回 `false`。 */
export function removeMockCostume(target: string): boolean {
  const index = worn.findIndex((entry) => entry.wearer === target);
  if (index === -1) {
    return false;
  }
  const [entry] = worn.splice(index, 1);
  if (entry !== undefined) {
    addItem(storage, entry.item);
  }
  return true;
}

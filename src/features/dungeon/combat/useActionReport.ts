/**
 * 「这次动作干了什么」的浮窗状态：动作一开始就开窗（服务端要跑决策与结算，几秒到十几秒），
 * 结束后把本回合 `entries` 的新增条目交出来。
 *
 * 条目要等 `invalidateDungeons` 重新拉取之后才到，所以"任务结束"不等于"已有内容"：任务结束后
 * 先停在 `running`，条目一出现就转 `settled`；一直没有（过牌但没有词缀可结算）就等一小会儿，
 * 再给一个空结果。失败不弹内容——那颗按钮旁边已经写着原因了。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { Schemas } from "../../../api/types";
import { type EntriesSnapshot, readEntriesSince, snapshotEntries } from "./readRoundEntries";
import type { CombatActions } from "./useCombatActions";

/** 动作 → 浮窗标题（键即 `useCombatActions` 里的动作名，只有会记回合条目的那几个）。 */
const ACTION_LABELS = {
  play: "出牌结算",
  pass: "过牌",
  use: "使用消耗品",
  gear: "装备物化",
  advance: "怪物行动",
} as const;

type ActionKey = keyof typeof ACTION_LABELS;

const ACTION_KEYS = Object.keys(ACTION_LABELS) as ActionKey[];

/**
 * 任务结束到"重新拉取把条目带回来"只隔一次 GET。过了这段时间还没有条目，就是这次真的没有记录
 * （过牌但没有词缀可结算）：直接收窗，不让玩家为一句"没有记录"再点一次。
 */
const EMPTY_TIMEOUT_MS = 1200;

export interface ActionReport {
  /** 浮窗标题：这次是哪种动作。 */
  label: string;
  /** `running` = 服务端还在算；`settled` = 本次条目已经拿到。 */
  phase: "running" | "settled";
  /** 这次动作新增的回合条目（`settled` 时非空——没有条目的动作直接收窗）。 */
  entries: Schemas["RoundEntry"][];
}

function readRunningKey(actions: CombatActions): ActionKey | null {
  return ACTION_KEYS.find((key) => actions[key].isBusy) ?? null;
}

/** 动作失败的原因（同一时刻只可能有一个动作在跑，所以谁有错就是它）。 */
function readError(actions: CombatActions): string | null {
  return (
    actions.play.error ??
    actions.pass.error ??
    actions.use.error ??
    actions.gear.error ??
    actions.advance.error
  );
}

export function useActionReport(actions: CombatActions, rounds: Schemas["Round"][]) {
  const runningKey = readRunningKey(actions);
  const [report, setReport] = useState<ActionReport | null>(null);

  // 起点只在按下的那一刻读一次：动作期间记录会增长，事后再读就等于没有起点
  const snapshot = useRef<EntriesSnapshot | null>(null);
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const errorRef = useRef<string | null>(null);
  errorRef.current = readError(actions);

  // 开窗：动作开始（提交请求也算，按钮那一刻就已经"忙"了）
  useEffect(() => {
    if (runningKey === null) {
      return;
    }
    snapshot.current = snapshotEntries(roundsRef.current);
    setReport({ label: ACTION_LABELS[runningKey], phase: "running", entries: [] });
  }, [runningKey]);

  // 收窗：失败直接收起；成功则等新增条目出现，一直等不到就是这次没有记录，也收起
  useEffect(() => {
    if (runningKey !== null || report === null) {
      return;
    }
    if (errorRef.current !== null) {
      setReport(null);
      return;
    }
    const entries = readEntriesSince(rounds, snapshot.current);
    if (entries.length > 0) {
      // 已经显示的就是这一批就不再 setState：`report` 是本 effect 的依赖，无脑换新对象会自激成死循环
      if (report.entries.length !== entries.length) {
        setReport({ ...report, phase: "settled", entries });
      }
      return;
    }
    const timer = setTimeout(() => setReport(null), EMPTY_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [runningKey, report, rounds]);

  const close = useCallback(() => setReport(null), []);

  return { report, close };
}

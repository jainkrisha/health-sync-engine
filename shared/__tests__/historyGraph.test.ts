import { describe, expect, it } from "vitest";
import { buildCommitGraph } from "../historyGraph";
import type { Conflict, HistoryCommit } from "../types";

let seq = 0;
function commit(
  id: string,
  clientId: string,
  clock: Record<string, number>,
  field: HistoryCommit["field"] = "medications",
): HistoryCommit {
  seq++;
  const t = new Date(Date.UTC(2026, 9, 1, 10, seq)).toISOString();
  return {
    id,
    clientId,
    deviceName: `Tablet ${clientId}`,
    userName: `nurse ${clientId}`,
    operation: field ? "update" : "create",
    field,
    payload: {},
    vectorClock: clock,
    timestamp: t,
    receivedAt: t,
    status: "synced",
    decisions: [],
  };
}

function conflict(over: Partial<Conflict>): Conflict {
  return {
    id: "k1",
    patientId: "p",
    patientName: "Asha",
    field: "medications",
    key: "metformin",
    label: "Metformin",
    currentValue: { dosage: "850 mg", frequency: "daily", active: true },
    currentClock: { a: 2 },
    currentClientId: "a",
    currentTimestamp: "",
    incomingValue: { dosage: "1000 mg", frequency: "daily", active: true },
    incomingClock: { a: 1, b: 1 },
    incomingClientId: "b",
    incomingTimestamp: "",
    mutationId: "b1",
    status: "pending_review",
    createdAt: new Date(Date.UTC(2026, 9, 1, 11)).toISOString(),
    ...over,
  };
}

describe("buildCommitGraph", () => {
  const history = [
    commit("a0", "a", { a: 1 }, null),
    commit("a1", "a", { a: 2 }),
    commit("b1", "b", { a: 1, b: 1 }),
    commit("a2", "a", { a: 3, b: 1 }),
  ];

  it("gives each device a lane and links commits to their causal parents", () => {
    const g = buildCommitGraph({ commits: history, conflicts: [] });
    expect(g.lanes.map((l) => l.key)).toEqual(["a", "b"]);
    const parents = Object.fromEntries(g.nodes.map((n) => [n.id, n.parents]));
    expect(parents).toEqual({
      a0: [],
      a1: ["a0"],
      b1: ["a0"],
      a2: ["a1", "b1"],
    });
    expect(g.nodes.map((n) => n.id)).toEqual(["a2", "b1", "a1", "a0"]);
  });

  it("joins the two sides of a conflict in an open review node", () => {
    const g = buildCommitGraph(
      { commits: history.slice(0, 3), conflicts: [conflict({})] },
      "2026-10-02T00:00:00.000Z",
    );
    expect(g.lanes.at(-1)).toMatchObject({ key: "review", review: true });
    const top = g.nodes[0];
    expect(top).toMatchObject({ kind: "pending", parents: ["a1", "b1"] });
    expect(g.nodes.find((n) => n.id === "a1")!.clashes).toHaveLength(1);
    expect(g.nodes.find((n) => n.id === "b1")!.clashes).toHaveLength(1);
  });

  it("places a settled conflict at the time it was resolved", () => {
    const resolvedAt = new Date(Date.UTC(2026, 9, 1, 12)).toISOString();
    const g = buildCommitGraph({
      commits: history.slice(0, 3),
      conflicts: [
        conflict({ status: "resolved", resolvedAt, resolvedByName: "Dr Rao" }),
      ],
    });
    expect(g.nodes[0]).toMatchObject({
      kind: "resolution",
      time: resolvedAt,
      parents: ["a1", "b1"],
    });
    expect(g.lanes.at(-1)!.people).toEqual(["Dr Rao"]);
  });
});

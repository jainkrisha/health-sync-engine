/**
 * historyGraph.ts — turns one patient's history into a commit graph, the way
 * `git log --graph` draws branches.
 *
 * - Every device is a branch (a lane). Each mutation it pushed is a commit.
 * - A commit's parents are the latest commits it had already seen, read from the
 *   vector clocks: d is a parent of c when d happened before c and nothing else
 *   sits causally between them. Two commits that never saw each other fork into
 *   separate lanes, exactly like two branches.
 * - A conflict joins its two clashing commits in a merge node on the review lane:
 *   a solid merge once a reviewer settled it, an open (dashed) one while it waits.
 */
import type { Conflict, HistoryCommit } from "./types";
import { compare, type VectorClock } from "./vectorClock";

export type GraphNodeKind = "commit" | "resolution" | "pending";

export interface GraphLane {
  key: string;
  label: string;
  /** Who worked on this branch. */
  people: string[];
  review: boolean;
}

export interface GraphNode {
  id: string;
  kind: GraphNodeKind;
  lane: number;
  parents: string[];
  time: string;
  commit?: HistoryCommit;
  conflict?: Conflict;
  /** For commits: the conflicts this commit is one side of. */
  clashes: Conflict[];
}

export interface CommitGraph {
  lanes: GraphLane[];
  /** Newest first, like `git log`. */
  nodes: GraphNode[];
}

export const REVIEW_LANE = "review";

function sameClock(a: VectorClock, b: VectorClock): boolean {
  return compare(a, b) === "equal";
}

/** The commit that wrote the stored side of a conflict. */
function currentSideOf(
  conflict: Conflict,
  commits: HistoryCommit[],
): HistoryCommit | undefined {
  const byDevice = commits.filter(
    (c) =>
      c.clientId === conflict.currentClientId && c.id !== conflict.mutationId,
  );
  return (
    byDevice.find((c) => sameClock(c.vectorClock, conflict.currentClock)) ??
    byDevice
      .filter(
        (c) => c.field === "medications" && c.receivedAt <= conflict.createdAt,
      )
      .at(-1) ??
    byDevice.at(-1)
  );
}

export function buildCommitGraph(
  input: { commits: HistoryCommit[]; conflicts: Conflict[] },
  now = new Date().toISOString(),
): CommitGraph {
  // Server receipt order is a valid causal order: a device can only have seen a
  // write after the server stored it.
  const commits = [...input.commits].sort((a, b) =>
    a.receivedAt.localeCompare(b.receivedAt),
  );

  const lanes: GraphLane[] = [];
  const laneOf = new Map<string, number>();
  for (const c of commits) {
    if (!laneOf.has(c.clientId)) {
      laneOf.set(c.clientId, lanes.length);
      lanes.push({
        key: c.clientId,
        label: c.deviceName,
        people: [],
        review: false,
      });
    }
    const lane = lanes[laneOf.get(c.clientId)!];
    if (!lane.people.includes(c.userName)) lane.people.push(c.userName);
  }

  const nodes: GraphNode[] = commits.map((c, i) => {
    const before = commits
      .slice(0, i)
      .filter((d) => compare(d.vectorClock, c.vectorClock) === "before");
    // Keep only the latest ones: drop any that another candidate already saw.
    const parents = before.filter(
      (d) =>
        !before.some(
          (e) => e !== d && compare(d.vectorClock, e.vectorClock) === "before",
        ),
    );
    return {
      id: c.id,
      kind: "commit",
      lane: laneOf.get(c.clientId)!,
      parents: parents.map((p) => p.id),
      time: c.receivedAt,
      commit: c,
      clashes: [],
    };
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));

  if (input.conflicts.length > 0) {
    const reviewLane = lanes.length;
    lanes.push({
      key: REVIEW_LANE,
      label: "District review",
      people: [],
      review: true,
    });
    for (const conflict of input.conflicts) {
      const incoming = byId.get(conflict.mutationId);
      const current = currentSideOf(conflict, commits);
      const parents = [current?.id, incoming?.id].filter((id): id is string =>
        Boolean(id),
      );
      for (const id of parents) byId.get(id)!.clashes.push(conflict);
      const resolved = conflict.status === "resolved";
      if (
        resolved &&
        conflict.resolvedByName &&
        !lanes[reviewLane].people.includes(conflict.resolvedByName)
      ) {
        lanes[reviewLane].people.push(conflict.resolvedByName);
      }
      nodes.push({
        id: `${resolved ? "resolution" : "pending"}-${conflict.id}`,
        kind: resolved ? "resolution" : "pending",
        lane: reviewLane,
        parents,
        time: resolved ? (conflict.resolvedAt ?? conflict.createdAt) : now,
        conflict,
        clashes: [],
      });
    }
  }

  // Newest first; a node always sits above its parents.
  const order = new Map(nodes.map((n, i) => [n.id, i]));
  nodes.sort(
    (a, b) =>
      b.time.localeCompare(a.time) || order.get(b.id)! - order.get(a.id)!,
  );
  return { lanes, nodes };
}

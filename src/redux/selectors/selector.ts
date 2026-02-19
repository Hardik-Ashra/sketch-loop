// selectors.ts  — put this alongside your Redux store files
//
// Rule: any selector that returns a derived value (array, object, computed
// result) must be memoized with createSelector. Plain field lookups that
// return a primitive (string, number, boolean) are safe as inline selectors.

import { createSelector } from "@reduxjs/toolkit"; // re-exports reselect
import type { RootState } from "@/redux/store";
import type { Shape } from "@/redux/slices/shapes";

// ─── shapes ──────────────────────────────────────────────────────────────────

const selectShapeEntities = (state: RootState) => state.shapes.shapes.entities;
const selectShapeIds = (state: RootState) => state.shapes.shapes.ids;

/**
 * Returns the full shape list as an array.
 * Memoized: only recomputes when entities or ids actually change.
 *
 * Replaces every:
 *   Object.values(state.shapes.shapes?.entities || {}).filter(s => s !== undefined)
 * in useWorkflowGeneration, useFrame, useChatWindow, etc.
 */
export const selectAllShapes = createSelector(
    [selectShapeEntities, selectShapeIds],
    (entities, ids): Shape[] =>
        ids
            .map((id: string) => entities[id])
            .filter((s: Shape | undefined): s is Shape => s !== undefined)
);

/**
 * Returns only the shapes that are currently selected.
 */
const selectSelectedIds = (state: RootState) => state.shapes.selected;
export const selectSelectedShapes = createSelector(
    [selectShapeEntities, selectSelectedIds],
    (entities, selected): Shape[] =>
        Object.keys(selected)
            .map((id) => entities[id])
            .filter((s: Shape | undefined): s is Shape => s !== undefined)
);
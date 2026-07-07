import React, { createContext, useCallback, useContext, useRef, useState } from "react";
import type { AppState } from "./AppState.js";

type Updater = (prev: AppState) => AppState;

interface Store {
  getAppState: () => AppState;
  setAppState: (updater: Updater) => void;
  useSelector: <T>(selector: (s: AppState) => T) => T;
}

const AppStateCtx = createContext<Store | null>(null);

export function AppStateProvider({
  initialState,
  children,
}: {
  initialState: AppState;
  children: React.ReactNode;
}) {
  // Hold authoritative state in a ref so imperative getters (from tools, QueryEngine)
  // always see the latest value without being tied to React render cycles.
  const stateRef = useRef<AppState>(initialState);
  // React-visible mirror — used by useSelector to trigger re-renders.
  const [tick, setTick] = useState(0);

  const getAppState = useCallback(() => stateRef.current, []);
  const setAppState = useCallback((updater: Updater) => {
    const next = updater(stateRef.current);
    if (next === stateRef.current) return; // no-op (e.g. early-return updaters)
    stateRef.current = next;
    setTick((t) => t + 1);
  }, []);

  const useSelector = useCallback(<T,>(selector: (s: AppState) => T): T => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return React.useMemo(() => selector(stateRef.current), [tick, selector]);
  }, [tick]);

  const store: Store = { getAppState, setAppState, useSelector };
  return <AppStateCtx.Provider value={store}>{children}</AppStateCtx.Provider>;
}

export function useAppStore(): Store {
  const s = useContext(AppStateCtx);
  if (!s) throw new Error("useAppStore used outside AppStateProvider");
  return s;
}

export function useAppSelector<T>(selector: (s: AppState) => T): T {
  return useAppStore().useSelector(selector);
}

export function useAppState(): AppState {
  return useAppSelector((s) => s);
}

export function useSetAppState(): (updater: Updater) => void {
  return useAppStore().setAppState;
}

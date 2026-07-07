import React, { useEffect, useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { theme } from "./theme.js";
import {
  listAccounts,
  getActiveAccountId,
  addAccount,
  removeAccount,
  isProviderWired,
  dashboardUrl,
  ACCOUNT_PROVIDERS,
  type ProviderAccount,
} from "../config/accounts.js";
import { providerFromAccount } from "../agent/providers/index.js";
import type { QuotaStatus } from "../agent/quota.js";
import { openExternal } from "../utils/openExternal.js";

interface Props {
  initialAddMode?: boolean;
  onSwitch: (acc: ProviderAccount) => void | Promise<void>;
  onClose: () => void;
  notify: (msg: string, tone?: "info" | "warn" | "error") => void;
}

type QuotaCell = "loading" | "skip" | QuotaStatus;

export function AccountsOverlay({ initialAddMode, onSwitch, onClose, notify }: Props) {
  const [accounts, setAccounts] = useState<ProviderAccount[] | null>(null);
  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [cursor, setCursor] = useState(0);
  const [quota, setQuota] = useState<Record<string, QuotaCell>>({});
  const [mode, setMode] = useState<"list" | "add">(initialAddMode ? "add" : "list");

  // Add-flow sub-state.
  const [addStep, setAddStep] = useState<
    "provider" | "name" | "key" | "endpoint" | "deployment" | "apiVersion"
  >("provider");
  const [providerIdx, setProviderIdx] = useState(0);
  const [nameBuf, setNameBuf] = useState("");
  const [keyBuf, setKeyBuf] = useState("");
  // Azure Foundry extras.
  const [endpointBuf, setEndpointBuf] = useState("");
  const [deploymentBuf, setDeploymentBuf] = useState("");
  const [apiVersionBuf, setApiVersionBuf] = useState("");

  const probeQuota = useCallback((accts: ProviderAccount[]) => {
    const next: Record<string, QuotaCell> = {};
    for (const a of accts) {
      next[a.id] = isProviderWired(a.provider) && a.apiKey ? "loading" : "skip";
    }
    setQuota(next);
    for (const a of accts) {
      if (!isProviderWired(a.provider) || !a.apiKey) continue;
      void (async () => {
        try {
          const p = providerFromAccount(a);
          const q = p.getQuota ? await p.getQuota() : { available: false, summary: "n/a" };
          setQuota((prev) => ({ ...prev, [a.id]: q }));
        } catch {
          setQuota((prev) => ({ ...prev, [a.id]: { available: false, summary: "⚠ error" } }));
        }
      })();
    }
  }, []);

  const reload = useCallback(async () => {
    const [accts, active] = await Promise.all([listAccounts(), getActiveAccountId()]);
    setAccounts(accts);
    setActiveId(active);
    setCursor((c) => Math.min(c, Math.max(0, accts.length - 1)));
    probeQuota(accts);
  }, [probeQuota]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const resetAdd = () => {
    setAddStep("provider");
    setProviderIdx(0);
    setNameBuf("");
    setKeyBuf("");
    setEndpointBuf("");
    setDeploymentBuf("");
    setApiVersionBuf("");
  };

  const commitAdd = useCallback(async () => {
    const provider = ACCOUNT_PROVIDERS[providerIdx]!;
    const name = nameBuf.trim();
    const key = keyBuf.trim();
    if (!name) return;
    const isAzure = provider === "azure-foundry";
    const host = isAzure ? endpointBuf.trim() || undefined : undefined;
    const deployment = deploymentBuf.trim();
    const meta = isAzure
      ? {
          deployment,
          apiVersion: apiVersionBuf.trim() || "2024-10-21",
          model: deployment,
        }
      : undefined;
    const rec = await addAccount({ provider, name, apiKey: key || undefined, host, meta });
    notify(`✔ added ${provider} account "${name}"`, "info");
    resetAdd();
    setMode("list");
    await reload();
    // Place cursor on the new row.
    const accts = await listAccounts();
    const idx = accts.findIndex((a) => a.id === rec.id);
    if (idx >= 0) setCursor(idx);
  }, [providerIdx, nameBuf, keyBuf, endpointBuf, deploymentBuf, apiVersionBuf, notify, reload]);

  useInput((input, key) => {
    // ── Add flow ──
    if (mode === "add") {
      if (key.escape) {
        resetAdd();
        if (initialAddMode) return onClose();
        return setMode("list");
      }
      if (addStep === "provider") {
        if (key.upArrow) return setProviderIdx((i) => Math.max(0, i - 1));
        if (key.downArrow) return setProviderIdx((i) => Math.min(ACCOUNT_PROVIDERS.length - 1, i + 1));
        if (key.return) return setAddStep("name");
        return;
      }
      if (addStep === "name") {
        if (key.return) {
          if (nameBuf.trim()) setAddStep("key");
          return;
        }
        if (key.backspace || key.delete) return setNameBuf((s) => s.slice(0, -1));
        if (input && !key.ctrl && !key.meta) return setNameBuf((s) => s + input);
        return;
      }
      if (addStep === "key") {
        if (key.return) {
          // Azure needs an endpoint + deployment before it can be saved.
          if (ACCOUNT_PROVIDERS[providerIdx] === "azure-foundry") return setAddStep("endpoint");
          void commitAdd();
          return;
        }
        if (key.backspace || key.delete) return setKeyBuf((s) => s.slice(0, -1));
        if (input && !key.ctrl && !key.meta) return setKeyBuf((s) => s + input);
        return;
      }
      if (addStep === "endpoint") {
        if (key.return) {
          if (endpointBuf.trim()) setAddStep("deployment");
          return;
        }
        if (key.backspace || key.delete) return setEndpointBuf((s) => s.slice(0, -1));
        if (input && !key.ctrl && !key.meta) return setEndpointBuf((s) => s + input);
        return;
      }
      if (addStep === "deployment") {
        if (key.return) {
          if (deploymentBuf.trim()) setAddStep("apiVersion");
          return;
        }
        if (key.backspace || key.delete) return setDeploymentBuf((s) => s.slice(0, -1));
        if (input && !key.ctrl && !key.meta) return setDeploymentBuf((s) => s + input);
        return;
      }
      // addStep === "apiVersion" (optional — enter with empty uses the default)
      if (key.return) {
        void commitAdd();
        return;
      }
      if (key.backspace || key.delete) return setApiVersionBuf((s) => s.slice(0, -1));
      if (input && !key.ctrl && !key.meta) return setApiVersionBuf((s) => s + input);
      return;
    }

    // ── List mode ──
    if (key.escape) return onClose();
    if (input === "a") {
      resetAdd();
      return setMode("add");
    }
    if (!accounts || accounts.length === 0) return;
    if (key.upArrow) return setCursor((i) => Math.max(0, i - 1));
    if (key.downArrow) return setCursor((i) => Math.min(accounts.length - 1, i + 1));
    if (input === "r") return probeQuota(accounts);
    if (input === "o") {
      const acc = accounts[cursor];
      const url = acc && dashboardUrl(acc.provider);
      if (url) {
        openExternal(url);
        notify(`opened usage dashboard: ${url}`);
      } else {
        notify("no usage dashboard for this provider", "warn");
      }
      return;
    }
    if (input === "d") {
      const acc = accounts[cursor];
      if (acc) {
        void (async () => {
          await removeAccount(acc.id);
          notify(`✔ removed ${acc.provider} account "${acc.name}"`, "info");
          await reload();
        })();
      }
      return;
    }
    if (key.return) {
      const acc = accounts[cursor];
      if (acc) void onSwitch(acc);
      return;
    }
  });

  // ── Render: add flow ──
  if (mode === "add") {
    return (
      <Box flexDirection="column" borderStyle="round" borderColor={theme.borderActive} paddingX={2} marginBottom={1}>
        <Text bold color={theme.accent}>Add account</Text>
        <Box marginTop={1} flexDirection="column">
          {addStep === "provider" && (
            <>
              <Text color="gray">Choose a provider:</Text>
              {ACCOUNT_PROVIDERS.map((p, i) => {
                const sel = i === providerIdx;
                const wired = isProviderWired(p);
                return (
                  <Box key={p}>
                    <Box width={2}><Text color={sel ? theme.accent : theme.muted}>{sel ? "▸" : " "}</Text></Box>
                    <Text color={sel ? theme.accent : theme.text} bold={sel}>{p}</Text>
                    {!wired && <Text color={theme.warning} dimColor={!sel}>{"  (not wired for chat yet)"}</Text>}
                  </Box>
                );
              })}
            </>
          )}
          {addStep === "name" && (
            <>
              <Text color="gray">provider: <Text color="white">{ACCOUNT_PROVIDERS[providerIdx]}</Text></Text>
              <Text>name: <Text color={theme.accent}>{nameBuf}</Text><Text color="gray">▏</Text></Text>
            </>
          )}
          {(addStep === "key" || addStep === "endpoint" || addStep === "deployment" || addStep === "apiVersion") && (
            <>
              <Text color="gray">provider: <Text color="white">{ACCOUNT_PROVIDERS[providerIdx]}</Text></Text>
              <Text color="gray">name: <Text color="white">{nameBuf}</Text></Text>
              <Text color={addStep === "key" ? theme.text : "gray"}>
                key{addStep === "key" ? " (hidden)" : ""}: <Text color={addStep === "key" ? theme.accent : "white"}>{keyBuf ? "•".repeat(keyBuf.length) : "(none)"}</Text>
                {addStep === "key" && <Text color="gray">▏</Text>}
              </Text>
              {(addStep === "endpoint" || addStep === "deployment" || addStep === "apiVersion") && (
                <Text>endpoint: <Text color={addStep === "endpoint" ? theme.accent : "white"}>{endpointBuf}</Text>{addStep === "endpoint" && <Text color="gray">▏</Text>}</Text>
              )}
              {(addStep === "deployment" || addStep === "apiVersion") && (
                <Text>deployment: <Text color={addStep === "deployment" ? theme.accent : "white"}>{deploymentBuf}</Text>{addStep === "deployment" && <Text color="gray">▏</Text>}</Text>
              )}
              {addStep === "apiVersion" && (
                <Text>api-version: <Text color={theme.accent}>{apiVersionBuf || "2024-10-21"}</Text><Text color="gray">▏</Text></Text>
              )}
            </>
          )}
        </Box>
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            {addStep === "provider" && "↑↓ choose · enter next · esc cancel"}
            {addStep === "name" && "type name · enter next · esc cancel"}
            {addStep === "key" && (ACCOUNT_PROVIDERS[providerIdx] === "azure-foundry" ? "paste key (hidden) · enter next · esc cancel" : "paste key (hidden) · enter save · esc cancel")}
            {addStep === "endpoint" && "resource URL e.g. https://my-res.openai.azure.com · enter next · esc cancel"}
            {addStep === "deployment" && "deployment name · enter next · esc cancel"}
            {addStep === "apiVersion" && "api-version (blank = 2024-10-21) · enter save · esc cancel"}
          </Text>
        </Box>
      </Box>
    );
  }

  // ── Render: list ──
  const quotaText = (a: ProviderAccount): { text: string; color: string } => {
    if (!isProviderWired(a.provider)) return { text: "⚠ provider not wired", color: theme.warning };
    const cell = quota[a.id];
    if (cell === "loading") return { text: "probing…", color: theme.muted };
    if (cell === "skip" || !cell) return { text: "no key", color: theme.muted };
    return { text: cell.summary, color: cell.available ? theme.success : theme.muted };
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor={theme.borderActive} paddingX={2} marginBottom={1}>
      <Text bold color={theme.accent}>Accounts</Text>
      <Box marginTop={1} flexDirection="column">
        {!accounts && (
          <Text color="gray"><Spinner type="dots" /> <Text> loading accounts…</Text></Text>
        )}
        {accounts && accounts.length === 0 && (
          <Text color="yellow">no accounts yet — press <Text bold>a</Text> to add one</Text>
        )}
        {accounts?.map((a, i) => {
          const sel = i === cursor;
          const isActive = a.id === activeId;
          const q = quotaText(a);
          return (
            <Box key={a.id}>
              <Box width={2}><Text color={sel ? theme.accent : theme.muted}>{sel ? "▸" : " "}</Text></Box>
              <Box width={20} marginRight={1}>
                <Text color={sel ? theme.accent : theme.text} bold={sel}>{a.name}</Text>
              </Box>
              <Box width={14} marginRight={1}><Text color="gray">[{a.provider}]</Text></Box>
              <Box width={9} marginRight={1}>
                <Text color={isActive ? theme.success : "gray"}>{isActive ? "● active" : "○"}</Text>
              </Box>
              <Text color={q.color}>{q.text}</Text>
            </Box>
          );
        })}
      </Box>
      <Box marginTop={1}>
        <Text color="gray" dimColor>↑↓ move · ⏎ switch · a add · o usage · r refresh · d remove · esc close</Text>
      </Box>
    </Box>
  );
}

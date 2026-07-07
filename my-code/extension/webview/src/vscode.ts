import type { HostMessage, WebviewMessage } from "../../src/chat/protocol.js";

interface VsCodeApi {
  postMessage(msg: WebviewMessage): void;
  getState(): unknown;
  setState(state: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

let vscodeApi: VsCodeApi | undefined;

export function getVsCode(): VsCodeApi {
  if (!vscodeApi) vscodeApi = acquireVsCodeApi();
  return vscodeApi;
}

export function postToHost(msg: WebviewMessage): void {
  getVsCode().postMessage(msg);
}

export function onHostMessage(handler: (msg: HostMessage) => void): () => void {
  const listener = (event: MessageEvent) => {
    handler(event.data as HostMessage);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}

import { useEffect, useState } from "react";

type UpdaterState =
  | { status: "idle" }
  | { status: "checking" }
  | { status: "not-available" }
  | { status: "available"; version: string; releaseNotes: string | null }
  | { status: "downloading"; percent: number }
  | { status: "ready"; version: string }
  | { status: "error"; message: string };

function getApi() {
  return (window as any).electronAPI?.updater ?? null;
}

export function useUpdater() {
  const [state, setState] = useState<UpdaterState>({ status: "idle" });
  const [isElectron, setIsElectron] = useState(false);

  useEffect(() => {
    const api = getApi();
    if (!api) return;
    setIsElectron(true);

    const offAvailable = api.onAvailable((info: { version: string; releaseNotes: string | null }) => {
      setState({ status: "available", version: info.version, releaseNotes: info.releaseNotes });
    });
    const offProgress = api.onProgress((p: { percent: number }) => {
      setState({ status: "downloading", percent: p.percent });
    });
    const offDownloaded = api.onDownloaded((info: { version: string }) => {
      setState({ status: "ready", version: info.version });
    });
    const offError = api.onError((err: { message: string }) => {
      setState({ status: "error", message: err.message });
    });
    const offNotAvailable = api.onNotAvailable?.(() => {
      setState({ status: "not-available" });
    });
    const offManualCheck = api.onManualCheck?.(() => {
      api.check();
    });

    return () => {
      offAvailable?.();
      offProgress?.();
      offDownloaded?.();
      offError?.();
      offNotAvailable?.();
      offManualCheck?.();
    };
  }, []);

  const download = () => getApi()?.download();
  const install  = () => getApi()?.install();
  const check    = () => { setState({ status: "checking" }); return getApi()?.check(); };
  const dismiss  = () => setState({ status: "idle" });

  return { state, download, install, check, dismiss, isElectron };
}

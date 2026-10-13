import { useCallback, useEffect, useState } from "react";
import "../ui.css";
import "./push.css";
import { HttpError } from "../service/api";
import { fetchPushConfig, sendTestPush } from "./pushApi";
import { disablePush, enablePush, readPermission, readSupport, refreshPush, validSubscription } from "./pushClient";
import { TEXT, dismissedRecently, pushStatus, supportProblem, testText, type PushStatus } from "./pushLogic";

const DISMISS_KEY = "vc_push_later";

type Props = { companyId: string };

function readDismissed(): boolean {
  try {
    return dismissedRecently(window.localStorage.getItem(DISMISS_KEY), Date.now());
  } catch {
    return false;
  }
}

function rememberDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, String(Date.now()));
  } catch {
    /* sem armazenamento: o convite volta na próxima vez, só isso */
  }
}

/**
 * "Aviso no celular": liga a notificação de pedido novo, mesa chamando e entrega pronta mesmo com o app fechado.
 * Aparece no painel da equipe e na tela do motoqueiro. Se o servidor não liga o aviso, ou o navegador não sabe
 * receber, não aparece nada (o apito de dentro do painel continua valendo).
 */
export default function PushToggle({ companyId }: Props) {
  const [serverKey, setServerKey] = useState<string | null>(null);
  const [serverEnabled, setServerEnabled] = useState<boolean | null>(null);
  const [status, setStatus] = useState<PushStatus>("checking");
  const [busy, setBusy] = useState<"" | "on" | "off" | "test">("");
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(readDismissed);

  const recheck = useCallback(async (enabled: boolean | null, key: string | null) => {
    const support = readSupport();
    const permission = readPermission();
    const canLook = Boolean(enabled && key) && !supportProblem(support) && permission === "granted";
    const subscribed = canLook && key ? Boolean(await validSubscription(key)) : false;
    setStatus(pushStatus({ serverEnabled: enabled, support, permission, subscribed }));
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const config = await fetchPushConfig();
        if (!alive) return;
        setServerEnabled(config.enabled);
        setServerKey(config.enabled ? config.key : null);
        await recheck(config.enabled, config.enabled ? config.key : null);
        if (config.enabled) void refreshPush(companyId, config.key);
      } catch {
        // sem sinal ou servidor antigo: fica escondido, o painel segue normal
        if (alive) setServerEnabled(false);
        if (alive) setStatus("hidden");
      }
    })();
    return () => {
      alive = false;
    };
  }, [companyId, recheck]);

  // quem libera a notificação nas configurações do navegador volta para cá: confere de novo
  useEffect(() => {
    function onVisible() {
      if (!document.hidden && serverEnabled) void recheck(serverEnabled, serverKey);
    }
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [serverEnabled, serverKey, recheck]);

  function say(text: string, bad = false) {
    setMessage(text);
    setFailed(bad);
  }

  async function turnOn() {
    if (!serverKey) return;
    setBusy("on");
    say("");
    try {
      const result = await enablePush(companyId, serverKey);
      if (result.kind === "denied") {
        say(readPermission() === "denied" ? TEXT.blocked : TEXT.denied, true);
      } else {
        say(TEXT.activated);
      }
    } catch (error) {
      const known = error instanceof HttpError && error.status > 0;
      say(known ? (error as HttpError).message : error instanceof Error && error.message ? error.message : TEXT.noSignal, true);
    } finally {
      setBusy("");
      await recheck(serverEnabled, serverKey);
    }
  }

  async function turnOff() {
    setBusy("off");
    say("");
    try {
      await disablePush(companyId);
      say(TEXT.turnedOff);
    } catch (error) {
      const known = error instanceof HttpError && error.status > 0;
      say(known ? (error as HttpError).message : TEXT.noSignal, true);
    } finally {
      setBusy("");
      await recheck(serverEnabled, serverKey);
    }
  }

  async function test() {
    setBusy("test");
    say("");
    try {
      say(testText(await sendTestPush(companyId)));
    } catch (error) {
      const known = error instanceof HttpError && error.status > 0;
      say(known ? (error as HttpError).message : TEXT.noSignal, true);
    } finally {
      setBusy("");
    }
  }

  if (status === "checking" || status === "hidden") return null;

  if (status === "unsupported") {
    // só explica quando a pessoa pode fazer algo (iPhone fora da tela inicial); o resto não vira ruído
    const problem = supportProblem(readSupport());
    if (!problem.startsWith("No iPhone") || dismissed) return null;
    return (
      <section className="push-strip" aria-label={TEXT.title}>
        <p className="push-text">{problem}</p>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            rememberDismissed();
            setDismissed(true);
          }}
        >
          {TEXT.later}
        </button>
      </section>
    );
  }

  if (status === "on") {
    return (
      <section className="push-strip push-on" aria-label={TEXT.title}>
        <p className="push-text">
          <span aria-hidden="true">🔔 </span>
          {TEXT.on}
        </p>
        <div className="push-actions">
          <button type="button" className="btn btn-outline btn-sm" disabled={busy !== ""} onClick={() => void test()}>
            {busy === "test" ? TEXT.testing : TEXT.test}
          </button>
          <button type="button" className="btn btn-quiet btn-sm" disabled={busy !== ""} onClick={() => void turnOff()}>
            {busy === "off" ? TEXT.turningOff : TEXT.turnOff}
          </button>
        </div>
        {message && (
          <p className={failed ? "msg-error push-note" : "msg-ok push-note"} role="status">
            {message}
          </p>
        )}
      </section>
    );
  }

  if (status === "blocked") {
    if (dismissed) return null;
    return (
      <section className="push-strip" aria-label={TEXT.title}>
        <p className="push-text">{TEXT.blocked}</p>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          onClick={() => {
            rememberDismissed();
            setDismissed(true);
          }}
        >
          {TEXT.later}
        </button>
      </section>
    );
  }

  // status === "off": o convite
  if (dismissed && !message) return null;
  return (
    <section className="push-strip" aria-label={TEXT.title}>
      <p className="push-text">
        <span aria-hidden="true">🔔 </span>
        {TEXT.pitch}
      </p>
      <div className="push-actions">
        <button type="button" className="btn btn-primary btn-sm" disabled={busy !== ""} onClick={() => void turnOn()}>
          {busy === "on" ? TEXT.activating : TEXT.activate}
        </button>
        <button
          type="button"
          className="btn btn-quiet btn-sm"
          disabled={busy !== ""}
          onClick={() => {
            rememberDismissed();
            setDismissed(true);
          }}
        >
          {TEXT.later}
        </button>
      </div>
      {message && (
        <p className={failed ? "msg-error push-note" : "msg-ok push-note"} role={failed ? "alert" : "status"}>
          {message}
        </p>
      )}
    </section>
  );
}

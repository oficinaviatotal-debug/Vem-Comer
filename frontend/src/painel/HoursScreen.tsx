import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Hours from "../novo/Hours";
import {
  HOURS_LOAD_ERROR,
  HOURS_PAUSE_DONE_OFF,
  HOURS_PAUSE_DONE_ON,
  HOURS_PAUSE_ERROR,
  HOURS_REMOVED,
  HOURS_REMOVE_ERROR,
  HOURS_SAVED,
  HOURS_SAVE_ERROR,
} from "../novo/copy";
import { DICTATION_PATIENCE_MS, canListen, hear, type Hearing } from "../assistant/voiceIO";
import { clearAdminHours, fetchAdminHours, saveAdminHours, setOrdersPaused } from "../service/hoursApi";
import { addShift, copyToAll, fromApi, removeShift, setClosed, setShift, toBody, validate, type ApiHours, type Day } from "../service/hoursDraft";
import { SPOKEN_HOURS_HELP, parseSpokenHours } from "../service/spokenHours";
import { REMOVE_ARM_MS, hoursViewOf } from "./hoursViewLogic";

type Props = {
  /** "Maria, dono": quem está no painel, para o alto da tela. */
  person: string;
  /** O menu do painel. Sem ele o botão de menu não aparece. */
  onMenu?: () => void;
};

type Load = "loading" | "ready" | "error";
type Notice = { ok: boolean; text: string };

/** A frase do servidor quando há (ele escreve em português); senão a nossa. */
const wordsOf = (error: unknown, fallback: string): string => (error instanceof Error && error.message ? error.message : fallback);

/**
 * O Horário de verdade. A pausa vale na hora (não pode esperar); os dias e as horas só vão ao servidor com o botão
 * Salvar horário, depois de a pessoa conferir o que digitou ou falou. Falar o horário só preenche a tela: nada é salvo
 * sozinho. Tirar o horário pede dois toques. Sem horário salvo o restaurante recebe pedido a qualquer hora.
 */
export default function HoursScreen({ person, onMenu }: Props) {
  const [load, setLoad] = useState<Load>("loading");
  const [error, setError] = useState("");
  const [server, setServer] = useState<ApiHours | null>(null);
  const [week, setWeek] = useState<Day[]>(() => fromApi(null));
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeArmed, setRemoveArmed] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const [spoken, setSpoken] = useState<{ said: string; lines: string[]; notes: string[] } | null>(null);

  const alive = useRef(true);
  const hearing = useRef<Hearing | null>(null);
  const heardRef = useRef("");
  const armTimer = useRef<number | undefined>(undefined);
  const canSpeak = useMemo(() => canListen(), []);

  const open = useCallback(async () => {
    setLoad("loading");
    setError("");
    try {
      const data = await fetchAdminHours();
      if (!alive.current) return;
      setServer(data);
      setWeek(fromApi(data));
      setLoad("ready");
    } catch (failure) {
      if (!alive.current) return;
      setError(wordsOf(failure, HOURS_LOAD_ERROR));
      setLoad("error");
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void open();
    return () => {
      alive.current = false;
      hearing.current?.cancel();
      hearing.current = null;
      window.clearTimeout(armTimer.current);
    };
  }, [open]);

  const disarm = useCallback(() => {
    window.clearTimeout(armTimer.current);
    setRemoveArmed(false);
  }, []);

  /** Qualquer mudança nos dias: some o erro e o aviso velhos e o primeiro toque de "tirar" se perde. */
  const change = useCallback(
    (next: Day[]) => {
      setWeek(next);
      setProblems([]);
      setNotice(null);
      disarm();
    },
    [disarm],
  );

  /** O que foi falado vira horas na tela. Nada é salvo: a pessoa confere e toca em Salvar horário. */
  const understand = useCallback(
    (said: string) => {
      const parsed = parseSpokenHours(said, week);
      if (!parsed.week) {
        setSpoken({ said, lines: [], notes: parsed.notes });
        return;
      }
      change(parsed.week);
      setSpoken({ said, lines: parsed.lines, notes: parsed.notes });
    },
    [week, change],
  );

  const stopHearing = useCallback(() => {
    hearing.current?.cancel();
    hearing.current = null;
    setListening(false);
  }, []);

  const listen = useCallback(async () => {
    if (hearing.current) return;
    setSpoken(null);
    setHeard("");
    heardRef.current = "";
    setListening(true);
    const mine = hear({
      patienceMs: DICTATION_PATIENCE_MS,
      onPartial: (text) => {
        heardRef.current = text;
        setHeard(text);
      },
    });
    hearing.current = mine;
    const said = await mine.result;
    if (!alive.current || hearing.current !== mine) return; // cancelado ou trocado enquanto ouvia
    hearing.current = null;
    setListening(false);
    understand((said ?? heardRef.current).trim());
  }, [understand]);

  /** "Pronto": usa as palavras que já chegaram em vez de esperar o silêncio. */
  const finish = useCallback(() => {
    if (!hearing.current) return;
    const words = heardRef.current.trim();
    stopHearing();
    understand(words);
  }, [stopHearing, understand]);

  const cancel = useCallback(() => {
    stopHearing();
    setHeard("");
  }, [stopHearing]);

  const flipPause = useCallback(async () => {
    if (!server || switching) return;
    setSwitching(true);
    setNotice(null);
    try {
      const paused = await setOrdersPaused(!server.orders_paused);
      if (!alive.current) return;
      setServer({ ...server, orders_paused: paused });
      setNotice({ ok: true, text: paused ? HOURS_PAUSE_DONE_ON : HOURS_PAUSE_DONE_OFF });
    } catch (failure) {
      if (alive.current) setNotice({ ok: false, text: wordsOf(failure, HOURS_PAUSE_ERROR) });
    } finally {
      if (alive.current) setSwitching(false);
    }
  }, [server, switching]);

  const save = useCallback(async () => {
    const found = validate(week);
    if (found.length > 0) {
      setProblems(found);
      setNotice(null);
      return;
    }
    setSaving(true);
    setNotice(null);
    try {
      const saved = await saveAdminHours(toBody(week));
      if (!alive.current) return;
      setServer(saved);
      setWeek(fromApi(saved));
      setProblems([]);
      setSpoken(null);
      setNotice({ ok: true, text: HOURS_SAVED });
    } catch (failure) {
      if (alive.current) setNotice({ ok: false, text: wordsOf(failure, HOURS_SAVE_ERROR) });
    } finally {
      if (alive.current) setSaving(false);
    }
  }, [week]);

  const removeHours = useCallback(async () => {
    setRemoving(true);
    setNotice(null);
    try {
      await clearAdminHours();
      const data = await fetchAdminHours();
      if (!alive.current) return;
      setServer(data);
      setWeek(fromApi(data));
      setProblems([]);
      setSpoken(null);
      setNotice({ ok: true, text: HOURS_REMOVED });
    } catch (failure) {
      if (alive.current) setNotice({ ok: false, text: wordsOf(failure, HOURS_REMOVE_ERROR) });
    } finally {
      if (alive.current) setRemoving(false);
    }
  }, []);

  const view = useMemo(
    () =>
      hoursViewOf({
        load,
        server,
        week,
        person,
        error,
        switching,
        saving,
        removing,
        removeArmed,
        problems,
        notice,
        listening,
        heard,
        spoken,
        canSpeak,
        speakHelp: SPOKEN_HOURS_HELP,
      }),
    [load, server, week, person, error, switching, saving, removing, removeArmed, problems, notice, listening, heard, spoken, canSpeak],
  );

  return (
    <Hours
      view={view}
      onMenu={onMenu}
      onToggleDay={(weekday) => {
        const day = week.find((entry) => entry.weekday === weekday);
        if (day) change(setClosed(week, weekday, !day.closed));
      }}
      onShift={(weekday, index, patch) => change(setShift(week, weekday, index, patch))}
      onAddShift={(weekday) => change(addShift(week, weekday))}
      onRemoveShift={(weekday, index) => change(removeShift(week, weekday, index))}
      onCopyAll={(weekday) => change(copyToAll(week, weekday))}
      onPause={() => void flipPause()}
      onSave={() => void save()}
      onDiscard={() => {
        if (server) change(fromApi(server));
        setSpoken(null);
      }}
      onRemove={() => {
        if (removing || saving) return;
        if (!removeArmed) {
          // Primeiro toque: espera o segundo por alguns segundos. Tirar o horário abre o restaurante para pedidos a qualquer hora.
          window.clearTimeout(armTimer.current);
          setRemoveArmed(true);
          armTimer.current = window.setTimeout(() => setRemoveArmed(false), REMOVE_ARM_MS);
          return;
        }
        disarm();
        void removeHours();
      }}
      // A bolinha e o botão "Falar o horário": tocar enquanto ouve é o "Pronto".
      onSpeak={() => (hearing.current ? finish() : void listen())}
      onDone={finish}
      onCancel={cancel}
      onCloseSpoken={() => setSpoken(null)}
      onRetry={() => void open()}
    />
  );
}

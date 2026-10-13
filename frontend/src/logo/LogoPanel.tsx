import { useEffect, useState } from "react";
import "../ui.css";
import "./logo.css";
import ConfirmButton from "../service/ConfirmButton";
import { deleteCompanyLogo, fetchCompany, mediaUrl, uploadCompanyLogo } from "../service/api";
import LogoMaker from "./LogoMaker";
import LogoReview from "./LogoReview";
import { prepareLogoFile, reviewLogoFile, type LogoReviewResult } from "./logoFiles";
import FeedbackAsk from "../feedback/FeedbackAsk";

type Props = {
  companyId: string;
};

type Brand = { name: string; logo_url: string | null };

/** Aba "Marca" do painel: ver, criar, enviar ou tirar a logomarca do restaurante. */
export default function LogoPanel({ companyId }: Props) {
  const [brand, setBrand] = useState<Brand | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [making, setMaking] = useState(false);
  /** A imagem que o dono escolheu, esperando o "Ficou bom?". Nada foi salvo ainda. */
  const [candidate, setCandidate] = useState<(LogoReviewResult & { fileName: string }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    let alive = true;
    fetchCompany(companyId)
      .then((company) => {
        if (!alive) return;
        setBrand({ name: String(company.name ?? ""), logo_url: company.logo_url ?? null });
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [companyId]);

  async function saveMade(png: Blob) {
    const result = await uploadCompanyLogo(png, "logomarca.png");
    setBrand((old) => (old ? { ...old, logo_url: result.logo_url } : old));
    setMaking(false);
    setError("");
    setDone("Logomarca salva. O cliente já vê no cardápio.");
  }

  /** O dono escolheu a imagem dele: prepara, olha e mostra o "Ficou bom?". Só salva quando ele disser que sim. */
  async function chooseMine(file: File | undefined) {
    if (!file) return;
    setError("");
    setDone("");
    setBusy(true);
    try {
      const ready = await prepareLogoFile(file);
      const review = await reviewLogoFile(ready);
      setCandidate({ ...review, fileName: file.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui abrir a logomarca. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  async function useCandidate(blob: Blob) {
    if (!candidate) return;
    setError("");
    setBusy(true);
    setSaving(true);
    try {
      const result = await uploadCompanyLogo(blob, blob.type === "image/png" ? "logomarca.png" : candidate.fileName);
      setBrand((old) => (old ? { ...old, logo_url: result.logo_url } : old));
      setCandidate(null);
      setDone("Logomarca salva. O cliente já vê no cardápio.");
    } catch (err) {
      // fica na tela do "Ficou bom?": o dono tenta de novo sem escolher a imagem outra vez
      setError(err instanceof Error ? err.message : "Não consegui enviar a logomarca. Tente de novo.");
    } finally {
      setBusy(false);
      setSaving(false);
    }
  }

  async function remove() {
    setError("");
    setDone("");
    setBusy(true);
    try {
      await deleteCompanyLogo();
      setBrand((old) => (old ? { ...old, logo_url: null } : old));
      setDone("Logomarca removida.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não consegui remover a logomarca. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  if (loadFailed) {
    return (
      <p className="adm-status" role="alert">
        Não foi possível abrir esta tela. Confira a internet e tente de novo.
      </p>
    );
  }
  if (!brand) return <p className="adm-status">Carregando…</p>;

  if (candidate) {
    return (
      <LogoReview
        review={candidate}
        restaurantName={brand.name}
        busy={busy}
        saving={saving}
        error={error}
        onUse={(blob) => void useCandidate(blob)}
        onPick={(file) => void chooseMine(file)}
        onCancel={() => {
          setCandidate(null);
          setError("");
        }}
      />
    );
  }

  if (making) {
    return (
      <LogoMaker
        initialName={brand.name}
        onSave={saveMade}
        onCancel={() => setMaking(false)}
      />
    );
  }

  const current = mediaUrl(brand.logo_url);

  return (
    <section className="adm-stack" aria-label="Marca">
      <div className="sheet">
        <h2>Logomarca</h2>
        {current ? (
          <div className="logo-current">
            <img id="logo-current" src={current} alt={`Logomarca de ${brand.name}`} width={160} height={160} />
          </div>
        ) : (
          <p className="adm-lead">
            Você ainda não tem logomarca. Eu crio uma para você em três toques, e é de graça. Se já tem uma, é só enviar.
          </p>
        )}

        <div className="logo-actions">
          <button
            type="button"
            id="logo-make"
            className={current ? "btn btn-outline btn-block" : "btn btn-primary btn-block"}
            disabled={busy}
            onClick={() => {
              setDone("");
              setError("");
              setMaking(true);
            }}
          >
            {current ? "Criar outra logomarca" : "Criar minha logomarca"}
          </button>

          <label htmlFor="logo-file" className={busy ? "btn btn-outline btn-block is-disabled" : "btn btn-outline btn-block"}>
            Já tenho uma logomarca
          </label>
          <input
            id="logo-file"
            className="logo-input"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = ""; // permite escolher o mesmo arquivo de novo
              void chooseMine(file);
            }}
          />

          {current && <ConfirmButton label="Remover a logomarca" onConfirm={() => void remove()} />}
        </div>

        {busy && (
          <p className="adm-muted" role="status">
            Abrindo a imagem…
          </p>
        )}
        {error && (
          <p className="msg-error" role="alert">
            {error}
          </p>
        )}
        {done && (
          <p className="msg-ok" role="status">
            {done}
          </p>
        )}
        {done.startsWith("Logomarca salva") && <FeedbackAsk context="logomarca" title="Como foi fazer a logomarca?" />}
        <p className="adm-muted">Dica: uma logomarca com o fundo transparente (PNG) fica melhor no cardápio.</p>
      </div>
    </section>
  );
}

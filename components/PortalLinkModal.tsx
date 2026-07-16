import React, { useEffect, useState, useCallback } from 'react';
import QRCode from 'qrcode';
import { SavedDiet } from '../types';
import { PortalToken } from '../hooks/useAppData';
import { useToast } from './Toast';
import { PORTAL_BASE_URL } from '../config/clinic';

interface Props {
  diet: SavedDiet;
  onClose: () => void;
  getOrCreatePortalToken: (clientId: string, clientName: string) => Promise<PortalToken | null>;
  updatePortalToken: (token: string, patch: Partial<{ enabled: boolean; showEquivalences: boolean }>) => Promise<void>;
  regeneratePortalToken: (oldToken: string, clientId: string, clientName: string) => Promise<PortalToken | null>;
  getPortalWeeklyAdherence: (token: string) => Promise<number>;
}

const PortalLinkModal: React.FC<Props> = ({
  diet, onClose,
  getOrCreatePortalToken, updatePortalToken, regeneratePortalToken, getPortalWeeklyAdherence,
}) => {
  const { toast } = useToast();
  const clientId = diet.patientData.clientId;
  const clientName = diet.patientData.name || 'Paciente';

  const [portalToken, setPortalToken] = useState<PortalToken | null>(null);
  const [loading, setLoading] = useState(true);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [adherence, setAdherence] = useState<number | null>(null);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!clientId) { setLoading(false); return; }
    let cancelled = false;
    getOrCreatePortalToken(clientId, clientName).then(t => {
      if (cancelled) return;
      setPortalToken(t);
      setLoading(false);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const link = portalToken ? `${PORTAL_BASE_URL}/p/${portalToken.token}` : null;

  useEffect(() => {
    if (!link) { setQrDataUrl(null); return; }
    let cancelled = false;
    QRCode.toDataURL(link, { width: 220, margin: 1 }).then(url => { if (!cancelled) setQrDataUrl(url); });
    return () => { cancelled = true; };
  }, [link]);

  useEffect(() => {
    if (!portalToken) return;
    let cancelled = false;
    getPortalWeeklyAdherence(portalToken.token).then(count => { if (!cancelled) setAdherence(count); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalToken?.token]);

  const handleCopy = useCallback(() => {
    if (!link) return;
    navigator.clipboard.writeText(link).then(
      () => toast('Enlace copiado al portapapeles.', 'success'),
      () => toast('No se pudo copiar el enlace.', 'error')
    );
  }, [link, toast]);

  const handleToggleEquivalences = useCallback(async () => {
    if (!portalToken || busy) return;
    setBusy(true);
    const next = !portalToken.showEquivalences;
    await updatePortalToken(portalToken.token, { showEquivalences: next });
    setPortalToken({ ...portalToken, showEquivalences: next });
    setBusy(false);
  }, [portalToken, busy, updatePortalToken]);

  const handleToggleEnabled = useCallback(async () => {
    if (!portalToken || busy) return;
    setBusy(true);
    const next = !portalToken.enabled;
    await updatePortalToken(portalToken.token, { enabled: next });
    setPortalToken({ ...portalToken, enabled: next });
    setBusy(false);
    toast(next ? 'Enlace reactivado.' : 'Enlace desactivado. El paciente ya no podrá acceder.', next ? 'success' : 'info');
  }, [portalToken, busy, updatePortalToken, toast]);

  const handleRegenerate = useCallback(async () => {
    if (!portalToken || !clientId || busy) return;
    setBusy(true);
    const created = await regeneratePortalToken(portalToken.token, clientId, clientName);
    setBusy(false);
    setConfirmingRegenerate(false);
    if (created) {
      setPortalToken(created);
      setAdherence(0);
      toast('Enlace regenerado. El anterior ha dejado de funcionar.', 'success');
    }
  }, [portalToken, clientId, clientName, busy, regeneratePortalToken, toast]);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl bg-surface-light dark:bg-surface-dark border border-border-light dark:border-border-dark shadow-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-black text-text-main dark:text-white">Portal del paciente</h2>
            <p className="text-sm text-text-sub dark:text-gray-400">{clientName}</p>
          </div>
          <button onClick={onClose} className="size-8 flex items-center justify-center rounded-lg text-text-sub hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {!clientId && (
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 text-sm text-amber-800 dark:text-amber-300">
            Este registro no tiene un identificador de paciente estable. Guarda de nuevo la dieta (Editar datos → Guardar) y vuelve a intentarlo.
          </div>
        )}

        {clientId && loading && (
          <p className="text-sm text-text-sub dark:text-gray-400">Generando enlace…</p>
        )}

        {clientId && !loading && portalToken && (
          <>
            <div className="flex flex-col items-center gap-3 py-2">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="Código QR del portal del paciente" className="rounded-lg border border-border-light dark:border-border-dark" />
              )}
              <div className="w-full flex items-center gap-2 rounded-lg bg-background-light dark:bg-background-dark border border-border-light dark:border-border-dark px-3 h-11">
                <span className="material-symbols-outlined text-text-sub dark:text-gray-400 text-[18px]">link</span>
                <input readOnly value={link ?? ''} className="flex-1 bg-transparent border-none text-sm text-text-main dark:text-white outline-none truncate" onFocus={e => e.target.select()} />
                <button onClick={handleCopy} className="shrink-0 rounded-md px-3 h-8 bg-primary text-background-dark text-xs font-bold hover:brightness-90 transition-all">
                  Copiar
                </button>
              </div>
              {!portalToken.enabled && (
                <p className="text-xs font-bold text-red-500">Enlace desactivado — el paciente no puede acceder.</p>
              )}
            </div>

            <label className="flex items-center justify-between gap-3 cursor-pointer">
              <span className="text-sm font-bold text-text-main dark:text-white">Mostrar alternativas equivalentes</span>
              <input type="checkbox" checked={portalToken.showEquivalences} onChange={handleToggleEquivalences} disabled={busy} className="size-5 accent-primary" />
            </label>

            <div className="rounded-xl bg-background-light dark:bg-background-dark p-4 flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">task_alt</span>
              <p className="text-sm text-text-main dark:text-white">
                {adherence === null ? 'Cargando adherencia…' : (
                  <>Esta semana marcó <strong>{adherence}</strong> comida{adherence === 1 ? '' : 's'} como realizada{adherence === 1 ? '' : 's'}.</>
                )}
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2 border-t border-border-light dark:border-border-dark">
              <button
                onClick={handleToggleEnabled}
                disabled={busy}
                className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 border border-border-light dark:border-border-dark text-sm font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{portalToken.enabled ? 'block' : 'check_circle'}</span>
                {portalToken.enabled ? 'Desactivar enlace' : 'Reactivar enlace'}
              </button>

              {!confirmingRegenerate ? (
                <button
                  onClick={() => setConfirmingRegenerate(true)}
                  disabled={busy}
                  className="flex items-center justify-center gap-2 rounded-lg h-10 px-4 border border-border-light dark:border-border-dark text-sm font-bold text-text-main dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">autorenew</span>
                  Regenerar enlace
                </button>
              ) : (
                <div className="rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-3 flex flex-col gap-2">
                  <p className="text-xs text-red-700 dark:text-red-300">El enlace actual dejará de funcionar de inmediato. ¿Continuar?</p>
                  <div className="flex gap-2">
                    <button onClick={handleRegenerate} disabled={busy} className="flex-1 rounded-md h-9 bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors disabled:opacity-50">
                      Sí, regenerar
                    </button>
                    <button onClick={() => setConfirmingRegenerate(false)} className="flex-1 rounded-md h-9 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-xs font-bold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PortalLinkModal;

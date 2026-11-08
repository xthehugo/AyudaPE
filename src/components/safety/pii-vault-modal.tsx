'use client';

import React, { useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileCheck2,
  KeyRound,
  Lock,
  Phone,
  ShieldAlert,
  Unlock,
  X,
} from 'lucide-react';
import type { IPostLocal } from '@shared/types';
import { useOperationalMode } from '@/context/mode-context';
import {
  executePiiVaultUnlock,
  type ILocalPiiAuditRecord,
} from '@/lib/safety/pii-vault';

export interface PiiVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: IPostLocal;
  onUnlocked?: (audit: ILocalPiiAuditRecord) => void;
}

export function PiiVaultModal({
  isOpen,
  onClose,
  post,
  onUnlocked,
}: PiiVaultModalProps): React.ReactElement | null {
  const { activeRole, setActiveRole } = useOperationalMode();

  const [pin, setPin] = useState('');
  const [justification, setJustification] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [auditRecord, setAuditRecord] = useState<ILocalPiiAuditRecord | null>(null);
  const [unlockedData, setUnlockedData] = useState<{
    exact_address: string;
    contact_phone: string;
    audit_id: string;
  } | null>(null);

  if (!isOpen) return null;

  // Dirección y teléfono protegidos de respaldo
  const protectedAddress =
    post.description.includes('Jr.') || post.description.includes('Calle')
      ? post.description
      : 'Jr. Huiracocha 1488 Dpto 201, El Tambo, Huancayo';
  const protectedPhone = '987-111-222';

  const handleSwitchToBrigadista = () => {
    setActiveRole('BRIGADISTA_CERTIFICADO');
    setPin('1234');
    setErrorMsg(null);
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Validación de PIN demostrativo de brigadista
    if (activeRole !== 'BRIGADISTA_CERTIFICADO' && activeRole !== 'OPERADOR_MUNICIPAL') {
      const result = executePiiVaultUnlock({
        postId: post.id ?? 1,
        userRole: activeRole,
        userName: 'Vecino Usuario',
        accessReason: justification,
        protectedAddress,
        protectedPhone,
      });
      setErrorMsg(result.error ?? 'Acceso denegado');
      return;
    }

    if (pin !== '1234' && pin !== '9999') {
      setErrorMsg('PIN de Brigadista incorrecto. Use el PIN demo: 1234');
      return;
    }

    const outcome = executePiiVaultUnlock({
      postId: post.id ?? 1,
      userRole: activeRole,
      userName: 'Brigadista Pedro Quispe · Junta El Tambo',
      accessReason: justification,
      protectedAddress,
      protectedPhone,
    });

    if (!outcome.success) {
      setErrorMsg(outcome.error ?? 'Error de validación');
      return;
    }

    if (outcome.data && outcome.auditRecord) {
      setUnlockedData(outcome.data);
      setAuditRecord(outcome.auditRecord);
      if (onUnlocked) {
        onUnlocked(outcome.auditRecord);
      }
    }
  };

  const handleFillDemoJustification = () => {
    setJustification('Rescate urgente de adulto mayor con balón de oxígeno medicinal agotado.');
    setErrorMsg(null);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pii-vault-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-900/70 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-200 p-5 sm:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Cabecera del Modal */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
              <Lock className="w-5 h-5" strokeWidth={2.2} />
            </div>
            <div>
              <h2
                id="pii-vault-modal-title"
                className="text-base sm:text-lg font-black text-slate-900 tracking-tight"
              >
                Bóveda de Privacidad PII
              </h2>
              <p className="text-xs font-semibold text-slate-500">
                Ley N° 29733 · Protección de Datos Personales
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal de Bóveda PII"
            className="min-h-[48px] min-w-[48px] h-12 w-12 rounded-2xl bg-slate-100 text-slate-500 hover:text-slate-800 hover:bg-slate-200 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={2.2} />
          </button>
        </div>

        {/* Estado actual de protección */}
        <div className="rounded-2xl bg-amber-50 border border-amber-200/80 p-3.5 space-y-2 text-xs text-amber-900">
          <div className="flex items-center gap-2 font-black text-amber-950">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>Radio Difuminado de 50 metros Activo</span>
          </div>
          <p className="leading-relaxed text-amber-800">
            Por mandato legal, las alertas SOS ocultan la dirección exacta del paciente o adulto
            mayor para evitar vulneraciones de seguridad. Solo personal acreditado puede ver los datos.
          </p>
        </div>

        {/* Contenido dinámico: Desbloqueado vs Formulario */}
        {unlockedData && auditRecord ? (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4 space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                <span>Desbloqueo Acreditado por Brigadista</span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  Dirección Exacta Desbloqueada:
                </div>
                <div className="text-sm font-black text-slate-900 p-2.5 rounded-xl bg-white border border-emerald-300 shadow-sm">
                  {unlockedData.exact_address}
                </div>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  Contacto Directo:
                </div>
                <div className="text-sm font-black text-slate-900 flex items-center justify-between p-2.5 rounded-xl bg-white border border-emerald-300 shadow-sm">
                  <span>{unlockedData.contact_phone}</span>
                  <a
                    href={`tel:${unlockedData.contact_phone}`}
                    className="min-h-[48px] px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white font-black text-xs inline-flex items-center gap-1.5 hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>Llamar</span>
                  </a>
                </div>
              </div>
            </div>

            {/* Ficha inmutable de Auditoría Legal */}
            <div className="rounded-2xl bg-slate-900 text-white p-4 space-y-2.5 text-xs font-mono shadow-inner">
              <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                <span className="flex items-center gap-1.5 font-sans font-black text-emerald-400 text-xs">
                  <FileCheck2 className="w-4 h-4" />
                  Registro de Auditoría Forense
                </span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full border border-slate-700 font-bold">
                  {auditRecord.compliance_legal}
                </span>
              </div>

              <div className="space-y-1 text-[11px] text-slate-300">
                <p>
                  <span className="text-slate-400 font-semibold">Audit ID:</span> {auditRecord.id}
                </p>
                <p>
                  <span className="text-slate-400 font-semibold">Timestamp:</span> {auditRecord.timestamp}
                </p>
                <p>
                  <span className="text-slate-400 font-semibold">Brigadista:</span> {auditRecord.requester_name}
                </p>
                <p>
                  <span className="text-slate-400 font-semibold">Justificación:</span>{' '}
                  <span className="text-white italic">"{auditRecord.access_reason}"</span>
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] h-12 w-full rounded-2xl bg-slate-900 text-white font-black text-sm hover:bg-black transition-colors"
            >
              Listo · Entendido
            </button>
          </div>
        ) : (
          <form onSubmit={handleUnlock} className="space-y-4">
            {/* Si es vecino ordinario, mostrar aviso y botón para simular brigadista */}
            {activeRole === 'VECINO' ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 space-y-3 text-xs text-red-900">
                <div className="flex items-center gap-2 font-black text-red-950 text-sm">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                  <span>Tu rol actual es VECINO (Acceso Restringido)</span>
                </div>
                <p className="text-red-800 leading-relaxed">
                  Los vecinos ordinarios no pueden desbloquear direcciones exactas para proteger la
                  privacidad familiar. Para la simulación de la hackathon, puedes conmutar a rol
                  Brigadista Certificado con PIN 1234.
                </p>

                <button
                  type="button"
                  onClick={handleSwitchToBrigadista}
                  className="min-h-[48px] h-12 w-full rounded-2xl bg-amber-600 text-white font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors shadow-sm"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>Conmutar a Brigadista Certificado (PIN: 1234)</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span>Rol Acreditado:</span>
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-black">
                    Brigadista Certificado
                  </span>
                </div>

                {/* Input PIN */}
                <div className="space-y-1.5">
                  <label htmlFor="brigadista-pin-input" className="text-xs font-black text-slate-800">
                    PIN de Brigadista / Credencial:
                  </label>
                  <input
                    id="brigadista-pin-input"
                    type="password"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="Ej. 1234"
                    className="min-h-[48px] h-12 w-full px-3.5 rounded-2xl border border-slate-300 text-base font-black tracking-widest text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setPin('1234')}
                      className="min-h-[48px] h-12 px-3 text-[11px] font-bold text-amber-700 hover:underline inline-flex items-center"
                    >
                      Poner PIN Demo (1234)
                    </button>
                  </div>
                </div>

                {/* Input Justificación Operativa */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="brigadista-justification-input"
                      className="text-xs font-black text-slate-800"
                    >
                      Justificación de Rescate (Mín. 10 caracteres):
                    </label>
                    <span
                      className={`text-[10px] font-black ${
                        justification.trim().length >= 10 ? 'text-emerald-600' : 'text-slate-400'
                      }`}
                    >
                      {justification.trim().length}/10
                    </span>
                  </div>
                  <textarea
                    id="brigadista-justification-input"
                    rows={3}
                    value={justification}
                    onChange={(e) => setJustification(e.target.value)}
                    placeholder="Describe el motivo operativo de asistencia o rescate..."
                    className="w-full p-3 rounded-2xl border border-slate-300 text-xs text-slate-900 focus:outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-200"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleFillDemoJustification}
                      className="min-h-[48px] h-12 px-3 text-[11px] font-bold text-amber-700 hover:underline inline-flex items-center"
                    >
                      Prellenar motivo de rescate
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Mensaje de Error */}
            {errorMsg && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs font-bold text-red-800 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Botón de Acción */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] h-12 flex-1 rounded-2xl bg-slate-100 text-slate-700 font-bold text-xs hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[48px] h-12 flex-1 rounded-2xl bg-amber-600 text-white font-black text-xs uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-amber-700 transition-colors shadow-sm"
              >
                <Unlock className="w-4 h-4" />
                <span>Desbloquear Bóveda</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default PiiVaultModal;

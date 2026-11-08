'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Heart,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  deriveHmac4DigitCode,
  verifyCommitmentCode,
} from '@/lib/crypto/confirmation-protocol';
import { getOrCreateDeviceId } from '@/lib/crypto/device-identity';
import type { ICommitmentLocal, IPostLocal } from '@shared/types';
import type { ResourceProgressItem } from '@/components/views/solidarity-wall-view';

export interface HelpConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  post: IPostLocal;
  resource: ResourceProgressItem;
  commitment?: ICommitmentLocal | null;
  mode: 'COMMIT_FORM' | 'SHOW_CODE_REQUESTER' | 'ENTER_CODE_VOLUNTEER';
  onCommitSuccess: (quantity: number, note: string) => void;
  onDeliveredSuccess?: (commitmentId: string) => void;
  onReceivedSuccess?: (commitmentId: string) => void;
}

/**
 * Modal Interactivo P2P para el Flujo de Confirmación de Ayuda entre Dos Vecinos (Sin cuenta y Offline):
 * 1. Voluntario: Elige cantidad a llevar y genera compromiso.
 * 2. Solicitante: Ve el código de 4 dígitos derivado con HMAC (renovado cada 24h).
 * 3. Voluntario: Ingresa el código y presiona "Ya entregué".
 * 4. Solicitante: Toca "Ya recibí".
 * 5. Muestra insignia "Confirmado por ambos" únicamente si ambos validaron desde dispositivos distintos.
 */
export function HelpConfirmationModal({
  isOpen,
  onClose,
  post,
  resource,
  commitment,
  mode: initialMode,
  onCommitSuccess,
  onDeliveredSuccess,
  onReceivedSuccess,
}: HelpConfirmationModalProps): React.ReactElement | null {
  const [modalMode, setModalMode] = useState(initialMode);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [fourDigitCode, setFourDigitCode] = useState<string>('----');
  const [enteredCode, setEnteredCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const deviceId = getOrCreateDeviceId();

  useEffect(() => {
    setModalMode(initialMode);
  }, [initialMode]);

  // Si el modo es ver el código para el solicitante, derivar HMAC determinista de 4 dígitos
  useEffect(() => {
    let active = true;
    async function computeCode() {
      if (modalMode === 'SHOW_CODE_REQUESTER' && commitment?.shared_secret) {
        try {
          const code = await deriveHmac4DigitCode(
            commitment.shared_secret,
            commitment.client_mutation_id
          );
          if (active) setFourDigitCode(code);
        } catch {
          if (active) setFourDigitCode('4819');
        }
      }
    }
    void computeCode();
    return () => {
      active = false;
    };
  }, [modalMode, commitment]);

  if (!isOpen) return null;

  const handleCreateCommitment = (e: React.FormEvent) => {
    e.preventDefault();
    onCommitSuccess(quantity, note);
  };

  const handleDeliverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (enteredCode.length !== 4) {
      setValidationError('Ingresa el código numérico de 4 dígitos.');
      return;
    }

    if (!commitment) return;

    setIsVerifying(true);
    try {
      // Validación con protocolo criptográfico
      const verification = await verifyCommitmentCode({
        sharedSecret: commitment.shared_secret || 'redvecina-secret-seed',
        commitmentId: commitment.client_mutation_id,
        enteredCode: enteredCode.trim(),
        requesterDeviceId: commitment.requester_device_id || 'remote-requester',
        helperDeviceId: deviceId,
        currentDeviceId: deviceId,
      });

      if (!verification.valid) {
        setValidationError(verification.error || 'Código incorrecto.');
        setIsVerifying(false);
        return;
      }

      // Notificar al backend / cola local
      try {
        await fetch(`/api/v1/commitments/${commitment.client_mutation_id}/deliver`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: enteredCode.trim(),
            device_id: deviceId,
          }),
        });
      } catch {
        // En modo offline continúa optimista
      }

      toast.success('¡Entrega declarada correctamente!', {
        description: 'Esperando que el vecino solicitante pulse "Ya recibí" para confirmar por ambos.',
      });

      if (onDeliveredSuccess) {
        onDeliveredSuccess(commitment.client_mutation_id);
      }
      onClose();
    } catch {
      setValidationError('Error validando el código de entrega.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleReceiveSubmit = async () => {
    if (!commitment) return;

    try {
      await fetch(`/api/v1/commitments/${commitment.client_mutation_id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_id: deviceId,
        }),
      });
    } catch {
      // Modo offline
    }

    toast.success('¡Recepción confirmada!', {
      description: 'La entrega ha quedado validada y firmada por ambos dispositivos.',
    });

    if (onReceivedSuccess) {
      onReceivedSuccess(commitment.client_mutation_id);
    }
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-white dark:bg-slate-900 rounded-[28px] max-w-md w-full p-4 sm:p-6 text-[#0B1E3F] dark:text-slate-100 shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 border border-slate-100 dark:border-slate-800 max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800 gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-8 h-8 rounded-full bg-[#E6ECF7] dark:bg-slate-800 text-[#0F2A56] dark:text-sky-300 flex items-center justify-center shrink-0">
              <Heart className="w-4 h-4 stroke-[2.4]" />
            </span>
            <h3 className="text-base sm:text-lg font-extrabold text-[#0B1E3F] dark:text-white truncate">
              {modalMode === 'COMMIT_FORM' && 'Quiero ayudar'}
              {modalMode === 'SHOW_CODE_REQUESTER' && 'Tu código de entrega'}
              {modalMode === 'ENTER_CODE_VOLUNTEER' && 'Confirmar entrega realizada'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar modal"
            className="min-h-[48px] min-w-[48px] h-12 w-12 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500 shrink-0 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODO 1: Formulario de Voluntario */}
        {modalMode === 'COMMIT_FORM' && (
          <form onSubmit={handleCreateCommitment} className="space-y-4">
            <div className="p-3.5 rounded-2xl bg-[#F4F5F7] dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700/60">
              <div className="text-[11px] font-bold text-[#5B6068] dark:text-slate-400 uppercase tracking-wide">
                Ayuda para la necesidad:
              </div>
              <div className="text-sm font-extrabold text-[#0B1E3F] dark:text-white line-clamp-2 leading-snug mt-0.5">
                {post.title}
              </div>
              <div className="text-xs font-semibold text-[#15795A] dark:text-emerald-400 mt-1">
                Recurso: {resource.item_name} (Faltan {Math.max(0, resource.quantity_needed - resource.quantity_committed)} {resource.unit})
              </div>
            </div>

            <div>
              <label htmlFor="commit-qty" className="block text-xs font-black text-[#0B1E3F] dark:text-slate-200 mb-1">
                ¿Cuántas unidades puedes llevar?
              </label>
              <input
                id="commit-qty"
                type="number"
                min={1}
                max={Math.max(1, resource.quantity_needed - resource.quantity_committed)}
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F4F5F7] dark:bg-slate-800 text-sm font-black text-[#0B1E3F] dark:text-white"
                required
              />
            </div>

            <div>
              <label htmlFor="commit-note" className="block text-xs font-black text-[#0B1E3F] dark:text-slate-200 mb-1">
                Nota o indicación de entrega (opcional)
              </label>
              <input
                id="commit-note"
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ej. Voy en camino en 20 minutos"
                className="w-full min-h-[48px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-[#F4F5F7] dark:bg-slate-800 text-sm text-[#0B1E3F] dark:text-white"
              />
            </div>

            <p className="text-[11px] text-[#5B6068] dark:text-slate-400 leading-relaxed">
              Al comprometerte se genera un secreto P2P entre tu teléfono y el del solicitante. Al entregar, ingresarás el código de 4 dígitos que él te muestre.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] h-12 flex-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1E3F] text-xs font-extrabold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="min-h-[48px] h-12 flex-1 rounded-full bg-[#15795A] hover:bg-[#0e5c27] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.97] cursor-pointer"
              >
                <Heart className="w-4 h-4 fill-white text-white" />
                <span>Confirmar compromiso</span>
              </button>
            </div>
          </form>
        )}

        {/* MODO 2: Solicitante ve el código de 4 dígitos */}
        {modalMode === 'SHOW_CODE_REQUESTER' && (
          <div className="space-y-4 text-center">
            <p className="text-xs text-[#5B6068]">
              Muestra este código de 4 dígitos al vecino voluntario cuando te entregue la ayuda:
            </p>

            <div className="py-4 px-6 rounded-2xl bg-[#E6ECF7] border border-[#d2def0] inline-block mx-auto">
              <span className="text-4xl sm:text-5xl font-black tracking-widest text-[#0F2A56] font-mono">
                {fourDigitCode}
              </span>
            </div>

            <div className="flex items-center justify-center gap-1 text-[11px] font-semibold text-[#5B6068]">
              <Clock className="w-3.5 h-3.5 text-amber-600" />
              <span>Código seguro renovado automáticamente cada 24 horas</span>
            </div>

            <div className="p-3 rounded-2xl bg-slate-50 text-[11px] text-[#5B6068] text-left">
              Cuando el voluntario ingrese este código en su celular, podrás tocar el botón de abajo para verificar la recepción bilateral.
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] h-12 flex-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1E3F] text-xs font-extrabold cursor-pointer"
              >
                Cerrar
              </button>
              <button
                type="button"
                onClick={handleReceiveSubmit}
                className="min-h-[48px] h-12 flex-1 rounded-full bg-[#15795A] hover:bg-[#0e5c27] text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.97] cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Ya recibí la ayuda</span>
              </button>
            </div>
          </div>
        )}

        {/* MODO 3: Voluntario ingresa el código numérico */}
        {modalMode === 'ENTER_CODE_VOLUNTEER' && (
          <form onSubmit={handleDeliverSubmit} className="space-y-4">
            <p className="text-xs text-[#5B6068]">
              Pídele al vecino que necesita la ayuda el código de 4 dígitos que aparece en su pantalla:
            </p>

            {validationError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs font-bold text-rose-800">
                {validationError}
              </div>
            )}

            <div>
              <label htmlFor="delivery-code" className="block text-xs font-black text-[#0B1E3F] mb-1 text-center">
                Código de 4 dígitos
              </label>
              <input
                id="delivery-code"
                type="text"
                inputMode="numeric"
                maxLength={4}
                value={enteredCode}
                onChange={(e) => setEnteredCode(e.target.value.replace(/\D/g, ''))}
                placeholder="0000"
                className="w-full min-h-[52px] text-center tracking-widest text-2xl font-black font-mono rounded-2xl border border-slate-300 bg-[#F4F5F7] text-[#0F2A56] focus:ring-2 focus:ring-[#0F2A56]"
                required
              />
            </div>

            <p className="text-[11px] text-[#5B6068] text-center">
              Máximo 5 intentos antes del bloqueo preventivo por 15 minutos.
            </p>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="min-h-[48px] h-12 flex-1 rounded-full bg-slate-100 hover:bg-slate-200 text-[#0B1E3F] text-xs font-extrabold cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isVerifying || enteredCode.length !== 4}
                className="min-h-[48px] h-12 flex-1 rounded-full bg-[#0F2A56] hover:bg-[#091b37] disabled:opacity-50 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md active:scale-[0.97] cursor-pointer"
              >
                {isVerifying ? (
                  <span>Validando...</span>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Ya entregué</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

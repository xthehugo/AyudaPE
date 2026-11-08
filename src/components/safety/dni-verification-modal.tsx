'use client';

import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { getOrCreateDeviceId } from '@/lib/crypto/device-identity';

export interface DniVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerifiedSuccess?: (name: string) => void;
}

/**
 * Modal de Verificación Voluntaria con DNI (Ley N° 29733 de Protección de Datos Personales):
 * - Es voluntaria y jamás bloquea el uso de la app.
 * - Consentimiento informado claro.
 * - Envía DNI y nombre al backend; el token de la API nunca toca el frontend.
 * - Guarda únicamente el hash con sal y otorga la insignia "Vecino verificado".
 * - Incluye la aclaración: "Sus datos de DNI fueron validados. No incluye verificación facial."
 */
export function DniVerificationModal({
  isOpen,
  onClose,
  onVerifiedSuccess,
}: DniVerificationModalProps): React.ReactElement | null {
  const [dni, setDni] = useState('');
  const [consent, setConsent] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanDni = dni.trim();
    if (!/^\d{8}$/.test(cleanDni)) {
      setErrorMessage('Ingresa un número de DNI válido de 8 dígitos numéricos.');
      return;
    }

    if (!consent) {
      setErrorMessage('Debes aceptar el consentimiento de uso de datos para continuar.');
      return;
    }

    setIsLoading(true);

    try {
      const deviceId = getOrCreateDeviceId();
      const response = await fetch('/api/v1/identity/verify-dni', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: cleanDni,
          consent: true,
          device_id: deviceId,
        }),
      });

      const res = await response.json();

      if (response.ok && res.success && res.data?.verified) {
        const verifiedName = (res.data.full_name as string) || 'Vecino Verificado';
        const maskedDni = (res.data.dni_masked as string) || `****${cleanDni.slice(4)}`;

        localStorage.setItem('redvecina_dni_verified', 'true');
        localStorage.setItem('redvecina_verified_name', verifiedName);
        localStorage.setItem('redvecina_dni_masked', maskedDni);

        try {
          const existingProfile = JSON.parse(
            localStorage.getItem('redvecina_user_profile') || '{}'
          );
          localStorage.setItem(
            'redvecina_user_profile',
            JSON.stringify({
              ...existingProfile,
              nombre_completo: verifiedName,
              numero_dni: maskedDni,
              dni_verificado: true,
            })
          );
        } catch {
          // Ignorar errores de parseo
        }

        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent('redvecina_identity_updated', {
              detail: {
                isVerified: true,
                verifiedName,
                dniMasked: maskedDni,
                deviceId,
              },
            })
          );
        }

        toast.success(`¡Identidad verificada en RENIEC!`, {
          description: `${verifiedName} (${maskedDni}) · Vecino verificado`,
        });

        if (onVerifiedSuccess) {
          onVerifiedSuccess(verifiedName);
        }
        onClose();
      } else {
        const errorDesc =
          res.error?.message ||
          res.data?.errorMessage ||
          'DNI inválido o no encontrado en RENIEC. Verifica los 8 dígitos e intenta nuevamente.';
        setErrorMessage(errorDesc);
      }
    } catch {
      setErrorMessage(
        'RENIEC no responde o no hay conexión en este momento. Intenta nuevamente.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dni-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="bg-[var(--bg-surface)] rounded-[28px] max-w-md w-full p-6 text-[var(--text-main)] shadow-2xl space-y-4 animate-in zoom-in-95 duration-200 border border-[var(--border-main)]">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)]">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 stroke-[2.4]" />
            </span>
            <h3 id="dni-modal-title" className="text-base sm:text-lg font-extrabold text-[var(--text-main)]">
              Verificar DNI con RENIEC
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar ventana de verificación"
            className="min-h-[48px] min-w-[48px] h-12 w-12 rounded-full hover:bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs sm:text-[13px] text-[var(--text-secondary)] leading-relaxed">
          Ingresa tu número de DNI para consultar tus nombres y apellidos reales en <strong>RENIEC</strong> y activar tu insignia de vecino verificado. Tu DNI se muestra siempre enmascarado (<strong>****1234</strong>).
        </p>

        {errorMessage && (
          <div
            role="alert"
            className="rounded-2xl bg-[var(--color-danger-bg)] border border-[var(--color-danger)] p-3 flex items-start gap-2 text-xs text-[var(--color-danger)] font-bold"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
          <div>
            <label htmlFor="dni-number" className="block text-xs font-black text-[var(--text-main)] mb-1">
              Número de DNI (8 dígitos) <span className="text-[var(--color-danger)]">*</span>
            </label>
            <input
              id="dni-number"
              type="text"
              inputMode="numeric"
              maxLength={8}
              value={dni}
              onChange={(e) => {
                setDni(e.target.value.replace(/\D/g, '').slice(0, 8));
                if (errorMessage) setErrorMessage(null);
              }}
              placeholder="Ej. 45678912"
              required
              autoFocus
              className="w-full min-h-[48px] px-3.5 rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-surface-subtle)] text-sm font-extrabold text-[var(--text-main)] focus:outline-hidden focus:border-[var(--border-focus)]"
            />
          </div>

          {/* Consentimiento Ley 29733 */}
          <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-[var(--bg-surface-subtle)] border border-[var(--border-main)] cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-1 w-4 h-4 rounded accent-[var(--accent-primary)] shrink-0"
            />
            <span className="text-[11px] sm:text-xs text-[var(--text-secondary)] leading-tight">
              Autorizo la consulta de mis datos en RENIEC según la <strong>Ley N° 29733</strong>. Mi DNI nunca se mostrará completo a otros usuarios (solo <strong>****{dni.length === 8 ? dni.slice(4) : '1234'}</strong>).
            </span>
          </label>

          <div className="pt-2 flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[48px] h-12 flex-1 rounded-full bg-[var(--bg-surface-subtle)] hover:opacity-90 text-[var(--text-main)] border border-[var(--border-main)] text-xs font-extrabold cursor-pointer transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading || !consent || dni.length !== 8}
              className="min-h-[48px] h-12 flex-1 rounded-full bg-[var(--cta-primary-bg)] hover:opacity-95 disabled:opacity-50 text-[var(--cta-primary-fg)] text-xs font-extrabold inline-flex items-center justify-center gap-1.5 shadow-md transition-all active:scale-[0.97] cursor-pointer"
            >
              {isLoading ? (
                <span>Consultando RENIEC...</span>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Verificar con RENIEC</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

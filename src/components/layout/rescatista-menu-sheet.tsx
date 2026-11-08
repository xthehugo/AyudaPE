'use client';

import React, { useEffect, useState } from 'react';
import {
  Check,
  ChevronRight,
  FileCheck2,
  Fingerprint,
  HelpCircle,
  IdCard,
  KeyRound,
  Lock,
  Moon,
  Phone,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Sun,
  Type,
  User,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { useOperationalMode } from '@/context/mode-context';
import { useNetworkSync } from '@/hooks/use-network-sync';
import type { ILocalPiiAuditRecord } from '@/lib/safety/pii-vault';
import { DniVerificationModal } from '@/components/safety/dni-verification-modal';
import { getOrCreateDeviceId } from '@/lib/crypto/device-identity';

export interface RescatistaMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTutorial: () => void;
}

export function RescatistaMenuSheet({
  isOpen,
  onClose,
  onOpenTutorial,
}: RescatistaMenuSheetProps): React.ReactElement | null {
  const {
    mode,
    toggleMode,
    fontScale,
    toggleFontScale,
    activeRole,
    setActiveRole,
    isDarkMode,
    toggleDarkMode,
  } = useOperationalMode();

  const { isOnline, triggerSync } = useNetworkSync(1);

  const [deviceId, setDeviceId] = useState<string>('disp-local');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpStep, setOtpStep] = useState<'PHONE' | 'CODE'>('PHONE');
  const [celularInput, setCelularInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isSendingOtp, setIsSendingOtp] = useState(false);

  const [isPhoneVerified, setIsPhoneVerified] = useState<boolean>(false);
  const [verifiedPhone, setVerifiedPhone] = useState<string>('');

  // Código de Brigadista de Zona y Modo Demo
  const [brigadistaCodeInput, setBrigadistaCodeInput] = useState<string>('');
  const [isVerifyingCode, setIsVerifyingCode] = useState<boolean>(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [showCodeInput, setShowCodeInput] = useState<boolean>(false);
  const [demoRolesAvailable, setDemoRolesAvailable] = useState<boolean>(false);

  const [showAuditRegistry, setShowAuditRegistry] = useState(false);
  const [showDniModal, setShowDniModal] = useState(false);
  const [isDniVerified, setIsDniVerified] = useState<boolean>(false);
  const [verifiedName, setVerifiedName] = useState<string>('');
  const [dniMasked, setDniMasked] = useState<string>('');

  const syncProfileFromStorage = () => {
    if (typeof window === 'undefined') return;
    const id = getOrCreateDeviceId();
    setDeviceId(id);

    const dniVer = localStorage.getItem('redvecina_dni_verified') === 'true';
    const vName = localStorage.getItem('redvecina_verified_name') ?? '';
    const vMasked = localStorage.getItem('redvecina_dni_masked') ?? '****1234';
    setIsDniVerified(dniVer);
    setVerifiedName(vName);
    setDniMasked(vMasked);

    const phoneVer = localStorage.getItem('redvecina_phone_verified') === 'true';
    const vPhone = localStorage.getItem('redvecina_phone') ?? '';
    setIsPhoneVerified(phoneVer);
    setVerifiedPhone(vPhone);
    if (vPhone && !celularInput) {
      setCelularInput(vPhone);
    }
  };

  useEffect(() => {
    syncProfileFromStorage();
    const handleIdentityChange = () => syncProfileFromStorage();

    // Consultar si DEMO_ROLES está habilitado en el entorno
    void fetch('/api/v1/brigadista/code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DEMO_STATUS' }),
    })
      .then((r) => r.json())
      .then((j) => {
        if (j?.data?.demo_roles_enabled) {
          setDemoRolesAvailable(true);
        }
      })
      .catch(() => {});

    if (typeof window !== 'undefined') {
      window.addEventListener('redvecina_identity_updated', handleIdentityChange);
      window.addEventListener('redvecina_profile_updated', handleIdentityChange);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('redvecina_identity_updated', handleIdentityChange);
        window.removeEventListener('redvecina_profile_updated', handleIdentityChange);
      }
    };
  }, [isOpen]);

  const handleVerifyBrigadistaCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    const code = brigadistaCodeInput.trim().toUpperCase();
    if (!code && !demoRolesAvailable) {
      setCodeError('Ingresa el código proporcionado por tu administrador de zona.');
      return;
    }

    setIsVerifyingCode(true);
    try {
      const res = await fetch('/api/v1/brigadista/code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_CODE',
          code: code || 'DEMO',
          device_id: deviceId,
          sector_id: 'huancayo-el-tambo',
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.verified) {
        setCodeError(json.error?.message || 'Código de brigadista inválido o ya utilizado.');
        return;
      }

      const token = (json.data.brigadista_token as string) || 'BRIG-TOKEN-VERIFIED';
      const phoneToUse = verifiedPhone || '987654321';
      setIsPhoneVerified(true);
      setVerifiedPhone(phoneToUse);
      setActiveRole('BRIGADISTA_CERTIFICADO');
      persistProfileRoleAndPhone('BRIGADISTA_CERTIFICADO', phoneToUse, true, token);
      setShowCodeInput(false);
      setBrigadistaCodeInput('');
      toast.success('¡Rol Brigadista Activado!', {
        description: json.data.message || 'Código de zona verificado en el servidor. Función "Reunir / Junta" habilitada.',
        duration: 5000,
      });
    } catch {
      setCodeError('Error de conexión al validar código con el servidor central.');
    } finally {
      setIsVerifyingCode(false);
    }
  };

  const [auditList] = useState<ILocalPiiAuditRecord[]>([
    {
      id: 'AUDIT-179407-8821',
      timestamp: new Date().toISOString(),
      post_id: 2,
      requester_role: 'BRIGADISTA_CERTIFICADO',
      requester_name: 'Brigadista Pedro Quispe · El Tambo',
      access_reason: 'Rescate de paciente adulto mayor con necesidad de oxígeno medicinal.',
      compliance_legal: 'LEY_29733_ART_17',
    },
  ]);

  if (!isOpen) return null;

  const persistProfileRoleAndPhone = (
    nextRole: 'VECINO' | 'BRIGADISTA_CERTIFICADO',
    phone: string,
    phoneVerified: boolean,
    brigadistaToken?: string
  ) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('redvecina_phone', phone);
    localStorage.setItem('redvecina_phone_verified', phoneVerified ? 'true' : 'false');
    if (brigadistaToken) {
      localStorage.setItem('redvecina_brigadista_token', brigadistaToken);
    }
    try {
      const existing = JSON.parse(localStorage.getItem('redvecina_user_profile') || '{}');
      localStorage.setItem(
        'redvecina_user_profile',
        JSON.stringify({
          ...existing,
          rol: nextRole,
          celular: phone,
          celular_verificado: phoneVerified,
        })
      );
    } catch {
      // Ignorar errores de parseo
    }
    window.dispatchEvent(
      new CustomEvent('redvecina_profile_updated', {
        detail: {
          rol: nextRole,
          celular: phone,
          celular_verificado: phoneVerified,
        },
      })
    );
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    const cleanPhone = celularInput.trim().replace(/\D/g, '');

    if (!/^9\d{8}$/.test(cleanPhone)) {
      setOtpError('Ingresa un número de celular válido de 9 dígitos que empiece con 9.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/v1/brigadista/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SEND_OTP',
          celular: cleanPhone,
          device_id: deviceId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setOtpError(json.error?.message || 'No se pudo enviar el código SMS.');
        return;
      }

      setOtpStep('CODE');
      const code = json.data?.simulated_sms_otp as string | undefined;
      toast.info(`📱 SMS Recibido (${cleanPhone})`, {
        description: code
          ? `Tu código de verificación de Brigadista es: ${code}`
          : 'Ingresa el código de 6 dígitos enviado por SMS.',
        duration: 12000,
      });
    } catch {
      setOtpError('Error de red al enviar el SMS. Intenta nuevamente.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError(null);
    const cleanPhone = celularInput.trim().replace(/\D/g, '');
    const cleanOtp = otpInput.trim().replace(/\D/g, '');

    if (!/^\d{6}$/.test(cleanOtp)) {
      setOtpError('Ingresa el código de verificación de 6 dígitos.');
      return;
    }

    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/v1/brigadista/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'VERIFY_OTP',
          celular: cleanPhone,
          otp_code: cleanOtp,
          device_id: deviceId,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success || !json.data?.verified) {
        setOtpError(
          json.error?.message || 'Código OTP incorrecto o expirado. Intenta nuevamente.'
        );
        return;
      }

      const token = json.data.brigadista_token as string | undefined;
      setIsPhoneVerified(true);
      setVerifiedPhone(cleanPhone);
      setActiveRole('BRIGADISTA_CERTIFICADO');
      persistProfileRoleAndPhone('BRIGADISTA_CERTIFICADO', cleanPhone, true, token);

      setShowOtpModal(false);
      setOtpStep('PHONE');
      setOtpInput('');
      toast.success('¡Celular verificado y rol Brigadista activado!', {
        description: `Número ${cleanPhone} validado por SMS. Opción "Reunir / Junta" habilitada.`,
      });
    } catch {
      setOtpError('No se pudo verificar el código OTP. Intenta nuevamente.');
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleToggleRoleDirectly = () => {
    if (activeRole === 'BRIGADISTA_CERTIFICADO') {
      setActiveRole('VECINO');
      persistProfileRoleAndPhone('VECINO', verifiedPhone, isPhoneVerified);
      toast.info('Rol cambiado a: Vecino');
    } else if (isPhoneVerified && /^9\d{8}$/.test(verifiedPhone)) {
      setActiveRole('BRIGADISTA_CERTIFICADO');
      persistProfileRoleAndPhone('BRIGADISTA_CERTIFICADO', verifiedPhone, true);
      toast.success('Rol Brigadista activado');
    } else {
      setOtpStep('PHONE');
      setOtpError(null);
      setShowOtpModal(true);
    }
  };

  const handleManualSync = async () => {
    toast.promise(triggerSync(), {
      loading: 'Sincronizando outbox con el servidor...',
      success: 'Datos locales y outbox sincronizados exitosamente.',
      error: 'Modo sin red: los cambios permanecen seguros en tu celular.',
    });
  };

  const shortDeviceId = deviceId ? `id-${deviceId.slice(0, 8)}` : 'id-dispositivo';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="rescatista-menu-title"
      className="fixed inset-0 z-50 flex items-start justify-end p-3 sm:p-4 bg-black/70 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-[28px] bg-[var(--bg-surface)] text-[var(--text-main)] shadow-2xl border border-[var(--border-main)] p-5 space-y-4 max-h-[92vh] overflow-y-auto mt-2"
      >
        {/* Cabecera del Menú: Vecinos del barrio */}
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border-main)] pb-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)] text-white font-black text-lg flex items-center justify-center shrink-0 shadow-md overflow-hidden p-1 relative">
              {activeRole === 'BRIGADISTA_CERTIFICADO' ? (
                <ShieldAlert className="w-6 h-6 text-amber-300" />
              ) : (
                <img
                  src="/AyudaPE.svg"
                  alt="AyudaPE"
                  className="w-full h-full object-contain rounded-full"
                />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2
                  id="rescatista-menu-title"
                  className="text-base font-extrabold text-[var(--text-main)] leading-tight"
                >
                  Vecinos del barrio
                </h2>
                {isDniVerified && (
                  <span
                    title="Cuenta verificada con RENIEC"
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] text-[10px] font-extrabold px-2 py-0.5 border border-[var(--color-success)]/30"
                  >
                    <ShieldCheck className="w-3 h-3" />
                    <span>Verificado</span>
                  </span>
                )}
              </div>

              {/* Tarjeta/Entrada de usuario verificado con Nombre e ID debajo */}
              {isDniVerified && verifiedName ? (
                <div className="mt-1.5 rounded-xl bg-[var(--bg-surface-subtle)] border border-[var(--border-main)] px-2.5 py-1.5 space-y-0.5">
                  <p className="text-xs font-black text-[var(--text-main)] truncate">
                    {verifiedName}
                  </p>
                  <p className="text-[11px] font-mono font-bold text-[var(--text-secondary)] flex items-center gap-1.5 flex-wrap">
                    <Fingerprint className="w-3 h-3 text-[var(--color-info)] shrink-0" />
                    <span>ID: {shortDeviceId}</span>
                    <span>· DNI {dniMasked || '****1234'}</span>
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--text-secondary)] font-semibold flex items-center gap-1 mt-0.5">
                  <Fingerprint className="w-3 h-3 text-[var(--color-info)]" />
                  <span className="font-mono text-[11px]">{shortDeviceId}</span>
                  <span>· Sin verificar</span>
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar menú"
            className="min-h-[48px] min-w-[48px] h-12 w-12 rounded-full bg-[var(--bg-surface-subtle)] text-[var(--text-secondary)] hover:opacity-80 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tarjeta de Solicitud / Estado del Rol de Brigadista */}
        {activeRole !== 'BRIGADISTA_CERTIFICADO' || (typeof window !== 'undefined' && !isPhoneVerified) ? (
          <div className="rounded-2xl bg-[var(--bg-surface-subtle)] p-3.5 border border-[var(--border-main)] space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[var(--text-main)] flex items-center gap-1.5">
                <Shield className="w-4 h-4 text-[var(--color-success)]" />
                Rol actual: Vecino
              </span>
              {isPhoneVerified && (
                <span className="rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] text-[10px] font-black px-2 py-0.5">
                  Celular verificado
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-[var(--text-secondary)]">
              Para activar el rol de Brigadista, valida tu número de celular peruano (9 dígitos) mediante un código SMS (OTP).
            </p>
            <button
              type="button"
              onClick={() => {
                setOtpStep('PHONE');
                setOtpError(null);
                setShowCodeInput(false);
                setShowOtpModal(true);
              }}
              className="w-full min-h-[48px] h-12 rounded-full bg-[var(--cta-primary-bg)] hover:opacity-95 text-[var(--cta-primary-fg)] font-extrabold text-xs transition-all shadow-xs flex items-center justify-center gap-2 active:scale-95 cursor-pointer"
            >
              <Phone className="w-4 h-4" />
              <span>Solicitar rol de Brigadista (Validar SMS)</span>
            </button>

            <div className="pt-2 border-t border-[var(--border-main)]/60 text-center">
              <button
                type="button"
                onClick={() => {
                  setShowCodeInput((v) => !v);
                  setShowOtpModal(false);
                  setCodeError(null);
                }}
                className="min-h-[48px] text-[11px] font-black text-[var(--color-info)] hover:underline inline-flex items-center gap-1.5 py-1 px-3 rounded-full cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>¿Tienes un Código de Brigadista de Zona?</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl bg-[var(--color-success-bg)] border border-[var(--color-success)]/40 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-black text-[var(--color-success)]">
                <Check className="w-4 h-4" />
                <span>Brigadista Activo · Celular {verifiedPhone}</span>
              </div>
              <span className="rounded-full bg-[var(--color-success)] text-white text-[9px] font-bold px-2 py-0.5">
                SMS Verificado
              </span>
            </div>
            <p className="text-[11px] text-[var(--text-main)] leading-tight">
              Tu número fue validado por SMS. Tienes habilitada la opción <strong>“Reunir / Junta”</strong> en la parte superior de la pantalla principal.
            </p>
            <button
              type="button"
              onClick={() => {
                setActiveRole('VECINO');
                persistProfileRoleAndPhone('VECINO', verifiedPhone, isPhoneVerified);
                toast.info('Regresaste al modo Vecino Habitual');
              }}
              className="w-full min-h-[48px] h-12 rounded-full bg-[var(--bg-surface)] text-[var(--color-success)] border border-[var(--color-success)]/40 font-bold text-xs hover:opacity-90 transition-colors flex items-center justify-center cursor-pointer"
            >
              Volver a modo Vecino
            </button>
          </div>
        )}

        {/* Formulario de Código de Brigadista emitido por Administrador de Zona (MOD-Roles) */}
        {showCodeInput && (
          <form
            onSubmit={handleVerifyBrigadistaCode}
            className="rounded-2xl bg-[var(--bg-surface-subtle)] border-2 border-[var(--color-info)]/60 p-3.5 space-y-3 animate-in zoom-in-95"
            noValidate
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[var(--color-info)] flex items-center gap-1.5">
                <KeyRound className="w-4 h-4" />
                Canjear Código de Brigadista
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowCodeInput(false);
                  setCodeError(null);
                }}
                className="min-h-[48px] text-[11px] text-[var(--text-secondary)] hover:underline font-bold inline-flex items-center cursor-pointer p-2"
              >
                Cerrar
              </button>
            </div>

            <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">
              Ingresa el código único emitido por el Administrador de Zona (ej. <code>BRIGADA-2026</code>). Vence a los 7 días y solo se almacena su hash SHA-256.
            </p>

            <div className="space-y-1.5">
              <label
                htmlFor="brigadista-code-input"
                className="block text-xs font-extrabold text-[var(--text-main)]"
              >
                Código de Brigadista *
              </label>
              <input
                id="brigadista-code-input"
                type="text"
                maxLength={24}
                value={brigadistaCodeInput}
                onChange={(e) => {
                  setBrigadistaCodeInput(e.target.value.toUpperCase());
                  if (codeError) setCodeError(null);
                }}
                placeholder="Ej. BRIGADA-2026"
                autoFocus
                className="min-h-[48px] h-12 w-full px-3.5 rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] text-sm font-black tracking-widest text-[var(--text-main)] uppercase focus:outline-none focus:border-[var(--border-focus)]"
              />
              {codeError && (
                <p role="alert" className="text-xs font-bold text-[var(--color-danger)]">
                  {codeError}
                </p>
              )}
              {demoRolesAvailable && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold">
                  ⚡ DEMO_ROLES activo: puedes dejarlo vacío o escribir DEMO para canjear sin código.
                </p>
              )}
              <button
                type="submit"
                disabled={isVerifyingCode}
                className="min-h-[48px] h-12 w-full rounded-xl bg-[var(--cta-primary-bg)] hover:opacity-95 text-[var(--cta-primary-fg)] font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                {isVerifyingCode ? 'Validando con Servidor...' : 'Verificar y Activar Brigadista'}
              </button>
            </div>
          </form>
        )}

        {/* Formulario de Validación de Celular + OTP por SMS para Brigadista */}
        {showOtpModal && (
          <form
            onSubmit={otpStep === 'PHONE' ? handleSendOtp : handleVerifyOtp}
            className="rounded-2xl bg-[var(--color-warning-bg)] border-2 border-[var(--color-warning)]/50 p-3.5 space-y-3 animate-in zoom-in-95"
            noValidate
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-[var(--color-warning)] flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                Validación SMS para Brigadista
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowOtpModal(false);
                  setOtpError(null);
                }}
                className="min-h-[48px] px-2 text-[11px] text-[var(--color-warning)] hover:underline font-bold inline-flex items-center cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            {otpStep === 'PHONE' ? (
              <div className="space-y-1.5">
                <label
                  htmlFor="brigadista-phone-input"
                  className="block text-xs font-extrabold text-[var(--text-main)]"
                >
                  Número de celular (9 dígitos, empieza con 9) *
                </label>
                <input
                  id="brigadista-phone-input"
                  type="tel"
                  inputMode="numeric"
                  maxLength={9}
                  value={celularInput}
                  onChange={(e) => {
                    setCelularInput(e.target.value.replace(/\D/g, '').slice(0, 9));
                    if (otpError) setOtpError(null);
                  }}
                  placeholder="Ej. 987654321"
                  autoFocus
                  className="min-h-[48px] h-12 w-full px-3.5 rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] text-sm font-black tracking-wide text-[var(--text-main)] focus:outline-none focus:border-[var(--border-focus)]"
                />
                {otpError && (
                  <p role="alert" className="text-xs font-bold text-[var(--color-danger)]">
                    {otpError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={isSendingOtp}
                  className="min-h-[48px] h-12 w-full rounded-xl bg-[var(--cta-primary-bg)] hover:opacity-95 text-[var(--cta-primary-fg)] font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSendingOtp ? 'Enviando SMS...' : 'Enviar código de verificación (SMS)'}
                </button>
              </div>
            ) : (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-[var(--text-main)]">
                  Código enviado por SMS al celular <strong>{celularInput}</strong>.
                </p>
                <label
                  htmlFor="brigadista-otp-input"
                  className="block text-xs font-extrabold text-[var(--text-main)]"
                >
                  Código OTP (6 dígitos) *
                </label>
                <input
                  id="brigadista-otp-input"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => {
                    setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                    if (otpError) setOtpError(null);
                  }}
                  placeholder="Ej. 123456"
                  autoFocus
                  className="min-h-[48px] h-12 w-full px-3.5 rounded-xl border-2 border-[var(--border-main)] bg-[var(--bg-surface)] text-sm font-black tracking-widest text-[var(--text-main)] focus:outline-none focus:border-[var(--border-focus)]"
                />
                {otpError && (
                  <p role="alert" className="text-xs font-bold text-[var(--color-danger)]">
                    {otpError}
                  </p>
                )}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setOtpStep('PHONE');
                      setOtpError(null);
                    }}
                    className="min-h-[48px] h-12 px-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-main)] text-[var(--text-main)] font-bold text-xs cursor-pointer"
                  >
                    Cambiar número
                  </button>
                  <button
                    type="submit"
                    disabled={isSendingOtp}
                    className="min-h-[48px] h-12 flex-1 rounded-xl bg-[var(--cta-primary-bg)] hover:opacity-95 text-[var(--cta-primary-fg)] font-extrabold text-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isSendingOtp ? 'Validando...' : 'Validar y Activar Brigadista'}
                  </button>
                </div>
              </div>
            )}
          </form>
        )}

        {/* SECCIÓN 1: TU BARRIO */}
        <div className="space-y-1 pt-1">
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)] px-1">
            Tu Barrio & Confianza
          </p>

          {/* Verificar mi identidad con DNI (RENIEC) */}
          <button
            type="button"
            onClick={() => setShowDniModal(true)}
            className="w-full min-h-[48px] p-3 rounded-2xl bg-[var(--bg-surface-subtle)] hover:opacity-90 border border-[var(--border-main)] flex items-center justify-between text-left transition-all active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[var(--color-info-bg)] text-[var(--color-info)] flex items-center justify-center font-bold text-xs shrink-0">
                <IdCard className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-extrabold text-xs text-[var(--text-main)]">
                    Verificar mi identidad (DNI)
                  </p>
                  {isDniVerified && (
                    <span className="rounded-full bg-[var(--color-success-bg)] text-[var(--color-success)] text-[10px] font-black px-2 py-0.5">
                      ✓ Verificado
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-[var(--text-secondary)] font-medium truncate">
                  {isDniVerified && verifiedName
                    ? `${verifiedName} (${dniMasked || '****1234'})`
                    : 'Consulta RENIEC · Otorga insignia de vecino verificado'}
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)] shrink-0" />
          </button>

          {/* Fila Mi Rol */}
          <button
            type="button"
            onClick={handleToggleRoleDirectly}
            className="min-h-[48px] h-12 w-full rounded-2xl hover:bg-[var(--bg-surface-subtle)] px-3 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs font-extrabold text-[var(--text-main)]">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                <User className="w-4 h-4" />
              </div>
              <span>Mi rol</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)]">
              <span>
                {activeRole === 'BRIGADISTA_CERTIFICADO' && isPhoneVerified
                  ? 'Brigadista (SMS ✓)'
                  : 'Vecino'}
              </span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
          </button>

          {/* Fila Modo Barrio / Día */}
          <button
            type="button"
            onClick={toggleMode}
            className="min-h-[48px] h-12 w-full rounded-2xl hover:bg-[var(--bg-surface-subtle)] px-3 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs font-extrabold text-[var(--text-main)]">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                <Shield className="w-4 h-4" />
              </div>
              <span>Modo barrio</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)]">
              <span>{mode === 'EMERGENCIA' ? 'Emergencia' : 'Día'}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
          </button>

          {/* Fila Sincronizar Ahora */}
          <button
            type="button"
            onClick={handleManualSync}
            className="min-h-[48px] h-12 w-full rounded-2xl hover:bg-[var(--bg-surface-subtle)] px-3 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs font-extrabold text-[var(--text-main)]">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                <RefreshCw className="w-4 h-4" />
              </div>
              <span>Sincronizar ahora</span>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-[var(--color-warning-bg)] text-[var(--color-warning)] text-[10px] font-black">
              Sincronizar
            </span>
          </button>
        </div>

        {/* SECCIÓN 2: CUMPLIMIENTO DE LA LEY N° 29733 */}
        <div className="space-y-1 pt-1 border-t border-[var(--border-main)]">
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)] px-1 pt-2">
            Cumplimiento Ley N° 29733
          </p>

          <button
            type="button"
            onClick={() => setShowAuditRegistry((prev) => !prev)}
            className="min-h-[48px] h-12 w-full rounded-2xl hover:bg-[var(--bg-surface-subtle)] px-3 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs font-extrabold text-[var(--text-main)]">
              <div className="w-7 h-7 rounded-full bg-[var(--color-warning-bg)] flex items-center justify-center text-[var(--color-warning)]">
                <FileCheck2 className="w-4 h-4" />
              </div>
              <span>Bitácora de Auditoría Forense</span>
            </div>
            <span className="text-xs text-[var(--color-warning)] font-bold">
              {showAuditRegistry ? 'Ocultar' : 'Ver log >'}
            </span>
          </button>

          {showAuditRegistry && (
            <div className="rounded-2xl bg-slate-900 text-slate-100 p-3.5 space-y-2 text-xs font-mono shadow-inner border border-slate-700">
              <div className="flex items-center justify-between border-b border-slate-700 pb-1.5">
                <span className="text-emerald-300 font-bold font-sans text-[11px]">
                  Ley N° 29733 Art. 17 · Registro Inmutable
                </span>
                <span className="text-[9px] bg-slate-800 text-slate-200 px-1.5 py-0.5 rounded">
                  PostgreSQL
                </span>
              </div>
              {auditList.map((record) => (
                <div key={record.id} className="space-y-0.5 text-[10px] text-slate-200">
                  <p className="text-amber-300 font-bold">{record.id}</p>
                  <p>{record.timestamp}</p>
                  <p className="text-slate-100">
                    <span className="text-slate-400">Rescatista:</span> {record.requester_name}
                  </p>
                  <p className="italic text-slate-200">"{record.access_reason}"</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* SECCIÓN 3: PREFERENCIAS & ACCESIBILIDAD */}
        <div className="space-y-1 pt-1 border-t border-[var(--border-main)]">
          <p className="text-[11px] font-black uppercase tracking-wider text-[var(--text-secondary)] px-1 pt-2">
            Preferencias
          </p>

          {/* Modo Nocturno */}
          <div className="min-h-[48px] h-12 w-full rounded-2xl hover:bg-[var(--bg-surface-subtle)] px-3 flex items-center justify-between transition-colors">
            <div className="flex items-center gap-2.5 text-xs font-extrabold text-[var(--text-main)]">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                {isDarkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </div>
              <span>Modo nocturno</span>
            </div>
            <button
              type="button"
              onClick={toggleDarkMode}
              role="switch"
              aria-checked={isDarkMode}
              aria-label="Alternar modo nocturno"
              className="min-h-[48px] h-12 flex items-center justify-center p-1 cursor-pointer"
            >
              <div
                className={`w-12 h-7 rounded-full p-1 transition-colors ${
                  isDarkMode ? 'bg-[var(--accent-primary)]' : 'bg-slate-400'
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white transition-transform ${
                    isDarkMode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </div>
            </button>
          </div>

          {/* Tamaño de Texto A+ */}
          <button
            type="button"
            onClick={toggleFontScale}
            className="min-h-[48px] h-12 w-full rounded-2xl hover:bg-[var(--bg-surface-subtle)] px-3 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs font-extrabold text-[var(--text-main)]">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                <Type className="w-4 h-4" />
              </div>
              <span>Tamaño de texto</span>
            </div>
            <div className="flex items-center gap-1 text-xs font-bold text-[var(--text-secondary)]">
              <span>{fontScale === 'LARGE' ? 'Grande (A+)' : 'Normal'}</span>
              <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
            </div>
          </button>

          {/* Guía de Uso */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenTutorial();
            }}
            className="min-h-[48px] h-12 w-full rounded-2xl hover:bg-[var(--bg-surface-subtle)] px-3 flex items-center justify-between transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2.5 text-xs font-extrabold text-[var(--text-main)]">
              <div className="w-7 h-7 rounded-full bg-[var(--bg-surface-subtle)] flex items-center justify-center text-[var(--text-secondary)]">
                <HelpCircle className="w-4 h-4" />
              </div>
              <span>Guía de uso</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--text-secondary)]" />
          </button>
        </div>

        {/* Footer con Dot de Conectividad */}
        <div className="pt-2 border-t border-[var(--border-main)] flex flex-col items-center justify-center gap-1.5 text-xs font-bold text-[var(--text-secondary)]">
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isOnline ? 'bg-[var(--color-success)]' : 'bg-amber-500 animate-pulse'
              }`}
            />
            <span>AyudaPE · {isOnline ? 'Online' : 'Offline'}</span>
          </div>
          <p className="text-[10px] text-[var(--text-secondary)] font-medium">
            Hackathon UTP – El Comercio · Huancayo & Lima
          </p>
        </div>

        <DniVerificationModal
          isOpen={showDniModal}
          onClose={() => setShowDniModal(false)}
          onVerifiedSuccess={(name) => {
            setIsDniVerified(true);
            setVerifiedName(name);
            syncProfileFromStorage();
          }}
        />
      </div>
    </div>
  );
}

export default RescatistaMenuSheet;

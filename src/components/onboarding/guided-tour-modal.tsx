'use client';

import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Compass,
  HeartHandshake,
  Radio,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';

export interface GuidedTourModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface TourStep {
  id: string;
  badge: string;
  tabLabel: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  summary: string;
  highlights: string[];
  previewTitle: string;
  previewDetails: {
    label: string;
    value: string;
  }[];
  accentClasses: {
    badgeBg: string;
    badgeText: string;
    iconBg: string;
    iconText: string;
    cardBorder: string;
    cardBg: string;
  };
}

const TOUR_STEPS: TourStep[] = [
  {
    id: 'bienvenida',
    badge: 'BIENVENIDA · PROPÓSITO Y COMUNIDAD',
    tabLabel: 'Bienvenida',
    icon: HeartHandshake,
    title: '¡Bienvenido a AyudaPe!',
    summary:
      'AyudaPe es una plataforma web y comunitaria creada con el propósito de conectar a los vecinos de tu sector, recuperar la confianza barrial y brindar apoyo mutuo inmediato. Nació para que nadie en tu cuadra esté solo: une a las familias para resolver necesidades del día a día, organizar auxilio solidario sin dinero y coordinar rescate y triaje de emergencia incluso cuando colapsan el internet y las comunicaciones.',
    highlights: [
      'Propósito humano y barrial: Crear una red viva de cuidado colectivo donde el vecino más cercano es tu primer aliado y auxilio.',
      'Solidaridad con cero dinero: Coordinación comunitaria de favores, acompañamiento a adultos mayores y préstamo de insumos médicos sin comisiones ni intermediarios.',
      'Resiliencia absoluta ante emergencias: Funciona con normalidad en línea y al 100% offline mediante malla P2P cuando colapsan la telefonía y las redes.',
      'Economía local de hiperproximidad: Encuentra oficios verificados y talentos de tu propia cuadra a menos de 500 metros.',
    ],
    previewTitle: 'El Corazón de AyudaPe',
    previewDetails: [
      { label: 'Propósito social', value: 'Unir a la comunidad y proteger a los vecinos más vulnerables' },
      { label: 'Resumen cálido', value: 'Hoy por ti, mañana por mí · Cuidado mutuo, confianza y empatía' },
      { label: 'Alcance territorial', value: 'Tu barrio, tu cuadra y tu sector a pasos de distancia' },
    ],
    accentClasses: {
      badgeBg: 'bg-amber-100 dark:bg-amber-950/60',
      badgeText: 'text-amber-900 dark:text-amber-300',
      iconBg: 'bg-amber-600',
      iconText: 'text-white',
      cardBorder: 'border-amber-200 dark:border-amber-900/60',
      cardBg: 'bg-amber-50/50 dark:bg-amber-950/20',
    },
  },
  {
    id: 'oficios',
    badge: 'MODULO 01',
    tabLabel: 'Oficios',
    icon: Wrench,
    title: 'Oficios Locales con Visto Bueno Barrial',
    summary:
      'Encuentra gasfiteros, electricistas, enfermeras, cerrajeros o menús caseros de tus propios vecinos en Huancayo, geolocalizados a pasos de tu ubicación.',
    highlights:
      [
        'Proximidad euclidiana real: Resultados ordenados por distancia exacta en metros (100 m, 250 m, 500 m).',
        'Visto Bueno Barrial: Puntuación ponderada donde el aval de vecinos a menos de 200m tiene mayor peso de confianza.',
        'Trato directo y sin comisión: Comunicación transparente por llamada telefónica o mensajería directa sin intermediarios.',
      ],
    previewTitle: 'Ficha de Oficio Hiperlocal',
    previewDetails: [
      { label: 'Distancia al vecino', value: '180 metros · Jr. Sucre (El Tambo)' },
      { label: 'Confianza comunitaria', value: '4.9 / 5 · 14 vecinos del sector avalan el servicio' },
      { label: 'Disponibilidad de guardia', value: 'Atención 24/7 para emergencias domiciliarias' },
    ],
    accentClasses: {
      badgeBg: 'bg-blue-100 dark:bg-blue-950/60',
      badgeText: 'text-blue-900 dark:text-blue-300',
      iconBg: 'bg-blue-600',
      iconText: 'text-white',
      cardBorder: 'border-blue-200 dark:border-blue-900/60',
      cardBg: 'bg-blue-50/50 dark:bg-blue-950/20',
    },
  },
  {
    id: 'solidario',
    badge: 'MODULO 02',
    tabLabel: 'Solidario',
    icon: HeartHandshake,
    title: 'Muro Solidario · Cooperación con Cero Dinero',
    summary:
      'Intercambio comunitario de favores, préstamos de insumos médicos críticos (muletas, balones de oxígeno) y apoyo mutuo sin transacciones monetarias.',
    highlights:
      [
        'Ciclo anti-fraude de 3 etapas: [En espera de apoyo] → [Vecino comprometido] → [Entregado] → [Recibido].',
        'Confirmación segura de entrega: El solicitante valida la recepción cara a cara mediante código PIN o confirmación en pantalla.',
        'Prioridad de atención: Clasificación inmediata por nivel de urgencia (Baja, Media, Alta o Crítica).',
      ],
    previewTitle: 'Ciclo de Auxilio Solidario',
    previewDetails: [
      { label: 'Estado del apoyo', value: 'Comprometido · 1 vecino va en camino' },
      { label: 'Recurso solidario', value: 'Préstamo de muletas ortopédicas para adulto mayor' },
      { label: 'Validación de entrega', value: 'Cierre de ciclo verificado por el solicitante' },
    ],
    accentClasses: {
      badgeBg: 'bg-emerald-100 dark:bg-emerald-950/60',
      badgeText: 'text-emerald-900 dark:text-emerald-300',
      iconBg: 'bg-emerald-600',
      iconText: 'text-white',
      cardBorder: 'border-emerald-200 dark:border-emerald-900/60',
      cardBg: 'bg-emerald-50/50 dark:bg-emerald-950/20',
    },
  },
  {
    id: 'copiloto',
    badge: 'MODULO 03',
    tabLabel: 'Copiloto & Voz',
    icon: Sparkles,
    title: 'Publicación Rápida por Voz & Copiloto IA',
    summary:
      'Publica cualquier requerimiento o servicio en segundos simplemente hablando al micrófono; la Inteligencia Artificial categoriza y estructura todo.',
    highlights:
      [
        'Dictado en lenguaje natural: Reconocimiento vocal adaptado a expresiones locales del Perú y español andino.',
        'Arquitectura híbrida: Clasificador heurístico local que opera sin internet + procesamiento avanzado en nube.',
        'Autocompletado automático: Extrae automáticamente título, descripción, tipo de módulo, urgencia y coordenadas.',
      ],
    previewTitle: 'Procesamiento Semántico en Tiempo Real',
    previewDetails: [
      { label: 'Entrada de voz', value: '"Se rompió la tubería matriz en Jr. Junín, requerimos llave francesa urgente"' },
      { label: 'Inferencia IA', value: 'Módulo: SOLIDARIO · Categoría: HERRAMIENTAS · Urgencia: ALTA' },
      { label: 'Geolocalización', value: 'Coordenadas del sector asignadas automáticamente' },
    ],
    accentClasses: {
      badgeBg: 'bg-purple-100 dark:bg-purple-950/60',
      badgeText: 'text-purple-900 dark:text-purple-300',
      iconBg: 'bg-purple-600',
      iconText: 'text-white',
      cardBorder: 'border-purple-200 dark:border-purple-900/60',
      cardBg: 'bg-purple-50/50 dark:bg-purple-950/20',
    },
  },
  {
    id: 'rescate',
    badge: 'MODULO 04',
    tabLabel: 'Rescate SOS',
    icon: Radio,
    title: 'Rescate Táctico SOS & Malla P2P Offline',
    summary:
      'Diseñado para situaciones de desastre, terremotos o personas atrapadas bajo escombros (protocolo USAR) donde colapsa la telefonía e internet comercial.',
    highlights:
      [
        'Baliza Acústica Morse (880 Hz): Emite el código internacional SOS (··· ——— ···) con vibración rítmica detectable por geófonos de bomberos.',
        'Malla Vecinal P2P (50 saltos): Transmisión directa de teléfono a teléfono vía WebRTC DataChannel y Bluetooth BLE sin antenas comerciales.',
        'Modo Pantalla Negra (72 Horas): Fondo negro puro (#000000) en pantallas OLED para estirar la batería al máximo con despertar por doble toque.',
      ],
    previewTitle: 'Protocolo USAR (Urban Search and Rescue)',
    previewDetails: [
      { label: 'Baliza física activa', value: 'Tono acústico a 880 Hz + Pulsos de vibración háptica' },
      { label: 'Retransmisión P2P', value: 'Mula de datos vecinal de hasta 50 saltos de alcance' },
      { label: 'Ahorro de energía', value: 'Pantalla OLED 0% brillo con reactivación por doble toque' },
    ],
    accentClasses: {
      badgeBg: 'bg-red-100 dark:bg-red-950/60',
      badgeText: 'text-red-900 dark:text-red-300',
      iconBg: 'bg-red-600',
      iconText: 'text-white',
      cardBorder: 'border-red-200 dark:border-red-900/60',
      cardBg: 'bg-red-50/50 dark:bg-red-950/20',
    },
  },
  {
    id: 'seguridad',
    badge: 'MODULO 05',
    tabLabel: 'Privacidad & Juntas',
    icon: ShieldCheck,
    title: 'Bóveda de Privacidad (Ley N° 29733) & Juntas',
    summary:
      'Protección rigurosa de datos personales sensibles y herramientas operativas para brigadistas acreditados y líderes vecinales.',
    highlights:
      [
        'Cumplimiento Ley N° 29733: Las coordenadas exactas y domicilios nunca se exponen al público; se utiliza un radio difuminado de 50 metros.',
        'Bitácora Forense Art. 17: Registro inmutable que audita a todo brigadista certificado que consulte una ficha médica o teléfono.',
        'Juntas Vecinales en el Mapa: Convocatoria geolocalizada de asambleas de seguridad con notificación automática a los vecinos del sector.',
      ],
    previewTitle: 'Gobernanza y Protección Legal',
    previewDetails: [
      { label: 'Ofuscación PII', value: 'Zona difuminada de seguridad de 50 metros en el mapa' },
      { label: 'Acreditación', value: 'Validación de brigadistas mediante OTP y código oficial' },
      { label: 'Auditoría forense', value: 'Registro de accesos inmutable para inspección del jurado' },
    ],
    accentClasses: {
      badgeBg: 'bg-slate-200 dark:bg-slate-800',
      badgeText: 'text-slate-800 dark:text-slate-200',
      iconBg: 'bg-slate-800 dark:bg-slate-700',
      iconText: 'text-white',
      cardBorder: 'border-slate-300 dark:border-slate-700',
      cardBg: 'bg-slate-100/60 dark:bg-slate-900/40',
    },
  },
];

export function GuidedTourModal({
  isOpen,
  onClose,
}: GuidedTourModalProps): React.ReactElement | null {
  const [mounted, setMounted] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<number>(0);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleClose = (completed = false) => {
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem('ayudape_tour_seen', 'true');
        if (completed) {
          localStorage.setItem('ayudape_tour_completed', 'true');
        }
      } catch {}
    }
    onClose();
  };

  // Atajos de teclado: Escape para salir, flechas para navegar
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose(false);
      } else if (e.key === 'ArrowRight') {
        setCurrentStep((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft') {
        setCurrentStep((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!mounted || !isOpen) {
    return null;
  }

  const active = TOUR_STEPS[currentStep] ?? TOUR_STEPS[0];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === TOUR_STEPS.length - 1;
  const StepIcon = active.icon;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="guided-tour-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => handleClose(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[28px] bg-white dark:bg-[#0F172A] text-[#0B1E3F] dark:text-slate-100 shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh] animate-in zoom-in-95 duration-200"
      >
        {/* Encabezado Superior: Título, Indicador de Paso y Botón Cerrar */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#0F2A56] text-white flex items-center justify-center shrink-0 shadow-xs">
              <Compass className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  Guía Oficial · AyudaPE
                </span>
                <span className="text-[11px] font-black text-slate-400">
                  {currentStep + 1} de {TOUR_STEPS.length}
                </span>
              </div>
              <h2 className="text-sm font-black text-[#0B1E3F] dark:text-white truncate">
                {currentStep === 0 ? 'Bienvenida y Propósito' : 'Arquitectura y Módulos'}
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={() => handleClose(false)}
            aria-label="Cerrar guía de uso"
            className="min-h-[48px] min-w-[48px] w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 flex items-center justify-center cursor-pointer transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selector Horizontal de Módulos (Pestañas tocables) */}
        <div className="px-4 sm:px-5 pt-3 pb-2 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 bg-slate-50/50 dark:bg-slate-900/30">
          {TOUR_STEPS.map((step, idx) => {
            const isSelected = idx === currentStep;
            const TabIcon = step.icon;
            return (
              <button
                key={step.id}
                type="button"
                onClick={() => setCurrentStep(idx)}
                aria-label={`Ver módulo: ${step.tabLabel}`}
                className={`min-h-[48px] px-3 rounded-xl font-black text-xs inline-flex items-center gap-1.5 transition-all shrink-0 cursor-pointer ${
                  isSelected
                    ? 'bg-[#0F2A56] text-white shadow-xs scale-100'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 border border-slate-200 dark:border-slate-700'
                }`}
              >
                <TabIcon className="w-3.5 h-3.5" />
                <span>{step.tabLabel}</span>
              </button>
            );
          })}
        </div>

        {/* Cuerpo Principal del Paso Seleccionado (Scroll vertical suave) */}
        <div className="p-4 sm:p-6 overflow-y-auto no-scrollbar space-y-4 flex-1">
          {/* Fila de Insignia y Título */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full ${active.accentClasses.badgeBg} ${active.accentClasses.badgeText}`}
              >
                {active.badge}
              </span>
            </div>
            <h3
              id="guided-tour-title"
              className="text-lg sm:text-xl font-extrabold text-[#0B1E3F] dark:text-white leading-snug tracking-tight"
            >
              {active.title}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
              {active.summary}
            </p>
          </div>

          {/* Tarjeta de Demostración Visual / Ficha del Módulo */}
          <div
            className={`rounded-2xl p-3.5 sm:p-4 border ${active.accentClasses.cardBorder} ${active.accentClasses.cardBg} space-y-2.5`}
          >
            <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-slate-800 pb-2">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${active.accentClasses.iconBg} ${active.accentClasses.iconText}`}
                >
                  <StepIcon className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-[#0B1E3F] dark:text-white">
                  {active.previewTitle}
                </span>
              </div>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Verificación Activa
              </span>
            </div>

            <div className="space-y-1.5">
              {active.previewDetails.map((item, i) => (
                <div
                  key={i}
                  className="flex items-start justify-between gap-3 text-xs bg-white dark:bg-slate-800/80 p-2.5 rounded-xl border border-slate-200/50 dark:border-slate-700/60"
                >
                  <span className="font-bold text-slate-500 dark:text-slate-400 text-[11px] shrink-0">
                    {item.label}:
                  </span>
                  <span className="font-extrabold text-[#0B1E3F] dark:text-slate-100 text-right leading-tight">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Lista de Puntos Clave del Módulo */}
          <div className="space-y-2 pt-1">
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Puntos Operativos Clave
            </h4>
            <div className="space-y-1.5">
              {active.highlights.map((point, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2.5 text-xs text-slate-700 dark:text-slate-300 font-medium leading-relaxed bg-slate-50 dark:bg-slate-900/40 p-2.5 rounded-xl border border-slate-100 dark:border-slate-800"
                >
                  <span className="font-black text-[#0F2A56] dark:text-sky-400 shrink-0">
                    •
                  </span>
                  <span>{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Barra de Progreso y Pie de Navegación */}
        <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-slate-50/60 dark:bg-slate-900/40">
          {/* Puntos de Paginación */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => {
              const isCurrent = idx === currentStep;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setCurrentStep(idx)}
                  aria-label={`Ir al paso ${idx + 1}`}
                  className="min-h-[48px] min-w-[24px] flex items-center justify-center cursor-pointer"
                >
                  <span
                    className={`block transition-all duration-200 ${
                      isCurrent
                        ? 'w-6 h-2 rounded-full bg-[#0F2A56] dark:bg-sky-400'
                        : 'w-2 h-2 rounded-full bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Botones Anterior y Siguiente / Finalizar */}
          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
                aria-label="Paso anterior"
                className="min-h-[48px] px-3.5 rounded-xl font-bold text-xs bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 text-slate-800 dark:text-slate-200 inline-flex items-center justify-center gap-1.5 active:scale-95 transition-all cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Anterior</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                if (isLastStep) {
                  handleClose(true);
                } else {
                  setCurrentStep((prev) => Math.min(TOUR_STEPS.length - 1, prev + 1));
                }
              }}
              aria-label={isLastStep ? 'Finalizar guía y comenzar' : 'Siguiente paso'}
              className="min-h-[48px] px-4 sm:px-5 rounded-xl font-black text-xs bg-[#0F2A56] hover:bg-[#0B1E3F] text-white inline-flex items-center justify-center gap-2 shadow-xs active:scale-95 transition-all cursor-pointer"
            >
              {isLastStep ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Comenzar a explorar</span>
                </>
              ) : (
                <>
                  <span>Siguiente</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GuidedTourModal;

import React, { useState } from 'react';
import {
  Button,
  Input,
  NumberStepper,
  Select,
  ShineButton,
  Slider,
  Switch,
} from '@ptech/designsystem/inputs';
import { Chip } from '@ptech/designsystem/datadisplay';
import { AnimatedTabs, type TabItem } from '@ptech/designsystem/navigation';
import { Modal, ToolTip } from '@ptech/designsystem/overlays';
import {
  BookmarkPlus,
  Cpu,
  Eraser,
  FileArchive,
  FolderCog,
  Info,
  PenTool,
  RotateCcw,
  Save,
  ShieldCheck,
  Sliders,
  Sparkles,
} from 'lucide-react';
import {
  AI_MODELS,
  AI_MODEL_SELECT_OPTIONS,
  COMPRESSION_OPTIONS,
  COMPRESSION_SELECT_OPTIONS,
  JPG_BG_SELECT_OPTIONS,
  MODE_SELECT_OPTIONS,
  OUTPUT_FORMAT_SELECT_OPTIONS,
  TRACE_CURVE_MODE_OPTIONS,
  TRACE_IGNORE_COLOR_OPTIONS,
  TRACE_PRESETS,
  TRACE_PRESET_SELECT_OPTIONS,
  TRACE_STROKE_COLOR_OPTIONS,
  TRACE_STROKE_STYLE_OPTIONS,
  UPSCALE_FACTOR_OPTIONS,
} from '../constants/processorOptions';
import type {
  BackgroundModelId,
  CompressionModeId,
  OutputFormatId,
  PresetConfig,
  ProcessingModeId,
  ProcessorSettings,
  TraceCurveModeId,
  TracePresetId,
} from '../types/imageProcessor';

const InfoTip: React.FC<{ title: string; description: string }> = ({
  title,
  description,
}) => (
  <ToolTip
    position="right"
    delay={100}
    content={
      <div
        style={{
          whiteSpace: 'normal',
          maxWidth: '250px',
          lineHeight: 1.4,
          display: 'flex',
          flexDirection: 'column',
          gap: '3px',
          padding: '2px 0',
        }}
      >
        <strong
          style={{
            fontSize: '0.76rem',
            color: 'var(--ptech-primary, #818cf8)',
          }}
        >
          {title}
        </strong>
        <span
          style={{
            fontSize: '0.73rem',
            color: 'var(--ptech-text-primary)',
          }}
        >
          {description}
        </span>
      </div>
    }
  >
    <span
      tabIndex={0}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '17px',
        height: '17px',
        borderRadius: '999px',
        color: 'var(--ptech-text-secondary)',
        backgroundColor: 'var(--ptech-surface-elevated)',
        border: '1px solid var(--ptech-border-subtle)',
        cursor: 'help',
        flexShrink: 0,
      }}
    >
      <Info size={11} />
    </span>
  </ToolTip>
);

const ControlHeader: React.FC<{
  label: string;
  info: string;
  valueBadge?: string | number;
}> = ({ label, info, valueBadge }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '6px',
      marginBottom: '-4px',
    }}
  >
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <span
        style={{
          fontSize: '0.77rem',
          fontWeight: 600,
          color: 'var(--ptech-text-primary)',
        }}
      >
        {label}
      </span>
      <InfoTip title={label} description={info} />
    </div>
    {valueBadge !== undefined && (
      <span
        style={{
          fontSize: '0.73rem',
          fontWeight: 700,
          color: 'var(--ptech-primary)',
        }}
      >
        {valueBadge}
      </span>
    )}
  </div>
);

export interface SettingsSidebarProps {
  settings: ProcessorSettings;
  activePreset: PresetConfig | null;
  hasUnsavedChanges: boolean;
  onUpdateSettings: (partial: Partial<ProcessorSettings>) => void;
  onPresetChange: (presetId: TracePresetId) => void;
  onSaveToActivePreset: () => void;
  onRevertToActivePreset: () => void;
  onCreateNewPreset: (
    name: string,
    badge: string,
    description: string,
    makeDefault: boolean
  ) => void;
  onOpenCrudView: () => void;
  isProcessing: boolean;
  totalFiles: number;
  completedCount: number;
  onProcessAll: () => void;
  onDownloadAll: () => void;
}

export const SettingsSidebar: React.FC<SettingsSidebarProps> = ({
  settings,
  activePreset,
  hasUnsavedChanges,
  onUpdateSettings,
  onPresetChange,
  onSaveToActivePreset,
  onRevertToActivePreset,
  onCreateNewPreset,
  onOpenCrudView,
  isProcessing,
  totalFiles,
  completedCount,
  onProcessAll,
  onDownloadAll,
}) => {
  const [isSaveAsModalOpen, setIsSaveAsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newBadge, setNewBadge] = useState('Personalizado');
  const [newDesc, setNewDesc] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);
  const [nameError, setNameError] = useState('');

  const activeModel =
    AI_MODELS.find((m) => m.id === settings.bgModel) || AI_MODELS[0];
  const activeCompression =
    COMPRESSION_OPTIONS.find((c) => c.id === settings.compressionMode) ||
    COMPRESSION_OPTIONS[0];
  const activeTracePreset =
    TRACE_PRESETS.find((p) => p.id === settings.tracePreset) ||
    TRACE_PRESETS[0];

  const handleConfirmSaveAs = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError('Ingresá un nombre para la nueva configuración.');
      return;
    }
    onCreateNewPreset(
      trimmed,
      newBadge.trim() || 'Personalizado',
      newDesc.trim() || 'Configuración guardada desde el Inspector.',
      makeDefault
    );
    setNewName('');
    setNewDesc('');
    setNameError('');
    setIsSaveAsModalOpen(false);
  };

  const inspectorTabs: TabItem[] = [
    {
      id: 'ai_vector',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Eraser size={14} /> IA & Vector
        </span>
      ),
      content: (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            paddingTop: '12px',
          }}
        >
          {/* Scale Up HD · Super-Resolución Anti-Borroso */}
          <div
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--ptech-radius-lg, 8px)',
              backgroundColor: 'var(--ptech-surface-elevated)',
              border: settings.upscaleEnabled
                ? '1px solid var(--ptech-primary)'
                : '1px solid var(--ptech-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--ptech-primary)' }} />
                <span
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 700,
                    color: 'var(--ptech-text-primary)',
                  }}
                >
                  Scale Up HD · Anti-Borroso
                </span>
                <InfoTip
                  title="Scale Up Super-Resolución + Anti-Borroso"
                  description="Escala hacia arriba imágenes de baja resolución (2x, 3x o 4x) antes del recorte IA y del calco SVG. Aplica limpieza bilateral de bloques JPEG, interpolación Lanczos-3 con retroproyección iterativa (IBP) y reconstrucción de bordes sin halos (CAS + curva S)."
                />
              </div>
              <Switch
                size="sm"
                checked={Boolean(settings.upscaleEnabled)}
                onChange={(e) =>
                  onUpdateSettings({ upscaleEnabled: e.target.checked })
                }
              />
            </div>

            {settings.upscaleEnabled && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--ptech-radius-md, 6px)',
                  backgroundColor: 'var(--ptech-surface-card)',
                  border: '1px solid var(--ptech-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <ControlHeader
                  label="Factor de Escalado"
                  info="Multiplica el ancho y alto de la imagen de baja resolución por 2x, 3x o 4x (tope de seguridad 3840px UHD)."
                  valueBadge={`${settings.upscaleFactor ?? 2}x`}
                />
                <Select
                  options={UPSCALE_FACTOR_OPTIONS}
                  value={String(settings.upscaleFactor ?? 2)}
                  onChange={(val: string) =>
                    onUpdateSettings({
                      upscaleFactor: (Number(val) as 2 | 3 | 4) || 2,
                    })
                  }
                  portal
                />

                <ControlHeader
                  label="Intensidad Anti-Borroso (De-Blur)"
                  info="Contrae bordes difusos o borrosos en contornos nítidos de 1–2px usando retroproyección iterativa (IBP) y nitidez adaptativa acotada (0% de halos)."
                  valueBadge={`${settings.upscaleDeblur ?? 70}%`}
                />
                <Slider
                  value={settings.upscaleDeblur ?? 70}
                  min={0}
                  max={100}
                  step={5}
                  showValue={false}
                  onChange={(e) =>
                    onUpdateSettings({
                      upscaleDeblur: Number(e.target.value),
                    })
                  }
                />

                <ControlHeader
                  label="Limpieza de Ruido JPEG"
                  info="Elimina el granulado y los bloques 8×8 de imágenes comprimidas chicas antes de agrandarlas."
                  valueBadge={`${settings.upscaleDenoise ?? 45}%`}
                />
                <Slider
                  value={settings.upscaleDenoise ?? 45}
                  min={0}
                  max={100}
                  step={5}
                  showValue={false}
                  onChange={(e) =>
                    onUpdateSettings({
                      upscaleDenoise: Number(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* AI Segmentation Section */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--ptech-radius-lg, 8px)',
              backgroundColor: 'var(--ptech-surface-elevated)',
              border: '1px solid var(--ptech-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <span
                style={{
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  color: 'var(--ptech-text-primary)',
                }}
              >
                Recorte de Fondo ONNX
              </span>
              <Switch
                size="sm"
                checked={settings.removeBackground}
                onChange={(e) =>
                  onUpdateSettings({ removeBackground: e.target.checked })
                }
              />
            </div>

            {settings.removeBackground && (
              <>
                <Select
                  label="Modelo de Segmentación"
                  options={AI_MODEL_SELECT_OPTIONS}
                  value={settings.bgModel}
                  onChange={(val: string) =>
                    onUpdateSettings({ bgModel: val as BackgroundModelId })
                  }
                  portal
                />

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <Chip
                      label={activeModel.badge}
                      color={
                        activeModel.category === 'interactive'
                          ? 'primary'
                          : 'success'
                      }
                      variant="soft"
                    />
                  </div>
                  <span
                    style={{
                      fontSize: '0.75rem',
                      color: 'var(--ptech-text-secondary)',
                      lineHeight: 1.4,
                    }}
                  >
                    {activeModel.description}
                  </span>
                </div>

                {settings.bgModel === 'sam' && (
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--ptech-radius-md, 6px)',
                      backgroundColor: 'var(--ptech-surface-card)',
                      border: '1px solid var(--ptech-border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '6px',
                      }}
                    >
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.76rem',
                            fontWeight: 600,
                            color: 'var(--ptech-text-primary)',
                          }}
                        >
                          Recuadro Periférico (Con Cartón)
                        </span>
                        <InfoTip
                          title="Recuadro Periférico (Con Cartón)"
                          description="Amplía el marco de detección inicial hasta el 98% del lienzo para conservar blísteres, tarjetas o cartones que llegan casi hasta el borde."
                        />
                      </div>
                      <Switch
                        size="sm"
                        checked={settings.samIncludeCardboard}
                        onChange={(e) =>
                          onUpdateSettings({
                            samIncludeCardboard: e.target.checked,
                          })
                        }
                      />
                    </div>

                    <ControlHeader
                      label="Max Offset de Píxeles por Punto"
                      info="Radio máximo en píxeles (sobre base 1000px) hasta donde se expande la detección de color contiguo alrededor de cada clic (+) o (−). Evita que un punto borre o seleccione zonas lejanas del mismo color."
                      valueBadge={`${settings.samMaxOffsetPx ?? 160} px`}
                    />
                    <Slider
                      value={settings.samMaxOffsetPx ?? 160}
                      min={20}
                      max={500}
                      step={10}
                      showValue={false}
                      onChange={(e) =>
                        onUpdateSettings({
                          samMaxOffsetPx: Number(e.target.value),
                        })
                      }
                    />

                    <ControlHeader
                      label="Tolerancia de Color por Punto"
                      info="Diferencia máxima de color por canal (±RGB) para considerar que un píxel vecino pertenece a la misma superficie donde hiciste clic. Valores bajos (15–26) frenan en bordes sutiles."
                      valueBadge={`±${settings.samColorTolerance ?? 24}`}
                    />
                    <Slider
                      value={settings.samColorTolerance ?? 24}
                      min={6}
                      max={75}
                      step={1}
                      showValue={false}
                      onChange={(e) =>
                        onUpdateSettings({
                          samColorTolerance: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Adobe Illustrator Vector Trace Section */}
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--ptech-radius-lg, 8px)',
              backgroundColor: 'var(--ptech-surface-elevated)',
              border: '1px solid var(--ptech-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: 'var(--ptech-text-primary)',
                    display: 'block',
                  }}
                >
                  Calco Vectorial (SVG)
                </span>
                <span
                  style={{
                    fontSize: '0.72rem',
                    color: 'var(--ptech-text-secondary)',
                  }}
                >
                  Estilo Adobe Illustrator Image Trace
                </span>
              </div>
              <Switch
                size="sm"
                checked={settings.vectorizeEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  onUpdateSettings({
                    vectorizeEnabled: enabled,
                    outputFormat: enabled
                      ? 'svg'
                      : settings.outputFormat === 'svg'
                      ? 'auto'
                      : settings.outputFormat,
                  });
                }}
              />
            </div>

            {settings.vectorizeEnabled && (
              <>
                <ControlHeader
                  label="Preset de Trazado"
                  info="Selecciona un perfil base estilo Adobe Illustrator Image Trace (Foto Alta Fidelidad, Ilustración, Póster, Blanco y Negro o Arte Lineal)."
                />
                <Select
                  options={TRACE_PRESET_SELECT_OPTIONS}
                  value={settings.tracePreset}
                  onChange={(val: string) =>
                    onPresetChange(val as TracePresetId)
                  }
                  portal
                />

                <span
                  style={{
                    fontSize: '0.74rem',
                    color: 'var(--ptech-text-secondary)',
                    lineHeight: 1.35,
                  }}
                >
                  {activeTracePreset.description}
                </span>

                {/* 1. Configuración Geométrica de Trazados (Vector Paths) */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--ptech-radius-md, 6px)',
                    backgroundColor: 'var(--ptech-surface-card)',
                    border: '1px solid var(--ptech-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--ptech-text-primary)',
                    }}
                  >
                    1. Geometría de Trazados y Nodos
                  </span>

                  <ControlHeader
                    label="Modo de Curva de Trazos"
                    info="Define cómo se construyen los segmentos vectoriales: 'Curvas Bézier Suaves (Spline)' crea curvas continuas ideales para logos e ilustraciones; 'Poligonal' usa rectas entre vértices; 'Píxel Exacto' sigue los bordes ortogonales."
                  />
                  <Select
                    options={TRACE_CURVE_MODE_OPTIONS}
                    value={settings.traceCurveMode ?? 'spline'}
                    onChange={(val: string) =>
                      onUpdateSettings({
                        traceCurveMode: val as TraceCurveModeId,
                      })
                    }
                    portal
                  />

                  {settings.tracePreset !== 'bw' && (
                    <>
                      <ControlHeader
                        label="Precisión de Color"
                        info="Bits significativos por canal RGB (1 a 8 bits) al cuantizar colores. Valores altos (7–8) conservan más matices y degradados; valores bajos (2–4) reducen la imagen a pocos colores planos."
                        valueBadge={`${settings.traceColorPrecision} bits`}
                      />
                      <Slider
                        value={settings.traceColorPrecision}
                        min={1}
                        max={8}
                        step={1}
                        showValue={false}
                        onChange={(e) =>
                          onUpdateSettings({
                            traceColorPrecision: Number(e.target.value),
                          })
                        }
                      />

                      <ControlHeader
                        label="Salto entre Capas de Color"
                        info="Diferencia mínima de tono para separar dos regiones vecinas en capas vectoriales distintas. Valores bajos crean más capas de degradado; valores altos fusionan colores similares en un solo trazo."
                        valueBadge={settings.traceLayerDifference}
                      />
                      <Slider
                        value={settings.traceLayerDifference}
                        min={4}
                        max={64}
                        step={2}
                        showValue={false}
                        onChange={(e) =>
                          onUpdateSettings({
                            traceLayerDifference: Number(e.target.value),
                          })
                        }
                      />
                    </>
                  )}

                  <ControlHeader
                    label="Filtro de Ruido (Speckle)"
                    info="Descarta automáticamente manchas o micro-trazos aislados cuyo tamaño sea menor a esta cantidad de píxeles. Subilo para eliminar puntos parásitos y basura en los bordes."
                    valueBadge={`${settings.traceFilterSpeckle} px`}
                  />
                  <Slider
                    value={settings.traceFilterSpeckle}
                    min={0}
                    max={48}
                    step={1}
                    showValue={false}
                    onChange={(e) =>
                      onUpdateSettings({
                        traceFilterSpeckle: Number(e.target.value),
                      })
                    }
                  />

                  <ControlHeader
                    label="Ajuste de Longitud de Trazos"
                    info="Longitud de subdivisión de segmentos (equivalente a 'Trazados / Paths' en Illustrator). Valores bajos (3.5 px) se pegan más al píxel con más nodos; valores altos (8–10 px) generan curvas más largas, limpias y con menos nodos."
                    valueBadge={`${(settings.traceLengthThreshold ?? 4.5).toFixed(1)} px`}
                  />
                  <Slider
                    value={settings.traceLengthThreshold ?? 4.5}
                    min={3.5}
                    max={10}
                    step={0.5}
                    maxDecimals={1}
                    showValue={false}
                    onChange={(e) =>
                      onUpdateSettings({
                        traceLengthThreshold: Number(e.target.value),
                      })
                    }
                  />

                  <ControlHeader
                    label="Suavizado de Esquinas"
                    info="Ángulo mínimo (en grados) para detectar un vértice como esquina aguda. Valores bajos crean más esquinas rectas; valores altos redondean los giros en curvas suaves."
                    valueBadge={`${settings.traceCornerThreshold}°`}
                  />
                  <Slider
                    value={settings.traceCornerThreshold}
                    min={15}
                    max={165}
                    step={5}
                    showValue={false}
                    onChange={(e) =>
                      onUpdateSettings({
                        traceCornerThreshold: Number(e.target.value),
                      })
                    }
                  />

                  <ControlHeader
                    label="Ángulo de Empalme (Splice)"
                    info="Ángulo de inflexión necesario para dividir una curva Bézier en dos segmentos separados. Controla qué tan continuo fluye el trazo en curvas largas."
                    valueBadge={`${settings.traceSpliceThreshold ?? 45}°`}
                  />
                  <Slider
                    value={settings.traceSpliceThreshold ?? 45}
                    min={10}
                    max={90}
                    step={5}
                    showValue={false}
                    onChange={(e) =>
                      onUpdateSettings({
                        traceSpliceThreshold: Number(e.target.value),
                      })
                    }
                  />

                  <ControlHeader
                    label="Precisión Decimal SVG"
                    info="Cantidad de decimales en las coordenadas de cada <path d='...'>. Menos decimales (1–2) producen archivos SVG más livianos; más decimales (3–4) dan máxima exactitud sub-píxel."
                    valueBadge={`${settings.tracePathPrecision ?? 2} dec`}
                  />
                  <Slider
                    value={settings.tracePathPrecision ?? 2}
                    min={1}
                    max={4}
                    step={1}
                    showValue={false}
                    onChange={(e) =>
                      onUpdateSettings({
                        tracePathPrecision: Number(e.target.value),
                      })
                    }
                  />

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                      paddingTop: '2px',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 600,
                          color: 'var(--ptech-text-primary)',
                        }}
                      >
                        Modo Cutout (Sin solapar)
                      </span>
                      <InfoTip
                        title="Modo Cutout vs Superpuesto"
                        description="Activado (Cutout): las formas contiguas se recortan entre sí sin superponerse (ideal para plotter de corte y vinilo). Desactivado (Stacked): apila formas completas una sobre otra evitando huecos."
                      />
                    </div>
                    <Switch
                      size="sm"
                      checked={settings.traceCutout}
                      onChange={(e) =>
                        onUpdateSettings({ traceCutout: e.target.checked })
                      }
                    />
                  </div>
                </div>

                {/* 2. Configuración de Línea de Trazo SVG (stroke / fill) */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--ptech-radius-md, 6px)',
                    backgroundColor: 'var(--ptech-surface-card)',
                    border: '1px solid var(--ptech-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.78rem',
                      fontWeight: 700,
                      color: 'var(--ptech-text-primary)',
                    }}
                  >
                    2. Contorno de Trazo y Relleno (Stroke / Fill)
                  </span>

                  <ControlHeader
                    label="Estilo de Trazo y Relleno"
                    info="Elige cómo se dibujan los vectores <path>: 'Solo Relleno' exporta áreas sólidas; 'Relleno + Línea de Trazo' agrega borde (stroke) a cada forma; 'Solo Contorno de Trazo' quita el relleno (fill='none') dejando únicamente el dibujo lineal."
                  />
                  <Select
                    options={TRACE_STROKE_STYLE_OPTIONS}
                    value={
                      !(settings.traceFillEnabled ?? true)
                        ? 'stroke_only'
                        : settings.traceStrokeEnabled
                        ? 'fill_and_stroke'
                        : 'fill_only'
                    }
                    onChange={(val: string) => {
                      if (val === 'fill_only') {
                        onUpdateSettings({
                          traceFillEnabled: true,
                          traceStrokeEnabled: false,
                        });
                      } else if (val === 'fill_and_stroke') {
                        onUpdateSettings({
                          traceFillEnabled: true,
                          traceStrokeEnabled: true,
                        });
                      } else if (val === 'stroke_only') {
                        onUpdateSettings({
                          traceFillEnabled: false,
                          traceStrokeEnabled: true,
                          traceStrokeColorAuto: false,
                        });
                      }
                    }}
                    portal
                  />

                  {(settings.traceStrokeEnabled ||
                    !(settings.traceFillEnabled ?? true)) && (
                    <>
                      <ControlHeader
                        label="Grosor del Trazo (stroke-width)"
                        info="Ancho en píxeles de la línea de contorno (stroke-width) aplicada a cada vector del SVG."
                        valueBadge={`${(settings.traceStrokeWidth ?? 1.5).toFixed(1)} px`}
                      />
                      <Slider
                        value={settings.traceStrokeWidth ?? 1.5}
                        min={0.5}
                        max={10}
                        step={0.5}
                        maxDecimals={1}
                        showValue={false}
                        onChange={(e) =>
                          onUpdateSettings({
                            traceStrokeWidth: Number(e.target.value),
                          })
                        }
                      />

                      <ControlHeader
                        label="Color de la Línea de Trazo"
                        info="Si elegís 'Mismo Color del Relleno', cada forma usa su propio color como borde para sellar fisuras entre vectores. Si elegís un color fijo (como Negro), delinea todas las piezas con ese color."
                      />
                      <Select
                        options={TRACE_STROKE_COLOR_OPTIONS}
                        value={
                          settings.traceStrokeColorAuto
                            ? 'auto'
                            : ['#0f172a', '#000000', '#ffffff'].includes(
                                (
                                  settings.traceStrokeColorHex || '#0f172a'
                                ).toLowerCase()
                              )
                            ? (
                                settings.traceStrokeColorHex || '#0f172a'
                              ).toLowerCase()
                            : 'custom'
                        }
                        onChange={(val: string) => {
                          if (val === 'auto') {
                            onUpdateSettings({ traceStrokeColorAuto: true });
                          } else if (val === 'custom') {
                            onUpdateSettings({
                              traceStrokeColorAuto: false,
                              traceStrokeColorHex:
                                settings.traceStrokeColorHex || '#0f172a',
                            });
                          } else {
                            onUpdateSettings({
                              traceStrokeColorAuto: false,
                              traceStrokeColorHex: val,
                            });
                          }
                        }}
                        portal
                      />

                      {!settings.traceStrokeColorAuto && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '8px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <Input
                              label="Hex del Trazo"
                              placeholder="#0F172A"
                              value={settings.traceStrokeColorHex || '#0f172a'}
                              onChange={(e) =>
                                onUpdateSettings({
                                  traceStrokeColorHex: e.target.value,
                                })
                              }
                              fullWidth
                            />
                          </div>
                          <input
                            type="color"
                            value={
                              /^#[0-9a-fA-F]{6}$/.test(
                                settings.traceStrokeColorHex || ''
                              )
                                ? settings.traceStrokeColorHex
                                : '#0f172a'
                            }
                            onChange={(e) =>
                              onUpdateSettings({
                                traceStrokeColorAuto: false,
                                traceStrokeColorHex: e.target.value,
                              })
                            }
                            title="Seleccionar color de trazo"
                            style={{
                              width: '38px',
                              height: '38px',
                              padding: '2px',
                              borderRadius: 'var(--ptech-radius-md, 6px)',
                              border: '1px solid var(--ptech-border-default)',
                              backgroundColor: 'var(--ptech-surface-elevated)',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          />
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* 3. Omitir un Color Entero en el SVG */}
                <div
                  style={{
                    padding: '10px 12px',
                    borderRadius: 'var(--ptech-radius-md, 6px)',
                    backgroundColor: 'var(--ptech-surface-card)',
                    border: '1px solid var(--ptech-border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          color: 'var(--ptech-text-primary)',
                        }}
                      >
                        3. Omitir un Color Entero
                      </span>
                      <InfoTip
                        title="Omitir un Color Entero en el SVG"
                        description="Elimina tanto los píxeles previos al calco como cualquier etiqueta <path fill='#...'> resultante que coincida con el color elegido (similar a 'Ignorar Blanco' de Illustrator pero para cualquier color)."
                      />
                    </div>
                    <Switch
                      size="sm"
                      checked={settings.traceIgnoreColorEnabled}
                      onChange={(e) =>
                        onUpdateSettings({
                          traceIgnoreColorEnabled: e.target.checked,
                        })
                      }
                    />
                  </div>

                  {settings.traceIgnoreColorEnabled && (
                    <>
                      <ControlHeader
                        label="Color a Omitir del Vector"
                        info="Podés auto-detectar el color dominante del borde de la imagen o elegir explícitamente Blanco (#FFFFFF), Gris, Negro o cualquier código Hex personalizado."
                      />
                      <Select
                        options={TRACE_IGNORE_COLOR_OPTIONS}
                        value={
                          settings.traceIgnoreColorAuto
                            ? 'auto'
                            : ['#ffffff', '#f8fafc', '#000000'].includes(
                                settings.traceIgnoreColorHex.toLowerCase()
                              )
                            ? settings.traceIgnoreColorHex.toLowerCase()
                            : 'custom'
                        }
                        onChange={(val: string) => {
                          if (val === 'auto') {
                            onUpdateSettings({ traceIgnoreColorAuto: true });
                          } else if (val === 'custom') {
                            onUpdateSettings({
                              traceIgnoreColorAuto: false,
                              traceIgnoreColorHex:
                                settings.traceIgnoreColorHex || '#e2e8f0',
                            });
                          } else {
                            onUpdateSettings({
                              traceIgnoreColorAuto: false,
                              traceIgnoreColorHex: val,
                            });
                          }
                        }}
                        portal
                      />

                      {!settings.traceIgnoreColorAuto && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'flex-end',
                            gap: '8px',
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <Input
                              label="Código Hex a Omitir"
                              placeholder="#FFFFFF"
                              value={settings.traceIgnoreColorHex}
                              onChange={(e) =>
                                onUpdateSettings({
                                  traceIgnoreColorHex: e.target.value,
                                })
                              }
                              fullWidth
                            />
                          </div>
                          <input
                            type="color"
                            value={
                              /^#[0-9a-fA-F]{6}$/.test(
                                settings.traceIgnoreColorHex
                              )
                                ? settings.traceIgnoreColorHex
                                : '#ffffff'
                            }
                            onChange={(e) =>
                              onUpdateSettings({
                                traceIgnoreColorAuto: false,
                                traceIgnoreColorHex: e.target.value,
                              })
                            }
                            title="Seleccionar color a omitir"
                            style={{
                              width: '38px',
                              height: '38px',
                              padding: '2px',
                              borderRadius: 'var(--ptech-radius-md, 6px)',
                              border: '1px solid var(--ptech-border-default)',
                              backgroundColor: 'var(--ptech-surface-elevated)',
                              cursor: 'pointer',
                              flexShrink: 0,
                            }}
                          />
                        </div>
                      )}

                      <ControlHeader
                        label="Tolerancia de Color a Omitir"
                        info="Rango de proximidad cromática (±RGB) alrededor del color elegido que también será eliminado para no dejar halos ni bordes residuales de ese tono."
                        valueBadge={`±${settings.traceIgnoreTolerance}`}
                      />
                      <Slider
                        value={settings.traceIgnoreTolerance}
                        min={5}
                        max={95}
                        step={1}
                        showValue={false}
                        onChange={(e) =>
                          onUpdateSettings({
                            traceIgnoreTolerance: Number(e.target.value),
                          })
                        }
                      />
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      ),
    },
    {
      id: 'output_compression',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={14} /> Salida
        </span>
      ),
      content: (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            paddingTop: '12px',
          }}
        >
          <Select
            label="Formato de Exportación (JPG / PNG / SVG)"
            options={OUTPUT_FORMAT_SELECT_OPTIONS}
            value={settings.outputFormat}
            onChange={(val: string) => {
              const fmt = val as OutputFormatId;
              onUpdateSettings({
                outputFormat: fmt,
                vectorizeEnabled: fmt === 'svg',
              });
            }}
            portal
          />

          {settings.outputFormat === 'jpg' && (
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--ptech-radius-md, 6px)',
                backgroundColor: 'var(--ptech-surface-elevated)',
                border: '1px solid var(--ptech-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <Select
                label="Fondo para Transparencia en JPG"
                options={JPG_BG_SELECT_OPTIONS}
                value={settings.jpgBackground}
                onChange={(val: string) =>
                  onUpdateSettings({ jpgBackground: val })
                }
                portal
              />
              <Slider
                label="Calidad JPEG (%)"
                value={settings.jpgQuality}
                min={60}
                max={100}
                step={1}
                onChange={(e) =>
                  onUpdateSettings({ jpgQuality: Number(e.target.value) })
                }
              />
            </div>
          )}

          {!settings.vectorizeEnabled && settings.outputFormat !== 'svg' && (
            <>
              <Select
                label="Compresión Sin Pérdida (Lossless Engine)"
                options={COMPRESSION_SELECT_OPTIONS}
                value={settings.compressionMode}
                onChange={(val: string) =>
                  onUpdateSettings({
                    compressionMode: val as CompressionModeId,
                  })
                }
                portal
              />

              <div
                style={{
                  padding: '12px',
                  borderRadius: 'var(--ptech-radius-md, 6px)',
                  backgroundColor: 'var(--ptech-surface-elevated)',
                  border: '1px solid var(--ptech-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div>
                  <Chip
                    label={
                      activeCompression.isLossless
                        ? '100% Lossless Sin Pérdida'
                        : 'Cuantización Paleta PNG-8'
                    }
                    color={activeCompression.isLossless ? 'success' : 'warning'}
                    variant="soft"
                  />
                </div>
                <span
                  style={{
                    fontSize: '0.75rem',
                    color: 'var(--ptech-text-secondary)',
                    lineHeight: 1.4,
                  }}
                >
                  {activeCompression.description}
                </span>
              </div>
            </>
          )}
        </div>
      ),
    },
    {
      id: 'adjustments',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Sliders size={14} /> Ajustes
        </span>
      ),
      content: (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            paddingTop: '12px',
          }}
        >
          {/* Scale Up HD · Super-Resolución Anti-Borroso */}
          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--ptech-radius-md, 6px)',
              backgroundColor: 'var(--ptech-surface-elevated)',
              border: settings.upscaleEnabled
                ? '1px solid var(--ptech-primary)'
                : '1px solid var(--ptech-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '6px',
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                <Sparkles size={14} style={{ color: 'var(--ptech-primary)' }} />
                <span
                  style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    color: 'var(--ptech-text-primary)',
                  }}
                >
                  Scale Up HD · Anti-Borroso
                </span>
                <InfoTip
                  title="Super-Resolución + De-Blurring Sin Halos"
                  description="Escala imágenes chicas o de baja resolución (2x, 3x o 4x) antes de recortar o vectorizar. Combina desbloqueo bilateral JPEG, interpolación Lanczos-3 con retroproyección iterativa (IBP) y filtro de choque de bordes (CAS + curva S) acotado al vecindario 3×3 para eliminar lo borroso sin generar halos blancos ni negros."
                />
              </div>
              <Switch
                size="sm"
                checked={Boolean(settings.upscaleEnabled)}
                onChange={(e) =>
                  onUpdateSettings({ upscaleEnabled: e.target.checked })
                }
              />
            </div>

            {settings.upscaleEnabled && (
              <div
                style={{
                  padding: '10px 12px',
                  borderRadius: 'var(--ptech-radius-md, 6px)',
                  backgroundColor: 'var(--ptech-surface-card)',
                  border: '1px solid var(--ptech-border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <ControlHeader
                  label="Factor de Escalado (Scale Up)"
                  info="Multiplica el ancho y alto de la imagen original por 2x, 3x o 4x (hasta un tope seguro de 3840px UHD) antes de pasar por el recorte de fondo o el calco SVG."
                  valueBadge={`${settings.upscaleFactor ?? 2}x`}
                />
                <Select
                  options={UPSCALE_FACTOR_OPTIONS}
                  value={String(settings.upscaleFactor ?? 2)}
                  onChange={(val: string) =>
                    onUpdateSettings({
                      upscaleFactor: (Number(val) as 2 | 3 | 4) || 2,
                    })
                  }
                  portal
                />

                <ControlHeader
                  label="Intensidad Anti-Borroso (De-Blur)"
                  info="Fuerza de reconstrucción de contornos y nitidez adaptativa (Iterative Back-Projection + Contrast Adaptive Sharpening). Contrae las rampas borrosas de 4px en bordes definidos de 1–2px para textos, logos y envases sin crear aureolas."
                  valueBadge={`${settings.upscaleDeblur ?? 70}%`}
                />
                <Slider
                  value={settings.upscaleDeblur ?? 70}
                  min={0}
                  max={100}
                  step={5}
                  showValue={false}
                  onChange={(e) =>
                    onUpdateSettings({
                      upscaleDeblur: Number(e.target.value),
                    })
                  }
                />

                <ControlHeader
                  label="Limpieza de Bloques JPEG (Denoise)"
                  info="Suavizado bilateral previo al escalado que elimina el ruido mosquito y los bloques 8×8 de imágenes comprimidas de baja calidad para que no se amplifiquen al agrandar."
                  valueBadge={`${settings.upscaleDenoise ?? 45}%`}
                />
                <Slider
                  value={settings.upscaleDenoise ?? 45}
                  min={0}
                  max={100}
                  step={5}
                  showValue={false}
                  onChange={(e) =>
                    onUpdateSettings({
                      upscaleDenoise: Number(e.target.value),
                    })
                  }
                />
              </div>
            )}
          </div>

          <ControlHeader
            label="Escalado de Resolución de Salida"
            info="Define el tamaño final de exportación: 'Original (1:1)' conserva la resolución nativa (o la resolución ampliada por Scale Up HD); 'Catálogo Web' ajusta a 500px; 'Personalizadas' fuerza un Ancho × Alto exacto."
          />
          <Select
            options={MODE_SELECT_OPTIONS}
            value={settings.mode}
            onChange={(val: string) =>
              onUpdateSettings({ mode: val as ProcessingModeId })
            }
            portal
          />

          {settings.mode === 'custom' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '10px',
              }}
            >
              <NumberStepper
                label="Ancho (px)"
                value={settings.width}
                min={16}
                max={8192}
                step={10}
                size="sm"
                onChange={(val) => onUpdateSettings({ width: val })}
              />
              <NumberStepper
                label="Alto (px)"
                value={settings.height}
                min={16}
                max={8192}
                step={10}
                size="sm"
                onChange={(val) => onUpdateSettings({ height: val })}
              />
            </div>
          )}

          <div
            style={{
              padding: '12px',
              borderRadius: 'var(--ptech-radius-md, 6px)',
              backgroundColor: 'var(--ptech-surface-elevated)',
              border: '1px solid var(--ptech-border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <Switch
              size="sm"
              label="Auto-Recorte y Centrado Cuadrado (1:1)"
              checked={settings.autoCrop}
              onChange={(e) =>
                onUpdateSettings({ autoCrop: e.target.checked })
              }
            />

            <Switch
              size="sm"
              label="Refinamiento de Bordes Sobel"
              checked={settings.sobelRefinement}
              onChange={(e) =>
                onUpdateSettings({ sobelRefinement: e.target.checked })
              }
            />

            <Switch
              size="sm"
              label="Embellecedor de Catálogo (+Color/Nitidez)"
              checked={settings.beautify}
              onChange={(e) =>
                onUpdateSettings({ beautify: e.target.checked })
              }
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span
              style={{
                fontSize: '0.76rem',
                fontWeight: 600,
                color: 'var(--ptech-text-secondary)',
              }}
            >
              Corrección de Imagen
            </span>
            {(settings.brightness !== 1 ||
              settings.saturation !== 1 ||
              settings.sharpness !== 1) && (
              <Button
                variant="ghost"
                size="sm"
                leftIcon={<RotateCcw size={12} />}
                onClick={() =>
                  onUpdateSettings({
                    brightness: 1,
                    saturation: 1,
                    sharpness: 1,
                  })
                }
              >
                Restablecer
              </Button>
            )}
          </div>

          <Slider
            label="Brillo"
            value={settings.brightness}
            min={0.5}
            max={1.8}
            step={0.1}
            maxDecimals={1}
            onChange={(e) =>
              onUpdateSettings({ brightness: Number(e.target.value) })
            }
          />

          <Slider
            label="Saturación"
            value={settings.saturation}
            min={0}
            max={2}
            step={0.1}
            maxDecimals={1}
            onChange={(e) =>
              onUpdateSettings({ saturation: Number(e.target.value) })
            }
          />

          <Slider
            label="Nitidez"
            value={settings.sharpness}
            min={0.5}
            max={2.5}
            step={0.1}
            maxDecimals={1}
            onChange={(e) =>
              onUpdateSettings({ sharpness: Number(e.target.value) })
            }
          />
        </div>
      ),
    },
  ];

  return (
    <aside
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: 'var(--ptech-surface-card)',
        borderRight: '1px solid var(--ptech-border-default)',
        overflow: 'hidden',
      }}
    >
      {/* 1. Pinned Top Inspector Header + Preset Quick CRUD Actions */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--ptech-border-subtle)',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={15} style={{ color: 'var(--ptech-primary)' }} />
            <span
              style={{
                fontSize: '0.88rem',
                fontWeight: 700,
                color: 'var(--ptech-text-primary)',
              }}
            >
              Inspector de Pipeline
            </span>
          </div>

          <Chip
            label={
              settings.vectorizeEnabled
                ? 'SVG Vector'
                : settings.outputFormat.toUpperCase()
            }
            color="primary"
            variant="soft"
          />
        </div>

        {/* Active Preset Status Box */}
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 'var(--ptech-radius-md, 6px)',
            backgroundColor: 'var(--ptech-surface-elevated)',
            border: '1px solid var(--ptech-border-subtle)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '6px',
            }}
          >
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: 'var(--ptech-text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {activePreset ? activePreset.name : 'Configuración Libre'}
            </span>

            {hasUnsavedChanges && (
              <Chip label="Modificado *" color="warning" variant="soft" />
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexWrap: 'wrap',
            }}
          >
            {hasUnsavedChanges && activePreset && (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Save size={12} />}
                  onClick={onSaveToActivePreset}
                >
                  Actualizar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<RotateCcw size={12} />}
                  onClick={onRevertToActivePreset}
                >
                  Revertir
                </Button>
              </>
            )}

            <Button
              variant="outline"
              size="sm"
              leftIcon={<BookmarkPlus size={12} />}
              onClick={() => {
                setNewName('');
                setNewBadge('Personalizado');
                setNewDesc('');
                setNameError('');
                setMakeDefault(false);
                setIsSaveAsModalOpen(true);
              }}
            >
              Guardar Como...
            </Button>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<FolderCog size={12} />}
              onClick={onOpenCrudView}
            >
              CRUD
            </Button>
          </div>
        </div>
      </div>

      {/* 2. Scrollable Controls Body */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '14px 16px',
        }}
      >
        <AnimatedTabs tabs={inspectorTabs} variant="pill" />
      </div>

      {/* 3. Pinned Bottom Batch Action Dock */}
      <div
        style={{
          padding: '12px 16px',
          borderTop: '1px solid var(--ptech-border-default)',
          backgroundColor: 'var(--ptech-surface-elevated)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}
      >
        <ShineButton
          mode="hover"
          duration={2.6}
          disabled={totalFiles === 0 || isProcessing}
          onClick={onProcessAll}
          style={{
            width: '100%',
            padding: '11px 16px',
            fontWeight: 700,
            fontSize: '0.88rem',
            opacity: totalFiles === 0 ? 0.55 : 1,
            cursor: totalFiles === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
            }}
          >
            {settings.vectorizeEnabled ? (
              <PenTool size={16} />
            ) : (
              <Sparkles size={16} />
            )}
            {isProcessing
              ? 'Procesando Lote...'
              : settings.vectorizeEnabled
              ? `Calcar Lote a SVG (${totalFiles})`
              : `Procesar Imágenes (${totalFiles})`}
          </span>
        </ShineButton>

        {completedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            fullWidth
            leftIcon={<FileArchive size={15} />}
            onClick={onDownloadAll}
          >
            Descargar Todo en ZIP ({completedCount})
          </Button>
        )}
      </div>

      {/* Save As New Preset Modal */}
      <Modal
        isOpen={isSaveAsModalOpen}
        onClose={() => setIsSaveAsModalOpen(false)}
        title="Guardar como Nueva Configuración"
        size="sm"
        footer={
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '8px',
              width: '100%',
            }}
          >
            <Button variant="ghost" onClick={() => setIsSaveAsModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              leftIcon={<Save size={14} />}
              onClick={handleConfirmSaveAs}
            >
              Crear Configuración
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <Input
            label="Nombre de la Configuración"
            placeholder="Ej: Catálogo MercadoLibre PNG"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (nameError) setNameError('');
            }}
            error={nameError}
            fullWidth
          />
          <Input
            label="Etiqueta / Categoría"
            placeholder="Ej: E-Commerce"
            value={newBadge}
            onChange={(e) => setNewBadge(e.target.value)}
            fullWidth
          />
          <Input
            label="Descripción"
            placeholder="Ej: U2NET + Auto-Crop + Lossless Fast"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            fullWidth
          />
          <Switch
            size="sm"
            label="Fijar como configuración preseleccionada al iniciar"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
          />
        </div>
      </Modal>
    </aside>
  );
};

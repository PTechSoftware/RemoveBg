import React, { useMemo, useState } from 'react';
import {
  Button,
  Input,
  NumberStepper,
  Select,
  Slider,
  Switch,
} from '@ptech/designsystem/inputs';
import {
  Card,
  CardContent,
  CardHeader,
  Chip,
} from '@ptech/designsystem/datadisplay';
import { Modal } from '@ptech/designsystem/overlays';
import {
  Check,
  Copy,
  Download,
  Edit3,
  FolderCog,
  Pin,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  AI_MODELS,
  AI_MODEL_SELECT_OPTIONS,
  BUILT_IN_PRESETS,
  COMPRESSION_OPTIONS,
  COMPRESSION_SELECT_OPTIONS,
  JPG_BG_SELECT_OPTIONS,
  MODE_SELECT_OPTIONS,
  OUTPUT_FORMAT_SELECT_OPTIONS,
  TRACE_PRESET_SELECT_OPTIONS,
  UPSCALE_FACTOR_OPTIONS,
} from '../constants/processorOptions';
import type {
  BackgroundModelId,
  CompressionModeId,
  OutputFormatId,
  PresetConfig,
  ProcessingModeId,
  ProcessorSettings,
  TracePresetId,
} from '../types/imageProcessor';

export interface PresetCrudManagerProps {
  presets: PresetConfig[];
  activePresetId: string | null;
  defaultPresetId: string;
  currentSettings: ProcessorSettings;
  hasUnsavedChanges: boolean;
  onSelectPreset: (preset: PresetConfig) => void;
  onSetDefaultPreset: (presetId: string) => void;
  onCreatePreset: (
    preset: Omit<PresetConfig, 'id'>,
    makeDefault: boolean
  ) => void;
  onUpdatePreset: (
    presetId: string,
    updated: Omit<PresetConfig, 'id'>,
    makeDefault: boolean
  ) => void;
  onDeletePreset: (presetId: string) => void;
  onDuplicatePreset: (preset: PresetConfig) => void;
  onResetFactoryPresets: () => void;
  onImportPresets: (imported: PresetConfig[]) => void;
}

export const PresetCrudManager: React.FC<PresetCrudManagerProps> = ({
  presets,
  activePresetId,
  defaultPresetId,
  currentSettings,
  hasUnsavedChanges,
  onSelectPreset,
  onSetDefaultPreset,
  onCreatePreset,
  onUpdatePreset,
  onDeletePreset,
  onDuplicatePreset,
  onResetFactoryPresets,
  onImportPresets,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'custom' | 'builtin'>(
    'all'
  );

  // Modal Form State (Create & Edit)
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formBadge, setFormBadge] = useState('Personalizado');
  const [formDescription, setFormDescription] = useState('');
  const [formIsBuiltIn, setFormIsBuiltIn] = useState(false);
  const [formMakeDefault, setFormMakeDefault] = useState(false);
  const [formSettings, setFormSettings] = useState<ProcessorSettings>(() => ({
    ...currentSettings,
  }));
  const [nameError, setNameError] = useState('');

  // Delete confirmation modal
  const [deletingPreset, setDeletingPreset] = useState<PresetConfig | null>(
    null
  );

  const filteredPresets = useMemo(() => {
    return presets.filter((p) => {
      if (filterType === 'custom' && p.isBuiltIn) return false;
      if (filterType === 'builtin' && !p.isBuiltIn) return false;
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.badge.toLowerCase().includes(q) ||
        p.settings.bgModel.toLowerCase().includes(q) ||
        p.settings.outputFormat.toLowerCase().includes(q)
      );
    });
  }, [presets, filterType, searchQuery]);

  const openCreateFromCurrent = () => {
    setEditingPresetId(null);
    setFormName('');
    setFormBadge('Personalizado');
    setFormDescription('');
    setFormIsBuiltIn(false);
    setFormMakeDefault(false);
    setFormSettings({ ...currentSettings });
    setNameError('');
    setIsEditorOpen(true);
  };

  const openCreateNewBlank = () => {
    setEditingPresetId(null);
    setFormName('');
    setFormBadge('Producción');
    setFormDescription('');
    setFormIsBuiltIn(false);
    setFormMakeDefault(false);
    setFormSettings({ ...BUILT_IN_PRESETS[0].settings });
    setNameError('');
    setIsEditorOpen(true);
  };

  const openEditPreset = (preset: PresetConfig) => {
    setEditingPresetId(preset.id);
    setFormName(preset.name);
    setFormBadge(preset.badge);
    setFormDescription(preset.description);
    setFormIsBuiltIn(preset.isBuiltIn);
    setFormMakeDefault(preset.id === defaultPresetId);
    setFormSettings({ ...preset.settings });
    setNameError('');
    setIsEditorOpen(true);
  };

  const updateFormSettings = (partial: Partial<ProcessorSettings>) => {
    setFormSettings((prev) => ({ ...prev, ...partial }));
  };

  const handleSaveEditor = () => {
    const trimmedName = formName.trim();
    if (!trimmedName) {
      setNameError('El nombre de la configuración es obligatorio.');
      return;
    }

    const payload: Omit<PresetConfig, 'id'> = {
      name: trimmedName,
      badge: formBadge.trim() || 'Personalizado',
      description:
        formDescription.trim() ||
        'Configuración de procesamiento personalizada.',
      isBuiltIn: formIsBuiltIn,
      settings: { ...formSettings },
    };

    if (editingPresetId) {
      onUpdatePreset(editingPresetId, payload, formMakeDefault);
    } else {
      onCreatePreset(payload, formMakeDefault);
    }

    setIsEditorOpen(false);
  };

  const handleExportJson = () => {
    const dataStr = JSON.stringify(presets, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'removebg_presets_config.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (Array.isArray(parsed) && parsed.length > 0) {
          onImportPresets(parsed);
        }
      } catch {
        // ignore invalid json
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getModelLabel = (id: BackgroundModelId) => {
    const found = AI_MODELS.find((m) => m.id === id);
    return found ? found.name.split('·')[0].trim() : id.toUpperCase();
  };

  const getCompressionLabel = (id: CompressionModeId) => {
    const found = COMPRESSION_OPTIONS.find((c) => c.id === id);
    return found ? found.name.split('(')[0].trim() : id;
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        padding: '24px',
        height: '100%',
        overflowY: 'auto',
      }}
    >
      {/* Top CRUD Action Header */}
      <Card variant="elevated" padding="md">
        <CardContent>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: 'var(--ptech-radius-lg, 8px)',
                  backgroundColor: 'var(--ptech-surface-elevated)',
                  border: '1px solid var(--ptech-border-default)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--ptech-primary)',
                }}
              >
                <FolderCog size={22} />
              </div>
              <div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  <h2
                    style={{
                      margin: 0,
                      fontSize: '1.1rem',
                      fontWeight: 700,
                      color: 'var(--ptech-text-primary)',
                    }}
                  >
                    Gestor CRUD de Configuraciones (Presets)
                  </h2>
                  <Chip
                    label={`${presets.length} Configuraciones`}
                    color="primary"
                    variant="soft"
                  />
                </div>
                <p
                  style={{
                    margin: '4px 0 0 0',
                    fontSize: '0.8rem',
                    color: 'var(--ptech-text-secondary)',
                  }}
                >
                  Creá, editá, cloná, eliminá y fijá la configuración
                  preseleccionada que se carga al iniciar el estudio.
                </p>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw size={14} />}
                onClick={onResetFactoryPresets}
              >
                Restaurar de Fábrica
              </Button>

              <Button
                variant="outline"
                size="sm"
                leftIcon={<Download size={14} />}
                onClick={handleExportJson}
              >
                Exportar JSON
              </Button>

              <label style={{ display: 'inline-flex', cursor: 'pointer' }}>
                <input
                  type="file"
                  accept=".json"
                  style={{ display: 'none' }}
                  onChange={handleImportJsonFile}
                />
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    borderRadius: 'var(--ptech-radius-md, 6px)',
                    border: '1px solid var(--ptech-border-default)',
                    backgroundColor: 'var(--ptech-surface-elevated)',
                    color: 'var(--ptech-text-primary)',
                  }}
                >
                  <Upload size={14} /> Importar JSON
                </span>
              </label>

              <Button
                variant="secondary"
                size="sm"
                leftIcon={<Save size={14} />}
                onClick={openCreateFromCurrent}
              >
                Crear desde Controles Actuales
              </Button>

              <Button
                variant="primary"
                size="sm"
                glow
                leftIcon={<Plus size={15} />}
                onClick={openCreateNewBlank}
              >
                Nueva Configuración
              </Button>
            </div>
          </div>

          {/* Search & Filter Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
              marginTop: '16px',
              paddingTop: '14px',
              borderTop: '1px solid var(--ptech-border-subtle)',
            }}
          >
            <div style={{ flex: 1, minWidth: '240px', maxWidth: '420px' }}>
              <Input
                placeholder="Buscar por nombre, modelo (sam, u2net), formato (svg, png, jpg)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search size={15} />}
                clearable
                onClear={() => setSearchQuery('')}
                fullWidth
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Button
                variant={filterType === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterType('all')}
              >
                Todas ({presets.length})
              </Button>
              <Button
                variant={filterType === 'custom' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterType('custom')}
              >
                Personalizadas ({presets.filter((p) => !p.isBuiltIn).length})
              </Button>
              <Button
                variant={filterType === 'builtin' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilterType('builtin')}
              >
                Sistema ({presets.filter((p) => p.isBuiltIn).length})
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Presets Grid (Read / Update / Delete / Pin / Duplicate) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '16px',
        }}
      >
        {filteredPresets.map((preset) => {
          const isActive = preset.id === activePresetId;
          const isDefault = preset.id === defaultPresetId;
          const s = preset.settings;

          return (
            <Card
              key={preset.id}
              variant={isActive ? 'glow' : 'elevated'}
              padding="md"
            >
              <CardHeader>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: '10px',
                    width: '100%',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px',
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.98rem',
                          fontWeight: 700,
                          color: 'var(--ptech-text-primary)',
                        }}
                      >
                        {preset.name}
                      </span>
                      <Chip
                        label={preset.badge}
                        color={isActive ? 'primary' : 'default'}
                        variant="soft"
                      />
                      {isDefault && (
                        <Chip
                          label="Predeterminada al Iniciar"
                          icon={<Pin size={11} />}
                          color="success"
                          variant="soft"
                        />
                      )}
                      {isActive && (
                        <Chip
                          label={
                            hasUnsavedChanges ? 'Activa (Modificada)' : 'Activa'
                          }
                          color={hasUnsavedChanges ? 'warning' : 'primary'}
                          variant="outline"
                        />
                      )}
                    </div>
                    <span
                      style={{
                        fontSize: '0.79rem',
                        color: 'var(--ptech-text-secondary)',
                        lineHeight: 1.4,
                      }}
                    >
                      {preset.description}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '14px',
                  }}
                >
                  {/* Technical Summary Pills */}
                  <div
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--ptech-radius-md, 6px)',
                      backgroundColor: 'var(--ptech-surface-elevated)',
                      border: '1px solid var(--ptech-border-subtle)',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                    }}
                  >
                    <Chip
                      label={
                        s.removeBackground
                          ? `IA: ${getModelLabel(s.bgModel)}`
                          : 'Sin Recorte IA'
                      }
                      color={s.bgModel === 'sam' ? 'primary' : 'default'}
                      variant="outline"
                    />
                    <Chip
                      label={`Salida: ${
                        s.vectorizeEnabled
                          ? 'SVG Vector'
                          : s.outputFormat.toUpperCase()
                      }`}
                      color="success"
                      variant="outline"
                    />
                    {!s.vectorizeEnabled && s.outputFormat !== 'svg' && (
                      <Chip
                        label={getCompressionLabel(s.compressionMode)}
                        color="default"
                        variant="outline"
                      />
                    )}
                    <Chip
                      label={
                        s.mode === 'original'
                          ? 'Res: Original'
                          : s.mode === 'optimized'
                          ? 'Res: 500px'
                          : `Res: ${s.width}×${s.height}`
                      }
                      color="default"
                      variant="outline"
                    />
                    {s.autoCrop && (
                      <Chip
                        label="Auto-Crop 1:1"
                        color="default"
                        variant="outline"
                      />
                    )}
                    {s.sobelRefinement && (
                      <Chip label="Sobel" color="default" variant="outline" />
                    )}
                    {s.beautify && (
                      <Chip
                        label="Embellecedor"
                        color="default"
                        variant="outline"
                      />
                    )}
                  </div>

                  {/* CRUD Action Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                      flexWrap: 'wrap',
                      paddingTop: '4px',
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
                      <Button
                        variant={isActive ? 'secondary' : 'primary'}
                        size="sm"
                        leftIcon={
                          isActive ? (
                            <Check size={14} />
                          ) : (
                            <Sparkles size={14} />
                          )
                        }
                        onClick={() => onSelectPreset(preset)}
                      >
                        {isActive ? 'Aplicada' : 'Usar Ahora'}
                      </Button>

                      <Button
                        variant={isDefault ? 'secondary' : 'outline'}
                        size="sm"
                        leftIcon={<Pin size={14} />}
                        onClick={() => onSetDefaultPreset(preset.id)}
                      >
                        {isDefault ? 'Fijada al Inicio' : 'Fijar Inicio'}
                      </Button>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Edit3 size={14} />}
                        onClick={() => openEditPreset(preset)}
                      >
                        Editar
                      </Button>

                      <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Copy size={14} />}
                        onClick={() => onDuplicatePreset(preset)}
                      >
                        Clonar
                      </Button>

                      {presets.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<Trash2 size={14} />}
                          onClick={() => setDeletingPreset(preset)}
                          aria-label="Eliminar configuración"
                        />
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Full Create / Edit Preset Modal */}
      <Modal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        title={
          editingPresetId
            ? 'Editar Configuración (Preset)'
            : 'Nueva Configuración (Preset)'
        }
        size="lg"
        footer={
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              width: '100%',
            }}
          >
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFormSettings({ ...currentSettings })}
            >
              Copiar valores actuales del Inspector
            </Button>

            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="ghost" onClick={() => setIsEditorOpen(false)}>
                Cancelar
              </Button>
              <Button
                variant="primary"
                leftIcon={<Save size={15} />}
                onClick={handleSaveEditor}
              >
                {editingPresetId ? 'Guardar Cambios' : 'Crear Configuración'}
              </Button>
            </div>
          </div>
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            maxHeight: '68vh',
            overflowY: 'auto',
            paddingRight: '4px',
          }}
        >
          {/* Metadata Row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr',
              gap: '12px',
            }}
          >
            <Input
              label="Nombre de la Configuración"
              placeholder="Ej: E-Commerce PNG Rápido"
              value={formName}
              onChange={(e) => {
                setFormName(e.target.value);
                if (nameError) setNameError('');
              }}
              error={nameError}
              fullWidth
            />
            <Input
              label="Etiqueta / Categoría"
              placeholder="Ej: Lote Rápido"
              value={formBadge}
              onChange={(e) => setFormBadge(e.target.value)}
              fullWidth
            />
          </div>

          <Input
            label="Descripción"
            placeholder="Describe para qué flujo de trabajo sirve esta configuración..."
            value={formDescription}
            onChange={(e) => setFormDescription(e.target.value)}
            fullWidth
          />

          <Switch
            size="sm"
            label="Fijar como configuración preseleccionada al iniciar la aplicación"
            checked={formMakeDefault}
            onChange={(e) => setFormMakeDefault(e.target.checked)}
          />

          {/* Pipeline Parameters Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '14px',
              paddingTop: '8px',
              borderTop: '1px solid var(--ptech-border-subtle)',
            }}
          >
            {/* Column 1: AI & Vector */}
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--ptech-radius-md, 6px)',
                backgroundColor: 'var(--ptech-surface-elevated)',
                border: '1px solid var(--ptech-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--ptech-text-primary)',
                }}
              >
                1. Segmentación IA & Vector SVG
              </span>

              <Switch
                size="sm"
                label="Recorte de Fondo con IA"
                checked={formSettings.removeBackground}
                onChange={(e) =>
                  updateFormSettings({ removeBackground: e.target.checked })
                }
              />

              {formSettings.removeBackground && (
                <Select
                  label="Modelo ONNX"
                  options={AI_MODEL_SELECT_OPTIONS}
                  value={formSettings.bgModel}
                  onChange={(val: string) =>
                    updateFormSettings({ bgModel: val as BackgroundModelId })
                  }
                  portal
                />
              )}

              {formSettings.removeBackground &&
                formSettings.bgModel === 'sam' && (
                  <>
                    <Switch
                      size="sm"
                      label="Incluir recuadro periférico (Con Cartón)"
                      checked={formSettings.samIncludeCardboard}
                      onChange={(e) =>
                        updateFormSettings({
                          samIncludeCardboard: e.target.checked,
                        })
                      }
                    />
                    <Slider
                      label="Max Offset de Píxeles por Punto (px)"
                      value={formSettings.samMaxOffsetPx ?? 160}
                      min={20}
                      max={500}
                      step={10}
                      onChange={(e) =>
                        updateFormSettings({
                          samMaxOffsetPx: Number(e.target.value),
                        })
                      }
                    />
                    <Slider
                      label="Tolerancia de Color por Punto (±RGB)"
                      value={formSettings.samColorTolerance ?? 24}
                      min={6}
                      max={75}
                      step={1}
                      onChange={(e) =>
                        updateFormSettings({
                          samColorTolerance: Number(e.target.value),
                        })
                      }
                    />
                  </>
                )}

              <Switch
                size="sm"
                label="Activar Calco Vectorial SVG (Illustrator)"
                checked={formSettings.vectorizeEnabled}
                onChange={(e) => {
                  const enabled = e.target.checked;
                  updateFormSettings({
                    vectorizeEnabled: enabled,
                    outputFormat: enabled
                      ? 'svg'
                      : formSettings.outputFormat === 'svg'
                      ? 'auto'
                      : formSettings.outputFormat,
                  });
                }}
              />

              {formSettings.vectorizeEnabled && (
                <>
                  <Select
                    label="Preset de Trazado SVG"
                    options={TRACE_PRESET_SELECT_OPTIONS}
                    value={formSettings.tracePreset}
                    onChange={(val: string) =>
                      updateFormSettings({ tracePreset: val as TracePresetId })
                    }
                    portal
                  />

                  <Switch
                    size="sm"
                    label="Omitir un Color Entero en el SVG"
                    checked={formSettings.traceIgnoreColorEnabled ?? true}
                    onChange={(e) =>
                      updateFormSettings({
                        traceIgnoreColorEnabled: e.target.checked,
                      })
                    }
                  />

                  {(formSettings.traceIgnoreColorEnabled ?? true) && (
                    <Slider
                      label="Tolerancia de Color a Omitir (±RGB)"
                      value={formSettings.traceIgnoreTolerance ?? 28}
                      min={5}
                      max={95}
                      step={1}
                      onChange={(e) =>
                        updateFormSettings({
                          traceIgnoreTolerance: Number(e.target.value),
                        })
                      }
                    />
                  )}
                </>
              )}
            </div>

            {/* Column 2: Output, Compression & Adjustments */}
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--ptech-radius-md, 6px)',
                backgroundColor: 'var(--ptech-surface-elevated)',
                border: '1px solid var(--ptech-border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
              }}
            >
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: 'var(--ptech-text-primary)',
                }}
              >
                2. Formato, Compresión y Ajustes
              </span>

              <Select
                label="Formato de Salida"
                options={OUTPUT_FORMAT_SELECT_OPTIONS}
                value={formSettings.outputFormat}
                onChange={(val: string) => {
                  const fmt = val as OutputFormatId;
                  updateFormSettings({
                    outputFormat: fmt,
                    vectorizeEnabled: fmt === 'svg',
                  });
                }}
                portal
              />

              {!formSettings.vectorizeEnabled &&
                formSettings.outputFormat !== 'svg' && (
                  <Select
                    label="Motor de Compresión"
                    options={COMPRESSION_SELECT_OPTIONS}
                    value={formSettings.compressionMode}
                    onChange={(val: string) =>
                      updateFormSettings({
                        compressionMode: val as CompressionModeId,
                      })
                    }
                    portal
                  />
                )}

              {formSettings.outputFormat === 'jpg' && (
                <>
                  <Select
                    label="Color de Fondo JPG"
                    options={JPG_BG_SELECT_OPTIONS}
                    value={formSettings.jpgBackground}
                    onChange={(val: string) =>
                      updateFormSettings({ jpgBackground: val })
                    }
                    portal
                  />
                  <Slider
                    label="Calidad JPG (%)"
                    value={formSettings.jpgQuality}
                    min={60}
                    max={100}
                    step={1}
                    onChange={(e) =>
                      updateFormSettings({
                        jpgQuality: Number(e.target.value),
                      })
                    }
                  />
                </>
              )}

              <Select
                label="Escalado de Resolución"
                options={MODE_SELECT_OPTIONS}
                value={formSettings.mode}
                onChange={(val: string) =>
                  updateFormSettings({ mode: val as ProcessingModeId })
                }
                portal
              />

              <Switch
                size="sm"
                label="Scale Up HD · Super-Resolución Anti-Borroso"
                checked={Boolean(formSettings.upscaleEnabled)}
                onChange={(e) =>
                  updateFormSettings({ upscaleEnabled: e.target.checked })
                }
              />

              {formSettings.upscaleEnabled && (
                <>
                  <Select
                    label="Factor de Escalado (Scale Up)"
                    options={UPSCALE_FACTOR_OPTIONS}
                    value={String(formSettings.upscaleFactor ?? 2)}
                    onChange={(val: string) =>
                      updateFormSettings({
                        upscaleFactor: (Number(val) as 2 | 3 | 4) || 2,
                      })
                    }
                    portal
                  />
                  <Slider
                    label="Intensidad Anti-Borroso (%)"
                    value={formSettings.upscaleDeblur ?? 70}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(e) =>
                      updateFormSettings({
                        upscaleDeblur: Number(e.target.value),
                      })
                    }
                  />
                  <Slider
                    label="Limpieza de Bloques JPEG (%)"
                    value={formSettings.upscaleDenoise ?? 45}
                    min={0}
                    max={100}
                    step={5}
                    onChange={(e) =>
                      updateFormSettings({
                        upscaleDenoise: Number(e.target.value),
                      })
                    }
                  />
                </>
              )}

              {formSettings.mode === 'custom' && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: '8px',
                  }}
                >
                  <NumberStepper
                    label="Ancho (px)"
                    value={formSettings.width}
                    min={16}
                    max={8192}
                    step={10}
                    size="sm"
                    onChange={(val) => updateFormSettings({ width: val })}
                  />
                  <NumberStepper
                    label="Alto (px)"
                    value={formSettings.height}
                    min={16}
                    max={8192}
                    step={10}
                    size="sm"
                    onChange={(val) => updateFormSettings({ height: val })}
                  />
                </div>
              )}

              <Switch
                size="sm"
                label="Auto-Recorte y Centrado Cuadrado (1:1)"
                checked={formSettings.autoCrop}
                onChange={(e) =>
                  updateFormSettings({ autoCrop: e.target.checked })
                }
              />

              <Switch
                size="sm"
                label="Refinamiento de Bordes Sobel"
                checked={formSettings.sobelRefinement}
                onChange={(e) =>
                  updateFormSettings({ sobelRefinement: e.target.checked })
                }
              />

              <Switch
                size="sm"
                label="Embellecedor de Catálogo (+Color/Nitidez)"
                checked={formSettings.beautify}
                onChange={(e) =>
                  updateFormSettings({ beautify: e.target.checked })
                }
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={Boolean(deletingPreset)}
        onClose={() => setDeletingPreset(null)}
        title="Eliminar Configuración"
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
            <Button variant="ghost" onClick={() => setDeletingPreset(null)}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              leftIcon={<Trash2 size={14} />}
              onClick={() => {
                if (deletingPreset) {
                  onDeletePreset(deletingPreset.id);
                  setDeletingPreset(null);
                }
              }}
            >
              Confirmar Eliminación
            </Button>
          </div>
        }
      >
        <p
          style={{
            margin: 0,
            fontSize: '0.88rem',
            color: 'var(--ptech-text-secondary)',
            lineHeight: 1.5,
          }}
        >
          ¿Estás seguro de que querés eliminar la configuración{' '}
          <strong style={{ color: 'var(--ptech-text-primary)' }}>
            {deletingPreset?.name}
          </strong>
          ? Siempre podés volver a restaurar las configuraciones de fábrica si
          lo necesitás.
        </p>
      </Modal>
    </div>
  );
};

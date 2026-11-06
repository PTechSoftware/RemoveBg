import React, { useState } from 'react';
import { Button, Input, Switch } from '@ptech/designsystem/inputs';
import { Card, CardContent, Chip } from '@ptech/designsystem/datadisplay';
import { Modal } from '@ptech/designsystem/overlays';
import { BookmarkPlus, Check, Pin, Sparkles, Trash2 } from 'lucide-react';
import type { PresetConfig } from '../types/imageProcessor';

export interface PresetSelectorBarProps {
  presets: PresetConfig[];
  activePresetId: string | null;
  defaultPresetId: string;
  onSelectPreset: (preset: PresetConfig) => void;
  onSetDefaultPreset: (presetId: string) => void;
  onSaveCustomPreset: (
    name: string,
    description: string,
    makeDefault: boolean
  ) => void;
  onDeleteCustomPreset: (presetId: string) => void;
}

export const PresetSelectorBar: React.FC<PresetSelectorBarProps> = ({
  presets,
  activePresetId,
  defaultPresetId,
  onSelectPreset,
  onSetDefaultPreset,
  onSaveCustomPreset,
  onDeleteCustomPreset,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [makeDefault, setMakeDefault] = useState(true);
  const [nameError, setNameError] = useState('');

  const activePreset = presets.find((p) => p.id === activePresetId) || null;
  const isCurrentDefault = activePresetId === defaultPresetId;

  const handleConfirmSave = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNameError('Ingresá un nombre para tu configuración preseleccionada');
      return;
    }
    onSaveCustomPreset(
      trimmed,
      newDesc.trim() || 'Configuración personalizada guardada por el usuario.',
      makeDefault
    );
    setNewName('');
    setNewDesc('');
    setNameError('');
    setIsModalOpen(false);
  };

  return (
    <>
      <Card variant="elevated" padding="sm">
        <CardContent>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            {/* Top row: Title + Active Preset Description + Actions */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                flexWrap: 'wrap',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: 'var(--ptech-text-secondary)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <Sparkles size={14} />
                  Configuración Preseleccionada (Presets)
                </span>

                {activePreset ? (
                  <Chip
                    label={activePreset.badge}
                    color="primary"
                    variant="soft"
                  />
                ) : (
                  <Chip
                    label="Ajustes Personalizados (Sin guardar)"
                    color="warning"
                    variant="soft"
                  />
                )}

                {activePreset && (
                  <span
                    style={{
                      fontSize: '0.78rem',
                      color: 'var(--ptech-text-secondary)',
                    }}
                  >
                    {activePreset.description}
                  </span>
                )}
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                {activePresetId && (
                  <Button
                    variant={isCurrentDefault ? 'secondary' : 'outline'}
                    size="sm"
                    leftIcon={
                      isCurrentDefault ? <Check size={14} /> : <Pin size={14} />
                    }
                    onClick={() => onSetDefaultPreset(activePresetId)}
                  >
                    {isCurrentDefault
                      ? 'Preseleccionada al Iniciar'
                      : 'Fijar como Predeterminada'}
                  </Button>
                )}

                {activePreset && !activePreset.isBuiltIn && (
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 size={14} />}
                    onClick={() => onDeleteCustomPreset(activePreset.id)}
                  >
                    Eliminar Preset
                  </Button>
                )}

                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<BookmarkPlus size={14} />}
                  onClick={() => {
                    setNewName('');
                    setNewDesc('');
                    setNameError('');
                    setMakeDefault(true);
                    setIsModalOpen(true);
                  }}
                >
                  Guardar Configuración Actual
                </Button>
              </div>
            </div>

            {/* Bottom row: Selectable Preset Pills */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
              }}
            >
              {presets.map((preset) => {
                const isSelected = preset.id === activePresetId;
                const isDefault = preset.id === defaultPresetId;

                return (
                  <Button
                    key={preset.id}
                    variant={isSelected ? 'primary' : 'outline'}
                    size="sm"
                    glow={isSelected}
                    leftIcon={isDefault ? <Pin size={13} /> : undefined}
                    onClick={() => onSelectPreset(preset)}
                  >
                    {preset.name}
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save Custom Preset Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Guardar Configuración Preseleccionada"
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
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={handleConfirmSave}>
              Guardar Preset
            </Button>
          </div>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Nombre del Preset"
            placeholder="Ej: Catálogo MercadoLibre PNG Rápido"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              if (nameError) setNameError('');
            }}
            error={nameError}
            fullWidth
            clearable
            onClear={() => setNewName('')}
          />

          <Input
            label="Descripción Breve (Opcional)"
            placeholder="Ej: U2NET + Auto-Crop + Lossless Fast"
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            fullWidth
          />

          <Switch
            size="sm"
            label="Fijar como configuración preseleccionada al abrir la aplicación"
            checked={makeDefault}
            onChange={(e) => setMakeDefault(e.target.checked)}
          />
        </div>
      </Modal>
    </>
  );
};

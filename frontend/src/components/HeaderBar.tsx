import React from 'react';
import {
  AnimatedThemeToggler,
  Button,
  Select,
} from '@ptech/designsystem/inputs';
import { Chip } from '@ptech/designsystem/datadisplay';
import { Progress } from '@ptech/designsystem/feedback';
import { useTheme, getCounterpartThemeId } from '@ptech/designsystem/theme';
import {
  FileArchive,
  FolderCog,
  Layers,
  LayoutGrid,
  MonitorPlay,
  Pin,
  Save,
  Sparkles,
} from 'lucide-react';
import type { PresetConfig } from '../types/imageProcessor';

export type StudioViewMode = 'stage' | 'batch' | 'presets';

export interface HeaderBarProps {
  activeView: StudioViewMode;
  onChangeView: (view: StudioViewMode) => void;
  presets: PresetConfig[];
  activePresetId: string | null;
  defaultPresetId: string;
  hasUnsavedChanges: boolean;
  onSelectPresetById: (presetId: string) => void;
  onQuickSaveActivePreset: () => void;
  isProcessing: boolean;
  overallProgress: number;
  completedCount: number;
  totalCount: number;
  vectorizeEnabled: boolean;
  onProcessAll: () => void;
  onDownloadAll: () => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  activeView,
  onChangeView,
  presets,
  activePresetId,
  defaultPresetId,
  hasUnsavedChanges,
  onSelectPresetById,
  onQuickSaveActivePreset,
  isProcessing,
  overallProgress,
  completedCount,
  totalCount,
  vectorizeEnabled,
  onProcessAll,
  onDownloadAll,
}) => {
  const { theme, activeThemeConfig, setTheme } = useTheme();
  const isDarkTheme = activeThemeConfig?.isDark ?? true;

  const presetOptions = presets.map((p) => ({
    value: p.id,
    label: p.id === defaultPresetId ? `📌 ${p.name}` : p.name,
  }));

  return (
    <header
      style={{
        height: '58px',
        borderBottom: '1px solid var(--ptech-border-default)',
        backgroundColor: 'var(--ptech-surface-card)',
        padding: '0 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '14px',
        flexShrink: 0,
        zIndex: 40,
      }}
    >
      {/* Left: Brand Identity + Quick Preset Selector */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          minWidth: 0,
        }}
      >
        <div
          style={{
            width: '34px',
            height: '34px',
            borderRadius: 'var(--ptech-radius-md, 8px)',
            backgroundColor: 'var(--ptech-surface-elevated)',
            border: '1px solid var(--ptech-border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--ptech-primary)',
            flexShrink: 0,
          }}
        >
          <Layers size={18} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              fontSize: '0.96rem',
              fontWeight: 700,
              color: 'var(--ptech-text-primary)',
              whiteSpace: 'nowrap',
            }}
          >
            RemoveBG Studio
          </span>
          <Chip label="MobileSAM · i7" color="success" variant="soft" />
        </div>

        {/* Divider */}
        <div
          style={{
            width: '1px',
            height: '24px',
            backgroundColor: 'var(--ptech-border-subtle)',
            margin: '0 2px',
          }}
        />

        {/* Quick Preset Selector */}
        <div
          style={{
            width: '230px',
            flexShrink: 0,
          }}
        >
          <Select
            options={presetOptions}
            value={activePresetId || presets[0]?.id || ''}
            onChange={(val: string) => onSelectPresetById(val)}
            portal
          />
        </div>

        {activePresetId === defaultPresetId && (
          <Chip
            label="Inicio"
            icon={<Pin size={11} />}
            color="primary"
            variant="soft"
          />
        )}

        {hasUnsavedChanges && activePresetId && (
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Save size={13} />}
            onClick={onQuickSaveActivePreset}
          >
            Guardar cambios
          </Button>
        )}
      </div>

      {/* Center: Studio Workspace Navigation Pills */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px',
          borderRadius: 'var(--ptech-radius-lg, 8px)',
          backgroundColor: 'var(--ptech-surface-elevated)',
          border: '1px solid var(--ptech-border-subtle)',
        }}
      >
        <Button
          variant={activeView === 'stage' ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={<MonitorPlay size={14} />}
          onClick={() => onChangeView('stage')}
        >
          Estudio & Lienzo
        </Button>

        <Button
          variant={activeView === 'batch' ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={<LayoutGrid size={14} />}
          onClick={() => onChangeView('batch')}
        >
          Cuadrícula Lote ({totalCount})
        </Button>

        <Button
          variant={activeView === 'presets' ? 'primary' : 'ghost'}
          size="sm"
          leftIcon={<FolderCog size={14} />}
          onClick={() => onChangeView('presets')}
        >
          CRUD Configuraciones ({presets.length})
        </Button>
      </div>

      {/* Right: Batch Progress + Actions + Theme Switcher */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          flexShrink: 0,
        }}
      >
        {isProcessing && (
          <div style={{ width: '140px' }}>
            <Progress
              variant="linear"
              value={Math.round(overallProgress)}
              max={100}
              showValue
              size="sm"
            />
          </div>
        )}

        {totalCount > 0 && (
          <Button
            variant="primary"
            size="sm"
            glow
            isLoading={isProcessing}
            leftIcon={<Sparkles size={14} />}
            onClick={onProcessAll}
          >
            {vectorizeEnabled
              ? `Calcar Lote (${totalCount})`
              : `Procesar Lote (${totalCount})`}
          </Button>
        )}

        {completedCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            leftIcon={<FileArchive size={14} />}
            onClick={onDownloadAll}
          >
            ZIP ({completedCount})
          </Button>
        )}

        <AnimatedThemeToggler
          isDark={isDarkTheme}
          onToggle={() => {
            const nextThemeId =
              getCounterpartThemeId(theme) ||
              (isDarkTheme ? 'linear-pearl-light' : 'dark');
            setTheme(nextThemeId);
          }}
        />
      </div>
    </header>
  );
};

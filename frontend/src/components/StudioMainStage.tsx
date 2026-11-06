import React, { useRef } from 'react';
import { Button, type FileError } from '@ptech/designsystem/inputs';
import { Card, CardContent, Chip } from '@ptech/designsystem/datadisplay';
import { Progress } from '@ptech/designsystem/feedback';
import { Image } from '@ptech/designsystem/media';
import { ImagePointPicker, type Point } from '@ptech/designsystem/tech';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Eye,
  FolderCog,
  LayoutGrid,
  PenTool,
  Pin,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { UploadDropzone } from './UploadDropzone';
import {
  formatBytes,
  getExtensionFromMime,
} from '../constants/processorOptions';
import type {
  ImageQueueItem,
  OutputFormatId,
  PresetConfig,
} from '../types/imageProcessor';

export interface StudioMainStageProps {
  files: ImageQueueItem[];
  activeFile: ImageQueueItem | null;
  isInteractiveModel: boolean;
  outputFormat: OutputFormatId;
  vectorizeEnabled: boolean;
  presets: PresetConfig[];
  activePresetId: string | null;
  defaultPresetId: string;
  onSelectPreset: (preset: PresetConfig) => void;
  onOpenCrudView: () => void;
  onOpenBatchGridView: () => void;
  onFilesAdded: (files: File[]) => void;
  onInvalidFiles: (errors: FileError[]) => void;
  onSelectFile: (id: string) => void;
  onRemoveFile: (id: string) => void;
  onClearAll: () => void;
  onPointsChange: (points: Point[]) => void;
  onProcessSingle: (item: ImageQueueItem) => void;
  onVectorizeSingle: (item: ImageQueueItem) => void;
  onDownloadSingle: (item: ImageQueueItem) => void;
}

export const StudioMainStage: React.FC<StudioMainStageProps> = ({
  files,
  activeFile,
  isInteractiveModel,
  outputFormat,
  vectorizeEnabled,
  presets,
  activePresetId,
  defaultPresetId,
  onSelectPreset,
  onOpenCrudView,
  onOpenBatchGridView,
  onFilesAdded,
  onInvalidFiles,
  onSelectFile,
  onRemoveFile,
  onClearAll,
  onPointsChange,
  onProcessSingle,
  onVectorizeSingle,
  onDownloadSingle,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Empty Workspace State: Centered Dropzone + Quick Preset Cards
  if (files.length === 0 || !activeFile) {
    return (
      <div
        style={{
          height: '100%',
          overflowY: 'auto',
          padding: '32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '28px',
        }}
      >
        <div style={{ width: '100%', maxWidth: '780px' }}>
          <UploadDropzone
            onFilesAdded={onFilesAdded}
            onInvalidFiles={onInvalidFiles}
            compact={false}
          />
        </div>

        {/* Quick Preset Switcher Strip right below the dropzone */}
        <div
          style={{
            width: '100%',
            maxWidth: '980px',
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
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                color: 'var(--ptech-text-secondary)',
              }}
            >
              Configuraciones Preseleccionadas (Presets Activos)
            </span>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<FolderCog size={14} />}
              onClick={onOpenCrudView}
            >
              Abrir CRUD de Configuraciones ({presets.length})
            </Button>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: '10px',
            }}
          >
            {presets.map((preset) => {
              const isSelected = preset.id === activePresetId;
              const isDefault = preset.id === defaultPresetId;

              return (
                <Card
                  key={preset.id}
                  variant={isSelected ? 'glow' : 'elevated'}
                  padding="sm"
                  style={{ cursor: 'pointer' }}
                  onClick={() => onSelectPreset(preset)}
                >
                  <CardContent>
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
                          justifyContent: 'space-between',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '0.84rem',
                            fontWeight: 700,
                            color: 'var(--ptech-text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {preset.name}
                        </span>
                        {isDefault && (
                          <Pin
                            size={13}
                            style={{
                              color: 'var(--ptech-primary)',
                              flexShrink: 0,
                            }}
                          />
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
                        <Chip
                          label={preset.badge}
                          color={isSelected ? 'primary' : 'default'}
                          variant="soft"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  const activeIndex = files.findIndex((f) => f.id === activeFile.id);
  const hasPrev = activeIndex > 0;
  const hasNext = activeIndex < files.length - 1;

  const positiveCount = activeFile.pickerPoints.filter(
    (p) => p.type === 'positive'
  ).length;
  const negativeCount = activeFile.pickerPoints.filter(
    (p) => p.type === 'negative'
  ).length;

  const outExt = getExtensionFromMime(
    activeFile.resultMime,
    vectorizeEnabled ? 'svg' : outputFormat
  ).toUpperCase();

  const savedPct =
    activeFile.originalSize &&
    activeFile.processedSize &&
    activeFile.processedSize < activeFile.originalSize
      ? Math.round(
          (1 - activeFile.processedSize / activeFile.originalSize) * 100
        )
      : null;

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* 1. Top Stage Action Bar */}
      <div
        style={{
          height: '52px',
          padding: '0 18px',
          borderBottom: '1px solid var(--ptech-border-default)',
          backgroundColor: 'var(--ptech-surface-card)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        {/* Left: Prev/Next + File Info + SAM Point Counter */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            minWidth: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Button
              variant="outline"
              size="sm"
              disabled={!hasPrev}
              leftIcon={<ChevronLeft size={14} />}
              onClick={() => hasPrev && onSelectFile(files[activeIndex - 1].id)}
              aria-label="Imagen anterior"
            />
            <Chip
              label={`${activeIndex + 1} / ${files.length}`}
              color="default"
              variant="outline"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={!hasNext}
              leftIcon={<ChevronRight size={14} />}
              onClick={() => hasNext && onSelectFile(files[activeIndex + 1].id)}
              aria-label="Imagen siguiente"
            />
          </div>

          <span
            style={{
              fontSize: '0.9rem',
              fontWeight: 700,
              color: 'var(--ptech-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '260px',
            }}
          >
            {activeFile.file.name}
          </span>

          <Chip
            label={
              activeFile.processedSize
                ? `${formatBytes(activeFile.originalSize)} → ${formatBytes(
                    activeFile.processedSize
                  )}`
                : formatBytes(activeFile.originalSize)
            }
            color={activeFile.processedSize ? 'success' : 'default'}
            variant="soft"
          />

          {savedPct !== null && (
            <Chip label={`−${savedPct}%`} color="primary" variant="soft" />
          )}

          {activeFile.durationMs && (
            <Chip
              label={`${activeFile.durationMs} ms`}
              icon={<Clock size={11} />}
              color="default"
              variant="outline"
            />
          )}

          {isInteractiveModel && (
            <Chip
              label={`${positiveCount} Preserve (+) · ${negativeCount} Delete (−)`}
              color="primary"
              variant="soft"
            />
          )}

          {isInteractiveModel && activeFile.pointsDirty && (
            <Chip
              label="Puntos modificados · Presioná Generar Preview"
              color="warning"
              variant="soft"
            />
          )}
        </div>

        {/* Right: Single-Image Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flexShrink: 0,
          }}
        >
          <Button
            variant="primary"
            size="sm"
            glow
            isLoading={activeFile.status === 'processing'}
            leftIcon={
              isInteractiveModel ? <Eye size={14} /> : <Sparkles size={14} />
            }
            onClick={() => onProcessSingle(activeFile)}
          >
            {isInteractiveModel
              ? activeFile.result
                ? 'Actualizar Preview SAM'
                : 'Generar Preview SAM'
              : activeFile.result
              ? 'Reprocesar Imagen'
              : 'Procesar Imagen'}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            isLoading={activeFile.status === 'processing'}
            leftIcon={<PenTool size={14} />}
            onClick={() => onVectorizeSingle(activeFile)}
          >
            Calcar SVG
          </Button>

          {activeFile.result && (
            <Button
              variant="outline"
              size="sm"
              leftIcon={<Download size={14} />}
              onClick={() => onDownloadSingle(activeFile)}
            >
              Descargar {outExt}
            </Button>
          )}
        </div>
      </div>

      {/* 2. Central Split Studio Viewport (Left = Original or SAM Point Picker, Right = Result) */}
      <div
        className="studio-split-stage"
        style={{
          flex: 1,
          minHeight: 0,
          padding: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          overflow: 'hidden',
        }}
      >
        {/* Left Pane: Input / Interactive SAM Point Picker */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--ptech-radius-lg, 10px)',
            border: '1px solid var(--ptech-border-default)',
            backgroundColor: 'var(--ptech-surface-card)',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            style={{
              height: '38px',
              padding: '0 14px',
              borderBottom: '1px solid var(--ptech-border-subtle)',
              backgroundColor: 'var(--ptech-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--ptech-text-secondary)',
              }}
            >
              {isInteractiveModel
                ? '1. Lienzo Interactivo MobileSAM (Preserve + / Delete −)'
                : '1. Imagen Original de Entrada'}
            </span>
            <Chip
              label={
                isInteractiveModel ? 'Click para marcar puntos' : 'Original'
              }
              color={isInteractiveModel ? 'primary' : 'default'}
              variant="soft"
            />
          </div>

          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: isInteractiveModel ? '8px' : '16px',
              backgroundColor: 'var(--ptech-surface-canvas)',
            }}
          >
            {isInteractiveModel ? (
              <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>
                <ImagePointPicker
                  src={activeFile.preview}
                  points={activeFile.pickerPoints}
                  onChange={onPointsChange}
                  positiveLabel="Preserve (+)"
                  negativeLabel="Delete (−)"
                  clearLabel="Limpiar"
                  allowDrag
                  allowLabels
                  showZoomControls
                  showLoupe={false}
                  showSidebar={false}
                />
              </div>
            ) : (
              <Image
                src={activeFile.preview}
                alt={activeFile.file.name}
                width="100%"
                height="100%"
                objectFit="contain"
              />
            )}
          </div>
        </div>

        {/* Right Pane: Processed Output Preview */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            borderRadius: 'var(--ptech-radius-lg, 10px)',
            border: '1px solid var(--ptech-border-default)',
            backgroundColor: 'var(--ptech-surface-card)',
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
          <div
            style={{
              height: '38px',
              padding: '0 14px',
              borderBottom: '1px solid var(--ptech-border-subtle)',
              backgroundColor: 'var(--ptech-surface-elevated)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                color: 'var(--ptech-text-secondary)',
              }}
            >
              2. Vista Previa de Salida ({outExt})
            </span>

            {activeFile.status === 'completed' ? (
              <Chip label="Completado" color="success" variant="soft" />
            ) : (
              <Chip label="A Demanda" color="default" variant="outline" />
            )}
          </div>

          <div
            className="checkerboard"
            style={{
              flex: 1,
              minHeight: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '16px',
              overflow: 'hidden',
            }}
          >
            {activeFile.status === 'processing' ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '24px',
                  borderRadius: 'var(--ptech-radius-lg, 8px)',
                  backgroundColor: 'var(--ptech-surface-card)',
                  border: '1px solid var(--ptech-border-default)',
                }}
              >
                <Progress variant="circular" size="md" />
                <span
                  style={{
                    fontSize: '0.84rem',
                    fontWeight: 600,
                    color: 'var(--ptech-text-primary)',
                  }}
                >
                  {isInteractiveModel
                    ? 'Ejecutando MobileSAM (~0.2s - 1.0s)...'
                    : 'Procesando imagen en i7-12700...'}
                </span>
              </div>
            ) : activeFile.result ? (
              <Image
                src={activeFile.result}
                alt="Resultado procesado"
                width="100%"
                height="100%"
                objectFit="contain"
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  gap: '12px',
                  maxWidth: '340px',
                  padding: '24px',
                  borderRadius: 'var(--ptech-radius-lg, 10px)',
                  backgroundColor: 'var(--ptech-surface-card)',
                  border: '1px solid var(--ptech-border-default)',
                }}
              >
                <Sparkles
                  size={26}
                  style={{ color: 'var(--ptech-primary)' }}
                />
                <span
                  style={{
                    fontSize: '0.84rem',
                    color: 'var(--ptech-text-secondary)',
                    lineHeight: 1.45,
                  }}
                >
                  {isInteractiveModel
                    ? 'Colocá puntos Preserve (+) o Delete (−) a la izquierda y presioná el botón para generar la vista previa.'
                    : 'Presioná el botón para procesar esta imagen o ejecutá todo el lote desde la barra superior.'}
                </span>
                <Button
                  variant="primary"
                  size="sm"
                  glow
                  leftIcon={
                    isInteractiveModel ? (
                      <Eye size={15} />
                    ) : (
                      <Sparkles size={15} />
                    )
                  }
                  onClick={() => onProcessSingle(activeFile)}
                >
                  {isInteractiveModel
                    ? 'Generar Preview SAM'
                    : 'Procesar Esta Imagen'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Bottom Filmstrip / Batch Queue Dock */}
      <div
        style={{
          height: '112px',
          borderTop: '1px solid var(--ptech-border-default)',
          backgroundColor: 'var(--ptech-surface-card)',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          flexShrink: 0,
        }}
      >
        {/* Left Filmstrip Controls */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            flexShrink: 0,
            paddingRight: '12px',
            borderRight: '1px solid var(--ptech-border-subtle)',
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".png,.jpg,.jpeg,.webp"
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                onFilesAdded(Array.from(e.target.files));
                e.target.value = '';
              }
            }}
          />
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Plus size={14} />}
            onClick={() => fileInputRef.current?.click()}
          >
            Agregar ({files.length})
          </Button>

          <div style={{ display: 'flex', gap: '4px' }}>
            <Button
              variant="outline"
              size="sm"
              leftIcon={<LayoutGrid size={13} />}
              onClick={onOpenBatchGridView}
            >
              Lote
            </Button>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 size={13} />}
              onClick={onClearAll}
              aria-label="Vaciar cola"
            />
          </div>
        </div>

        {/* Horizontal Thumbnail Strip */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            overflowX: 'auto',
            height: '100%',
            paddingBottom: '2px',
          }}
        >
          {files.map((item) => {
            const isSelected = item.id === activeFile.id;
            const thumbSrc = item.result || item.preview;

            return (
              <div
                key={item.id}
                onClick={() => onSelectFile(item.id)}
                style={{
                  position: 'relative',
                  width: '126px',
                  height: '86px',
                  flexShrink: 0,
                  borderRadius: 'var(--ptech-radius-md, 8px)',
                  border: isSelected
                    ? '2px solid var(--ptech-primary)'
                    : '1px solid var(--ptech-border-default)',
                  backgroundColor: 'var(--ptech-surface-elevated)',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <div
                  className={item.result ? 'checkerboard' : undefined}
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <img
                    src={thumbSrc}
                    alt={item.file.name}
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                </div>

                {/* Bottom Tiny Caption Bar */}
                <div
                  style={{
                    height: '22px',
                    padding: '0 6px',
                    backgroundColor: 'var(--ptech-surface-card)',
                    borderTop: '1px solid var(--ptech-border-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '4px',
                  }}
                >
                  <span
                    style={{
                      fontSize: '0.66rem',
                      fontWeight: 600,
                      color: 'var(--ptech-text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.file.name}
                  </span>

                  {item.status === 'completed' && (
                    <CheckCircle2
                      size={11}
                      style={{
                        color: 'var(--ptech-success, #22c55e)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </div>

                {/* Quick Remove Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveFile(item.id);
                  }}
                  style={{
                    position: 'absolute',
                    top: '4px',
                    right: '4px',
                    width: '18px',
                    height: '18px',
                    borderRadius: '999px',
                    border: 'none',
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                  aria-label="Quitar"
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

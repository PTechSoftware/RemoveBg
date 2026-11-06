import React from 'react';
import { Button } from '@ptech/designsystem/inputs';
import {
  Card,
  CardContent,
  CardHeader,
  Chip,
} from '@ptech/designsystem/datadisplay';
import { Progress } from '@ptech/designsystem/feedback';
import { Image } from '@ptech/designsystem/media';
import { ImagePointPicker, type Point } from '@ptech/designsystem/tech';
import { Clock, Download, Eye, PenTool, Sparkles } from 'lucide-react';
import {
  formatBytes,
  getExtensionFromMime,
} from '../constants/processorOptions';
import type {
  BackgroundModelId,
  ImageQueueItem,
  OutputFormatId,
} from '../types/imageProcessor';

export interface SamInteractiveStudioProps {
  files: ImageQueueItem[];
  activeFile: ImageQueueItem;
  bgModel: BackgroundModelId;
  outputFormat: OutputFormatId;
  vectorizeEnabled: boolean;
  onSelectFile: (id: string) => void;
  onPointsChange: (points: Point[]) => void;
  onUpdatePreview: () => void;
  onVectorizeSingle: () => void;
  onDownload: (item: ImageQueueItem) => void;
}

export const SamInteractiveStudio: React.FC<SamInteractiveStudioProps> = ({
  files,
  activeFile,
  bgModel,
  outputFormat,
  vectorizeEnabled,
  onSelectFile,
  onPointsChange,
  onUpdatePreview,
  onVectorizeSingle,
  onDownload,
}) => {
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

  return (
    <Card variant="elevated" padding="md">
      <CardHeader>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '12px',
            width: '100%',
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
                fontSize: '1rem',
                fontWeight: 700,
                color: 'var(--ptech-text-primary)',
              }}
            >
              Estudio Interactivo SAM (Preserve / Delete)
            </span>
            <Chip
              label={`${positiveCount} Preserve (+) · ${negativeCount} Delete (−)`}
              color="primary"
              variant="soft"
            />
            {activeFile.pointsDirty && (
              <Chip
                label="Puntos listos · Presioná Generar Preview"
                color="warning"
                variant="soft"
              />
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              flexWrap: 'wrap',
            }}
          >
            <Button
              variant="primary"
              size="sm"
              glow
              isLoading={activeFile.status === 'processing'}
              leftIcon={<Eye size={15} />}
              onClick={onUpdatePreview}
            >
              {activeFile.result ? 'Actualizar Preview' : 'Generar Preview'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              isLoading={activeFile.status === 'processing'}
              leftIcon={<PenTool size={15} />}
              onClick={onVectorizeSingle}
            >
              Calcar Vector SVG
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* File Switcher Strip when multiple images are in the queue */}
          {files.length > 1 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexWrap: 'wrap',
                paddingBottom: '8px',
                borderBottom: '1px solid var(--ptech-border-subtle)',
              }}
            >
              {files.map((item) => {
                const isSelected = item.id === activeFile.id;
                return (
                  <Button
                    key={item.id}
                    variant={isSelected ? 'primary' : 'outline'}
                    size="sm"
                    onClick={() => onSelectFile(item.id)}
                  >
                    {item.file.name} ({item.pickerPoints.length} pts)
                  </Button>
                );
              })}
            </div>
          )}

          {/* Dual Workspace: Left = PTech ImagePointPicker (Preserve/Delete/Undo/Redo), Right = On-Demand Preview */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
              gap: '20px',
              alignItems: 'stretch',
            }}
          >
            {/* Left Panel: PTech ImagePointPicker */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: 0,
              }}
            >
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  color: 'var(--ptech-text-secondary)',
                }}
              >
                1. SELECCIÓN DE PUNTOS (PRESERVE / DELETE / UNDO / REDO)
              </span>

              <div style={{ flex: 1, minWidth: 0 }}>
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
            </div>

            {/* Right Panel: On-Demand Segmentation / Vector Preview */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}
              >
                <span
                  style={{
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    color: 'var(--ptech-text-secondary)',
                  }}
                >
                  2. VISTA PREVIA DE RESULTADO ({outExt})
                </span>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                  }}
                >
                  {activeFile.durationMs && (
                    <Chip
                      label={`${activeFile.durationMs} ms`}
                      icon={<Clock size={12} />}
                      color="default"
                      variant="outline"
                    />
                  )}
                  {activeFile.processedSize && (
                    <Chip
                      label={`${formatBytes(
                        activeFile.originalSize
                      )} → ${formatBytes(activeFile.processedSize)}`}
                      color="success"
                      variant="soft"
                    />
                  )}
                  {activeFile.result && (
                    <Button
                      variant="primary"
                      size="sm"
                      leftIcon={<Download size={14} />}
                      onClick={() => onDownload(activeFile)}
                    >
                      Descargar {outExt}
                    </Button>
                  )}
                </div>
              </div>

              <div
                className="checkerboard"
                style={{
                  flex: 1,
                  minHeight: '360px',
                  borderRadius: 'var(--ptech-radius-lg, 8px)',
                  border: '1px solid var(--ptech-border-default)',
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
                    }}
                  >
                    <Progress variant="circular" size="md" />
                    <span
                      style={{
                        fontSize: '0.82rem',
                        color: 'var(--ptech-text-secondary)',
                      }}
                    >
                      Ejecutando SAM Interactivo...
                    </span>
                  </div>
                ) : activeFile.result ? (
                  <Image
                    src={activeFile.result}
                    alt="Vista previa procesada"
                    width="100%"
                    height="100%"
                    objectFit="contain"
                    style={{ maxHeight: '420px' }}
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
                    }}
                  >
                    <Sparkles size={28} />
                    <span
                      style={{
                        fontSize: '0.85rem',
                        color: 'var(--ptech-text-secondary)',
                        lineHeight: 1.45,
                      }}
                    >
                      Marcá todos los puntos <strong>Preserve (+)</strong> o{' '}
                      <strong>Delete (−)</strong> que necesites en el lienzo
                      izquierdo y luego presioná el botón para generar el
                      preview.
                    </span>
                    <Button
                      variant="primary"
                      size="sm"
                      glow
                      leftIcon={<Eye size={15} />}
                      onClick={onUpdatePreview}
                    >
                      Generar Preview
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

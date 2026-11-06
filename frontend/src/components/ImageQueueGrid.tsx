import React from 'react';
import { Button, type FileError } from '@ptech/designsystem/inputs';
import { Card, CardContent, Chip } from '@ptech/designsystem/datadisplay';
import { Progress } from '@ptech/designsystem/feedback';
import { Image } from '@ptech/designsystem/media';
import {
  Clock,
  Download,
  MonitorPlay,
  PenTool,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { UploadDropzone } from './UploadDropzone';
import {
  formatBytes,
  getExtensionFromMime,
} from '../constants/processorOptions';
import type { ImageQueueItem, OutputFormatId } from '../types/imageProcessor';

export interface ImageQueueGridProps {
  files: ImageQueueItem[];
  selectedFileId: string | null;
  isInteractiveModel: boolean;
  outputFormat: OutputFormatId;
  vectorizeEnabled: boolean;
  onFilesAdded: (files: File[]) => void;
  onInvalidFiles: (errors: FileError[]) => void;
  onOpenInStage: (id: string) => void;
  onProcessSingle: (item: ImageQueueItem) => void;
  onVectorizeSingle: (item: ImageQueueItem) => void;
  onDownloadSingle: (item: ImageQueueItem) => void;
  onRemoveSingle: (id: string) => void;
  onClearAll: () => void;
}

export const ImageQueueGrid: React.FC<ImageQueueGridProps> = ({
  files,
  selectedFileId,
  isInteractiveModel,
  outputFormat,
  vectorizeEnabled,
  onFilesAdded,
  onInvalidFiles,
  onOpenInStage,
  onProcessSingle,
  onVectorizeSingle,
  onDownloadSingle,
  onRemoveSingle,
  onClearAll,
}) => {
  return (
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Top Batch Upload & Summary Bar */}
      <UploadDropzone
        onFilesAdded={onFilesAdded}
        onInvalidFiles={onInvalidFiles}
        compact={files.length > 0}
      />

      {files.length > 0 && (
        <>
          {/* Gallery Header */}
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
              <h3
                style={{
                  fontSize: '0.98rem',
                  fontWeight: 700,
                  margin: 0,
                  color: 'var(--ptech-text-primary)',
                }}
              >
                Cuadrícula de Procesamiento por Lote ({files.length})
              </h3>
              <Chip
                label={`${
                  files.filter((f) => f.status === 'completed').length
                } completadas`}
                color="success"
                variant="soft"
              />
            </div>

            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Trash2 size={14} />}
              onClick={onClearAll}
            >
              Vaciar Cola
            </Button>
          </div>

          {/* Responsive Visual Cards Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
              gap: '16px',
            }}
          >
            {files.map((item) => {
              const isSelected = item.id === selectedFileId;
              const inputExt =
                item.file.name.split('.').pop()?.toUpperCase() || 'IMG';
              const outExt = getExtensionFromMime(
                item.resultMime,
                vectorizeEnabled ? 'svg' : outputFormat
              ).toUpperCase();

              const savedPct =
                item.originalSize &&
                item.processedSize &&
                item.processedSize < item.originalSize
                  ? Math.round(
                      (1 - item.processedSize / item.originalSize) * 100
                    )
                  : null;

              const posCount = item.pickerPoints.filter(
                (p) => p.type === 'positive'
              ).length;
              const negCount = item.pickerPoints.filter(
                (p) => p.type === 'negative'
              ).length;

              return (
                <Card
                  key={item.id}
                  variant={isSelected ? 'glow' : 'elevated'}
                  padding="md"
                >
                  <CardContent>
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                      }}
                    >
                      {/* Top Bar: Filename + Remove Button */}
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
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            color: 'var(--ptech-text-primary)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.file.name}
                        </span>

                        <Button
                          variant="ghost"
                          size="sm"
                          leftIcon={<X size={14} />}
                          onClick={() => onRemoveSingle(item.id)}
                          aria-label="Quitar imagen"
                        />
                      </div>

                      {/* Side-by-Side Comparison Viewport */}
                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '10px',
                        }}
                      >
                        {/* Original Viewport */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: 'var(--ptech-text-secondary)',
                            }}
                          >
                            ORIGINAL ({inputExt}) ·{' '}
                            {formatBytes(item.originalSize)}
                          </span>
                          <div
                            style={{
                              height: '165px',
                              borderRadius: 'var(--ptech-radius-md, 6px)',
                              border: '1px solid var(--ptech-border-default)',
                              overflow: 'hidden',
                              backgroundColor: 'var(--ptech-surface-elevated)',
                            }}
                          >
                            <Image
                              src={item.preview}
                              alt={item.file.name}
                              width="100%"
                              height="100%"
                              objectFit="contain"
                            />
                          </div>
                        </div>

                        {/* Result Viewport */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '4px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 600,
                              color: 'var(--ptech-text-secondary)',
                            }}
                          >
                            SALIDA ({outExt})
                            {item.processedSize
                              ? ` · ${formatBytes(item.processedSize)}`
                              : ''}
                          </span>
                          <div
                            className="checkerboard"
                            style={{
                              height: '165px',
                              borderRadius: 'var(--ptech-radius-md, 6px)',
                              border: '1px solid var(--ptech-border-default)',
                              overflow: 'hidden',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {item.status === 'completed' && item.result ? (
                              <Image
                                src={item.result}
                                alt="Resultado procesado"
                                width="100%"
                                height="100%"
                                objectFit="contain"
                              />
                            ) : item.status === 'processing' ? (
                              <Progress variant="circular" size="sm" />
                            ) : item.status === 'error' ? (
                              <Chip
                                label="Error"
                                color="error"
                                variant="soft"
                              />
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.74rem',
                                  color: 'var(--ptech-text-muted)',
                                }}
                              >
                                Listo para procesar
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Status Chips & Action Footer */}
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
                          {item.status === 'completed' && (
                            <Chip
                              label={outExt}
                              color="success"
                              variant="soft"
                            />
                          )}
                          {savedPct !== null && (
                            <Chip
                              label={`−${savedPct}%`}
                              color="primary"
                              variant="soft"
                            />
                          )}
                          {item.durationMs && (
                            <Chip
                              label={`${item.durationMs} ms`}
                              icon={<Clock size={11} />}
                              color="default"
                              variant="outline"
                            />
                          )}
                          {(posCount > 0 || negCount > 0) && (
                            <Chip
                              label={`+${posCount} / −${negCount}`}
                              color="default"
                              variant="outline"
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
                          <Button
                            variant="outline"
                            size="sm"
                            leftIcon={<MonitorPlay size={13} />}
                            onClick={() => onOpenInStage(item.id)}
                          >
                            {isInteractiveModel ? 'Puntos SAM' : 'Abrir Lienzo'}
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            isLoading={item.status === 'processing'}
                            leftIcon={<Sparkles size={13} />}
                            onClick={() => onProcessSingle(item)}
                          >
                            Procesar
                          </Button>

                          <Button
                            variant="secondary"
                            size="sm"
                            isLoading={item.status === 'processing'}
                            leftIcon={<PenTool size={13} />}
                            onClick={() => onVectorizeSingle(item)}
                          >
                            SVG
                          </Button>

                          {item.result && (
                            <Button
                              variant="primary"
                              size="sm"
                              leftIcon={<Download size={13} />}
                              onClick={() => onDownloadSingle(item)}
                            >
                              Bajar
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};

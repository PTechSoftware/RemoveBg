import type { Point } from '@ptech/designsystem/tech';

export type BackgroundModelId =
  | 'sam'
  | 'u2net'
  | 'isnet-general-use'
  | 'silueta';

export type ProcessingModeId = 'original' | 'optimized' | 'custom';

export type OutputFormatId = 'auto' | 'png' | 'jpg' | 'svg';

export type CompressionModeId =
  | 'none'
  | 'lossless_fast'
  | 'lossless_balanced'
  | 'lossless_max'
  | 'lossless_zopfli'
  | 'png8_quant';

export type TracePresetId =
  | 'high_fidelity'
  | 'illustration'
  | 'poster'
  | 'bw'
  | 'line_art';

export type TraceCurveModeId = 'spline' | 'polygon' | 'pixel';

export type FileStatus = 'pending' | 'processing' | 'completed' | 'error';

export interface ImageQueueItem {
  id: string;
  file: File;
  preview: string;
  status: FileStatus;
  result: string | null;
  resultBlob: Blob | null;
  resultMime: string | null;
  originalSize: number;
  processedSize: number | null;
  /** Interactive points from @ptech/designsystem ImagePointPicker (xPercent: 0..100, yPercent: 0..100, type: 'positive' | 'negative') */
  pickerPoints: Point[];
  /** True when interactive points have been modified and are waiting for the user to click Preview */
  pointsDirty?: boolean;
  /** Last processing duration in milliseconds */
  durationMs?: number | null;
}

export interface ProcessorSettings {
  mode: ProcessingModeId;
  width: number;
  height: number;
  upscaleEnabled: boolean;
  upscaleFactor: 2 | 3 | 4;
  upscaleDeblur: number;
  upscaleDenoise: number;
  removeBackground: boolean;
  bgModel: BackgroundModelId;
  samIncludeCardboard: boolean;
  samMaxOffsetPx: number;
  samColorTolerance: number;
  autoPreviewSam: boolean;
  sobelRefinement: boolean;
  beautify: boolean;
  autoCrop: boolean;
  brightness: number;
  saturation: number;
  sharpness: number;
  outputFormat: OutputFormatId;
  compressionMode: CompressionModeId;
  jpgQuality: number;
  jpgBackground: string;
  vectorizeEnabled: boolean;
  tracePreset: TracePresetId;
  traceCurveMode: TraceCurveModeId;
  traceColorPrecision: number;
  traceFilterSpeckle: number;
  traceCornerThreshold: number;
  traceLengthThreshold: number;
  traceSpliceThreshold: number;
  tracePathPrecision: number;
  traceLayerDifference: number;
  traceCutout: boolean;
  traceStrokeEnabled: boolean;
  traceStrokeWidth: number;
  traceStrokeColorAuto: boolean;
  traceStrokeColorHex: string;
  traceFillEnabled: boolean;
  traceIgnoreColorEnabled: boolean;
  traceIgnoreColorAuto: boolean;
  traceIgnoreColorHex: string;
  traceIgnoreTolerance: number;
}

export interface PresetConfig {
  id: string;
  name: string;
  badge: string;
  description: string;
  isBuiltIn: boolean;
  settings: ProcessorSettings;
}

export interface ModelOptionMeta {
  id: BackgroundModelId;
  name: string;
  category: 'simple' | 'interactive';
  badge: string;
  description: string;
}

export interface CompressionOptionMeta {
  id: CompressionModeId;
  name: string;
  isLossless: boolean;
  description: string;
}

export interface TracePresetMeta {
  id: TracePresetId;
  name: string;
  description: string;
}

import type {
  CompressionOptionMeta,
  ModelOptionMeta,
  OutputFormatId,
  PresetConfig,
  TracePresetMeta,
} from '../types/imageProcessor';

export const STORAGE_KEYS = {
  ALL_PRESETS: 'removebg_presets_crud_v2',
  CUSTOM_PRESETS: 'removebg_custom_presets_v1',
  DEFAULT_PRESET_ID: 'removebg_default_preset_id_v1',
} as const;

export const AI_MODELS: ModelOptionMeta[] = [
  {
    id: 'u2net',
    name: 'U2NET · Estándar Rápido (Lote)',
    category: 'simple',
    badge: 'Simple · ~120ms CPU',
    description:
      'Carga y procesa en lote directamente con aceleración AVX2 en Intel i7-12700.',
  },
  {
    id: 'isnet-general-use',
    name: 'ISNet General · Bordes Finos (Lote)',
    category: 'simple',
    badge: 'Simple · Alta Precisión',
    description:
      'Excelente para contornos complejos y productos comerciales sin requerir puntos manuales.',
  },
  {
    id: 'silueta',
    name: 'Silueta · Ultra Liviano (Lote)',
    category: 'simple',
    badge: 'Simple · ~65ms CPU',
    description:
      'El modelo más veloz (42 MB) para procesamiento masivo instantáneo.',
  },
  {
    id: 'sam',
    name: 'SAM (Segment Anything Interactivo)',
    category: 'interactive',
    badge: 'Interactivo · Puntos & Redo',
    description:
      'Segmentación interactiva con selección manual de puntos Preserve (+), Delete (−), Undo/Redo y vista previa a demanda.',
  },
];

export const AI_MODEL_SELECT_OPTIONS = AI_MODELS.map((m) => ({
  value: m.id,
  label: m.name,
}));

export const COMPRESSION_OPTIONS: CompressionOptionMeta[] = [
  {
    id: 'lossless_fast',
    name: 'Lossless Rápido (OxiPNG Nivel 1 + Clean Alpha)',
    isLossless: true,
    description:
      '100% sin pérdida visual ni de datos. Limpia píxeles transparentes y comprime en ~15ms multi-hilo.',
  },
  {
    id: 'lossless_balanced',
    name: 'Lossless Equilibrado (OxiPNG Nivel 2 Multi-Core)',
    isLossless: true,
    description:
      '100% sin pérdida. Balance óptimo entre velocidad en CPU multi-núcleo y reducción de tamaño.',
  },
  {
    id: 'lossless_max',
    name: 'Lossless Máximo (OxiPNG Nivel 5 Exhaustivo)',
    isLossless: true,
    description:
      '100% sin pérdida. Evalúa múltiples combinaciones de filtros PNG con libdeflater.',
  },
  {
    id: 'lossless_zopfli',
    name: 'Lossless Ultra Zopfli (Google Zopfli Deflate)',
    isLossless: true,
    description:
      '100% sin pérdida. Máxima densidad Deflate bit-exacta para archivo final.',
  },
  {
    id: 'png8_quant',
    name: 'PNG-8 Cuantizado Inteligente + OxiPNG (Hasta −70%)',
    isLossless: false,
    description:
      'Paleta adaptativa de 256 colores con dithering perceptual + optimización lossless.',
  },
  {
    id: 'none',
    name: 'Sin Compresión Extra (PNG Rápido Directo)',
    isLossless: true,
    description:
      'Codificación PNG instantánea (~10ms) ideal para previsualización ultrarrápida.',
  },
];

export const COMPRESSION_SELECT_OPTIONS = COMPRESSION_OPTIONS.map((c) => ({
  value: c.id,
  label: c.name,
}));

export const TRACE_PRESETS: TracePresetMeta[] = [
  {
    id: 'high_fidelity',
    name: 'Foto de Alta Fidelidad (Illustrator High Fidelity)',
    description:
      '8 bits de precisión cromática y curvas Spline suaves para máxima fidelidad.',
  },
  {
    id: 'illustration',
    name: 'Ilustración / Logo Color (6-Bit Equilibrado)',
    description:
      'Ideal para convertir productos, insignias e ilustraciones en vectores limpios.',
  },
  {
    id: 'poster',
    name: 'Póster / Colores Planos (Low Fidelity)',
    description:
      'Agrupa regiones en capas cromáticas definidas con pocos nodos.',
  },
  {
    id: 'bw',
    name: 'Blanco y Negro / Silueta (2 Colores)',
    description: 'Calco binario para sellos, esténciles, iconos y logotipos.',
  },
  {
    id: 'line_art',
    name: 'Arte Lineal / Cutout (Sin Solapamiento)',
    description:
      'Trazado jerárquico tipo Cutout donde las formas no se superponen.',
  },
];

export const TRACE_PRESET_SELECT_OPTIONS = TRACE_PRESETS.map((p) => ({
  value: p.id,
  label: p.name,
}));

export const OUTPUT_FORMAT_SELECT_OPTIONS: {
  value: OutputFormatId;
  label: string;
}[] = [
  { value: 'auto', label: 'AUTO (PNG si hay recorte · respeta JPG/PNG)' },
  { value: 'png', label: 'PNG (Transparencia Alfa 32-bit / Lossless)' },
  { value: 'jpg', label: 'JPG / JPEG (Fondo Sólido Configurable)' },
  { value: 'svg', label: 'SVG Vectorial (Calco de Imagen Illustrator)' },
];

export const MODE_SELECT_OPTIONS = [
  { value: 'original', label: 'Original (1:1 Nativo)' },
  { value: 'optimized', label: 'Catálogo Web (Máx 500px)' },
  { value: 'custom', label: 'Dimensiones Personalizadas (W × H)' },
];

export const UPSCALE_FACTOR_OPTIONS = [
  { value: '2', label: '2x Super-Resolución (Doble Tamaño · Rápido)' },
  { value: '3', label: '3x Super-Resolución (Triple Tamaño · Alta Densidad)' },
  { value: '4', label: '4x Ultra-HD (Cuádruple Tamaño · Máx 3840px)' },
];

export const JPG_BG_SELECT_OPTIONS = [
  { value: '#ffffff', label: 'Blanco Puro (#FFFFFF)' },
  { value: '#f8fafc', label: 'Gris Estudio Claro (#F8FAFC)' },
  { value: '#0f172a', label: 'Oscuro Pizarra (#0F172A)' },
  { value: '#000000', label: 'Negro Puro (#000000)' },
];

export const TRACE_IGNORE_COLOR_OPTIONS = [
  { value: 'auto', label: 'Auto-detectar Color de Fondo / Borde' },
  { value: '#ffffff', label: 'Omitir Blanco (#FFFFFF)' },
  { value: '#f8fafc', label: 'Omitir Gris Claro (#F8FAFC)' },
  { value: '#000000', label: 'Omitir Negro (#000000)' },
  { value: 'custom', label: 'Color Personalizado (Selector / Hex)' },
];

export const TRACE_CURVE_MODE_OPTIONS = [
  {
    value: 'spline',
    label: 'Curvas Bézier Suaves (Spline · Illustrator)',
  },
  {
    value: 'polygon',
    label: 'Poligonal / Líneas Rectas (Nodos Geométricos)',
  },
  {
    value: 'pixel',
    label: 'Píxel Exacto (Escalones Ortogonales)',
  },
];

export const TRACE_STROKE_STYLE_OPTIONS = [
  { value: 'fill_only', label: 'Solo Relleno Vectorial (fill)' },
  {
    value: 'fill_and_stroke',
    label: 'Relleno + Línea de Trazo (fill + stroke)',
  },
  {
    value: 'stroke_only',
    label: 'Solo Contorno de Trazo / Lineal (stroke, sin relleno)',
  },
];

export const TRACE_STROKE_COLOR_OPTIONS = [
  { value: 'auto', label: 'Mismo Color del Relleno (Sellar Uniones)' },
  { value: '#0f172a', label: 'Tinta Oscura (#0F172A)' },
  { value: '#000000', label: 'Negro Puro (#000000)' },
  { value: '#ffffff', label: 'Blanco (#FFFFFF)' },
  { value: 'custom', label: 'Color de Trazo Personalizado (Hex)' },
];

/**
 * Curated Built-in Preset Configurations ("Configuraciones Preseleccionadas")
 */
export const BUILT_IN_PRESETS: PresetConfig[] = [
  {
    id: 'preset_ecommerce_fast',
    name: '⚡ E-Commerce Turbo (i7)',
    badge: 'Lote Rápido · ~120ms',
    description:
      'Recorte directo U2NET + Auto-Crop cuadrado + PNG Lossless Rápido. Ideal para procesar lotes sin demora.',
    isBuiltIn: true,
    settings: {
      mode: 'original',
      width: 1920,
      height: 1080,
      upscaleEnabled: false,
      upscaleFactor: 2,
      upscaleDeblur: 70,
      upscaleDenoise: 45,
      removeBackground: true,
      bgModel: 'u2net',
      samIncludeCardboard: false,
      samMaxOffsetPx: 160,
      samColorTolerance: 24,
      autoPreviewSam: true,
      sobelRefinement: true,
      beautify: false,
      autoCrop: true,
      brightness: 1,
      saturation: 1,
      sharpness: 1,
      outputFormat: 'png',
      compressionMode: 'lossless_fast',
      jpgQuality: 95,
      jpgBackground: '#ffffff',
      vectorizeEnabled: false,
      tracePreset: 'illustration',
      traceCurveMode: 'spline',
      traceColorPrecision: 6,
      traceFilterSpeckle: 10,
      traceCornerThreshold: 60,
      traceLengthThreshold: 4.5,
      traceSpliceThreshold: 45,
      tracePathPrecision: 2,
      traceLayerDifference: 20,
      traceCutout: false,
      traceStrokeEnabled: false,
      traceStrokeWidth: 1.5,
      traceStrokeColorAuto: true,
      traceStrokeColorHex: '#0f172a',
      traceFillEnabled: true,
      traceIgnoreColorEnabled: true,
      traceIgnoreColorAuto: true,
      traceIgnoreColorHex: '#ffffff',
      traceIgnoreTolerance: 28,
    },
  },
  {
    id: 'preset_upscale_hd_deblur',
    name: '🔍 Scale Up HD · Anti-Borroso (2x)',
    badge: 'Super-Res 2x · Sin Blur',
    description:
      'Escala imágenes chicas al doble (2x), limpia bloques JPEG y reconstruye bordes borrosos sin halos blancos.',
    isBuiltIn: true,
    settings: {
      mode: 'original',
      width: 1920,
      height: 1080,
      upscaleEnabled: true,
      upscaleFactor: 2,
      upscaleDeblur: 78,
      upscaleDenoise: 50,
      removeBackground: true,
      bgModel: 'isnet-general-use',
      samIncludeCardboard: false,
      samMaxOffsetPx: 160,
      samColorTolerance: 24,
      autoPreviewSam: true,
      sobelRefinement: true,
      beautify: false,
      autoCrop: false,
      brightness: 1,
      saturation: 1.05,
      sharpness: 1,
      outputFormat: 'png',
      compressionMode: 'lossless_fast',
      jpgQuality: 96,
      jpgBackground: '#ffffff',
      vectorizeEnabled: false,
      tracePreset: 'illustration',
      traceCurveMode: 'spline',
      traceColorPrecision: 6,
      traceFilterSpeckle: 10,
      traceCornerThreshold: 60,
      traceLengthThreshold: 4.5,
      traceSpliceThreshold: 45,
      tracePathPrecision: 2,
      traceLayerDifference: 20,
      traceCutout: false,
      traceStrokeEnabled: false,
      traceStrokeWidth: 1.5,
      traceStrokeColorAuto: true,
      traceStrokeColorHex: '#0f172a',
      traceFillEnabled: true,
      traceIgnoreColorEnabled: true,
      traceIgnoreColorAuto: true,
      traceIgnoreColorHex: '#ffffff',
      traceIgnoreTolerance: 28,
    },
  },
  {
    id: 'preset_sam_studio',
    name: '🎯 Estudio Interactivo SAM',
    badge: 'Interactivo · Puntos',
    description:
      'Segmentación interactiva SAM con selección manual de superficies Preserve (+), Delete (−), Undo/Redo y preview por botón.',
    isBuiltIn: true,
    settings: {
      mode: 'original',
      width: 1920,
      height: 1080,
      upscaleEnabled: false,
      upscaleFactor: 2,
      upscaleDeblur: 70,
      upscaleDenoise: 45,
      removeBackground: true,
      bgModel: 'sam',
      samIncludeCardboard: false,
      samMaxOffsetPx: 160,
      samColorTolerance: 24,
      autoPreviewSam: false,
      sobelRefinement: true,
      beautify: false,
      autoCrop: false,
      brightness: 1,
      saturation: 1,
      sharpness: 1,
      outputFormat: 'auto',
      compressionMode: 'lossless_fast',
      jpgQuality: 95,
      jpgBackground: '#ffffff',
      vectorizeEnabled: false,
      tracePreset: 'illustration',
      traceCurveMode: 'spline',
      traceColorPrecision: 6,
      traceFilterSpeckle: 10,
      traceCornerThreshold: 60,
      traceLengthThreshold: 4.5,
      traceSpliceThreshold: 45,
      tracePathPrecision: 2,
      traceLayerDifference: 20,
      traceCutout: false,
      traceStrokeEnabled: false,
      traceStrokeWidth: 1.5,
      traceStrokeColorAuto: true,
      traceStrokeColorHex: '#0f172a',
      traceFillEnabled: true,
      traceIgnoreColorEnabled: true,
      traceIgnoreColorAuto: true,
      traceIgnoreColorHex: '#ffffff',
      traceIgnoreTolerance: 28,
    },
  },
  {
    id: 'preset_illustrator_svg',
    name: '✒️ Calco Vectorial SVG',
    badge: 'Adobe Image Trace',
    description:
      'Quita el fondo, omite el color de fondo residual, limpia el ruido de bordes y convierte la imagen en vectores SVG.',
    isBuiltIn: true,
    settings: {
      mode: 'original',
      width: 1920,
      height: 1080,
      upscaleEnabled: false,
      upscaleFactor: 2,
      upscaleDeblur: 70,
      upscaleDenoise: 45,
      removeBackground: true,
      bgModel: 'u2net',
      samIncludeCardboard: false,
      samMaxOffsetPx: 160,
      samColorTolerance: 24,
      autoPreviewSam: true,
      sobelRefinement: true,
      beautify: false,
      autoCrop: true,
      brightness: 1,
      saturation: 1,
      sharpness: 1,
      outputFormat: 'svg',
      compressionMode: 'lossless_fast',
      jpgQuality: 95,
      jpgBackground: '#ffffff',
      vectorizeEnabled: true,
      tracePreset: 'illustration',
      traceCurveMode: 'spline',
      traceColorPrecision: 6,
      traceFilterSpeckle: 10,
      traceCornerThreshold: 60,
      traceLengthThreshold: 4.5,
      traceSpliceThreshold: 45,
      tracePathPrecision: 2,
      traceLayerDifference: 20,
      traceCutout: false,
      traceStrokeEnabled: false,
      traceStrokeWidth: 1.5,
      traceStrokeColorAuto: true,
      traceStrokeColorHex: '#0f172a',
      traceFillEnabled: true,
      traceIgnoreColorEnabled: true,
      traceIgnoreColorAuto: true,
      traceIgnoreColorHex: '#ffffff',
      traceIgnoreTolerance: 28,
    },
  },
  {
    id: 'preset_web_catalog_light',
    name: '📦 Catálogo Web Liviano',
    badge: 'PNG-8 · 500px',
    description:
      'Modelo ISNet de bordes finos + escalado 500px + embellecedor de color + compresión PNG-8 (−70% peso).',
    isBuiltIn: true,
    settings: {
      mode: 'optimized',
      width: 500,
      height: 500,
      upscaleEnabled: false,
      upscaleFactor: 2,
      upscaleDeblur: 70,
      upscaleDenoise: 45,
      removeBackground: true,
      bgModel: 'isnet-general-use',
      samIncludeCardboard: false,
      samMaxOffsetPx: 160,
      samColorTolerance: 24,
      autoPreviewSam: true,
      sobelRefinement: true,
      beautify: true,
      autoCrop: true,
      brightness: 1,
      saturation: 1,
      sharpness: 1,
      outputFormat: 'png',
      compressionMode: 'png8_quant',
      jpgQuality: 92,
      jpgBackground: '#ffffff',
      vectorizeEnabled: false,
      tracePreset: 'illustration',
      traceCurveMode: 'spline',
      traceColorPrecision: 6,
      traceFilterSpeckle: 10,
      traceCornerThreshold: 60,
      traceLengthThreshold: 4.5,
      traceSpliceThreshold: 45,
      tracePathPrecision: 2,
      traceLayerDifference: 20,
      traceCutout: false,
      traceStrokeEnabled: false,
      traceStrokeWidth: 1.5,
      traceStrokeColorAuto: true,
      traceStrokeColorHex: '#0f172a',
      traceFillEnabled: true,
      traceIgnoreColorEnabled: true,
      traceIgnoreColorAuto: true,
      traceIgnoreColorHex: '#ffffff',
      traceIgnoreTolerance: 28,
    },
  },
  {
    id: 'preset_jpg_marketplace',
    name: '🖼️ Foto Producto JPG Blanco',
    badge: 'JPG Fondo Blanco',
    description:
      'Recorta el fondo y exporta en formato JPG de alta calidad (96%) sobre lienzo blanco puro cuadrado.',
    isBuiltIn: true,
    settings: {
      mode: 'original',
      width: 1920,
      height: 1080,
      upscaleEnabled: false,
      upscaleFactor: 2,
      upscaleDeblur: 70,
      upscaleDenoise: 45,
      removeBackground: true,
      bgModel: 'u2net',
      samIncludeCardboard: false,
      samMaxOffsetPx: 160,
      samColorTolerance: 24,
      autoPreviewSam: true,
      sobelRefinement: true,
      beautify: true,
      autoCrop: true,
      brightness: 1,
      saturation: 1,
      sharpness: 1,
      outputFormat: 'jpg',
      compressionMode: 'lossless_balanced',
      jpgQuality: 96,
      jpgBackground: '#ffffff',
      vectorizeEnabled: false,
      tracePreset: 'illustration',
      traceCurveMode: 'spline',
      traceColorPrecision: 6,
      traceFilterSpeckle: 10,
      traceCornerThreshold: 60,
      traceLengthThreshold: 4.5,
      traceSpliceThreshold: 45,
      tracePathPrecision: 2,
      traceLayerDifference: 20,
      traceCutout: false,
      traceStrokeEnabled: false,
      traceStrokeWidth: 1.5,
      traceStrokeColorAuto: true,
      traceStrokeColorHex: '#0f172a',
      traceFillEnabled: true,
      traceIgnoreColorEnabled: true,
      traceIgnoreColorAuto: true,
      traceIgnoreColorHex: '#ffffff',
      traceIgnoreTolerance: 28,
    },
  },
];

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getExtensionFromMime(
  mime: string | null | undefined,
  fallbackFormat: OutputFormatId
): string {
  if (mime?.includes('svg')) return 'svg';
  if (mime?.includes('jpeg') || mime?.includes('jpg')) return 'jpg';
  if (mime?.includes('png')) return 'png';
  if (fallbackFormat === 'svg') return 'svg';
  if (fallbackFormat === 'jpg') return 'jpg';
  return 'png';
}

import React, { useState, useCallback, useMemo } from 'react';
import JSZip from 'jszip';
import { ThemeProvider } from '@ptech/designsystem/theme';
import {
  NotificationProvider,
  useNotification,
} from '@ptech/designsystem/feedback';
import type { FileError } from '@ptech/designsystem/inputs';
import type { Point } from '@ptech/designsystem/tech';
import { HeaderBar, type StudioViewMode } from './components/HeaderBar';
import { SettingsSidebar } from './components/SettingsSidebar';
import { StudioMainStage } from './components/StudioMainStage';
import { ImageQueueGrid } from './components/ImageQueueGrid';
import { PresetCrudManager } from './components/PresetCrudManager';
import {
  BUILT_IN_PRESETS,
  STORAGE_KEYS,
  getExtensionFromMime,
} from './constants/processorOptions';
import type {
  ImageQueueItem,
  PresetConfig,
  ProcessorSettings,
  TracePresetId,
} from './types/imageProcessor';

function normalizePresetSettings(s: ProcessorSettings): ProcessorSettings {
  return {
    ...s,
    upscaleEnabled: s.upscaleEnabled ?? false,
    upscaleFactor: s.upscaleFactor ?? 2,
    upscaleDeblur: s.upscaleDeblur ?? 70,
    upscaleDenoise: s.upscaleDenoise ?? 45,
    samMaxOffsetPx: s.samMaxOffsetPx ?? 160,
    samColorTolerance: s.samColorTolerance ?? 24,
    traceCurveMode: s.traceCurveMode ?? 'spline',
    traceFilterSpeckle: s.traceFilterSpeckle ?? 10,
    traceLengthThreshold: s.traceLengthThreshold ?? 4.5,
    traceSpliceThreshold: s.traceSpliceThreshold ?? 45,
    tracePathPrecision: s.tracePathPrecision ?? 2,
    traceStrokeEnabled: s.traceStrokeEnabled ?? false,
    traceStrokeWidth: s.traceStrokeWidth ?? 1.5,
    traceStrokeColorAuto: s.traceStrokeColorAuto ?? true,
    traceStrokeColorHex: s.traceStrokeColorHex ?? '#0f172a',
    traceFillEnabled: s.traceFillEnabled ?? true,
    traceIgnoreColorEnabled: s.traceIgnoreColorEnabled ?? true,
    traceIgnoreColorAuto: s.traceIgnoreColorAuto ?? true,
    traceIgnoreColorHex: s.traceIgnoreColorHex ?? '#ffffff',
    traceIgnoreTolerance: s.traceIgnoreTolerance ?? 28,
  };
}

function loadAllPresets(): PresetConfig[] {
  try {
    const rawV2 = localStorage.getItem(STORAGE_KEYS.ALL_PRESETS);
    if (rawV2) {
      const parsed = JSON.parse(rawV2);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((p: PresetConfig) => ({
          ...p,
          settings: normalizePresetSettings(p.settings),
        }));
      }
    }
    // Migrate legacy custom presets if present
    const rawLegacy = localStorage.getItem(STORAGE_KEYS.CUSTOM_PRESETS);
    if (rawLegacy) {
      const legacyCustom = JSON.parse(rawLegacy);
      if (Array.isArray(legacyCustom) && legacyCustom.length > 0) {
        const merged = [...BUILT_IN_PRESETS, ...legacyCustom].map(
          (p: PresetConfig) => ({
            ...p,
            settings: normalizePresetSettings(p.settings),
          })
        );
        localStorage.setItem(STORAGE_KEYS.ALL_PRESETS, JSON.stringify(merged));
        return merged;
      }
    }
  } catch {
    // ignore storage errors
  }
  return [...BUILT_IN_PRESETS];
}

function saveAllPresets(presets: PresetConfig[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.ALL_PRESETS, JSON.stringify(presets));
  } catch {
    // ignore storage errors
  }
}

function loadDefaultPresetId(presets: PresetConfig[]): string {
  try {
    const savedId = localStorage.getItem(STORAGE_KEYS.DEFAULT_PRESET_ID);
    if (savedId && presets.some((p) => p.id === savedId)) {
      return savedId;
    }
  } catch {
    // ignore storage errors
  }
  return presets[0]?.id || BUILT_IN_PRESETS[0].id;
}

function areSettingsEqual(a: ProcessorSettings, b: ProcessorSettings): boolean {
  return (
    a.mode === b.mode &&
    a.width === b.width &&
    a.height === b.height &&
    a.upscaleEnabled === b.upscaleEnabled &&
    a.upscaleFactor === b.upscaleFactor &&
    a.upscaleDeblur === b.upscaleDeblur &&
    a.upscaleDenoise === b.upscaleDenoise &&
    a.removeBackground === b.removeBackground &&
    a.bgModel === b.bgModel &&
    a.samIncludeCardboard === b.samIncludeCardboard &&
    a.samMaxOffsetPx === b.samMaxOffsetPx &&
    a.samColorTolerance === b.samColorTolerance &&
    a.sobelRefinement === b.sobelRefinement &&
    a.beautify === b.beautify &&
    a.autoCrop === b.autoCrop &&
    a.brightness === b.brightness &&
    a.saturation === b.saturation &&
    a.sharpness === b.sharpness &&
    a.outputFormat === b.outputFormat &&
    a.compressionMode === b.compressionMode &&
    a.jpgQuality === b.jpgQuality &&
    a.jpgBackground === b.jpgBackground &&
    a.vectorizeEnabled === b.vectorizeEnabled &&
    a.tracePreset === b.tracePreset &&
    a.traceCurveMode === b.traceCurveMode &&
    a.traceColorPrecision === b.traceColorPrecision &&
    a.traceFilterSpeckle === b.traceFilterSpeckle &&
    a.traceCornerThreshold === b.traceCornerThreshold &&
    a.traceLengthThreshold === b.traceLengthThreshold &&
    a.traceSpliceThreshold === b.traceSpliceThreshold &&
    a.tracePathPrecision === b.tracePathPrecision &&
    a.traceLayerDifference === b.traceLayerDifference &&
    a.traceCutout === b.traceCutout &&
    a.traceStrokeEnabled === b.traceStrokeEnabled &&
    a.traceStrokeWidth === b.traceStrokeWidth &&
    a.traceStrokeColorAuto === b.traceStrokeColorAuto &&
    a.traceStrokeColorHex === b.traceStrokeColorHex &&
    a.traceFillEnabled === b.traceFillEnabled &&
    a.traceIgnoreColorEnabled === b.traceIgnoreColorEnabled &&
    a.traceIgnoreColorAuto === b.traceIgnoreColorAuto &&
    a.traceIgnoreColorHex === b.traceIgnoreColorHex &&
    a.traceIgnoreTolerance === b.traceIgnoreTolerance
  );
}

function StudioWorkspace() {
  const [presets, setPresets] = useState<PresetConfig[]>(() =>
    loadAllPresets()
  );

  const [defaultPresetId, setDefaultPresetId] = useState<string>(() =>
    loadDefaultPresetId(loadAllPresets())
  );

  const [activePresetId, setActivePresetId] = useState<string | null>(
    () => defaultPresetId
  );

  const [settings, setSettings] = useState<ProcessorSettings>(() => {
    const initial =
      presets.find((p) => p.id === defaultPresetId) ||
      presets[0] ||
      BUILT_IN_PRESETS[0];
    return { ...initial.settings };
  });

  const [activeView, setActiveView] = useState<StudioViewMode>('stage');
  const [files, setFiles] = useState<ImageQueueItem[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [overallProgress, setOverallProgress] = useState(0);

  const { notify } = useNotification();

  const isInteractiveModel =
    settings.removeBackground && settings.bgModel === 'sam';

  const selectedFile =
    files.find((f) => f.id === selectedFileId) || files[0] || null;

  const activePreset = useMemo(
    () => presets.find((p) => p.id === activePresetId) || null,
    [presets, activePresetId]
  );

  const hasUnsavedChanges = useMemo(() => {
    if (!activePreset) return true;
    return !areSettingsEqual(settings, activePreset.settings);
  }, [settings, activePreset]);

  const updateSettings = useCallback((partial: Partial<ProcessorSettings>) => {
    setSettings((prev) => ({ ...prev, ...partial }));
  }, []);

  const handleSelectPreset = useCallback(
    (preset: PresetConfig) => {
      setSettings({ ...preset.settings });
      setActivePresetId(preset.id);
      notify.info('Configuración aplicada', `Se activó "${preset.name}"`);
    },
    [notify]
  );

  const handleSelectPresetById = useCallback(
    (presetId: string) => {
      const target = presets.find((p) => p.id === presetId);
      if (target) {
        handleSelectPreset(target);
      }
    },
    [presets, handleSelectPreset]
  );

  const handleSetDefaultPreset = useCallback(
    (presetId: string) => {
      setDefaultPresetId(presetId);
      try {
        localStorage.setItem(STORAGE_KEYS.DEFAULT_PRESET_ID, presetId);
      } catch {
        // ignore
      }
      const target = presets.find((p) => p.id === presetId);
      notify.success(
        'Configuración Preseleccionada Fijada',
        `"${target?.name || presetId}" se cargará automáticamente al iniciar.`
      );
    },
    [presets, notify]
  );

  // CRUD: CREATE
  const handleCreatePreset = useCallback(
    (newPresetData: Omit<PresetConfig, 'id'>, makeDefault: boolean) => {
      const created: PresetConfig = {
        ...newPresetData,
        id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      };

      setPresets((prev) => {
        const next = [...prev, created];
        saveAllPresets(next);
        return next;
      });

      setActivePresetId(created.id);
      setSettings({ ...created.settings });

      if (makeDefault) {
        setDefaultPresetId(created.id);
        try {
          localStorage.setItem(STORAGE_KEYS.DEFAULT_PRESET_ID, created.id);
        } catch {
          // ignore
        }
      }

      notify.success(
        'Configuración creada',
        `Se creó "${created.name}" correctamente.`
      );
    },
    [notify]
  );

  // CRUD: UPDATE
  const handleUpdatePreset = useCallback(
    (
      presetId: string,
      updatedData: Omit<PresetConfig, 'id'>,
      makeDefault: boolean
    ) => {
      const updatedPreset: PresetConfig = {
        ...updatedData,
        id: presetId,
      };

      setPresets((prev) => {
        const next = prev.map((p) => (p.id === presetId ? updatedPreset : p));
        saveAllPresets(next);
        return next;
      });

      if (activePresetId === presetId) {
        setSettings({ ...updatedPreset.settings });
      }

      if (makeDefault) {
        setDefaultPresetId(presetId);
        try {
          localStorage.setItem(STORAGE_KEYS.DEFAULT_PRESET_ID, presetId);
        } catch {
          // ignore
        }
      }

      notify.success(
        'Configuración actualizada',
        `Se guardaron los cambios en "${updatedPreset.name}".`
      );
    },
    [activePresetId, notify]
  );

  // Quick Save current sidebar settings into the active preset
  const handleSaveToActivePreset = useCallback(() => {
    if (!activePreset) return;
    handleUpdatePreset(
      activePreset.id,
      {
        name: activePreset.name,
        badge: activePreset.badge,
        description: activePreset.description,
        isBuiltIn: activePreset.isBuiltIn,
        settings: { ...settings },
      },
      activePreset.id === defaultPresetId
    );
  }, [activePreset, settings, defaultPresetId, handleUpdatePreset]);

  // Revert current sidebar settings back to active preset
  const handleRevertToActivePreset = useCallback(() => {
    if (!activePreset) return;
    setSettings({ ...activePreset.settings });
    notify.info(
      'Cambios descartados',
      `Se restauraron los valores de "${activePreset.name}".`
    );
  }, [activePreset, notify]);

  // CRUD: DUPLICATE
  const handleDuplicatePreset = useCallback(
    (source: PresetConfig) => {
      const cloned: PresetConfig = {
        id: `preset_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `${source.name} (Copia)`,
        badge: source.badge,
        description: source.description,
        isBuiltIn: false,
        settings: { ...source.settings },
      };

      setPresets((prev) => {
        const next = [...prev, cloned];
        saveAllPresets(next);
        return next;
      });

      setActivePresetId(cloned.id);
      setSettings({ ...cloned.settings });
      notify.success(
        'Configuración clonada',
        `Se creó "${cloned.name}" a partir de "${source.name}".`
      );
    },
    [notify]
  );

  // CRUD: DELETE
  const handleDeletePreset = useCallback(
    (presetId: string) => {
      setPresets((prev) => {
        if (prev.length <= 1) return prev;
        const next = prev.filter((p) => p.id !== presetId);
        saveAllPresets(next);

        const fallback = next[0];
        if (defaultPresetId === presetId && fallback) {
          setDefaultPresetId(fallback.id);
          try {
            localStorage.setItem(STORAGE_KEYS.DEFAULT_PRESET_ID, fallback.id);
          } catch {
            // ignore
          }
        }
        if (activePresetId === presetId && fallback) {
          setActivePresetId(fallback.id);
          setSettings({ ...fallback.settings });
        }

        return next;
      });

      notify.info(
        'Configuración eliminada',
        'La configuración fue eliminada del catálogo.'
      );
    },
    [defaultPresetId, activePresetId, notify]
  );

  // CRUD: RESET FACTORY PRESETS
  const handleResetFactoryPresets = useCallback(() => {
    const customOnly = presets.filter((p) => !p.isBuiltIn);
    const next = [...BUILT_IN_PRESETS, ...customOnly];
    setPresets(next);
    saveAllPresets(next);
    const first = next[0];
    setActivePresetId(first.id);
    setSettings({ ...first.settings });
    notify.success(
      'Presets de fábrica restaurados',
      'Se restauraron las configuraciones predeterminadas del sistema.'
    );
  }, [presets, notify]);

  // CRUD: IMPORT JSON
  const handleImportPresets = useCallback(
    (imported: PresetConfig[]) => {
      const valid = imported.filter(
        (item) => item && item.id && item.name && item.settings
      );
      if (valid.length === 0) {
        notify.error(
          'JSON inválido',
          'El archivo no contiene configuraciones válidas.'
        );
        return;
      }
      setPresets(valid);
      saveAllPresets(valid);
      setActivePresetId(valid[0].id);
      setSettings({ ...valid[0].settings });
      notify.success(
        'Configuraciones importadas',
        `Se cargaron ${valid.length} configuraciones desde el archivo JSON.`
      );
    },
    [notify]
  );

  const handlePresetChange = useCallback((presetId: TracePresetId) => {
    if (presetId === 'high_fidelity') {
      setSettings((prev) => ({
        ...prev,
        tracePreset: presetId,
        traceColorPrecision: 8,
        traceFilterSpeckle: 6,
        traceCornerThreshold: 55,
        traceLayerDifference: 12,
        traceCutout: false,
      }));
    } else if (presetId === 'illustration') {
      setSettings((prev) => ({
        ...prev,
        tracePreset: presetId,
        traceColorPrecision: 6,
        traceFilterSpeckle: 10,
        traceCornerThreshold: 60,
        traceLayerDifference: 18,
        traceCutout: false,
      }));
    } else if (presetId === 'poster') {
      setSettings((prev) => ({
        ...prev,
        tracePreset: presetId,
        traceColorPrecision: 4,
        traceFilterSpeckle: 14,
        traceCornerThreshold: 65,
        traceLayerDifference: 34,
        traceCutout: false,
      }));
    } else if (presetId === 'bw') {
      setSettings((prev) => ({
        ...prev,
        tracePreset: presetId,
        traceColorPrecision: 2,
        traceFilterSpeckle: 10,
        traceCornerThreshold: 60,
        traceLayerDifference: 18,
        traceCutout: false,
      }));
    } else if (presetId === 'line_art') {
      setSettings((prev) => ({
        ...prev,
        tracePreset: presetId,
        traceColorPrecision: 6,
        traceFilterSpeckle: 8,
        traceCornerThreshold: 45,
        traceLayerDifference: 16,
        traceCutout: true,
      }));
    }
  }, []);

  const handleFilesAdded = useCallback(
    (incomingFiles: File[]) => {
      if (incomingFiles.length === 0) return;

      const newItems: ImageQueueItem[] = incomingFiles.map((file) => ({
        id: Math.random().toString(36).substring(2, 10),
        file,
        preview: URL.createObjectURL(file),
        status: 'pending',
        result: null,
        resultBlob: null,
        resultMime: null,
        originalSize: file.size,
        processedSize: null,
        pickerPoints: [],
        durationMs: null,
      }));

      setFiles((prev) => {
        const next = [...prev, ...newItems];
        if (!selectedFileId && next.length > 0) {
          setSelectedFileId(next[0].id);
        }
        return next;
      });
    },
    [selectedFileId]
  );

  const handleInvalidFiles = useCallback(
    (errors: FileError[]) => {
      errors.forEach(({ file, reason }) => {
        notify.error(
          'Archivo no admitido',
          `${file.name}: ${reason}. Usá formatos JPG, PNG o WEBP.`
        );
      });
    },
    [notify]
  );

  const buildFormData = (
    targetFile: ImageQueueItem,
    overridePoints?: Point[] | null,
    forceVectorize?: boolean | null
  ): FormData => {
    const activePoints =
      overridePoints !== undefined && overridePoints !== null
        ? overridePoints
        : targetFile.pickerPoints;

    const isVec =
      forceVectorize !== undefined && forceVectorize !== null
        ? forceVectorize
        : settings.vectorizeEnabled || settings.outputFormat === 'svg';

    const formData = new FormData();
    formData.append('file', targetFile.file);
    formData.append('mode', settings.mode);
    if (settings.mode === 'custom') {
      formData.append('width', String(settings.width));
      formData.append('height', String(settings.height));
    }
    formData.append('upscale_enabled', String(Boolean(settings.upscaleEnabled)));
    formData.append('upscale_factor', String(settings.upscaleFactor ?? 2));
    formData.append('upscale_deblur', String(settings.upscaleDeblur ?? 70));
    formData.append('upscale_denoise', String(settings.upscaleDenoise ?? 45));
    formData.append('beautify', String(settings.beautify));
    formData.append('brightness', String(settings.brightness));
    formData.append('saturation', String(settings.saturation));
    formData.append('sharpness', String(settings.sharpness));
    formData.append('sobel_refinement', String(settings.sobelRefinement));
    formData.append('bg_model', settings.bgModel);
    formData.append(
      'sam_include_cardboard',
      String(settings.samIncludeCardboard)
    );
    formData.append(
      'sam_max_offset_px',
      String(settings.samMaxOffsetPx ?? 160)
    );
    formData.append(
      'sam_color_tolerance',
      String(settings.samColorTolerance ?? 24)
    );
    formData.append('remove_background', String(settings.removeBackground));
    formData.append('compression_mode', settings.compressionMode);
    formData.append(
      'compress',
      String(settings.compressionMode === 'png8_quant')
    );
    formData.append('output_format', isVec ? 'svg' : settings.outputFormat);
    formData.append('jpg_quality', String(settings.jpgQuality));
    formData.append('jpg_background', settings.jpgBackground);
    formData.append('auto_crop', String(settings.autoCrop));

    if (activePoints.length > 0) {
      const mappedPrompts = activePoints.map((pt) => ({
        x: Number((pt.xPercent / 100).toFixed(4)),
        y: Number((pt.yPercent / 100).toFixed(4)),
        label: pt.type === 'negative' ? 0 : 1,
      }));
      formData.append('sam_points', JSON.stringify(mappedPrompts));
    }

    formData.append('vectorize', String(isVec));
    if (isVec) {
      formData.append('trace_preset', settings.tracePreset);
      formData.append('trace_curve_mode', settings.traceCurveMode || 'spline');
      formData.append(
        'trace_color_precision',
        String(settings.traceColorPrecision)
      );
      formData.append(
        'trace_filter_speckle',
        String(settings.traceFilterSpeckle)
      );
      formData.append(
        'trace_corner_threshold',
        String(settings.traceCornerThreshold)
      );
      formData.append(
        'trace_length_threshold',
        String(settings.traceLengthThreshold ?? 4.5)
      );
      formData.append(
        'trace_splice_threshold',
        String(settings.traceSpliceThreshold ?? 45)
      );
      formData.append(
        'trace_path_precision',
        String(settings.tracePathPrecision ?? 2)
      );
      formData.append(
        'trace_layer_difference',
        String(settings.traceLayerDifference)
      );
      formData.append('trace_cutout', String(settings.traceCutout));
      formData.append(
        'trace_stroke_enabled',
        String(settings.traceStrokeEnabled ?? false)
      );
      formData.append(
        'trace_stroke_width',
        String(settings.traceStrokeWidth ?? 1.5)
      );
      formData.append(
        'trace_stroke_color_auto',
        String(settings.traceStrokeColorAuto ?? true)
      );
      formData.append(
        'trace_stroke_color',
        settings.traceStrokeColorHex || '#0f172a'
      );
      formData.append(
        'trace_fill_enabled',
        String(settings.traceFillEnabled ?? true)
      );
      formData.append(
        'trace_ignore_color_enabled',
        String(settings.traceIgnoreColorEnabled ?? true)
      );
      formData.append(
        'trace_ignore_color_auto',
        String(settings.traceIgnoreColorAuto ?? true)
      );
      formData.append(
        'trace_ignore_color',
        settings.traceIgnoreColorHex || '#ffffff'
      );
      formData.append(
        'trace_ignore_tolerance',
        String(settings.traceIgnoreTolerance ?? 28)
      );
    }

    return formData;
  };

  const processSingleFile = async (
    targetFile: ImageQueueItem,
    overridePoints?: Point[] | null,
    forceVectorize?: boolean | null
  ) => {
    const startTime = performance.now();
    setFiles((prev) =>
      prev.map((f) =>
        f.id === targetFile.id ? { ...f, status: 'processing' } : f
      )
    );

    const formData = buildFormData(targetFile, overridePoints, forceVectorize);

    try {
      const response = await fetch('/process-image', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Error al procesar la imagen en el servidor');
      }

      const mime =
        response.headers.get('X-Output-Format') ||
        response.headers.get('Content-Type') ||
        'image/png';
      const blob = await response.blob();
      const resultUrl = URL.createObjectURL(blob);
      const elapsed = Math.round(performance.now() - startTime);

      setFiles((prev) =>
        prev.map((f) =>
          f.id === targetFile.id
            ? {
                ...f,
                status: 'completed',
                result: resultUrl,
                resultBlob: blob,
                resultMime: mime,
                processedSize: blob.size,
                pointsDirty: false,
                durationMs: elapsed,
              }
            : f
        )
      );
    } catch (error) {
      console.error(error);
      setFiles((prev) =>
        prev.map((f) =>
          f.id === targetFile.id ? { ...f, status: 'error' } : f
        )
      );
      notify.error(
        'Error de procesamiento',
        `No se pudo procesar ${targetFile.file.name}`
      );
    }
  };

  const processAllFiles = async () => {
    if (files.length === 0) return;
    setIsProcessing(true);
    setOverallProgress(0);

    let count = 0;
    for (const item of files) {
      await processSingleFile(item);
      count++;
      setOverallProgress((count / files.length) * 100);
    }

    setIsProcessing(false);
    notify.success(
      'Lote completado',
      `Se procesaron ${files.length} imágenes correctamente.`
    );
  };

  const handlePointsChange = (nextPoints: Point[]) => {
    if (!selectedFile) return;

    setFiles((prev) =>
      prev.map((f) =>
        f.id === selectedFile.id
          ? { ...f, pickerPoints: nextPoints, pointsDirty: true }
          : f
      )
    );
  };

  const handleRemoveSingle = (id: string) => {
    setFiles((prev) => {
      const next = prev.filter((f) => f.id !== id);
      if (selectedFileId === id) {
        setSelectedFileId(next[0]?.id || null);
      }
      return next;
    });
  };

  const handleDownloadSingle = (item: ImageQueueItem) => {
    if (!item.result) return;
    const ext = getExtensionFromMime(
      item.resultMime,
      settings.vectorizeEnabled ? 'svg' : settings.outputFormat
    );
    const baseName = item.file.name.replace(/\.[^/.]+$/, '');
    const link = document.createElement('a');
    link.href = item.result;
    link.download = `${baseName}.${ext}`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadAllZip = async () => {
    const zip = new JSZip();
    let hasFiles = false;

    files.forEach((item) => {
      if (item.resultBlob) {
        const ext = getExtensionFromMime(
          item.resultMime,
          settings.vectorizeEnabled ? 'svg' : settings.outputFormat
        );
        const fileName = `${item.file.name.replace(/\.[^/.]+$/, '')}.${ext}`;
        zip.file(fileName, item.resultBlob);
        hasFiles = true;
      }
    });

    if (hasFiles) {
      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'processed_images.zip';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const completedCount = files.filter((f) => f.status === 'completed').length;

  return (
    <div className="studio-app-shell">
      <HeaderBar
        activeView={activeView}
        onChangeView={setActiveView}
        presets={presets}
        activePresetId={activePresetId}
        defaultPresetId={defaultPresetId}
        hasUnsavedChanges={hasUnsavedChanges}
        onSelectPresetById={handleSelectPresetById}
        onQuickSaveActivePreset={handleSaveToActivePreset}
        isProcessing={isProcessing}
        overallProgress={overallProgress}
        completedCount={completedCount}
        totalCount={files.length}
        vectorizeEnabled={settings.vectorizeEnabled}
        onProcessAll={processAllFiles}
        onDownloadAll={handleDownloadAllZip}
      />

      <div className="studio-workspace-body">
        {/* Left Docked Inspector Sidebar */}
        <div className="studio-sidebar-pane">
          <SettingsSidebar
            settings={settings}
            activePreset={activePreset}
            hasUnsavedChanges={hasUnsavedChanges}
            onUpdateSettings={updateSettings}
            onPresetChange={handlePresetChange}
            onSaveToActivePreset={handleSaveToActivePreset}
            onRevertToActivePreset={handleRevertToActivePreset}
            onCreateNewPreset={(name, badge, description, makeDefault) =>
              handleCreatePreset(
                {
                  name,
                  badge,
                  description,
                  isBuiltIn: false,
                  settings: { ...settings },
                },
                makeDefault
              )
            }
            onOpenCrudView={() => setActiveView('presets')}
            isProcessing={isProcessing}
            totalFiles={files.length}
            completedCount={completedCount}
            onProcessAll={processAllFiles}
            onDownloadAll={handleDownloadAllZip}
          />
        </div>

        {/* Right Main Studio Viewport */}
        <main className="studio-stage-pane">
          {activeView === 'stage' && (
            <StudioMainStage
              files={files}
              activeFile={selectedFile}
              isInteractiveModel={isInteractiveModel}
              outputFormat={settings.outputFormat}
              vectorizeEnabled={settings.vectorizeEnabled}
              presets={presets}
              activePresetId={activePresetId}
              defaultPresetId={defaultPresetId}
              onSelectPreset={handleSelectPreset}
              onOpenCrudView={() => setActiveView('presets')}
              onOpenBatchGridView={() => setActiveView('batch')}
              onFilesAdded={handleFilesAdded}
              onInvalidFiles={handleInvalidFiles}
              onSelectFile={setSelectedFileId}
              onRemoveFile={handleRemoveSingle}
              onClearAll={() => {
                setFiles([]);
                setSelectedFileId(null);
              }}
              onPointsChange={handlePointsChange}
              onProcessSingle={(item) => processSingleFile(item, null, false)}
              onVectorizeSingle={(item) => processSingleFile(item, null, true)}
              onDownloadSingle={handleDownloadSingle}
            />
          )}

          {activeView === 'batch' && (
            <ImageQueueGrid
              files={files}
              selectedFileId={selectedFile?.id || null}
              isInteractiveModel={isInteractiveModel}
              outputFormat={settings.outputFormat}
              vectorizeEnabled={settings.vectorizeEnabled}
              onFilesAdded={handleFilesAdded}
              onInvalidFiles={handleInvalidFiles}
              onOpenInStage={(id) => {
                setSelectedFileId(id);
                setActiveView('stage');
              }}
              onProcessSingle={(item) => processSingleFile(item, null, false)}
              onVectorizeSingle={(item) => processSingleFile(item, null, true)}
              onDownloadSingle={handleDownloadSingle}
              onRemoveSingle={handleRemoveSingle}
              onClearAll={() => {
                setFiles([]);
                setSelectedFileId(null);
              }}
            />
          )}

          {activeView === 'presets' && (
            <PresetCrudManager
              presets={presets}
              activePresetId={activePresetId}
              defaultPresetId={defaultPresetId}
              currentSettings={settings}
              hasUnsavedChanges={hasUnsavedChanges}
              onSelectPreset={(preset) => {
                handleSelectPreset(preset);
              }}
              onSetDefaultPreset={handleSetDefaultPreset}
              onCreatePreset={handleCreatePreset}
              onUpdatePreset={handleUpdatePreset}
              onDeletePreset={handleDeletePreset}
              onDuplicatePreset={handleDuplicatePreset}
              onResetFactoryPresets={handleResetFactoryPresets}
              onImportPresets={handleImportPresets}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <ThemeProvider defaultTheme="dark">
      <NotificationProvider position="bottom-right">
        <StudioWorkspace />
      </NotificationProvider>
    </ThemeProvider>
  );
}

export default App;

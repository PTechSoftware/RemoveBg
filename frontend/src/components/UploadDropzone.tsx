import React from 'react';
import { FileInput, type FileError } from '@ptech/designsystem/inputs';
import { Upload } from 'lucide-react';

export interface UploadDropzoneProps {
  onFilesAdded: (files: File[]) => void;
  onInvalidFiles?: (errors: FileError[]) => void;
  compact?: boolean;
}

export const UploadDropzone: React.FC<UploadDropzoneProps> = ({
  onFilesAdded,
  onInvalidFiles,
  compact = false,
}) => {
  return (
    <div style={{ width: '100%' }}>
      <FileInput
        label={
          compact
            ? 'Agregar más imágenes JPG, PNG o WEBP a la cola'
            : 'Arrastrá tus imágenes JPG, PNG o WEBP aquí o hacé clic para explorar'
        }
        description="Soporta entrada y salida en JPG, JPEG, PNG y WEBP hasta 50 MB por archivo"
        allowedExtensions={['.png', '.jpg', '.jpeg', '.webp']}
        maxSize={50 * 1024 * 1024}
        multiple
        icon={<Upload size={compact ? 20 : 28} />}
        variant="dashed"
        onValidFiles={onFilesAdded}
        onInvalidFiles={onInvalidFiles}
      />
    </div>
  );
};

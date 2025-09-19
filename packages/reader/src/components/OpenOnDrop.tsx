import { type PropsWithChildren, useState } from "react";
import { useDropzone } from "react-dropzone";

interface OpenOnDropProps extends PropsWithChildren {
  onDrop: (files: File[]) => void | Promise<void>;
  overlayText?: string;
  noClick?: boolean;
  noKeyboard?: boolean;
}

export function OpenOnDrop({
  children,
  onDrop,
  overlayText = "Drop files here",
  noClick = true,
  noKeyboard = true,
}: OpenOnDropProps) {
  const [isDragging, setIsDragging] = useState(false);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (files) => {
      setIsDragging(false);
      if (!files || files.length === 0) return;
      await onDrop(files);
    },
    onDragEnter: () => setIsDragging(true),
    onDragLeave: () => setIsDragging(false),
    accept: {
      "application/epub+zip": [".epub"],
      "application/pdf": [".pdf"]
    },
    multiple: true,
    noClick,
    noKeyboard,
  });

  return (
    <div {...getRootProps()} className="relative">
      <input {...getInputProps()} />
      {children}

      {isDragging && (
        <div className="fixed inset-0 z-50 bg-blue-50/95 flex items-center justify-center">
          <div className="bg-white px-8 py-6 rounded-lg shadow-2xl border-2 border-blue-200">
            <p className="text-xl text-blue-600">{overlayText}</p>
          </div>
        </div>
      )}
    </div>
  );
}

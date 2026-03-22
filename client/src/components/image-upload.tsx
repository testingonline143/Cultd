import { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageUploadProps {
  value: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  aspectRatio?: "16/9" | "square";
}

async function compressImage(file: File, maxPx = 1280, quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxPx || height > maxPx) {
        if (width > height) {
          height = Math.round((height / width) * maxPx);
          width = maxPx;
        } else {
          width = Math.round((width / height) * maxPx);
          height = maxPx;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not supported")); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Compression failed"));
        },
        "image/webp",
        quality
      );
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error("Image load failed")); };
    img.src = objectUrl;
  });
}

export function ImageUpload({ value, onChange, label = "Add cover photo", aspectRatio = "16/9" }: ImageUploadProps) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const heightClass = aspectRatio === "square" ? "aspect-square" : "h-44";

  async function handleFile(file: File) {
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const { supabase } = await import("@/lib/supabase");
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.webp`;

      const { data, error } = await supabase.storage
        .from('uploads')
        .upload(filename, compressed, {
          contentType: 'image/webp',
          cacheControl: '31536000',
          upsert: true
        });

      if (error) {
        throw new Error(error.message || "Upload failed");
      }

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(filename);

      onChange(publicUrl);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      {label && (
        <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
          {label}
        </label>
      )}

      <div
        className={`relative w-full ${heightClass} rounded-2xl overflow-hidden cursor-pointer transition-all`}
        style={{
          border: value ? "none" : "2px dashed rgba(196,98,45,0.35)",
          background: value ? "transparent" : "var(--cream)",
        }}
        onClick={() => !uploading && inputRef.current?.click()}
        data-testid="input-cover-image"
      >
        {value ? (
          <>
            <img src={value} alt="Cover" className="w-full h-full object-cover" />
            {uploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center z-10 transition-opacity hover:bg-black/80"
              data-testid="button-remove-cover"
            >
              <X className="w-3.5 h-3.5 text-white" />
            </button>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
            {uploading ? (
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--terra)" }} />
            ) : (
              <>
                <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "var(--terra-pale)" }}>
                  <Camera className="w-5 h-5" style={{ color: "var(--terra)" }} />
                </div>
                <span className="text-sm font-medium" style={{ color: "var(--terra)" }}>Tap to add photo</span>
                <span className="text-xs" style={{ color: "var(--muted-warm)" }}>JPG, PNG or WebP · max 5 MB</span>
              </>
            )}
          </div>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}

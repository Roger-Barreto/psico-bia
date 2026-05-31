import { useRef, useState } from "react"
import { toast } from "sonner"
import {
  DownloadSimpleIcon,
  FileArchiveIcon,
  FileAudioIcon,
  FileCsvIcon,
  FileDocIcon,
  FileIcon,
  FilePdfIcon,
  FileTextIcon,
  FileVideoIcon,
  FileXlsIcon,
  FileZipIcon,
  ImageIcon,
  PaperclipIcon,
  TrashIcon,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react"
import {
  useDeleteDocument,
  useDocumentSignedUrl,
  usePatientDocuments,
  useUploadDocument,
} from "@/api/queries"
import { Button } from "@/components/ui/button"
import { confirmDialog } from "@/components/ui/confirm-dialog"

interface Props {
  patientId: string
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

type IconComp = PhosphorIcon

function docTypeFor(
  filename: string,
): { Icon: IconComp; tint: string; label: string } {
  const ext = filename.toLowerCase().split(".").pop() ?? ""
  if (["pdf"].includes(ext))
    return { Icon: FilePdfIcon, tint: "text-red-400 bg-red-500/15", label: "PDF" }
  if (["doc", "docx", "odt", "rtf"].includes(ext))
    return { Icon: FileDocIcon, tint: "text-blue-400 bg-blue-500/15", label: "DOC" }
  if (["xls", "xlsx", "ods"].includes(ext))
    return { Icon: FileXlsIcon, tint: "text-emerald-400 bg-emerald-500/15", label: "XLS" }
  if (["csv"].includes(ext))
    return { Icon: FileCsvIcon, tint: "text-emerald-400 bg-emerald-500/15", label: "CSV" }
  if (["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "heic", "heif"].includes(ext))
    return { Icon: ImageIcon, tint: "text-purple-400 bg-purple-500/15", label: "IMG" }
  if (["mp3", "wav", "ogg", "m4a", "flac"].includes(ext))
    return { Icon: FileAudioIcon, tint: "text-pink-400 bg-pink-500/15", label: "AUDIO" }
  if (["mp4", "mov", "avi", "mkv", "webm"].includes(ext))
    return { Icon: FileVideoIcon, tint: "text-orange-400 bg-orange-500/15", label: "VIDEO" }
  if (["zip", "rar", "7z"].includes(ext))
    return { Icon: FileZipIcon, tint: "text-amber-400 bg-amber-500/15", label: "ZIP" }
  if (["tar", "gz", "bz2"].includes(ext))
    return { Icon: FileArchiveIcon, tint: "text-amber-400 bg-amber-500/15", label: "ARC" }
  if (["txt", "md", "log"].includes(ext))
    return { Icon: FileTextIcon, tint: "text-slate-300 bg-slate-500/15", label: "TXT" }
  return { Icon: FileIcon, tint: "text-muted-foreground bg-muted/40", label: ext.toUpperCase() || "FILE" }
}

export function PatientDocuments({ patientId }: Props) {
  const docsQ = usePatientDocuments(patientId)
  const uploadMut = useUploadDocument(patientId)
  const deleteMut = useDeleteDocument(patientId)
  const signedUrlMut = useDocumentSignedUrl()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const docs = docsQ.data ?? []

  async function uploadFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    for (const f of arr) {
      try {
        await uploadMut.mutateAsync(f)
        toast.success(`${f.name} enviado`)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : `Erro ao enviar ${f.name}`,
        )
      }
    }
  }

  async function onDelete(filename: string) {
    if (
      !(await confirmDialog({
        title: "Excluir documento",
        description: `Excluir "${filename}"?`,
        destructive: true,
      }))
    )
      return
    try {
      await deleteMut.mutateAsync(filename)
      toast.success("Documento excluído")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro")
    }
  }

  async function downloadDocument(filename: string) {
    try {
      const url = await signedUrlMut.mutateAsync({ patientId, filename })
      window.open(url, "_blank", "noopener,noreferrer")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao baixar")
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-semibold">Documentos</p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
        }}
        className={
          "rounded-lg border border-dashed px-3 py-3 text-xs transition-colors " +
          (dragOver
            ? "border-primary bg-primary/10 text-primary"
            : "border-border/60 bg-background/40 text-muted-foreground")
        }
      >
        <div className="flex items-center justify-between gap-2">
          <span>Arraste arquivos aqui ou clique em anexar.</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => inputRef.current?.click()}
            disabled={uploadMut.isPending}
          >
            <PaperclipIcon weight="bold" />
            Anexar
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) uploadFiles(e.target.files)
            e.target.value = ""
          }}
        />
      </div>

      <div className="space-y-1.5">
        {docsQ.isLoading && (
          <p className="text-xs text-muted-foreground">Carregando...</p>
        )}
        {!docsQ.isLoading && docs.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhum documento anexado.
          </p>
        )}
        {docs.map((d) => {
          const { Icon, tint, label } = docTypeFor(d.filename)
          return (
          <div
            key={d.filename}
            className="flex items-center gap-3 rounded-lg border border-border/60 bg-background/40 px-3 py-2"
          >
            <div
              className={
                "grid size-12 shrink-0 place-items-center rounded-lg " + tint
              }
              title={label}
            >
              <Icon weight="fill" className="size-8" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{d.filename}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {label} · {formatBytes(d.size)} ·{" "}
                {new Date(d.modifiedAt).toLocaleDateString("pt-BR")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => downloadDocument(d.filename)}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-primary/15 hover:text-primary"
              title="Baixar"
            >
              <DownloadSimpleIcon weight="fill" className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(d.filename)}
              className="grid size-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
              title="Excluir"
            >
              <TrashIcon weight="fill" className="size-3.5" />
            </button>
          </div>
          )
        })}
      </div>
    </div>
  )
}

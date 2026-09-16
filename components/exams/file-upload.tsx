"use client";

import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { zh } from "@/lib/i18n/zh";

export function FileUpload({ versionId }: { versionId: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string>();
  async function upload(file: File) {
    setStatus(zh.upload.uploading);
    const form = new FormData();
    form.set("file", file);
    const response = await fetch(`/api/exams/${versionId}/upload`, { method: "POST", body: form });
    const result = (await response.json()) as { message?: string };
    setStatus(response.ok ? zh.upload.success : (result.message ?? zh.upload.failed));
  }
  return (
    <div className="upload-box" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); const file = event.dataTransfer.files[0]; if (file) void upload(file); }}>
      <UploadCloud aria-hidden="true" />
      <strong>{zh.upload.drop}</strong>
      <span>{zh.upload.limits}</span>
      <input ref={input} className="sr-only" type="file" accept=".pdf,.docx,.doc" onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}/>
      <Button type="button" variant="outline" onClick={() => input.current?.click()}>{zh.upload.choose}</Button>
      {status ? <p role="status">{status}</p> : null}
    </div>
  );
}

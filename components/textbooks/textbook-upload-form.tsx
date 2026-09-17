"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { zh } from "@/lib/i18n/zh";

type StudentOption = { id: string; name: string; studentNumber: string };

export function TextbookUploadForm({
  students,
}: {
  students: StudentOption[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");

  async function upload(formData: FormData) {
    setStatus("uploading");
    try {
      const response = await fetch("/api/textbooks", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) throw new Error("UPLOAD_FAILED");
      formRef.current?.reset();
      setStatus("success");
      router.refresh();
    } catch {
      setStatus("error");
    }
  }

  return (
    <form
      ref={formRef}
      action={upload}
      className="stack-form textbook-upload-form"
    >
      <div>
        <Label htmlFor="textbook-title">{zh.textbooks.title}</Label>
        <Input id="textbook-title" name="title" maxLength={160} required />
      </div>
      <div>
        <Label htmlFor="textbook-description">{zh.textbooks.description}</Label>
        <Textarea
          id="textbook-description"
          name="description"
          maxLength={2000}
        />
      </div>
      <div>
        <Label htmlFor="textbook-file">{zh.textbooks.file}</Label>
        <Input
          id="textbook-file"
          name="file"
          type="file"
          accept="application/pdf,.pdf"
          required
        />
        <p className="field-help">{zh.textbooks.pdfOnly}</p>
      </div>
      <fieldset className="textbook-student-picker">
        <legend>{zh.textbooks.chooseStudents}</legend>
        {students.map((student) => (
          <label className="check-row" key={student.id}>
            <input type="checkbox" name="studentIds" value={student.id} />
            <span>
              {student.name} · {student.studentNumber}
            </span>
          </label>
        ))}
      </fieldset>
      <Button type="submit" disabled={status === "uploading"}>
        {status === "uploading" ? zh.textbooks.uploading : zh.textbooks.upload}
      </Button>
      <p className="form-status" role="status">
        {status === "success"
          ? zh.textbooks.uploadSuccess
          : status === "error"
            ? zh.textbooks.uploadFailed
            : ""}
      </p>
    </form>
  );
}

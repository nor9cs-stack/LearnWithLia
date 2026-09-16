"use client";

import { useActionState, useEffect, useState } from "react";
import { loginAction } from "@/app/actions/auth";
import { zh } from "@/lib/i18n/zh";

type LoginKind = "student" | "teacher";

export function LoginPanel() {
  const [kind, setKind] = useState<LoginKind>("student");
  const [state, action, pending] = useActionState(loginAction, {});
  const isStudent = kind === "student";

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    void Promise.resolve(
      context.registerTool(
        {
          name: "prepare_login",
          title: zh.auth.toolTitle,
          description: zh.auth.toolDescription,
          inputSchema: {
            type: "object",
            properties: { role: { type: "string", enum: ["student", "teacher"] } },
            required: ["role"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute(input: unknown) {
            if (
              typeof input !== "object" ||
              input === null ||
              !("role" in input) ||
              (input.role !== "student" && input.role !== "teacher")
            ) {
              throw new Error(zh.auth.invalidToolRole);
            }
            setKind(input.role);
            requestAnimationFrame(() => document.getElementById("identifier")?.focus());
            return { role: input.role, ready: true };
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => undefined);
    return () => lifecycle.abort();
  }, []);

  return (
    <div className="login-card">
      <div className="login-tabs" role="tablist" aria-label={zh.auth.chooseRole}>
        <button
          type="button"
          role="tab"
          aria-selected={isStudent}
          className={isStudent ? "active" : undefined}
          onClick={() => setKind("student")}
        >
          {zh.auth.studentTab}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isStudent}
          className={!isStudent ? "active" : undefined}
          onClick={() => setKind("teacher")}
        >
          {zh.auth.teacherTab}
        </button>
      </div>

      <form className="login-form" action={action}>
        <div className="field-stack">
          <label htmlFor="identifier">{isStudent ? zh.auth.studentNumber : zh.auth.email}</label>
          <input
            id="identifier"
            name="identifier"
            type={isStudent ? "text" : "email"}
            autoComplete={isStudent ? "username" : "email"}
            placeholder={isStudent ? zh.auth.studentNumberPlaceholder : zh.auth.emailPlaceholder}
            required
          />
        </div>
        <div className="field-stack">
          <div className="label-row">
            <label htmlFor="password">{zh.auth.password}</label>
            <span>{zh.auth.passwordHelper}</span>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={zh.auth.passwordPlaceholder}
            required
          />
        </div>
        <input type="hidden" name="kind" value={kind} />
        {state.error ? <p className="login-error" role="alert">{state.error}</p> : null}
        <button className="login-button" type="submit" disabled={pending}>
          {pending ? zh.auth.verifying : zh.auth.continue}
          <span aria-hidden="true">→</span>
        </button>
      </form>

      <p className="login-note">{zh.auth.note}</p>
    </div>
  );
}

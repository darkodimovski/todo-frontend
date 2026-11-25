import React, { useEffect, useState } from "react";

/**
 * Small "Est. h" field for managers. Saves on Enter or when leaving the field;
 * empty = no estimate. Accepts "1,5" as well as "1.5".
 */
export default function HoursInput({ value, onSave }) {
  const [text, setText] = useState(value ?? "");
  const [state, setState] = useState("idle"); // idle | saving | saved | error

  useEffect(() => setText(value ?? ""), [value]);

  const commit = async () => {
    const clean = String(text).trim().replace(",", ".");
    const next = clean === "" ? null : Number(clean);
    if (next !== null && (!Number.isFinite(next) || next < 0)) {
      setState("error");
      return;
    }
    if (next === (value ?? null)) return;
    setState("saving");
    try {
      await onSave(next);
      setState("saved");
      setTimeout(() => setState("idle"), 1200);
    } catch {
      setState("error");
    }
  };

  return (
    <label
      className="inline-flex items-center gap-1.5 text-xs text-gray-500"
      title="Estimated hours – only managers see this"
      onClick={(e) => e.stopPropagation()}
    >
      Est.
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setState("idle");
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
        }}
        placeholder="–"
        className={`w-14 px-1.5 py-0.5 border rounded text-right text-sm ${
          state === "error" ? "border-red-400" : ""
        }`}
      />
      h
      {state === "saving" && <span className="text-gray-400">…</span>}
      {state === "saved" && <span className="text-green-800">✓</span>}
      {state === "error" && <span className="text-red-600">invalid</span>}
    </label>
  );
}

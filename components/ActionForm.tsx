"use client";

import { useTransition, type FormHTMLAttributes } from "react";

/**
 * <form> que chama uma action sem o reset automático de campos do React 19
 * (que apagaria o que a pessoa digitou quando há erro de validação).
 */
export function ActionForm({ action, children, ...rest }: { action: (fd: FormData) => void } & Omit<FormHTMLAttributes<HTMLFormElement>, "action" | "onSubmit">) {
  const [, start] = useTransition();
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(() => action(data));
      }}
    >
      {children}
    </form>
  );
}

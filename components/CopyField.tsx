"use client";

import { useState } from "react";
import { Button, Group, TextInput } from "@mantine/core";
import { Icon } from "@/lib/icons";

/** Campo só de leitura com botão de copiar. */
export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Group gap="xs" wrap="nowrap" align="flex-end">
      <TextInput style={{ flex: 1 }} label={label} value={value} readOnly onFocus={(e) => e.currentTarget.select()} />
      <Button variant="light" leftSection={<Icon name={copied ? "check" : "link"} size={16} />} onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* o campo continua selecionável */ } }}>{copied ? "Copiado" : "Copiar"}</Button>
    </Group>
  );
}

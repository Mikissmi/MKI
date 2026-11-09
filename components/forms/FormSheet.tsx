"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Alert, Button, Checkbox, Drawer, Group, NativeSelect, Stack, Switch, Text, TextInput, Textarea, UnstyledButton } from "@mantine/core";
import { ActionForm } from "@/components/ActionForm";
import type { FormState } from "@/lib/agenda/schemas";

export type Field = {
  name: string;
  label: string;
  type?: "text" | "textarea" | "decimal" | "date" | "time" | "select" | "url" | "switch" | "days";
  options?: { value: string; label: string }[];
  required?: boolean;
  placeholder?: string;
  description?: string;
  maxLength?: number;
};

export type FormValues = Record<string, string | number | boolean | string[] | null | undefined>;

const DAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function FieldInput({ f, value, error }: { f: Field; value: FormValues[string]; error?: string }) {
  const str = value === null || value === undefined ? "" : String(value);
  const common = { name: f.name, label: f.label, description: f.description, error, required: f.required };
  switch (f.type) {
    case "textarea": return <Textarea {...common} defaultValue={str} autosize minRows={2} maxRows={8} maxLength={f.maxLength ?? 2000} placeholder={f.placeholder} />;
    case "date": return <TextInput {...common} type="date" defaultValue={str} />;
    case "time": return <TextInput {...common} type="time" defaultValue={str} />;
    case "decimal": return <TextInput {...common} type="text" inputMode="decimal" defaultValue={str} placeholder={f.placeholder} />;
    case "url": return <TextInput {...common} type="url" inputMode="url" defaultValue={str} placeholder={f.placeholder ?? "https://"} maxLength={1000} />;
    case "select": return <NativeSelect {...common} defaultValue={str} data={f.options ?? []} />;
    case "switch": return <Switch name={f.name} label={f.label} description={f.description} defaultChecked={value === true || value === "on"} color="lotus" />;
    case "days": {
      const selected = Array.isArray(value) ? value.map(String) : [];
      return (
        <div>
          <Text size="sm" fw={500} mb={4}>{f.label}</Text>
          <Group gap="xs">{DAYS.map((d, i) => <Checkbox key={d} name={f.name} value={String(i)} label={d} defaultChecked={selected.includes(String(i))} />)}</Group>
          {error && <Text size="xs" c="red">{error}</Text>}
        </div>
      );
    }
    default: return <TextInput {...common} defaultValue={str} maxLength={f.maxLength ?? 200} placeholder={f.placeholder} />;
  }
}

function SheetForm({ fields, values, action, remove, hidden, submitLabel, onDone }: {
  fields: Field[]; values?: FormValues; action: (prev: FormState, fd: FormData) => Promise<FormState>; remove?: (fd: FormData) => Promise<void>;
  hidden?: Record<string, string>; submitLabel: string; onDone: () => void;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const [deleting, setDeleting] = useState(false);
  useEffect(() => { if (state.ok) onDone(); }, [state, onDone]);
  const id = typeof values?.id === "string" ? values.id : "";
  const fieldNames = new Set(fields.map((f) => f.name));
  return (
    <>
      <ActionForm action={formAction}>
        <Stack gap="sm">
          <input type="hidden" name="id" value={id} />
          {Object.entries(hidden ?? {}).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          {state.error && !Object.keys(state.fieldErrors ?? {}).some((k) => fieldNames.has(k)) && <Alert color="red" variant="light">{state.error}</Alert>}
          {fields.map((f) => <FieldInput key={f.name} f={f} value={values?.[f.name]} error={state.fieldErrors?.[f.name]} />)}
          <Button type="submit" loading={pending} fullWidth size="md">{submitLabel}</Button>
        </Stack>
      </ActionForm>
      {remove && id && (
        <ActionForm action={async (fd) => { setDeleting(true); await remove(fd); onDone(); }}>
          <input type="hidden" name="id" value={id} />
          <Button type="submit" color="red" variant="subtle" fullWidth mt="xs" loading={deleting}>Excluir</Button>
        </ActionForm>
      )}
    </>
  );
}

/** Gaveta com formulário. O conteúdo (children) é o gatilho clicável: um cartão da lista ou um botão. */
export function FormSheet({ title, fields, values, action, remove, hidden, submitLabel, children, block = true, triggerLabel }: {
  title: string; fields: Field[]; values?: FormValues; action: (prev: FormState, fd: FormData) => Promise<FormState>; remove?: (fd: FormData) => Promise<void>;
  hidden?: Record<string, string>; submitLabel?: string; children: ReactNode; block?: boolean; triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const isEdit = typeof values?.id === "string";
  return (
    <>
      <UnstyledButton onClick={() => setOpen(true)} style={block ? { display: "block", width: "100%", textAlign: "left" } : undefined} aria-haspopup="dialog" aria-label={triggerLabel}>{children}</UnstyledButton>
      <Drawer opened={open} onClose={() => setOpen(false)} position="bottom" size="92%" radius="xl" title={<Text fw={800}>{title}</Text>} padding="md">
        <SheetForm fields={fields} values={values} action={action} remove={remove} hidden={hidden} submitLabel={submitLabel ?? (isEdit ? "Salvar" : "Adicionar")} onDone={() => setOpen(false)} />
      </Drawer>
    </>
  );
}

/** Botão pequeno "+" que abre um FormSheet de criação. */
export function AddSheet(props: Omit<Parameters<typeof FormSheet>[0], "children" | "block"> & { label?: string }) {
  const { label = "Novo", ...rest } = props;
  return <FormSheet {...rest} block={false} triggerLabel={rest.title}><Button component="span" size="compact-sm" variant="light" leftSection="+">{label}</Button></FormSheet>;
}

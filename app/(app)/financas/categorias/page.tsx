import { Group, Stack, Text } from "@mantine/core";
import { requireUser } from "@/lib/auth/session";
import { ensureCategories } from "@/lib/finance";
import { CATEGORY_COLORS, CATEGORY_ICONS } from "@/lib/options";
import { PageHeader } from "@/components/PageHeader";
import { Panel, IconTile } from "@/components/ui/Panel";
import { AddSheet, FormSheet, type Field } from "@/components/forms/FormSheet";
import { deleteCategory, saveCategory } from "../actions";

export const metadata = { title: "Categorias" };

const fields: Field[] = [
  { name: "name", label: "Nome", required: true, maxLength: 40 },
  { name: "color", label: "Cor", type: "select", options: Object.entries(CATEGORY_COLORS).map(([value, c]) => ({ value, label: c.label })) },
  { name: "icon", label: "Ícone", type: "select", options: CATEGORY_ICONS.map((i) => ({ value: i.value, label: i.label })) },
];

export default async function CategoriesPage() {
  const user = await requireUser();
  const cats = await ensureCategories(user.id);
  return (
    <>
      <PageHeader title="Categorias" back="/financas" action={<AddSheet title="Nova categoria" fields={fields} values={{ color: "pink", icon: "wallet" }} action={saveCategory} />} />
      <Panel tone="plain">
        <Stack gap={8}>
          {cats.map((c) => (
            <FormSheet key={c.id} title="Editar categoria" fields={fields} values={{ id: c.id, name: c.name, color: c.color, icon: c.icon }} action={saveCategory} remove={deleteCategory}>
              <Group gap="sm" wrap="nowrap"><IconTile icon={c.icon} tone="pink" size={36} round /><Text size="sm" fw={700} style={{ flex: 1 }}>{c.name}</Text><span aria-hidden style={{ width: 16, height: 16, borderRadius: 8, background: CATEGORY_COLORS[c.color]?.hex }} /></Group>
            </FormSheet>
          ))}
          <Text size="xs" c="dimmed">Ao excluir uma categoria, os gastos dela ficam como "Sem categoria".</Text>
        </Stack>
      </Panel>
    </>
  );
}

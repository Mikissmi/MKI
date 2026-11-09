"use client";

import { useState } from "react";
import { ActionIcon, Drawer, SimpleGrid, Stack, Text, UnstyledButton } from "@mantine/core";
import { notifications } from "@mantine/notifications";
import { IconDroplet, IconLink, IconMoodSmile, IconPlus, IconTargetArrow, IconWallet } from "@tabler/icons-react";

const ACTIONS = [
  { label: "Gasto", icon: IconWallet, color: "sun" },
  { label: "Água", icon: IconDroplet, color: "sage" },
  { label: "Humor", icon: IconMoodSmile, color: "lavender" },
  { label: "Hábito", icon: IconTargetArrow, color: "plum" },
  { label: "Link", icon: IconLink, color: "lotus" },
];

/** Botão flutuante "+" para registro rápido. Cada ação é ligada ao seu módulo nas próximas etapas. */
export function QuickAddButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <ActionIcon
        aria-label="Registro rápido"
        size={56}
        radius="xl"
        variant="filled"
        color="lotus"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed",
          right: 16,
          bottom: "calc(var(--mki-nav-height) + 16px + env(safe-area-inset-bottom))",
          zIndex: 110,
          boxShadow: "var(--mantine-shadow-md)",
        }}
      >
        <IconPlus size={28} />
      </ActionIcon>
      <Drawer opened={open} onClose={() => setOpen(false)} position="bottom" title="Registro rápido" size="auto" radius="xl">
        <SimpleGrid cols={3} spacing="md" pb="md">
          {ACTIONS.map(({ label, icon: Icon, color }) => (
            <UnstyledButton
              key={label}
              onClick={() => {
                setOpen(false);
                notifications.show({ message: `${label}: chega nas próximas etapas 🌸`, color });
              }}
            >
              <Stack align="center" gap={4}>
                <ActionIcon component="span" size={52} radius="xl" variant="light" color={color}>
                  <Icon size={26} />
                </ActionIcon>
                <Text size="sm">{label}</Text>
              </Stack>
            </UnstyledButton>
          ))}
        </SimpleGrid>
      </Drawer>
    </>
  );
}

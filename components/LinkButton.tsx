"use client";

import Link from "next/link";
import { ActionIcon, Button, type ActionIconProps, type ButtonProps } from "@mantine/core";

/** Botão Mantine que navega com next/link (usável a partir de server components). */
export function LinkButton({ href, ...props }: ButtonProps & { href: string; children?: React.ReactNode }) {
  return <Button component={Link} href={href} {...props} />;
}

export function LinkIconButton({ href, ...props }: ActionIconProps & { href: string; "aria-label": string; children?: React.ReactNode }) {
  return <ActionIcon component={Link} href={href} {...props} />;
}

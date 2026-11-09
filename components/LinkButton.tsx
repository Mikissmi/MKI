"use client";

import Link from "next/link";
import { Button, type ButtonProps } from "@mantine/core";

/** Botão Mantine que navega com next/link (usável a partir de server components). */
export function LinkButton({ href, ...props }: ButtonProps & { href: string; children?: React.ReactNode }) {
  return <Button component={Link} href={href} {...props} />;
}

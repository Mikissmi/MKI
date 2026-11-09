import Image from "next/image";

/** Logo oficial do MKI (flor de lótus rosa). Sempre a mesma imagem, sem recolorir. */
export function Logo({ size = 32 }: { size?: number }) {
  return <Image src="/brand/logo-mki.svg" alt="MKI" width={size} height={size} priority unoptimized />;
}

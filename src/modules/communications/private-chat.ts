import { createHash } from "crypto";
import { Prisma } from "@prisma/client";

export function privateChannelName(first: string, second: string) {
  return (
    "dm:" +
    createHash("sha256")
      .update(JSON.stringify([first, second].sort()))
      .digest("hex")
  );
}

export async function ensurePrivateConversation(
  tx: Prisma.TransactionClient,
  first: string,
  second: string,
) {
  return tx.channel.upsert({
    where: { name: privateChannelName(first, second) },
    update: {},
    include: { members: { include: { user: { select: { id: true, fullName: true } } } } },
    create: {
      name: privateChannelName(first, second),
      isGeneral: false,
      description: "Private conversation",
      members: { create: [{ userId: first }, { userId: second }] },
    },
  });
}

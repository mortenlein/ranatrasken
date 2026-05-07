'use server';

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export async function stampDestination(destinationId: number) {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;

  try {
    const stamp = await prisma.stamp.create({
      data: {
        userId,
        destinationId,
      },
    });

    revalidatePath("/");
    return { success: true, stamp };
  } catch (error) {
    console.error("Stamping failed:", error);
    return { success: false, error: "Already stamped or database error" };
  }
}

export async function getUserStamps() {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  const stamps = await prisma.stamp.findMany({
    where: { userId: session.user.id },
    select: { destinationId: true },
  });

  return stamps.map(s => s.destinationId);
}

export async function getFullUserStamps() {
  const session = await auth();
  if (!session?.user?.id) {
    return [];
  }

  return await prisma.stamp.findMany({
    where: { userId: session.user.id },
    orderBy: { stampedAt: 'desc' },
  });
}

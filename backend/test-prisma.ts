import "dotenv/config";

import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({
  adapter,
});

async function main() {
  // READ ALL
  const users = await prisma.user.findMany();
  console.log("All users:");
  console.log(users);

  // READ ONE
  const user = await prisma.user.findUnique({
    where: {
      id: 1,
    },
  });

  console.log("\nUser with id 1:");
  console.log(user);

  // UPDATE
  const updatedUser = await prisma.user.update({
    where: {
      id: 1,
    },
    data: {
      name: "Updated Prisma User",
    },
  });

  console.log("\nUpdated user:");
  console.log(updatedUser);

  // DELETE
  const deletedUser = await prisma.user.delete({
    where: {
      id: 1,
    },
  });

  console.log("\nDeleted user:");
  console.log(deletedUser);

  // CHECK
  const remainingUsers = await prisma.user.findMany();

  console.log("\nRemaining users:");
  console.log(remainingUsers);
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
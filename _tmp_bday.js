require("dotenv").config();
const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
p.salesRepProfile
  .findMany({
    where: { deletedAt: null },
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
    },
    take: 20,
  })
  .then((r) => {
    console.log(
      JSON.stringify(
        r.map((x) => ({
          id: x.id,
          name: `${x.user?.firstName || ""} ${x.user?.lastName || ""}`.trim(),
          email: x.user?.email,
          birthDate: x.birthDate,
        })),
        null,
        2,
      ),
    );
  })
  .finally(() => p.$disconnect());

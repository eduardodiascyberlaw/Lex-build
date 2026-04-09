import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const modules = [
  {
    code: "sis-indicacao",
    name: "Indicação SIS",
    description:
      "Módulo para casos envolvendo inserção no Sistema de Informação Schengen (SIS). Regulamentos UE 2018/1860 e 2018/1861.",
    pecaTypes: ["ACPAD" as const],
    sortOrder: 1,
  },
  {
    code: "abandono-voluntario",
    name: "Abandono voluntário / NAV",
    description:
      "Módulo para casos de abandono voluntário do território e notificação para abandono voluntário (NAV). Lei 23/2007 art. 138.º e seguintes.",
    pecaTypes: ["ACPAD" as const],
    sortOrder: 2,
  },
  {
    code: "erro-facto",
    name: "Erro de facto na decisão",
    description:
      "Módulo para invocação de erro nos pressupostos de facto da decisão administrativa. CPA art. 153.º.",
    pecaTypes: ["ACPAD" as const],
    sortOrder: 3,
  },
  {
    code: "ilegalidade-formal",
    name: "Ilegalidade formal",
    description:
      "Módulo para vícios de forma e procedimento: falta de audiência prévia, falta de fundamentação, incompetência. CPA arts. 114.º, 115.º, 121.º, 153.º, 160.º.",
    pecaTypes: ["ACPAD" as const],
    sortOrder: 4,
  },
  {
    code: "integracao-socioprofissional",
    name: "Integração socioprofissional",
    description:
      "Módulo para casos em que o requerente demonstra integração social e profissional em Portugal. Lei 23/2007.",
    pecaTypes: ["ACPAD" as const],
    sortOrder: 5,
  },
  {
    code: "menor-portugues",
    name: "Menor nacional português",
    description:
      "Módulo para casos envolvendo progenitor de menor com nacionalidade portuguesa. Direito de residência derivado do direito da UE. TFUE art. 20.º, Lei 23/2007 art. 134.º.",
    pecaTypes: ["ACPAD" as const],
    sortOrder: 6,
  },
  {
    code: "proporcionalidade",
    name: "Proporcionalidade / art. 8.º CEDH",
    description:
      "Módulo para invocação do princípio da proporcionalidade e direito ao respeito pela vida privada e familiar. CEDH art. 8.º, CPA art. 7.º, CRP art. 18.º.",
    pecaTypes: ["ACPAD" as const],
    sortOrder: 7,
  },
  {
    code: "proibicoes-absolutas",
    name: "Proibições absolutas (art. 134.º)",
    description:
      "Módulo para invocação das proibições absolutas de afastamento do território. Lei 23/2007 art. 134.º.",
    pecaTypes: ["ACPAD" as const],
    sortOrder: 8,
  },
];

async function main() {
  for (const mod of modules) {
    await prisma.thematicModule.upsert({
      where: { code: mod.code },
      update: {
        name: mod.name,
        description: mod.description,
        pecaTypes: mod.pecaTypes,
        sortOrder: mod.sortOrder,
      },
      create: mod,
    });
  }

   
  console.log(`Seeded ${modules.length} thematic modules`);
}

main()
  .catch((e) => {
     
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ─── MÓDULOS TEMÁTICOS ───

const modules = [
  {
    code: "sis-indicacao",
    name: "Indicação SIS",
    description:
      "Módulo para casos envolvendo inserção no Sistema de Informação Schengen (SIS). Regulamentos UE 2018/1860 e 2018/1861.",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const, "EXECUCAO" as const],
    sortOrder: 1,
  },
  {
    code: "abandono-voluntario",
    name: "Abandono voluntário / NAV",
    description:
      "Módulo para casos de abandono voluntário do território e notificação para abandono voluntário (NAV). Lei 23/2007 art. 138.º e seguintes.",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const, "EXECUCAO" as const],
    sortOrder: 2,
  },
  {
    code: "erro-facto",
    name: "Erro de facto na decisão",
    description:
      "Módulo para invocação de erro nos pressupostos de facto da decisão administrativa. CPA art. 153.º.",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const],
    sortOrder: 3,
  },
  {
    code: "ilegalidade-formal",
    name: "Ilegalidade formal",
    description:
      "Módulo para vícios de forma e procedimento: falta de audiência prévia, falta de fundamentação, incompetência. CPA arts. 114.º, 115.º, 121.º, 153.º, 160.º.",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const],
    sortOrder: 4,
  },
  {
    code: "integracao-socioprofissional",
    name: "Integração socioprofissional",
    description:
      "Módulo para casos em que o requerente demonstra integração social e profissional em Portugal. Lei 23/2007.",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const, "EXECUCAO" as const],
    sortOrder: 5,
  },
  {
    code: "menor-portugues",
    name: "Menor nacional português",
    description:
      "Módulo para casos envolvendo progenitor de menor com nacionalidade portuguesa. Direito de residência derivado do direito da UE. TFUE art. 20.º, Lei 23/2007 art. 134.º.",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const, "EXECUCAO" as const],
    sortOrder: 6,
  },
  {
    code: "proporcionalidade",
    name: "Proporcionalidade / art. 8.º CEDH",
    description:
      "Módulo para invocação do princípio da proporcionalidade e direito ao respeito pela vida privada e familiar. CEDH art. 8.º, CPA art. 7.º, CRP art. 18.º.",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const, "EXECUCAO" as const],
    sortOrder: 7,
  },
  {
    code: "proibicoes-absolutas",
    name: "Proibições absolutas (art. 134.º)",
    description:
      "Módulo para invocação das proibições absolutas de afastamento do território. Lei 23/2007 art. 134.º.",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const],
    sortOrder: 8,
  },
  {
    code: "meios-subsistencia-agregado",
    name: "Meios de subsistência / Agregado familiar",
    description:
      "Módulo para casos em que a AIMA indefere por falta de meios de subsistência, exigindo ilegalmente que provenham da atividade profissional subordinada. Tese: cômputo por referência ao agregado familiar (art. 2.º, n.º 2 Portaria 1563/2007). Validada pela sentença TAF Loulé proc. 247/26.0BELLE-A (21.04.2026).",
    pecaTypes: ["ACPAD" as const, "CAUTELAR" as const],
    sortOrder: 9,
  },
  {
    code: "sancao-pecuniaria",
    name: "Sanção pecuniária compulsória",
    description:
      "Art. 169.º CPTA — sanção coerciva diária por incumprimento de sentença. Natureza coerciva, não indemnizatória.",
    pecaTypes: ["EXECUCAO" as const],
    sortOrder: 10,
  },
  {
    code: "causa-legitima-inexecucao",
    name: "Causa legítima de inexecução",
    description:
      "Art. 163.º CPTA — defesa preventiva contra invocação de impossibilidade absoluta pela Executada.",
    pecaTypes: ["EXECUCAO" as const],
    sortOrder: 11,
  },
];

// ─── LEGISLAÇÃO CORE ───
// Artigos genéricos que aparecem em ~90% dos ACPADs

const coreLegislation: {
  diploma: string;
  article: string;
  epigraph: string | null;
  content: string;
}[] = [
  // CPTA — Código de Processo nos Tribunais Administrativos
  {
    diploma: "CPTA",
    article: "16.º, n.º 1",
    epigraph: "Competência territorial",
    content:
      "Os tribunais administrativos de círculo são competentes para conhecer de todos os processos do âmbito da jurisdição administrativa que não sejam atribuídos a outros tribunais. A competência territorial determina-se pelo domicílio do autor quando estejam em causa actos administrativos.",
  },
  {
    diploma: "CPTA",
    article: "34.º, n.º 2",
    epigraph: "Valor da causa",
    content:
      "Quando o valor da causa não seja determinável, considera-se de valor equivalente à alçada da Relação mais EUR 0,01 (trinta mil euros e um cêntimo).",
  },
  {
    diploma: "CPTA",
    article: "36.º",
    epigraph: "Cumulação de pedidos",
    content:
      "Podem cumular-se no mesmo processo pedidos de diferente natureza, designadamente de anulação ou declaração de nulidade de um acto administrativo e de condenação à prática de acto devido, quando os pedidos entre si se encontrem numa relação de prejudicialidade ou de dependência.",
  },
  {
    diploma: "CPTA",
    article: "58.º, n.º 1",
    epigraph: "Prazo de impugnação",
    content:
      "A impugnação de actos anuláveis tem lugar no prazo de três meses. O prazo conta-se nos termos do artigo 59.º.",
  },
  {
    diploma: "CPTA",
    article: "59.º, n.º 1, al. a)",
    epigraph: "Dies a quo — início do prazo",
    content:
      "Os prazos para a impugnação de actos administrativos começam a correr: a) Da notificação do acto, quando esta tenha lugar; na falta de notificação, da data do conhecimento do acto pelo interessado.",
  },
  {
    diploma: "CPTA",
    article: "66.º, n.º 1",
    epigraph: "Condenação à prática de acto devido",
    content:
      "A condenação à prática de acto devido pode ser pedida quando a Administração tenha omitido a prática de um acto administrativo legalmente devido, incluindo quando tenha recusado a prática do acto requerido ou praticado acto de conteúdo diferente do devido.",
  },
  {
    diploma: "CPTA",
    article: "66.º, n.º 2",
    epigraph: "Efeito da sentença de condenação",
    content:
      "A pronúncia condenatória elimina o acto de indeferimento, de recusa ou de conteúdo diferente do devido, tornando desnecessária a sua impugnação autónoma.",
  },
  {
    diploma: "CPTA",
    article: "67.º",
    epigraph: "Determinação do conteúdo do acto devido",
    content:
      "Quando a emissão do acto pretendido envolva a formulação de valorações próprias do exercício da função administrativa, o tribunal não pode determinar o conteúdo do acto a praticar, mas deve explicitar as vinculações a observar pela Administração na emissão do acto devido.",
  },
  {
    diploma: "CPTA",
    article: "68.º, n.º 1, al. a)",
    epigraph: "Legitimidade activa",
    content:
      "Tem legitimidade para impugnar um acto administrativo quem alegue ser titular de um interesse directo e pessoal, designadamente por ter sido lesado pelo acto nos seus direitos ou interesses legalmente protegidos.",
  },
  {
    diploma: "CPTA",
    article: "84.º",
    epigraph: "Junção do processo administrativo",
    content:
      "O tribunal pode ordenar a junção do processo administrativo, a requerimento das partes ou oficiosamente, devendo a entidade demandada apresentá-lo no prazo que for fixado.",
  },
  {
    diploma: "CPTA",
    article: "90.º",
    epigraph: "Meios de prova",
    content:
      "São admitidos no contencioso administrativo todos os meios de prova admitidos em processo civil, com as especialidades previstas no presente Código.",
  },
  // CPA — Código do Procedimento Administrativo
  {
    diploma: "CPA",
    article: "7.º",
    epigraph: "Princípio da proporcionalidade",
    content:
      "Na prossecução do interesse público, a Administração Pública deve adoptar os comportamentos adequados aos fins prosseguidos, que se revelem necessários e proporcionais face aos objectivos a realizar. As decisões da Administração que colidam com direitos subjectivos ou interesses legalmente protegidos dos particulares só podem afectar essas posições na medida do necessário e em termos proporcionais aos objectivos a realizar.",
  },
  {
    diploma: "CPA",
    article: "10.º",
    epigraph: "Princípio da boa fé",
    content:
      "No exercício da actividade administrativa e em todas as suas formas e fases, a Administração Pública e os particulares devem agir e relacionar-se segundo as regras da boa fé. No cumprimento do dever de boa fé, devem ponderar-se os valores fundamentais do direito, relevantes em face das situações consideradas, e, em especial, a confiança suscitada na contraparte pela actuação em causa e o objectivo a alcançar com a actuação empreendida.",
  },
  {
    diploma: "CPA",
    article: "11.º",
    epigraph: "Princípio da colaboração com os particulares",
    content:
      "Os órgãos da Administração Pública devem actuar em estreita colaboração com os particulares, cumprindo-lhes, designadamente, prestar aos particulares as informações e os esclarecimentos de que careçam, apoiar e estimular as iniciativas dos particulares e receber as suas sugestões e informações.",
  },
  {
    diploma: "CPA",
    article: "114.º, n.º 1",
    epigraph: "Dever de notificação",
    content:
      "Os actos administrativos que imponham deveres, encargos, ónus, sujeições ou sanções, que causem prejuízos ou restrinjam direitos ou interesses legalmente protegidos, ou que afectem as condições do seu exercício, devem ser notificados aos seus destinatários.",
  },
  {
    diploma: "CPA",
    article: "115.º",
    epigraph: "Meios de notificação",
    content:
      "As notificações podem ser feitas por carta registada com aviso de recepção, notificação pessoal, ou por transmissão electrónica de dados com certificação. A notificação por simples email sem certificação não constitui meio válido de notificação para actos desfavoráveis.",
  },
  {
    diploma: "CPA",
    article: "121.º, n.º 1",
    epigraph: "Audiência dos interessados",
    content:
      "Sem prejuízo do disposto no artigo seguinte, os interessados têm o direito de ser ouvidos no procedimento antes de ser tomada a decisão final, devendo ser informados, nomeadamente, sobre o sentido provável desta. A omissão de audiência prévia quando legalmente exigida constitui preterição de formalidade essencial.",
  },
  {
    diploma: "CPA",
    article: "153.º, n.º 1",
    epigraph: "Dever de fundamentação",
    content:
      "Devem ser fundamentados os actos administrativos que, total ou parcialmente, neguem, extingam, restrinjam ou afectem por qualquer modo direitos ou interesses legalmente protegidos, ou imponham ou agravem deveres, encargos ou sanções. A fundamentação deve ser expressa, através de sucinta exposição dos fundamentos de facto e de direito da decisão.",
  },
  {
    diploma: "CPA",
    article: "160.º, n.º 1",
    epigraph: "Eficácia do acto administrativo",
    content:
      "Os actos administrativos produzem os seus efeitos desde a data em que são praticados, salvo nos casos em que a lei ou o próprio acto lhes atribuam eficácia retroactiva ou diferida. Contudo, os actos que imponham deveres, encargos, ónus, sujeições ou sanções, ou que causem prejuízos, só são oponíveis aos destinatários a partir da respectiva notificação.",
  },
  {
    diploma: "CPA",
    article: "161.º, n.º 2",
    epigraph: "Actos nulos",
    content:
      "São nulos os actos administrativos: a) Que careçam em absoluto de forma legal; b) Praticados por órgão absolutamente incompetente; c) Cujo objecto ou conteúdo seja impossível, ininteligível ou constitua um crime; d) Que ofendam o conteúdo essencial de um direito fundamental; e) Cujo conteúdo seja determinado pela prática de um crime.",
  },
  {
    diploma: "CPA",
    article: "163.º, n.º 1",
    epigraph: "Anulabilidade",
    content:
      "São anuláveis os actos administrativos praticados com ofensa dos princípios ou normas jurídicas aplicáveis para cuja violação se não preveja outra sanção. A anulação determina a destruição dos efeitos do acto com eficácia retroactiva.",
  },
  // CRP — Constituição da República Portuguesa
  {
    diploma: "CRP",
    article: "18.º, n.º 2",
    epigraph: "Restrição de direitos, liberdades e garantias",
    content:
      "A lei só pode restringir os direitos, liberdades e garantias nos casos expressamente previstos na Constituição, devendo as restrições limitar-se ao necessário para salvaguardar outros direitos ou interesses constitucionalmente protegidos.",
  },
  {
    diploma: "CRP",
    article: "36.º",
    epigraph: "Família, casamento e filiação",
    content:
      "Todos têm o direito de constituir família e de contrair casamento em condições de plena igualdade. A maternidade e a paternidade constituem valores sociais eminentes.",
  },
  {
    diploma: "CRP",
    article: "268.º, n.º 4",
    epigraph: "Tutela jurisdicional efectiva",
    content:
      "É garantido aos administrados tutela jurisdicional efectiva dos seus direitos ou interesses legalmente protegidos, incluindo, nomeadamente, o reconhecimento desses direitos ou interesses, a impugnação de quaisquer actos administrativos que os lesem, independentemente da sua forma, a determinação da prática de actos administrativos legalmente devidos e a adopção de medidas cautelares adequadas.",
  },
  // CDFUE — Carta dos Direitos Fundamentais da UE
  {
    diploma: "CDFUE",
    article: "47.º",
    epigraph: "Direito a recurso efectivo e a um tribunal imparcial",
    content:
      "Toda a pessoa cujos direitos e liberdades garantidos pelo direito da União tenham sido violados tem direito a uma acção perante um tribunal. Toda a pessoa tem direito a que a sua causa seja julgada de forma equitativa, publicamente e num prazo razoável, por um tribunal independente e imparcial, previamente estabelecido por lei.",
  },
];

// ─── LEGISLAÇÃO POR MÓDULO (scope: MODULE) ───

interface ModuleLeg {
  moduleCode: string;
  diploma: string;
  article: string;
  epigraph: string | null;
  content: string;
  relevance: string | null;
}

const moduleLegislation: ModuleLeg[] = [
  // sis-indicacao
  {
    moduleCode: "sis-indicacao",
    diploma: "Lei 23/2007",
    article: "77.º, n.º 1, al. i)",
    epigraph: "Recusa de emissão de autorização de residência",
    content:
      "A emissão de autorização de residência pode ser recusada quando o requerente se encontre indicado no Sistema de Informação Schengen ou na lista nacional de pessoas não admissíveis por uma das Partes Contratantes para efeitos de não admissão. Nota: não constitui causa automática de recusa — exige ponderação caso a caso.",
    relevance: "Norma habilitante invocada pela AIMA para indeferir AR com base em indicação SIS.",
  },
  {
    moduleCode: "sis-indicacao",
    diploma: "Reg. (UE) 2018/1860",
    article: "6.º",
    epigraph: "Consulta prévia para indicações SIS — nacionais de países terceiros",
    content:
      "Antes de emitir uma indicação relativa a um nacional de país terceiro para efeitos de recusa de entrada e de permanência, o Estado-Membro indicante deve verificar se a proporcionalidade da medida é adequada, tendo em conta todas as circunstâncias do caso, nomeadamente a existência de laços familiares no território dos Estados-Membros.",
    relevance:
      "Exige ponderação proporcional antes de recusar AR com base em SIS. AIMA frequentemente omite esta ponderação.",
  },
  {
    moduleCode: "sis-indicacao",
    diploma: "Reg. (UE) 2018/1860",
    article: "9.º, n.º 1",
    epigraph: "Consulta obrigatória entre Estados-Membros",
    content:
      "Quando um Estado-Membro tenha motivos para emitir um título de residência a favor de um nacional de país terceiro que se encontre indicado no SIS para efeitos de recusa de entrada por outro Estado-Membro, deve consultar previamente o Estado-Membro indicante através do procedimento SIRENE.",
    relevance:
      "AIMA deve realizar consulta SIRENE antes de recusar — omissão constitui vício procedimental.",
  },
  {
    moduleCode: "sis-indicacao",
    diploma: "Reg. (UE) 2018/1861",
    article: "27.º",
    epigraph: "Consulta em caso de emissão ou prorrogação de título de residência",
    content:
      "Quando um Estado-Membro pretender emitir ou prorrogar um título de residência, deve verificar se o nacional de país terceiro em causa se encontra indicado no SIS. Caso exista uma indicação por outro Estado-Membro, deve consultar esse Estado-Membro antes de decidir.",
    relevance: "Reforça a obrigatoriedade de consulta SIS antes de qualquer decisão sobre AR.",
  },
  {
    moduleCode: "sis-indicacao",
    diploma: "CAAS",
    article: "25.º",
    epigraph: "Procedimento SIRENE — excepção humanitária",
    content:
      "Quando uma Parte Contratante pretenda emitir um título de residência deve consultar a Parte Contratante indicante e ter em conta os interesses desta. O título de residência só pode ser emitido por motivos sérios, nomeadamente razões humanitárias ou decorrentes de obrigações internacionais. A indicação SIS será então suprimida, podendo o Estado indicante inscrever o nacional na sua lista nacional de não admissíveis.",
    relevance:
      "Prevê excepção humanitária que permite AR mesmo com indicação SIS — aplicável quando há família em PT.",
  },
  // abandono-voluntario
  {
    moduleCode: "abandono-voluntario",
    diploma: "Lei 23/2007",
    article: "138.º",
    epigraph: "Abandono voluntário do território",
    content:
      "O cidadão estrangeiro que se encontre em situação irregular pode ser notificado para abandonar voluntariamente o território nacional no prazo que lhe for fixado, que não pode ser inferior a 10 nem superior a 30 dias. A notificação para abandono voluntário (NAV) é o primeiro passo do processo de afastamento.",
    relevance:
      "Base legal da NAV. Importante verificar se o requerente estava efectivamente em situação irregular à data da notificação.",
  },
  {
    moduleCode: "abandono-voluntario",
    diploma: "Despacho n.º 3863-B/2020",
    article: "n.º 3",
    epigraph: "Pendência de pedido regulariza situação",
    content:
      "Os cidadãos estrangeiros que, à data de entrada em vigor do presente despacho, tenham pendente um pedido de autorização de residência ou manifestação de interesse junto do SEF consideram-se em situação de permanência regular em território nacional até à decisão final do respectivo procedimento.",
    relevance:
      "Se existia pedido pendente à data da NAV, a permanência era regular — NAV é ilegal.",
  },
  // erro-facto
  {
    moduleCode: "erro-facto",
    diploma: "CPA",
    article: "163.º, n.º 2, al. c)",
    epigraph: "Erro nos pressupostos de facto",
    content:
      "Os actos administrativos são também anuláveis quando os seus pressupostos de facto se encontrem incorrectamente determinados. O erro nos pressupostos de facto verifica-se quando a Administração funda a sua decisão em factos inexistentes, inexactamente apurados ou indevidamente qualificados.",
    relevance:
      "Fundamento central do módulo: demonstrar que a AIMA baseou a decisão em factos errados.",
  },
  // ilegalidade-formal — usa legislação CORE (CPA 114, 115, 121, 153, 160, 163)
  // integracao-socioprofissional
  {
    moduleCode: "integracao-socioprofissional",
    diploma: "Lei 23/2007",
    article: "88.º, n.º 2",
    epigraph: "Autorização de residência para exercício de actividade profissional",
    content:
      "A autorização de residência pode ser concedida a cidadãos estrangeiros que se encontrem em território nacional e possuam um contrato de trabalho ou uma relação laboral comprovada por sindicato, associação com assento no COCAI ou pela Autoridade para as Condições do Trabalho.",
    relevance: "Base para demonstrar integração profissional legítima do requerente em Portugal.",
  },
  // menor-portugues
  {
    moduleCode: "menor-portugues",
    diploma: "TFUE",
    article: "20.º",
    epigraph: "Cidadania da União",
    content:
      "É cidadão da União qualquer pessoa que tenha a nacionalidade de um Estado-Membro. A cidadania da União é complementar da cidadania nacional e não a substitui. Os cidadãos da União gozam dos direitos e estão sujeitos aos deveres previstos nos Tratados. Os Estados-Membros não podem adoptar medidas nacionais que tenham o efeito de privar um cidadão da União do gozo efectivo do essencial dos direitos conferidos pelo estatuto de cidadão da União.",
    relevance:
      "Base do acórdão Ruiz Zambrano: afastamento do progenitor cuidador priva o menor cidadão da UE do gozo efectivo dos seus direitos.",
  },
  {
    moduleCode: "menor-portugues",
    diploma: "Lei 23/2007",
    article: "134.º",
    epigraph: "Proibições de afastamento",
    content:
      "Não podem ser afastados do território nacional os cidadãos estrangeiros que: a) Tenham nascido em território português e aqui residam; b) Tenham a seu cargo filhos menores de nacionalidade portuguesa a residir em Portugal; c) Tenham filhos menores de nacionalidade portuguesa sobre os quais exerçam efectivamente o poder paternal e a quem assegurem o sustento e a educação. A proibição abrange tanto o afastamento coercivo como a notificação para abandono voluntário.",
    relevance:
      "Proibição absoluta de afastamento de progenitor de menor PT. Aplica-se também à NAV.",
  },
  {
    moduleCode: "menor-portugues",
    diploma: "Lei 23/2007",
    article: "26.º, n.º 3",
    epigraph: "Interesse superior da criança",
    content:
      "Em todas as decisões relativas a menores, a AIMA deve ter em consideração o interesse superior da criança, em conformidade com a Convenção sobre os Direitos da Criança.",
    relevance:
      "Dever legal de ponderação do interesse da criança em qualquer decisão de afastamento.",
  },
  // proibicoes-absolutas
  {
    moduleCode: "proibicoes-absolutas",
    diploma: "Lei 23/2007",
    article: "134.º, n.º 1, al. c)",
    epigraph: "Proibição absoluta — progenitor de menor nacional",
    content:
      "Não podem ser afastados do território nacional os cidadãos estrangeiros que tenham filhos menores de nacionalidade portuguesa sobre os quais exerçam efectivamente o poder paternal e a quem assegurem o sustento e a educação. Esta proibição é automática e binária: verificados os pressupostos, não admite ponderação caso a caso.",
    relevance:
      "Norma central do módulo. Verificação: (1) filiação, (2) nacionalidade PT do menor, (3) exercício efectivo do poder paternal, (4) sustento e educação.",
  },
  // meios-subsistencia-agregado
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "Lei 23/2007",
    article: "77.º, n.º 1, al. d)",
    epigraph: "Posse de meios de subsistência — requisito geral",
    content:
      "A concessão de autorização de residência depende da verificação cumulativa de requisitos gerais, entre os quais a posse de meios de subsistência, tal como definidos pela portaria a que se refere a alínea d) do n.º 1 do art. 52.º (remete para a Portaria 1563/2007). O requisito é genérico e não exige que os meios provenham de fonte específica.",
    relevance:
      "Norma central: a posse de meios de subsistência é requisito geral, não específico do art. 88.º. A AIMA erra ao densificá-lo como se fosse requisito próprio da AR para atividade subordinada.",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "Lei 23/2007",
    article: "88.º, n.os 1, 2 e 6",
    epigraph: "AR para exercício de atividade profissional subordinada",
    content:
      "N.º 1 — contrato de trabalho celebrado nos termos da lei e inscrição na segurança social. N.º 2 — mediante manifestação de interesse: (a) contrato/promessa/relação laboral comprovada; (b) entrada legal; (c) inscrição na SS. N.º 6 — presunção de entrada legal quando o requerente trabalhe em território nacional e tenha situação regularizada perante a SS há pelo menos 12 meses. O artigo NÃO exige, como requisito específico, que os meios de subsistência provenham da atividade profissional subordinada concretamente exercida.",
    relevance:
      "Pedra de toque da tese: os requisitos específicos do art. 88.º são contrato + SS + entrada legal. Meios de subsistência é requisito GERAL do art. 77.º, não específico do 88.º.",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "DR 84/2007",
    article: "53.º, n.º 1, al. b)",
    epigraph: "Instrução do pedido — comprovativo de meios de subsistência",
    content:
      "O requerimento de concessão de autorização de residência é instruído com comprovativo de meios de subsistência, nos termos da portaria prevista na alínea d) do n.º 1 do artigo 52.º da Lei n.º 23/2007.",
    relevance:
      "Remete a instrução dos meios de subsistência para a Portaria 1563/2007, que prevê cômputo por agregado familiar.",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "DR 84/2007",
    article: "5.º, n.º 2",
    epigraph: "Força probatória do termo de responsabilidade",
    content:
      "O termo de responsabilidade subscrito por cidadão português ou cidadão estrangeiro habilitado com título de residência constitui meio probatório legalmente reconhecido para efeitos de demonstração dos meios de subsistência. A força probatória específica decorre desta disposição.",
    relevance:
      "Base legal para exigir que a AIMA se pronuncie sobre o termo de responsabilidade. Omissão de pronúncia = vício autónomo.",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "Portaria 1563/2007",
    article: "2.º, n.º 2",
    epigraph: "Critério de determinação dos meios — RMMG por agregado familiar",
    content:
      "O critério de determinação dos meios de subsistência é a retribuição mínima mensal garantida nos termos do art. 266.º do Código do Trabalho, aferido por referência ao agregado familiar. Existindo agregado familiar estável demonstrado, a AIMA tem o dever legal de o considerar no cômputo.",
    relevance:
      "NORMA-CHAVE: estabelece expressamente que o cômputo dos meios é feito por referência ao agregado familiar, não apenas pelos rendimentos individuais do requerente.",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "Portaria 1563/2007",
    article: "7.º, n.º 1",
    epigraph: "Disponibilidade ou possibilidade de adquirir meios",
    content:
      "Para efeitos de concessão ou renovação de autorização de residência temporária, o requerente deve comprovar que mantém a disponibilidade ou a possibilidade de adquirir legalmente os meios de subsistência a que alude o artigo 5.º da presente portaria, atendendo à finalidade da autorização de residência. A norma exige disponibilidade/possibilidade, NÃO que os meios resultem exclusivamente da atividade profissional.",
    relevance:
      "Contraargumento antecipado: a AIMA invoca este artigo para exigir origem subordinada. Deve ser neutralizado — a norma fala em 'disponibilidade/possibilidade', não em exclusividade da fonte.",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "DL 37-A/2024",
    article: "3.º, n.º 2",
    epigraph: "Regime de salvaguarda — pedidos anteriores",
    content:
      "Os pedidos de autorização de residência com manifestação de interesse apresentada antes da entrada em vigor do presente decreto-lei continuam a reger-se pela redação anterior da Lei 23/2007, conferida pela Lei n.º 53/2023, de 31 de agosto, por aplicação do art. 12.º do Código Civil. O regime de salvaguarda preserva o art. 88.º para pedidos já apresentados.",
    relevance:
      "Indispensável invocar na PI: sem este artigo, a AIMA pode tentar aplicar a redação atual (que eliminou o regime de manifestação de interesse) na reapreciação condenada.",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "Lei 23/2007",
    article: "12.º",
    epigraph: "Termo de responsabilidade",
    content:
      "O termo de responsabilidade subscrito por cidadão português ou cidadão estrangeiro com título de residência constitui meio de prova dos meios de subsistência para efeitos de concessão de autorização de residência, nos termos regulamentados no Decreto Regulamentar n.º 84/2007.",
    relevance:
      "Combinado com art. 5.º/2 DR 84/2007, impõe força probatória legal ao termo de responsabilidade. Desconsideração pela AIMA = omissão de pronúncia.",
  },
  // proporcionalidade
  {
    moduleCode: "proporcionalidade",
    diploma: "CEDH",
    article: "8.º",
    epigraph: "Direito ao respeito pela vida privada e familiar",
    content:
      "1. Qualquer pessoa tem direito ao respeito da sua vida privada e familiar, do seu domicílio e da sua correspondência. 2. Não pode haver ingerência da autoridade pública no exercício deste direito senão quando esta ingerência estiver prevista na lei e constituir uma providência que, numa sociedade democrática, seja necessária para a segurança nacional, para a segurança pública, para o bem-estar económico do país, a defesa da ordem e a prevenção das infracções penais, a protecção da saúde ou da moral, ou a protecção dos direitos e das liberdades de terceiros.",
    relevance:
      "Base convencional para protecção da vida familiar. Interferência (recusa de AR) deve ser prevista na lei, necessária e proporcional.",
  },
];

// ─── JURISPRUDÊNCIA POR MÓDULO ───

interface ModuleJuris {
  moduleCode: string;
  court: string;
  caseNumber: string;
  date: string;
  summary: string;
  keyPassage: string | null;
  tags: string[];
}

const moduleJurisprudence: ModuleJuris[] = [
  // menor-portugues / proibicoes-absolutas
  {
    moduleCode: "menor-portugues",
    court: "TJUE",
    caseNumber: "C-34/09",
    date: "08-03-2011",
    summary:
      "Acórdão Ruiz Zambrano — O art. 20.º TFUE opõe-se a medidas nacionais que tenham por efeito privar os cidadãos da União do gozo efectivo do essencial dos direitos conferidos pelo seu estatuto de cidadão da União. O afastamento do progenitor de um menor cidadão da UE, que seja cuidador principal, obriga de facto o menor a abandonar o território da União.",
    keyPassage:
      "O artigo 20.º TFUE deve ser interpretado no sentido de que se opõe a que um Estado-Membro, por um lado, recuse a um nacional de um Estado terceiro, que tem a seu cargo os seus filhos de tenra idade, cidadãos da União, a autorização de residência no Estado-Membro de residência destes últimos e de que estes são nacionais e, por outro, recuse ao referido nacional de um Estado terceiro uma autorização de trabalho, na medida em que tais decisões privem os referidos filhos do gozo efectivo do essencial dos direitos associados ao estatuto de cidadão da União.",
    tags: ["art-20-TFUE", "cidadania-UE", "progenitor-cuidador", "menor-EU"],
  },
  // sis-indicacao
  {
    moduleCode: "sis-indicacao",
    court: "TJUE",
    caseNumber: "C-193/19",
    date: "2020",
    summary:
      "Acórdão A c. Migrationsverket — O Tribunal de Justiça confirmou que a indicação SIS por um Estado-Membro não constitui fundamento automático de recusa de autorização de residência por outro Estado-Membro. É obrigatória a consulta prévia ao Estado indicante e a ponderação das circunstâncias individuais, incluindo laços familiares.",
    keyPassage:
      "A existência de uma indicação SIS não dispensa o Estado-Membro consultante de proceder a uma apreciação individualizada da situação do interessado, ponderando designadamente os seus laços familiares e pessoais no território, antes de recusar a emissão ou renovação do título de residência.",
    tags: ["SIS", "consulta-SIRENE", "ponderacao-individual"],
  },
  // meios-subsistencia-agregado
  {
    moduleCode: "meios-subsistencia-agregado",
    court: "TAF Loulé",
    caseNumber: "247/26.0BELLE-A / 247/26.0BELLE",
    date: "21-04-2026",
    summary:
      "Saneador-Sentença — Ação totalmente procedente. AIMA condenada a reapreciar pedido de AR para atividade profissional subordinada. O Tribunal declarou que: (1) a AIMA não pode exigir que os meios de subsistência provenham da atividade profissional subordinada, pois tal requisito não consta da lei; (2) o cômputo dos meios faz-se por referência ao agregado familiar (art. 2.º/2 Portaria 1563/2007); (3) a omissão de pronúncia sobre termo de responsabilidade constitui vício autónomo; (4) o art. 7.º/1 da Portaria 1563/2007 refere-se a 'disponibilidade/possibilidade' e não a origem exclusiva dos meios. Conhecimento imediato do mérito via art. 121.º/1 CPTA. Juiz Carlos Sérgio Madureira Rodrigues.",
    keyPassage:
      "não estando em causa um requisito específico da concessão de autorização de residência para exercício de atividade profissional subordinada, temos que a Requerida retira da lei o desenvolvimento de um requisito que da mesma não consta. Por outras palavras, se, com efeito, o/a Requerente deve fazer prova da posse dos meios de subsistência (art. 116.º do CPA) cujo critério de determinação é efetuado por referência à retribuição mínima mensal garantida nos termos do n.º 1 do artigo 266.º do Código do Trabalho (...) ponto é que nada obsta a que tal determinação seja feita por referência ao agregado familiar.",
    tags: [
      "meios_de_subsistencia",
      "agregado_familiar",
      "art_88_lei_23_2007",
      "art_77_lei_23_2007",
      "portaria_1563_2007",
      "termo_de_responsabilidade",
      "acpad",
      "indeferimento_aima",
      "erro_pressupostos_direito",
      "defice_fundamentacao",
      "omissao_pronuncia",
    ],
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    court: "TCA-Norte",
    caseNumber: "02050/12.5BEPRT",
    date: "08-01-2016",
    summary:
      "Acórdão do TCA-Norte que estabelece que o cômputo dos meios de subsistência para efeitos de concessão de autorização de residência deve ser feito por referência ao agregado familiar, nos termos do art. 2.º, n.º 2 da Portaria 1563/2007. Expressamente invocado na sentença do TAF de Loulé (proc. 247/26.0BELLE-A) como suporte para esta tese.",
    keyPassage: null,
    tags: ["meios_de_subsistencia", "agregado_familiar", "portaria_1563_2007", "tca_norte"],
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    court: "TCA-Norte",
    caseNumber: "02421/24.4BEPRT",
    date: "04-07-2025",
    summary:
      "Acórdão do TCA-Norte sobre os efeitos do art. 66.º, n.º 2 CPTA: a procedência do pedido condenatório (condenação à prática de ato devido) elimina automaticamente o ato de indeferimento impugnado, tornando desnecessária a sua impugnação autónoma. Citado na sentença de Loulé para fundamentar que a pronúncia sobre a impugnação fica prejudicada.",
    keyPassage: null,
    tags: ["art_66_cpta", "condenacao_ato_devido", "eliminacao_ato_impugnado", "processual"],
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    court: "TCAS",
    caseNumber: "02088/06",
    date: "26-03-2009",
    summary:
      "Acórdão do Tribunal Central Administrativo Sul que admite o conhecimento do mérito da ação principal (ACPAD) em sede de processo cautelar, ao abrigo do art. 121.º, n.º 1 CPTA, quando a matéria assuma cariz essencialmente de direito e as partes não se oponham. Técnica processual utilizada com sucesso no caso TAF Loulé (proc. 247/26.0BELLE-A).",
    keyPassage: null,
    tags: ["art_121_cpta", "cautelar_apensada", "conhecimento_merito", "tecnica_processual"],
  },
  // proporcionalidade
  {
    moduleCode: "proporcionalidade",
    court: "TEDH",
    caseNumber: "55597/09",
    date: "28-06-2011",
    summary:
      "Acórdão Nunez c. Noruega — O TEDH considerou que a expulsão de uma mãe de dois filhos menores residentes na Noruega, mesmo havendo violação das regras de imigração, constituiu violação do art. 8.º CEDH. O interesse superior das crianças e a consolidação da vida familiar em território norueguês prevaleceram sobre o interesse público na regulação da imigração.",
    keyPassage:
      "The Court considers that, given the children's long residence in Norway and their integration in the country, the decision to expel their mother would seriously affect the family's established private and family life, in violation of Article 8 of the Convention.",
    tags: ["art-8-CEDH", "vida-familiar", "menores", "proporcionalidade", "expulsao"],
  },
  {
    moduleCode: "proporcionalidade",
    court: "TEDH",
    caseNumber: "50435/99",
    date: "31-01-2006",
    summary:
      "Acórdão Rodrigues da Silva e Hoogkamer c. Países Baixos — O TEDH considerou que a recusa de autorização de residência a uma mãe brasileira de menor neerlandesa, mesmo em situação irregular, violou o art. 8.º CEDH. A relação afectiva real com a filha menor e o facto de a criança crescer nos Países Baixos impunham a ponderação do interesse familiar sobre a regulação migratória.",
    keyPassage:
      "The Court has to establish whether a fair balance has been struck between the competing interests, namely the personal interest of the applicant and her daughter in the applicant's continued residence in the Netherlands, and the public order interest of the Government in controlling immigration. In the circumstances, the Court considers that insufficient weight was given to the best interests of the child.",
    tags: ["art-8-CEDH", "vida-familiar", "menor-nacional", "proporcionalidade"],
  },
];

// ─── NOTAS PRÁTICAS POR MÓDULO ───

interface ModuleNote {
  moduleCode: string;
  content: string;
  category: "GENERAL" | "TRIBUNAL_SPECIFIC" | "PROCEDURAL" | "STRATEGIC";
}

const platformNotes: ModuleNote[] = [
  {
    moduleCode: "sis-indicacao",
    content:
      "Verificar sempre a data de inserção SIS face à data do pedido de AR. Se o pedido de AR é anterior à inserção SIS, a indicação é superveniente e não pode fundamentar indeferimento do pedido original — princípio das expectativas legítimas (CRP art. 266.º/2, CPA art. 10.º). Solicitar ao requerente que esclareça se sabe qual Estado-Membro inseriu a indicação e motivo.",
    category: "STRATEGIC",
  },
  {
    moduleCode: "sis-indicacao",
    content:
      "A AIMA raramente realiza a consulta SIRENE obrigatória (arts. 9.º/1 Reg. 2018/1860, 27.º Reg. 2018/1861). Alegar sempre a omissão de consulta como vício procedimental autónomo, mesmo que também se invoque a desproporcionalidade substantiva.",
    category: "PROCEDURAL",
  },
  {
    moduleCode: "abandono-voluntario",
    content:
      "Verificar se o requerente tinha pedido pendente de AR à data da NAV. Se sim, a permanência era regular por força do Despacho n.º 3863-B/2020 — a NAV é ilegal ab initio. Solicitar print do portal AIMA mostrando data do agendamento/pedido.",
    category: "STRATEGIC",
  },
  {
    moduleCode: "ilegalidade-formal",
    content:
      "Transcrever literalmente o texto da decisão impugnada na matéria de facto, com referência ao Doc. n.º, para depois contrapor na matéria de direito a insuficiência da fundamentação. O tribunal aprecia melhor quando vê o texto original do acto citado.",
    category: "PROCEDURAL",
  },
  {
    moduleCode: "erro-facto",
    content:
      "Identificar com precisão qual facto a AIMA considerou provado ou pressuposto e qual é o facto real, com suporte documental. Não misturar erro de facto com erro de direito — se o facto está correcto mas a AIMA aplicou a norma errada, é erro de direito (usar bloco II.2 do módulo direito, não este módulo).",
    category: "GENERAL",
  },
  {
    moduleCode: "menor-portugues",
    content:
      "Juntar sempre: certidão de nascimento do menor (mostrando filiação e nacionalidade PT), declaração do infantário/escola/centro de saúde confirmando que o requerente é o cuidador principal, e comprovativo de morada comum. Se o outro progenitor está ausente ou não tem AR, reforçar que o afastamento do requerente deixa o menor sem cuidador em PT.",
    category: "PROCEDURAL",
  },
  {
    moduleCode: "proibicoes-absolutas",
    content:
      "O art. 134.º é uma proibição absoluta — não admite ponderação. Uma vez verificados os pressupostos (filiação + nacionalidade PT + exercício efectivo do poder paternal), a consequência é automática. Não confundir com o art. 8.º CEDH que exige teste de proporcionalidade. Invocar ambos, mas distinguir: art. 134.º como proibição legal absoluta, art. 8.º CEDH como direito fundamental complementar.",
    category: "STRATEGIC",
  },
  {
    moduleCode: "proporcionalidade",
    content:
      "O teste de proporcionalidade do CPA art. 7.º tem três dimensões: adequação (a medida é apta a atingir o fim?), necessidade (não existe medida menos gravosa?) e proporcionalidade stricto sensu (o benefício público supera o dano privado?). Desenvolver cada dimensão separadamente na matéria de direito. A AIMA podia ter notificado para suprir deficiência documental (CPA art. 11.º) em vez de indeferir — apontar sempre esta alternativa menos gravosa.",
    category: "STRATEGIC",
  },
  // meios-subsistencia-agregado
  {
    moduleCode: "meios-subsistencia-agregado",
    content:
      "Verificar SEMPRE, antes de instaurar, se o pedido foi apresentado sob a redação da Lei 23/2007 pré-DL 37-A/2024. Só nesses casos é aplicável o art. 88.º na redação que esta tese invoca. Invocar expressamente o art. 3.º, n.º 2 DL 37-A/2024 e art. 12.º CC na PI para proteger o regime de salvaguarda contra tentativa da AIMA de aplicar a redação actual na reapreciação.",
    category: "STRATEGIC",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    content:
      "Estruturar a PI em torno do ERRO DE DIREITO PRINCIPAL (AIMA criou requisito sem base legal), com dois eixos de reforço: (1) cômputo por agregado familiar e (2) omissão de pronúncia sobre termo de responsabilidade. NÃO ancorar a PI em retórica de direitos fundamentais (art. 8.º CEDH, proporcionalidade em abstrato) — o TAF Loulé ignorou expressamente esses argumentos. A procedência assenta em legalidade estrita.",
    category: "STRATEGIC",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    content:
      "Técnica processual recomendada: propor cautelar de suspensão de eficácia (NAV + indeferimento) apensada à ACPAD, e requerer conhecimento imediato do mérito via art. 121.º, n.º 1 CPTA. Esta técnica foi utilizada com sucesso no caso de Loulé — o Tribunal conheceu do mérito da ACPAD em saneador, dispensando instrução e requisitos cautelares. Juntar prova documental exaustiva que dispense inquirição.",
    category: "PROCEDURAL",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    content:
      "Checklist documental obrigatória para instruir o pedido: (1) assento de casamento/união de facto, (2) AR ou título do cônjuge, (3) termo de responsabilidade (art. 5.º/2 DR 84/2007), (4) extratos bancários contínuos do cônjuge/agregado, (5) IRS conjunto, (6) certidões fiscais do cônjuge (AT + SS), (7) certidão de património imobiliário, (8) comprovativos de rendimentos do cônjuge, (9) atestado de residência da junta, (10) inscrição na SS + histórico contributivo do requerente.",
    category: "PROCEDURAL",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    content:
      "A sentença do TAF Loulé (proc. 247/26.0BELLE-A) é de 1.ª instância — aguardar eventual recurso e trânsito para consolidação em sede superior. Verificar em DGSI a subsistência do acórdão TCA-Norte proc. 02050/12.5BEPRT. Em sede de recurso da AIMA, preparar contra-alegações ancoradas no eixo tripartido (erro de direito + agregado familiar + omissão de pronúncia).",
    category: "GENERAL",
  },
  {
    moduleCode: "integracao-socioprofissional",
    content:
      "A integração socioprofissional deve ser demonstrada por: (1) tempo total de residência em PT, (2) contrato de trabalho ou actividade profissional com comprovativo de SS, (3) alojamento estável, (4) laços familiares em PT, (5) ausência de cadastro criminal, (6) fragilidade dos laços com o país de origem. Cada elemento deve ter suporte documental. Quanto maior o tempo de residência, mais forte o argumento.",
    category: "GENERAL",
  },
];

// ─── CORE REFS (módulos que puxam artigos CORE) ───

interface CoreRefLink {
  moduleCode: string;
  diploma: string;
  article: string;
  context: string;
}

const coreRefs: CoreRefLink[] = [
  {
    moduleCode: "ilegalidade-formal",
    diploma: "CPA",
    article: "114.º, n.º 1",
    context: "Dever de notificação — ausência constitui vício de forma",
  },
  {
    moduleCode: "ilegalidade-formal",
    diploma: "CPA",
    article: "115.º",
    context: "Meios válidos de notificação — notificação por email simples é inválida",
  },
  {
    moduleCode: "ilegalidade-formal",
    diploma: "CPA",
    article: "121.º, n.º 1",
    context: "Audiência prévia — omissão constitui preterição de formalidade essencial",
  },
  {
    moduleCode: "ilegalidade-formal",
    diploma: "CPA",
    article: "153.º, n.º 1",
    context: "Fundamentação — insuficiência constitui vício de forma",
  },
  {
    moduleCode: "ilegalidade-formal",
    diploma: "CPA",
    article: "160.º, n.º 1",
    context: "Eficácia — acto não notificado não produz efeitos",
  },
  {
    moduleCode: "ilegalidade-formal",
    diploma: "CPA",
    article: "163.º, n.º 1",
    context: "Consequência: anulabilidade por vício de forma ou procedimento",
  },
  {
    moduleCode: "proporcionalidade",
    diploma: "CPA",
    article: "7.º",
    context:
      "Princípio da proporcionalidade — três dimensões (adequação, necessidade, proporcionalidade s.s.)",
  },
  {
    moduleCode: "proporcionalidade",
    diploma: "CRP",
    article: "18.º, n.º 2",
    context:
      "Restrição de direitos só admissível para salvaguarda de outros direitos constitucionais",
  },
  {
    moduleCode: "menor-portugues",
    diploma: "CRP",
    article: "36.º",
    context: "Direito fundamental à família — protecção constitucional do vínculo familiar",
  },
  {
    moduleCode: "proibicoes-absolutas",
    diploma: "CRP",
    article: "36.º",
    context: "Protecção constitucional da família — complemento à proibição legal do art. 134.º",
  },
  // meios-subsistencia-agregado — puxa artigos CORE relevantes
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "CPA",
    article: "121.º, n.º 1",
    context:
      "Audiência prévia — junção de documentos em audiência impõe pronúncia expressa pela AIMA",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "CPA",
    article: "153.º, n.º 1",
    context:
      "Dever de fundamentação — omissão de pronúncia sobre termo de responsabilidade configura défice",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "CPA",
    article: "163.º, n.º 1",
    context:
      "Consequência: anulabilidade por criação de requisito sem base legal e omissão de pronúncia",
  },
  {
    moduleCode: "meios-subsistencia-agregado",
    diploma: "CPTA",
    article: "66.º, n.º 2",
    context:
      "Efeito da condenação: procedência condenatória elimina automaticamente o ato de indeferimento",
  },
];

// ─── MAIN SEED FUNCTION ───

async function main() {
  // 1. Upsert modules
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
  console.log(`✓ ${modules.length} módulos temáticos`);

  // 2. Upsert CORE legislation
  const coreLegIds: Record<string, string> = {};
  for (const leg of coreLegislation) {
    const existing = await prisma.legislation.findFirst({
      where: { diploma: leg.diploma, article: leg.article, scope: "CORE" },
    });
    if (existing) {
      await prisma.legislation.update({
        where: { id: existing.id },
        data: { epigraph: leg.epigraph, content: leg.content },
      });
      coreLegIds[`${leg.diploma}:${leg.article}`] = existing.id;
    } else {
      const created = await prisma.legislation.create({
        data: { ...leg, scope: "CORE" },
      });
      coreLegIds[`${created.diploma}:${created.article}`] = created.id;
    }
  }
  console.log(`✓ ${coreLegislation.length} artigos CORE`);

  // 3. Upsert MODULE legislation + links
  let modLegCount = 0;
  for (const ml of moduleLegislation) {
    const mod = await prisma.thematicModule.findUnique({ where: { code: ml.moduleCode } });
    if (!mod) continue;

    // Find or create the legislation article
    let leg = await prisma.legislation.findFirst({
      where: { diploma: ml.diploma, article: ml.article, scope: "MODULE" },
    });
    if (!leg) {
      leg = await prisma.legislation.create({
        data: {
          diploma: ml.diploma,
          article: ml.article,
          epigraph: ml.epigraph,
          content: ml.content,
          scope: "MODULE",
        },
      });
    } else {
      await prisma.legislation.update({
        where: { id: leg.id },
        data: { epigraph: ml.epigraph, content: ml.content },
      });
    }

    // Create link if not exists
    const existingLink = await prisma.moduleLegislation.findFirst({
      where: { moduleId: mod.id, legislationId: leg.id },
    });
    if (!existingLink) {
      await prisma.moduleLegislation.create({
        data: { moduleId: mod.id, legislationId: leg.id, relevance: ml.relevance },
      });
    }
    modLegCount++;
  }
  console.log(`✓ ${modLegCount} artigos de módulos linkados`);

  // 4. Upsert jurisprudence
  let jurisCount = 0;
  for (const j of moduleJurisprudence) {
    const mod = await prisma.thematicModule.findUnique({ where: { code: j.moduleCode } });
    if (!mod) continue;

    const existing = await prisma.moduleJurisprudence.findFirst({
      where: { moduleId: mod.id, caseNumber: j.caseNumber },
    });
    if (!existing) {
      await prisma.moduleJurisprudence.create({
        data: {
          moduleId: mod.id,
          court: j.court,
          caseNumber: j.caseNumber,
          date: j.date,
          summary: j.summary,
          keyPassage: j.keyPassage,
          tags: j.tags,
        },
      });
    } else {
      await prisma.moduleJurisprudence.update({
        where: { id: existing.id },
        data: {
          court: j.court,
          date: j.date,
          summary: j.summary,
          keyPassage: j.keyPassage,
          tags: j.tags,
        },
      });
    }
    jurisCount++;
  }
  console.log(`✓ ${jurisCount} acórdãos`);

  // 5. Upsert platform notes
  let notesCount = 0;
  for (const n of platformNotes) {
    const mod = await prisma.thematicModule.findUnique({ where: { code: n.moduleCode } });
    if (!mod) continue;

    // Simple dedup: check if note with same module and similar content exists
    const existing = await prisma.platformNote.findFirst({
      where: { moduleId: mod.id, content: n.content },
    });
    if (!existing) {
      await prisma.platformNote.create({
        data: {
          moduleId: mod.id,
          content: n.content,
          category: n.category,
        },
      });
    }
    notesCount++;
  }
  console.log(`✓ ${notesCount} notas práticas`);

  // 6. Core refs (module → CORE legislation cross-references)
  let coreRefCount = 0;
  for (const cr of coreRefs) {
    const mod = await prisma.thematicModule.findUnique({ where: { code: cr.moduleCode } });
    if (!mod) continue;

    const legId = coreLegIds[`${cr.diploma}:${cr.article}`];
    if (!legId) {
      console.warn(`⚠ Core ref not found: ${cr.diploma} ${cr.article}`);
      continue;
    }

    const existing = await prisma.moduleCoreRef.findFirst({
      where: { moduleId: mod.id, legislationId: legId },
    });
    if (!existing) {
      await prisma.moduleCoreRef.create({
        data: { moduleId: mod.id, legislationId: legId, context: cr.context },
      });
    }
    coreRefCount++;
  }
  console.log(`✓ ${coreRefCount} referências cruzadas CORE`);

  console.log("\n✅ Seed completo!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

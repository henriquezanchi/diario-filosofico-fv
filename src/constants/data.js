export const DEFAULT_FV_DAILY = {
  item1: '', item2: '', item34: '', item5: '', item6: '', item7: '',
  horasVoluntariado: '', horasAulaAssistida: '', horasAulaMinistrada: '',
  gdveTasksStatus: {}, gdveAttendance: false,
  praticas: {
    tratak: false, recitarHonra: false, recitar7Fases: false,
    camara: false, templo: false, porta: false,
    patioAberto: false, patioColunas: false, santuario: false
  }
};

export const BASTIOES_DB = [
  { name: "Bastiões 1976 - 001 a 006", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23101&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
  { name: "Bastiões 1977 - 007 a 017", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23102&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
  { name: "Bastiões 1978 - 018 a 029", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23103&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" },
  { name: "Bastiões 1979 - 029 a 039", link: "https://biblioteca.acropolebrasil.com.br/cgi-bin/koha/opac-detail.pl?biblionumber=23104&query_desc=kw%2Cwrdl%3A%20basti%C3%B5es" }
];

export const virtues = [
    // --- VIRTUDES CLÁSSICAS ---
    { 
      name: "Paciência", 
      shortDesc: "Uma forma de fé", 
      description: "Capacidade de suportar as adversidades sem se alterar, compreendendo os ritmos naturais do tempo e o processo das coisas.", 
      practices: "• Não reagir à primeira provocação\n• Esperar 10 segundos antes de responder\n• Aceitar o ritmo das outras pessoas", 
      internalPractices: "• Suportar as dificuldades da filiação sem críticas\n• Aguardar o ritmo natural da Escola\n• Exercer paciência com as falhas dos irmãos de ideal",
      quote: "A paciência não é a capacidade de esperar, mas como nos comportamos enquanto esperamos.", quoteAuthor: "J.A. Livraga", color: "#4A90E2" 
    },
    { 
      name: "Coragem", 
      shortDesc: "Agir com o coração", 
      description: "Não é a ausência do medo, mas a ação decidida e reta, movida pelo dever, apesar da presença do medo.", 
      practices: "• Fazer o que deve ser feito, mesmo com receio\n• Assumir a responsabilidade de um erro\n• Defender a verdade de forma justa",
      internalPractices: "• Assumir missões e responsabilidades no GDVE\n• Enfrentar o 'Kurava' dominante apontado pela IA\n• Defender os ideais acropolitanos perante o mundo", 
      quote: "Coragem é a resistência ao medo, o domínio do medo, e não a ausência do medo.", quoteAuthor: "Mark Twain", color: "#E74C3C" 
    },
    { 
      name: "Prudência", 
      shortDesc: "Sabedoria prática em ação", 
      description: "O discernimento que permite escolher os melhores caminhos e meios para alcançar um fim nobre.", 
      practices: "• Avaliar consequências antes de agir\n• Buscar conselho de pessoas sábias\n• Silenciar quando não se tem certeza",
      internalPractices: "• Consultar o Instrutor/Mestre antes de grandes decisões\n• Aplicar o discernimento (Viveka) nas ações\n• Preservar o silêncio e o mistério das práticas", 
      quote: "A prudência é a verdadeira mãe de todas as virtudes.", quoteAuthor: "Cícero", color: "#16A085" 
    },
    { 
      name: "Justiça", 
      shortDesc: "Dar a cada um de acordo com sua natureza e seus atos", 
      description: "A busca pelo equilíbrio e equidade, não segundo a conveniência egoísta, mas segundo a Lei Universal.", 
      practices: "• Não julgar por simpatias ou antipatias\n• Cumprir com as próprias obrigações\n• Reconhecer o mérito do outro",
      internalPractices: "• Agir de acordo com o Dharma\n• Cumprir rigorosamente suas escalas de serviço\n• Ser impecavelmente justo no trato com os companheiros", 
      quote: "A justiça não é outra coisa senão a conveniência do homem em sociedade.", quoteAuthor: "Platão", color: "#C0392B" 
    },
    { 
      name: "Disciplina", 
      shortDesc: "O alinhamento interior", 
      description: "O método pelo qual o ser humano alinha sua personalidade inferior aos propósitos de sua consciência superior.", 
      practices: "• Cumprir o cronograma estabelecido para o dia\n• Não ceder à preguiça em tarefas diárias\n• Terminar rigorosamente o que se começou",
      internalPractices: "• Fazer o Tratak e práticas diárias sem negociar\n• Assiduidade impecável nas atividades da filial\n• Cumprir os preceitos do Código de Honra", 
      quote: "A disciplina é a ponte entre as metas e as realizações.", quoteAuthor: "Jim Rohn", color: "#34495E" 
    },
    { 
      name: "Devoção", 
      shortDesc: "O Amor à verdade", 
      description: "O amor profundo que move o ser humano a entregar-se a uma causa sagrada ou a um ideal nobre.", 
      practices: "• Realizar ações cotidianas com elevado propósito\n• Manter o ambiente de estudo limpo e organizado\n• Ler textos atemporais com respeito e foco",
      internalPractices: "• Cultivar Bhakti pelo Ideal e pelo Mestre\n• Realizar limpezas e serviços como oferenda\n• Reverenciar os Símbolos da Escola", 
      quote: "Aquele que realiza todas as suas ações por Mim, e para quem Eu sou a meta suprema, esse chega a Mim.", quoteAuthor: "Bhagavad Gita", color: "#9B59B6" 
    },
    
    // --- PILARES FUNDAMENTAIS ---
    { 
      name: "Investigação", 
      shortDesc: "A busca pela Verdade", 
      description: "O estudo que não aceita dogmas cegos, mas busca ativamente as leis universais na Natureza e no homem.", 
      practices: "• Questionar os porquês antes de aceitar\n• Ler e meditar sobre uma página de filosofia profunda\n• Observar atentamente as leis da natureza",
      internalPractices: "• Aprofundar-se nos ensinamentos do Módulo GDVE\n• Realizar o autoexame de Kurukshetra com rigor\n• Estudo comparado de Religiões, Ciências e Artes", 
      quote: "Não há religião superior à Verdade.", quoteAuthor: "H.P. Blavatsky", color: "#2980B9" 
    },
    { 
      name: "Serviço", 
      shortDesc: "A Prática da Verdade", 
      description: "O ato de colocar as próprias mãos e mente a serviço da humanidade, sem buscar recompensas.", 
      practices: "• Fazer um trabalho invisível que ninguém quer fazer\n• Ajudar proativamente uma causa ou comunidade\n• Renunciar ao conforto pessoal por um dever",
      internalPractices: "• Acumular horas reais de trabalho na Filial\n• Apoiar ativamente as demandas do GAF\n• Praticar o Karma Yoga: ação sem apego", 
      quote: "Dorme o homem que trabalha para si. Desperta o que trabalha para a humanidade.", quoteAuthor: "J.A. Livraga", color: "#F39C12" 
    },
    { 
      name: "Generosidade", 
      shortDesc: "Gerar para dar", 
      description: "Compartilhar tempo, atenção e recursos de forma ampla, expandindo os próprios limites da bondade.", 
      practices: "• Ouvir alguém ativamente sem interromper\n• Partilhar conhecimento sem vaidade intelectual\n• Doar tempo de qualidade para apoiar alguém",
      internalPractices: "• Dar oportunidades de serviço e brilho ao outro\n• Compartilhar sabedoria fraterna nas reuniões\n• Apoiar financeiramente ou materialmente a Escola", 
      quote: "O pouco que se dá com o coração vale muito; o muito que se dá sem ele, não vale nada.", quoteAuthor: "Délia Steinberg Guzmán", color: "#27AE60" 
    },
    { 
      name: "Beleza", 
      shortDesc: "O resplendor da Verdade", 
      description: "A percepção estética e moral da harmonia em todas as coisas e ações do cotidiano.", 
      practices: "• Ouvir música clássica ou elevada com atenção\n• Arrumar-se e vestir-se com dignidade\n• Falar palavras limpas, evitando a vulgaridade",
      internalPractices: "• Cuidar da estética e limpeza do Templo/Filial\n• Contemplar a Arte como via de ascensão\n• Harmonizar o próprio discurso nas reuniões GDVE", 
      quote: "A beleza é o esplendor da verdade.", quoteAuthor: "Platão", color: "#E84393" 
    },
    { 
      name: "Bondade", 
      shortDesc: "A manifestação do Bem", 
      description: "A inclinação natural da Vontade em direção ao bem, promovendo a compaixão e o amparo.", 
      practices: "• Evitar completamente a crítica destrutiva\n• Treinar o olhar para o lado luminoso das pessoas\n• Agir imediatamente para aliviar a carga do outro",
      internalPractices: "• Ter compaixão estoica pelas falhas dos confrades\n• Fazer críticas apenas se forem construtivas e ao Diretor\n• Zelar ativamente pela fraternidade da filial", 
      quote: "A verdadeira bondade consiste não apenas em não fazer o mal, mas em nem sequer desejá-lo.", quoteAuthor: "Sêneca", color: "#FF69B4" 
    },
    { 
      name: "Ordem", 
      shortDesc: "A expressão da harmonia", 
      description: "A capacidade de alinhar a própria vida, o espaço ao redor e os pensamentos a um ritmo estruturado.", 
      practices: "• Arrumar a própria cama logo pela manhã\n• Manter a mesa de trabalho e papéis organizados\n• Focar em fazer apenas uma coisa de cada vez",
      internalPractices: "• Preencher a Carta de Degrau sem atrasos\n• Cumprir Item 3 e 4 (Trabalho Ordenado e Eficaz)\n• Alinhar o próprio ritmo ao ritmo das Forças da Natureza", 
      quote: "A ordem é a primeira lei do céu.", quoteAuthor: "Alexander Pope", color: "#7B68EE" 
    },
    
    // --- O FOGO E A MENTE ---
    { 
      name: "Entusiasmo", 
      shortDesc: "En Theos, com o Sagrado dentro", 
      description: "A energia vibrante que contagia as pessoas, dando força para continuar a marcha perante os obstáculos.", 
      practices: "• Sorrir intencionalmente perante uma dificuldade\n• Transmitir ânimo a quem está reclamando\n• Realizar uma tarefa monótona com alegria",
      internalPractices: "• Cultivar o 'En Theos' (Deus dentro) diariamente\n• Ser um motor de ânimo dentro do grupo GAF\n• Acordar almas adormecidas pela ação e exemplo", 
      quote: "O entusiasmo é a força divina em movimento; é Deus no homem.", quoteAuthor: "Délia Steinberg Guzmán", color: "#FF5722" 
    },
    { 
      name: "Vontade", 
      shortDesc: "O motor do Espírito", 
      description: "Não o mero desejo, mas a força reta que corta a inércia e concretiza decisões na matéria.", 
      practices: "• Fazer imediatamente algo que se está adiando\n• Controlar um pequeno impulso do corpo\n• Impor a si mesmo uma renúncia temporária",
      internalPractices: "• Acionar o Ícto espiritual contra as desculpas\n• Ficar imóvel fisicamente nas práticas de câmara\n• Forjar o combate direto no diário do Kurukshetra", 
      quote: "Onde há Vontade, há um Caminho.", quoteAuthor: "Sri Ram", color: "#C0392B" 
    },
    { 
      name: "Atenção", 
      shortDesc: "O Foco da Consciência", 
      description: "A capacidade de estar plenamente focado. Aonde vai a atenção, vai a energia e a vida.", 
      practices: "• Escutar alguém sem formular respostas mentais\n• Fazer uma caminhada prestando atenção nos passos\n• Exercícios visuais de fixação e observação",
      internalPractices: "• Praticar o Tratak Diário sem pestanejar\n• Otimizar Economia de Tempo e Energia (Item 5)\n• Manter o Prana ancorado no presente durante rituais", 
      quote: "Atenção é o caminho para a imortalidade; a desatenção é o caminho da morte.", quoteAuthor: "Dhammapada", color: "#3498DB" 
    },
    { 
      name: "Memória", 
      shortDesc: "Fidelidade a nós mesmos (nossa Alma)", 
      description: "O resgate consciente das lições já aprendidas e da própria identidade e propósito de vida.", 
      practices: "• Revisar mentalmente os eventos do dia anterior\n• Lembrar diariamente do porquê iniciou um projeto\n• Fazer um diário retrospectivo com fidelidade",
      internalPractices: "• Executar o Exercício Pitagórico noturno\n• Recordar a Tradição e os Bastiões lidos\n• Preencher o Prólogo e Epílogo para fixar a mente", 
      quote: "O homem é sua memória. A memória é a força da nossa identidade.", quoteAuthor: "J.A. Livraga", color: "#8E44AD" 
    },
    
    // --- O GUERREIRO INTERIOR ---
    { 
      name: "Perseverança", 
      shortDesc: "Repetir com Consciência, buscando Aperfeiçoamento", 
      description: "A força para levantar-se após um erro, retomar o passo e continuar marchando sem ceder à frustração.", 
      practices: "• Voltar a um hábito saudável que foi abandonado\n• Tentar resolver um problema mais uma vez\n• Eliminar completamente a auto-justificativa",
      internalPractices: "• Preencher a cota de Item 7 (Virtudes) da Carta\n• Levantar-se rapidamente de falhas relatadas no GDVE\n• Não abandonar a Filial perante as crises de personalidade", 
      quote: "A perseverança é mãe da boa sorte.", quoteAuthor: "Miguel de Cervantes", color: "#D35400" 
    },
    { 
      name: "Constância", 
      shortDesc: "Esperar enquanto Trabalha, sem cair no Desânimo", 
      description: "O nível maduro da perseverança: manter um ritmo inalterado, que não depende de humores ou motivação passageira.", 
      practices: "• Executar o planejamento do dia sem vontade\n• Manter a rotina de preenchimento do Diário\n• Cumprir horários com precisão absoluta",
      internalPractices: "• Vencer as 'Leis da Matéria' e ciclicidades (Item 2)\n• Sustentar o 'Streak' ininterrupto de Práticas FV\n• Frequência impecável nas reuniões do Grupo", 
      quote: "A gota d'água perfura a rocha não pela sua força, mas pela sua constância.", quoteAuthor: "Ovídio", color: "#2ECC71" 
    },
    { 
      name: "Intuição", 
      shortDesc: "Compreensão além da Mente", 
      description: "A percepção direta de algo profundo, que ultrapassa a lógica mecânica e o raciocínio comum.", 
      practices: "• Observar simbolismos nos acontecimentos do dia\n• Confiar na voz da consciência para escolhas morais\n• Desconectar das telas para ouvir o próprio silêncio",
      internalPractices: "• Buscar o clarão de Buddhi além de Kama-Manas\n• Extrair o sentido real por trás dos mitos estudados\n• Escutar o Mestre Interior na Câmara de Purificação", 
      quote: "A intuição não é a inimiga da razão, mas sua sucessora alada.", quoteAuthor: "J.A. Livraga", color: "#9B59B6" 
    },
    { 
      name: "Ousadia", 
      shortDesc: "Atrever-se a ser melhor", 
      description: "A atitude de lançar-se rumo a um ideal, rompendo fronteiras de conformismo e timidez.", 
      practices: "• Dar o primeiro passo prático em um projeto engavetado\n• Falar a verdade quando todos estão calados\n• Mudar intencionalmente uma rotina que traz muito conforto",
      internalPractices: "• Assumir frentes de trabalho ou docência na Escola\n• Apresentar palestras e superar o medo do público\n• Assumir as Missões de Ciclo (IA) sem hesitar", 
      quote: "Ousai, e vossas forças aumentarão.", quoteAuthor: "Joana d'Arc", color: "#E67E22" 
    },
    
    // --- O CAMINHO ALQUÍMICO ---
    { 
      name: "Transmutar", 
      shortDesc: "O chumbo em ouro - Mudar de dentro para fora", 
      description: "A arte interior de pegar emoções densas (raiva, medo, angústia) e elevá-las a qualidades superiores.", 
      practices: "• Converter uma ofensa em uma resposta de amabilidade\n• Usar o cansaço como combustível para o dever\n• Calar-se quando a vontade mecânica é reclamar",
      internalPractices: "• Varrer por Dentro (Item 1) para dissolver os nós psíquicos\n• Combater os Vícios e a negligência de frente (Item 6)\n• Aplicar a Alquimia ensinada no Módulo Avançado", 
      quote: "O Universo é transformação; a nossa vida é o que os nossos pensamentos fazem dela.", quoteAuthor: "Marco Aurélio", color: "#F1C40F" 
    },
    { 
      name: "Concórdia", 
      shortDesc: "O corações unificados", 
      description: "A capacidade humana de unir diferentes pessoas em torno de um Ideal único, ignorando vaidades.", 
      practices: "• Ceder numa discussão onde o orgulho quer vencer\n• Evitar debates sobre futilidades divisivas\n• Unir pessoas que possuem habilidades complementares",
      internalPractices: "• Manter o Corpo GDVE unido sob tensão\n• Trabalhar com confrades de temperamentos difíceis\n• Elevar a egrégora da filial de Barra do Garças", 
      quote: "Se quereis que vosso coração encontre concórdia, ide ao centro, que é o Espírito.", quoteAuthor: "Sri Ram", color: "#1ABC9C" 
    },
    { 
      name: "Fortaleza", 
      shortDesc: "O pilar na tormenta", 
      description: "A firmeza de caráter para não desmoronar perante o peso das crises externas e internas.", 
      practices: "• Manter-se produtivo em dias de caos\n• Ser o apoio de amigos que estão desesperados\n• Enfrentar mudanças bruscas sem lamentação",
      internalPractices: "• Agir como autêntico Bastião na defesa da Instituição\n• Blindar-se contra o falatório externo e as Leis da Matéria\n• Suportar o rito de passagem do Discipulado", 
      quote: "Sofre e suporta: não há homem forte sem o fogo da provação.", quoteAuthor: "Sêneca", color: "#7F8C8D" 
    },
    { 
      name: "Nobreza", 
      shortDesc: "Elevação de caráter", 
      description: "Viver e agir acima da mediocridade do mundo. Um estado de espírito que se recusa a ser vulgar.", 
      practices: "• Portar-se com etiqueta e asseio mesmo quando sozinho\n• Recusar fazer comentários rasteiros ou fofocas\n• Tratar pessoas simples com extrema reverência",
      internalPractices: "• Viver como as autênticas Damas e Cavalheiros\n• Jamais profanar os símbolos e ambientes da Ordem\n• Resgatar a moral clássica em pleno Século XXI", 
      quote: "A verdadeira nobreza está em sermos superiores ao nosso antigo eu.", quoteAuthor: "Ernest Hemingway", color: "#FFD700" 
    },
    { 
      name: "Integração", 
      shortDesc: "Tornar completo", 
      description: "Compreender que não somos seres isolados, mas partes ativas de um Grande Corpo ou sistema.", 
      practices: "• Pensar no bem de um grupo antes da conveniência pessoal\n• Somar esforços sem exigir os holofotes\n• Ver-se como um elo entre o passado e o futuro familiar",
      internalPractices: "• Sincronizar as ações diárias com as metas da Filial\n• Operar como uma única mente no corpo do GDVE\n• Reconhecer-se como instrumento da Cadeia Hierárquica", 
      quote: "O que não é útil ao enxame, não é útil à abelha.", quoteAuthor: "Marco Aurélio", color: "#3498DB" 
    },
    
    // --- O COMPROMISSO ---
    { 
      name: "Dever", 
      shortDesc: "Compromisso com a Finalidade", 
      description: "Fazer o que é certo puramente porque é o certo, dispensando cálculos de fuga ou recompensa.", 
      practices: "• Executar tarefas pendentes sem hesitar\n• Não abandonar obrigações por capricho emocional\n• Fazer mais do que o estritamente cobrado",
      internalPractices: "• O Dever como manifestação do Dharma\n• Cumprir as missões de IA sem negociação com o ego\n• Apresentar a Carta de Degrau impreterivelmente na data", 
      quote: "Faça o seu dever, porque a ação é melhor do que a inação.", quoteAuthor: "Bhagavad Gita", color: "#C0392B" 
    },
    { 
      name: "Dignidade", 
      shortDesc: "O valor imutável do Ser", 
      description: "Manter-se erguido internamente. Ter profundo respeito por si mesmo e pela condição humana.", 
      practices: "• Cumprir todas as promessas que fez no dia\n• Não rir do que denigre outras pessoas\n• Manter o controle emocional em discussões",
      internalPractices: "• Viver e respirar o Código de Honra diariamente\n• Proteger a Egrégora da Escola com a própria postura\n• Manter a coluna ereta, o símbolo da verticalidade interna", 
      quote: "Nenhum homem é livre se não for senhor de si mesmo.", quoteAuthor: "Epicteto", color: "#8E44AD" 
    },
    { 
      name: "Fidelidade", 
      shortDesc: "Lealdade ao que há de mais Elevado", 
      description: "A firmeza de sustentar juramentos, ideias e vínculos mesmo nos momentos de distanciamento ou escuridão.", 
      practices: "• Fazer a coisa certa quando ninguém está fiscalizando\n• Honrar compromissos feitos há muito tempo\n• Proteger segredos e confidências depositadas em você",
      internalPractices: "• Cumprir os ritos e a Forja mesmo estando sozinho em casa\n• Honrar os compromissos assumidos perante o Mestre\n• Preservar e proteger os materiais internos da Ordem", 
      quote: "O verdadeiro cavaleiro é aquele que se mantém fiel quando todos os outros fogem.", quoteAuthor: "J.A. Livraga", color: "#2980B9" 
    },
    { 
      name: "Mística", 
      shortDesc: "Boa Vontade e Eficácia", 
      description: "O estado de espírito que permite enxergar a assinatura do Eterno por trás das formas da Natureza.", 
      practices: "• Entrar em contato com o ar livre e a natureza com reverência\n• Refletir filosoficamente sobre a transitoriedade da vida\n• Purificar o ambiente antes de ler ou trabalhar",
      internalPractices: "• Construção ativa das 4 fases do Templo Interior\n• Transformar as Aulas em Ritos de Conhecimento\n• Perceber o mistério nas diretrizes da Escola", 
      quote: "Mística é ter sede de Deus.", quoteAuthor: "J.A. Livraga", color: "#6C3483" 
    },
    { 
      name: "Discipulado", 
      shortDesc: "Viver o que se Aprende", 
      description: "A postura de quem reconhece que nada sabe e se coloca disposto a aprender com a Vida e com os sábios.", 
      practices: "• Receber correções e feedback sem justificativas na ponta da língua\n• Procurar o ensinamento oculto atrás de uma frustração\n• Imitar o exemplo ético das grandes figuras da história",
      internalPractices: "• Ouvir o Instrutor da filial sem o ruído do intelecto\n• Transmitir fidedignamente o que recebeu, sem alterar a fonte\n• Compreender a obediência como liberdade estruturada", 
      quote: "Quando o discípulo está pronto, o Mestre aparece.", quoteAuthor: "O Caibalion", color: "#27AE60" 
    }
  ];

export const philosophicalQuotes = [
    // Clássicos e Estoicos
    { text: "Que ninguém hesite em se dedicar à filosofia enquanto jovem, nem se canse de fazê-lo depois de velho.", author: "Epicuro" },
    { text: "Não é porque as coisas são difíceis que não ousamos; é porque não ousamos que elas são difíceis.", author: "Sêneca" },
    { text: "A felicidade não consiste em adquirir e gozar, mas em não desejar nada.", author: "Epicteto" },
    { text: "Conhece-te a ti mesmo e conhecerás o universo e os deuses.", author: "Oráculo de Delfos" },
    { text: "A vida não examinada não vale a pena ser vivida.", author: "Sócrates" },
    { text: "Não percas tempo discutindo sobre o que um homem bom deve ser. Sê um.", author: "Marco Aurélio" },
    { text: "Tudo o que ouvimos é uma opinião, não um fato. Tudo o que vemos é uma perspectiva, não a verdade.", author: "Marco Aurélio" },
    { text: "O homem corajoso não é o que não sente medo, mas o que conquista esse medo.", author: "Aristóteles" },
    
    // Sabedoria Oriental e Esotérica
    { text: "O homem é feito pela sua crença. Como ele acredita, assim ele é.", author: "Bhagavad Gita" },
    { text: "A mente é tudo. O que você pensa, você se torna.", author: "Buda" },
    { text: "O maior domínio é o domínio de si mesmo.", author: "Buda" },
    { text: "Não há religião superior à verdade.", author: "H. P. Blavatsky" },
    { text: "Seja indulgente com as fraquezas alheias, mas rigoroso com as suas próprias.", author: "H. P. Blavatsky (A Voz do Silêncio)" },
    { text: "O sábio molda a si mesmo.", author: "Dhammapada" },
    { text: "Para o homem resoluto e determinado, não existe a palavra impossível.", author: "Sri Ram" },

    // Nova Acrópole (Jorge Ángel Livraga e Délia Steinberg)
    { text: "A melhor maneira de vencer as trevas não é lutar contra elas, mas acender uma luz.", author: "J.A. Livraga" },
    { text: "Um Ideal é o oxigênio da Alma.", author: "J.A. Livraga" },
    { text: "Temos que forjar uma Juventude que não precise de esperanças artificiais, mas da força dos seus próprios Ideais.", author: "J.A. Livraga" },
    { text: "As circunstâncias não fazem o homem, apenas o revelam a si mesmo.", author: "Epicteto / J.A. Livraga" },
    { text: "Ser filósofo não é ler muitos livros, é saber extrair sabedoria de cada ato da Vida.", author: "Délia Steinberg Guzmán" },
    { text: "O heroísmo cotidiano consiste em fazer o bem, de forma oculta e perseverante, todos os dias.", author: "Délia Steinberg Guzmán" },
    { text: "É inútil buscar a paz no mundo se não soubermos plantá-la no coração.", author: "Délia Steinberg Guzmán" },
    { text: "Vontade não é desejar as coisas, é sacrificar-se por elas.", author: "J.A. Livraga" },
    
    // Sabedoria Universal Complementar
    { text: "Mesmo a jornada de mil milhas começa com um único passo.", author: "Lao Tsé" },
    { text: "Aquele que conhece os outros é sábio; aquele que conhece a si mesmo é iluminado.", author: "Lao Tsé" },
    { text: "A verdadeira medida de um homem não se vê nos momentos de conforto, mas nos de desafio e controvérsia.", author: "Martin Luther King Jr." }
  ];

export const studyTips = [
    { phase: "E - Examinar", text: "Antes de iniciar a leitura, reserve 5 minutos para examinar o índice, os títulos e os resumos. Crie um mapa mental do que o autor pretende explorar." },
    { phase: "E - Examinar", text: "Leia o prefácio e a conclusão antes do primeiro capítulo. Entender o destino final facilita a jornada pela obra." },
    { phase: "P - Perguntar", text: "Transforme o título do capítulo em uma pergunta. O que você espera que o texto responda? Leia ativamente buscando essa resposta." },
    { phase: "P - Perguntar", text: "Um livro de sabedoria não é um monólogo. Faça perguntas ao texto enquanto lê: 'Como posso aplicar isso na minha vida amanhã?'" },
    { phase: "L - Ler", text: "Leia com um lápis em mãos. Sublinhe não apenas frases bonitas, mas os eixos centrais do pensamento lógico do autor." },
    { phase: "L - Ler", text: "Se a leitura estiver muito densa, diminua o ritmo. Livros clássicos devem ser mastigados, não engolidos." },
    { phase: "R - Rememorar", text: "Ao terminar um capítulo, feche o livro e tente explicar o que leu em voz alta, como se ensinasse a um amigo. Teste sua síntese." },
    { phase: "R - Rememorar", text: "Se você não consegue resumir a ideia principal da página que acabou de ler, volte. A retenção real exige atenção e repetição." },
    { phase: "R - Rever", text: "Reserve um dia da semana apenas para rever suas anotações e fichamentos. O ouro da leitura filosófica está na revisão." },
    { phase: "R - Rever", text: "Conecte o novo aprendizado com o que você já sabe. A sabedoria é uma teia viva, não uma gaveta de informações isoladas." },
    { phase: "Prática Geral", text: "Não meça seu avanço pela quantidade de páginas viradas, mas pela quantidade de ideias que você transformou em ação." },
    { phase: "Prática Geral", text: "É preferível ler poucos livros bons muitas vezes, do que muitos livros ruins uma só vez." }
  ];

  export const GRADE_CURRICULAR = [
  { id: 'g1', title: 'O Caibalion', author: 'Três Iniciados', stage: 'Introdução' },
  { id: 'g2', title: 'Bhagavad Gita', author: 'Vyasa', stage: 'Introdução' },
  { id: 'g3', title: 'A Voz do Silêncio', author: 'H.P. Blavatsky', stage: 'Introdução' },
  { id: 'g4', title: 'Luz no Caminho', author: 'Mabel Collins', stage: 'Básico' },
  { id: 'g5', title: 'Meditações', author: 'Marco Aurélio', stage: 'Básico' },
  { id: 'g6', title: 'Cartas a Lucílio', author: 'Sêneca', stage: 'Avançado' },
  { id: 'g7', title: 'O Mito da Caverna', author: 'Platão', stage: 'Avançado' },
];
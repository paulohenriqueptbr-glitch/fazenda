// ─── Catálogo de Medicamentos Bovinos ────────────────────────────────────────
// Baseado em protocolos veterinários bovinos brasileiros.
// Cada entrada define: padrões de busca, intervalo de reaplicação, dosagem padrão,
// via de administração, categoria e observações.

export const MEDICATION_CATEGORIES = {
  ECTOPARASITICIDA: { label: "Ectoparasiticida", icon: "bug" },
  HEMATINICO: { label: "Hematínico (Ferro)", icon: "droplet" },
  ANTIBIOTICO: { label: "Antibiótico", icon: "shield" },
  ANTI_INFLAMATORIO: { label: "Anti-inflamatório", icon: "heart-pulse" },
  ANTIPARASITARIO: { label: "Antiparasitário (Vermífugo)", icon: "shield-check" },
  ANTIPARASITARIO_COMBO: { label: "Antiparasitário (Combo)", icon: "shield-check" },
  VITAMINICO: { label: "Vitamínico / Suplemento", icon: "sparkles" },
  VACINA: { label: "Vacina", icon: "syringe" },
  ANESTESICO: { label: "Anestésico", icon: "zap" },
  OUTROS: { label: "Outros", icon: "pill" },
};

/**
 * Catálogo de medicamentos bovinos.
 * patterns: array de strings para matching case-insensitive no nome do medicamento
 * reapplyDays: intervalo padrão de reaplicação em dias
 * dosage: dosagem padrão por peso (ex: "1 ml a cada 50 kg")
 * route: via de administração (SC=subcutânea, IM=intramuscular, IV=intravenosa, PO=oral, TÓPICA=tópica)
 * category: chave de MEDICATION_CATEGORIES
 * notes: observações importantes
 */
export const BOVINE_MEDICATIONS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // ECTOPARASITICIDAS — Controle de carrapato, mosca dos chifres, bernes
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["cipermetrina", "cipermetrina", "cypermethrin"], reapplyDays: 15, dosage: "5 ml/animal (pour-on)", route: "TÓPICA (pour-on)", category: "ECTOPARASITICIDA", notes: "Controle de carrapato (Boophilus microplus). Intervalo de 15-21 dias conforme carga parasitária." },
  { patterns: ["deltametrina", "deltamethrin"], reapplyDays: 15, dosage: "1-2 ml/100 kg", route: "TÓPICA (pour-on)", category: "ECTOPARASITICIDA", notes: "Ectoparasiticida piretróide de amplo espectro." },
  { patterns: ["amitraz"], reapplyDays: 14, dosage: "500 ml/100 L de água (banho)", route: "TÓPICA (banho)", category: "ECTOPARASITICIDA", notes: "Acaricida para carrapato e piolho. Banho todo-passo." },
  { patterns: ["flumetrina", "flumethrin"], reapplyDays: 21, dosage: "1 ml/10 kg", route: "TÓPICA (pour-on)", category: "ECTOPARASITICIDA", notes: "Pour-on de longa duração para carrapato." },
  { patterns: ["triclorfon", "triclorfón"], reapplyDays: 14, dosage: "40 mg/kg", route: "TÓPICA (banho) ou SC", category: "ECTOPARASITICIDA", notes: "Organofosforado. Controle de carrapato e mosca." },
  { patterns: ["coumaphos", "cumafós"], reapplyDays: 14, dosage: "500 ml/100 L (banho)", route: "TÓPICA (banho)", category: "ECTOPARASITICIDA", notes: "Banho todo-passo para ectoparasitas." },
  { patterns: ["diazinon", "diazinón"], reapplyDays: 14, dosage: "625 ml/100 L (banho)", route: "TÓPICA (banho)", category: "ECTOPARASITICIDA", notes: "Organofosforado para carrapato e mosca." },
  { patterns: ["capstar", "nitenpiram", "nitenpyram"], reapplyDays: 30, dosage: "11 mg/kg (cães); não é indicado para bovinos", route: "PO", category: "ECTOPARASITICIDA", notes: "NOTA: Capstar é para pequenos animais. Listado apenas para referência." },
  { patterns: ["ivermectina tópica", "ivermectin topical"], reapplyDays: 15, dosage: "1 ml/50 kg", route: "TÓPICA (pour-on)", category: "ECTOPARASITICIDA", notes: "Pour-on com ação contra ectoparasitas e endoparasitas." },
  { patterns: ["clorpirifós", "clorpirifos", "chlorpyrifos"], reapplyDays: 14, dosage: "700 ml/100 L (banho)", route: "TÓPICA (banho)", category: "ECTOPARASITICIDA", notes: "Para carrapato, mosca e bicheira." },
  { patterns: ["fipronil"], reapplyDays: 21, dosage: "1 ml/10 kg", route: "TÓPICA (pour-on)", category: "ECTOPARASITICIDA", notes: "Acaricida e inseticida de longa persistência." },
  { patterns: ["malation", "malathion"], reapplyDays: 14, dosage: "800 ml/100 L (banho)", route: "TÓPICA (banho)", category: "ECTOPARASITICIDA", notes: "Organofosforado para mosca e carrapato." },

  // ═══════════════════════════════════════════════════════════════════════════
  // HEMATÍNICOS — Suplementação de ferro e cobre
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["ferron 12", "ferron"], reapplyDays: 7, dosage: "10 ml/animal", route: "IM ou SC", category: "HEMATINICO", notes: "Suplemento de ferro para bezerros e animais anêmicos. Repetir semanalmente até correção." },
  { patterns: ["ferrodex"], reapplyDays: 7, dosage: "10 ml/animal (bezerros); 20 ml (adultos)", route: "IM", category: "HEMATINICO", notes: "Dextranato de ferro. Essencial para bezerros nos primeiros 2 meses de vida." },
  { patterns: ["ferridex", "ferro dextrano"], reapplyDays: 7, dosage: "10 ml/animal", route: "IM", category: "HEMATINICO", notes: "Dextranato de ferro para profilaxia de anemia em bezerros." },
  { patterns: ["cobalto", "cobalt"], reapplyDays: 30, dosage: "1 comprimido/animal/mês", route: "PO", category: "HEMATINICO", notes: "Cloreto de cobalto em sal mineral. Co-fator para síntese de vitamina B12." },
  { patterns: ["sulfato ferroso", "ferrous sulfate"], reapplyDays: 7, dosage: "2-4 g/animal", route: "PO", category: "HEMATINICO", notes: "Suplementação oral de ferro. Menos biodisponível que formas injetáveis." },
  { patterns: ["hematitan", "hematitan®"], reapplyDays: 7, dosage: "10 ml/animal", route: "IM", category: "HEMATINICO", notes: "Complexo de ferro para prevenção e tratamento de anemia." },
  { patterns: ["vitamin b12", "vitamina b12", "cyanocobalamin"], reapplyDays: 14, dosage: "5 ml/animal", route: "IM", category: "HEMATINICO", notes: "Cianocobalamina. Co-fator essencial em animais anêmicos." },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIBIÓTICOS — Tratamento de infecções bacterianas
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["enrofloxacina", "enrofloxacin", "baytril"], reapplyDays: 3, dosage: "2,5-5 mg/kg/dia", route: "IM ou SC", category: "ANTIBIOTICO", notes: "Fluoroquinolona. Tratamento de infecções respiratórias e digestivas. Respeitar tempo de carência." },
  { patterns: ["ceftiofur", "excede", "naxcel"], reapplyDays: 3, dosage: "1 mg/kg/dia", route: "IM ou SC", category: "ANTIBIOTICO", notes: "Cefalosporina de 3ª geração. Mastite, infecções respiratórias. Tempo de carência: 0 dias (leite)." },
  { patterns: ["oxitetraciclina", "oxytetracycline", "terramicina"], reapplyDays: 3, dosage: "20 mg/kg (SC) ou 10 mg/kg (IV/IM)", route: "SC, IM ou IV", category: "ANTIBIOTICO", notes: "Antibiótico de amplo espectro. Pneumonia, metrite, mastite." },
  { patterns: ["tilosina", "tylosin", "tylan"], reapplyDays: 5, dosage: "10 mg/kg/dia", route: "IM ou SC", category: "ANTIBIOTICO", notes: "Macrólido. Pneumonia enzoótica, Enterotoxemia. Carência leite: 96h." },
  { patterns: ["penicilina", "penicillin", "benzetacil"], reapplyDays: 3, dosage: "22.000 UI/kg", route: "IM", category: "ANTIBIOTICO", notes: "Penicilina cristalina + procaína. Infecções por gram-positivos. Carência leite: 48h." },
  { patterns: ["estreptomicina", "streptomycin"], reapplyDays: 3, dosage: "10 mg/kg", route: "IM", category: "ANTIBIOTICO", notes: "Geralmente combinada com penicilina. Brucelose (uso restrito)." },
  { patterns: ["gentamicina", "gentamicin"], reapplyDays: 3, dosage: "2-4 mg/kg/dia", route: "IM ou IV", category: "ANTIBIOTICO", notes: "Aminoglicosídeo. Infecções gram-negativos. Nefrotóxico — usar com cautela." },
  { patterns: ["amoxicilina", "amoxicillin"], reapplyDays: 3, dosage: "10 mg/kg", route: "IM ou SC", category: "ANTIBIOTICO", notes: "Amplo espectro. Pneumonia, infecções de pele, metrite." },
  { patterns: ["cloranfenicol", "chloramphenicol"], reapplyDays: 5, dosage: "20-40 mg/kg", route: "IM", category: "ANTIBIOTICO", notes: "NOTA: Proibido uso em animais destinados a alimentação em muitos países." },
  { patterns: ["tulatromicina", "tulathromycin", "draxxin"], reapplyDays: 14, dosage: "2,5 mg/kg (dose única)", route: "SC", category: "ANTIBIOTICO", notes: "Macrólido de longa ação. Dose única para pneumonia. Carência carnes: 49 dias." },
  { patterns: ["florfenicol", "florfenicol", "nuflor"], reapplyDays: 5, dosage: "20 mg/kg (2 doses) ou 40 mg/kg (dose única)", route: "IM ou SC", category: "ANTIBIOTICO", notes: "Pneumonia bovina. Carência: 28-38 dias conforme dose." },
  { patterns: ["cefalonio", "cephapirin", "cefaquino"], reapplyDays: 3, dosage: "Intramamário: 1 frasco/querataria", route: "INTRAMAMÁRIO", category: "ANTIBIOTICO", notes: "Tratamento e profilaxia de mastite. Administrar após ordenha." },
  { patterns: ["cloxaceno", "cloxacillin"], reapplyDays: 3, dosage: "Intramamário: 1 frasco/querataria", route: "INTRAMAMÁRIO", category: "ANTIBIOTICO", notes: "Penicilina resistente à penicilinase. Mastite por estafilococo." },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTI-INFLAMATÓRIOS
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["flunixina", "flunixin", "banamine"], reapplyDays: 3, dosage: "1,1-2,2 mg/kg", route: "IV", category: "ANTI_INFLAMATORIO", notes: "AINE potente. Cólica, inflamações. CUIDADO: não usar em desidratados. Carência leite: 36h." },
  { patterns: ["ketoprofeno", "ketoprofen"], reapplyDays: 3, dosage: "2,2 mg/kg", route: "IV ou IM", category: "ANTI_INFLAMATORIO", notes: "AINE. Anti-inflamatório e antipirético. Carência leite: 48h." },
  { patterns: ["meloxicam", "meloxicam"], reapplyDays: 3, dosage: "0,5 mg/kg", route: "IV ou SC", category: "ANTI_INFLAMATORIO", notes: "AINE seletivo COX-2. Menor impacto gastrintestinal." },
  { patterns: ["dexametasona", "dexamethasone"], reapplyDays: 5, dosage: "5-20 mg/animal", route: "IV ou IM", category: "ANTI_INFLAMATORIO", notes: "Corticosteroide. Anti-inflamatório potente. CUIDADO: causaraborto em gestantes." },
  { patterns: ["prednisolona", "prednisolone"], reapplyDays: 5, dosage: "0,5-1 mg/kg/dia", route: "IM ou PO", category: "ANTI_INFLAMATORIO", notes: "Corticosteroide. Reduz progressivamente a dose." },
  { patterns: ["dipirona", "metamizole", "novalgina"], reapplyDays: 1, dosage: "25 mg/kg", route: "IV ou IM", category: "ANTI_INFLAMATORIO", notes: "Antipirético e analgésico. Uso clínico geral." },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANTIPARASITÁRIOS (Vermífugos) — Endoparasitas
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["ivermectina", "ivermectin", "ivomec", "ivomec gold"], reapplyDays: 60, dosage: "1 ml/50 kg (1% injetável) ou 2 ml/100 kg (pour-on)", route: "SC ou TÓPICA", category: "ANTIPARASITARIO", notes: "Endectocida. Vermífugo e ectoparasiticida. Intervalo mínimo 21 dias, recomendado 60 dias." },
  { patterns: ["albendazol", "albendazole", "valbazen"], reapplyDays: 60, dosage: "7,5 mg/kg", route: "PO", category: "ANTIPARASITARIO", notes: "Vermífugo de amplo espectro. Nematódeos, cestódeos, trematódeos. Carência leite: 60h." },
  { patterns: ["moxidectina", "moxidectin", "cydectin"], reapplyDays: 60, dosage: "0,2 mg/kg", route: "SC ou TÓPICA", category: "ANTIPARASITARIO", notes: "Macrociclo lactona de longa ação. Mais potente que ivermectina." },
  { patterns: ["levamisol", "levamisole"], reapplyDays: 28, dosage: "7,5-8 mg/kg", route: "PO ou SC", category: "ANTIPARASITARIO", notes: "Vermífugo e imunoestimulante. Ativo contra nematódeos gastrintestinais." },
  { patterns: ["febantel", "febantel"], reapplyDays: 60, dosage: "5-10 mg/kg", route: "PO", category: "ANTIPARASITARIO", notes: "Benzimidazol. Nematódeos e cestódeos." },
  { patterns: ["oxfendazol", "oxfendazole"], reapplyDays: 60, dosage: "2,25-4,5 mg/kg", route: "PO", category: "ANTIPARASITARIO", notes: "Benzimidazol de amplo espectro." },
  { patterns: ["closantel", "closantel"], reapplyDays: 60, dosage: "10 mg/kg", route: "PO ou SC", category: "ANTIPARASITARIO", notes: "Tenicida e helminticida. Tenias e vermes." },
  { patterns: ["niclosamida", "niclosamide"], reapplyDays: 90, dosage: "50-100 g/animal", route: "PO", category: "ANTIPARASITARIO", notes: "Tenicida específico. Actinium, Moniezia." },
  { patterns: ["nitroxinil", "nitroxynil"], reapplyDays: 60, dosage: "10 mg/kg", route: "SC", category: "ANTIPARASITARIO", notes: "Trematicida. Fasciola hepática." },
  { patterns: ["triclabendazol", "triclabendazole"], reapplyDays: 60, dosage: "10 mg/kg", route: "PO", category: "ANTIPARASITARIO", notes: "Triclabendazol. Fasciola hepática adulta e imatura." },
  { patterns: ["clorsulon", "clorsulon"], reapplyDays: 60, dosage: "7 mg/kg", route: "PO", category: "ANTIPARASITARIO", notes: "Fasciolicida. Fasciola hepática adulta." },
  { patterns: ["doramectina", "doramectin", "dectomax", "dectomax"], reapplyDays: 7, dosage: "1 ml/50 kg", route: "SC", category: "ANTIPARASITARIO", notes: "Macrociclo lactona. Para verminose e ectoparasitos. Protocolo: reaplicar em 7-14 dias conforme orientação veterinária. Carência leite: 60h." },
  { patterns: ["abamectina", "abamectin", "vermectin plus"], reapplyDays: 14, dosage: "1 ml/50 kg", route: "SC", category: "ANTIPARASITARIO", notes: "Macrociclo lactona. Vermífugo e ectoparasiticida. Intervalo de 14-21 dias." },
  { patterns: ["closamectina", "closamectin", "closantel ivermectina"], reapplyDays: 60, dosage: "1 ml/50 kg", route: "SC", category: "ANTIPARASITARIO_COMBO", notes: "Combinação anti-helmíntica e ectoparasiticida. Fasciola + nematódeos + carrapato." },
  { patterns: ["nitranil", "nitroxynil"], reapplyDays: 60, dosage: "10 mg/kg", route: "SC", category: "ANTIPARASITARIO", notes: "Trematicida. Fasciola hepática. (Nota: já existe nitroxinil listado separadamente.)" },

  // ═══════════════════════════════════════════════════════════════════════════
  // VITAMÍNICOS E SUPLEMENTOS
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["multimin", "multi-min"], reapplyDays: 28, dosage: "1 ml/45 kg", route: "SC", category: "VITAMINICO", notes: "Suplemento trace mineral. Zinco, selênio, cobre, manganês. Injeção a cada 28 dias." },
  { patterns: ["selenium", "selênio", "selenio"], reapplyDays: 21, dosage: "1 ml/45 kg (complexo de Se)", route: "IM ou SC", category: "VITAMINICO", notes: "Selenito de sódio ou complexo. Prevenção de miopatias e abortos." },
  { patterns: ["vitamin a", "vitamina a", "retinol"], reapplyDays: 30, dosage: "5-10 ml/animal", route: "IM", category: "VITAMINICO", notes: "Deficiência em pastagens pobres. Importante para reprodução e imunidade." },
  { patterns: ["vitamin e", "vitamina e", "tocopherol"], reapplyDays: 14, dosage: "1-3 ml/animal", route: "IM", category: "VITAMINICO", notes: "Antioxidante. Prevenção de miopatias (em associação com selênio)." },
  { patterns: ["vitamin d", "vitamina d", "calciferol"], reapplyDays: 30, dosage: "5-10 ml/animal", route: "IM", category: "VITAMINICO", notes: "Metabolismo do cálcio e fósforo. Deficiência em animais confinados." },
  { patterns: ["calcio", "cálcio", "calcium", "gluconato calcio", "calcium gluconate"], reapplyDays: 1, dosage: "50-100 ml (10-20%)", route: "IV lento", category: "VITAMINICO", notes: "Tetania do parto (hipocalcemia). Emergência: IV lento. Prevenção: cálcio oral no pós-parto." },
  { patterns: ["fosforo", "fósforo", "phosphorus"], reapplyDays: 30, dosage: "Via sal mineral ou mistura mineral", route: "PO", category: "VITAMINICO", notes: "Balancear Ca:P em 2:1. Deficiência afeta reprodução e crescimento." },
  { patterns: ["selenio vitamina e", "se ve"], reapplyDays: 28, dosage: "1 ml/45 kg", route: "IM ou SC", category: "VITAMINICO", notes: "Combinação de selênio e vitamina E. Prevenção de miopatias brancas." },
  { patterns: ["biotina", "biotin"], reapplyDays: 30, dosage: "20 mg/animal", route: "IM", category: "VITAMINICO", notes: "Saúde da pele e cascos." },
  { patterns: ["bcomplex", "b complex", "b-complex", "vitamina b complexo", "vitamin b complex"], reapplyDays: 14, dosage: "5-10 ml/animal", route: "IM ou SC", category: "VITAMINICO", notes: "Complexo de vitaminas do grupo B. Estímulo ao apetite, metabolismo. Indicado em animais debilitados, pós-parto, estresse." },
  { patterns: ["vitamina ad3e", "ad3e", "vitamin ad3e", "ad 3 e", "a d3 e"], reapplyDays: 30, dosage: "5-10 ml/animal", route: "IM", category: "VITAMINICO", notes: "Combinação de vitaminas A, D3 e E. Suplementação em pastagens pobres, pós-parto, crescimento." },
  { patterns: ["vitaminas injetaveis", "vitaminas", "injetavel vitaminico"], reapplyDays: 30, dosage: "5-10 ml/animal", route: "IM", category: "VITAMINICO", notes: "Suplemento vitaminico injetável. Pós-parto, estresse, deficiência nutricional." },
  { patterns: ["complexo b", "complexo-b", "complexo b injetavel"], reapplyDays: 14, dosage: "5-10 ml/animal", route: "IM", category: "VITAMINICO", notes: "Metabolismo energético. Indicado em anorexia, convalescença, pós-cirúrgico." },

  // ═══════════════════════════════════════════════════════════════════════════
  // VACINAS
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["febre aftosa", "aftosa", "foot-and-mouth"], reapplyDays: 180, dosage: "Dose conforme bula (2 ml)", route: "SC", category: "VACINA", notes: "Vacinação semestral obrigatória (calendário nacional). Pólos de vacinação." },
  { patterns: ["clostridiose", "clostridial", "clostridium", "7 em 1", "8 em 1"], reapplyDays: 365, dosage: "Dose conforme bula (2 ml)", route: "SC", category: "VACINA", notes: "Clostridiose(s). Anual. Bezerros: 1ª dose a partir de 3 meses, reforço em 30-45 dias." },
  { patterns: ["brucelose", "brucella"], reapplyDays: 0, dosage: "Dose única (Reba 19)", route: "SC (região inguinal)", category: "VACINA", notes: "Dose única entre 3-8 meses de fêmea. Vacinação obrigatória." },
  { patterns: ["leptospirose", "leptospira"], reapplyDays: 180, dosage: "2 ml", route: "SC", category: "VACINA", notes: "Semestral. Prevenção de aborto e hemoglobinúria." },
  { patterns: ["bovinos leite", "raiva", "rabies"], reapplyDays: 365, dosage: "Dose conforme bula", route: "SC", category: "VACINA", notes: "Anual. Zoneamento raiva." },
  { patterns: ["botulismo", "clostridium botulinum"], reapplyDays: 365, dosage: "Dose conforme bula", route: "SC", category: "VACINA", notes: "Anual. Essencial em regiões com histórico." },
  { patterns: ["carbúnculo", "anthrax", "carbunclo"], reapplyDays: 365, dosage: "Dose conforme bula", route: "SC", category: "VACINA", notes: "Anual. Obrigatória em regiões endêmicas." },

  // ═══════════════════════════════════════════════════════════════════════════
  // ANESTÉSICOS
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["xilazina", "xylazine", "rompun"], reapplyDays: 1, dosage: "0,05-0,1 mg/kg (sedação); 0,1-0,3 mg/kg (anestesia)", route: "IM ou IV", category: "ANESTESICO", notes: "Sedativo e analgésico. Ruminotomia, castração, cesárea. Antídoto: yohimbina." },
  { patterns: ["ketamina", "ketamine"], reapplyDays: 1, dosage: "2-4 mg/kg", route: "IV", category: "ANESTESICO", notes: "Anestésico dissociativo. Procedimentos curtos." },
  { patterns: ["lidocaina", "lidocaine", "lidocaína"], reapplyDays: 1, dosage: "Bloco: 3-5 ml por ponto", route: "BLOCO LOCAL", category: "ANESTESICO", notes: "Anestesia local. Episiotomia, suturas, bloqueios." },
  { patterns: ["procaína", "procaine", "procaína penicilina"], reapplyDays: 3, dosage: "Varia conforme formulação", route: "IM", category: "ANESTESICO", notes: "Penicilina procaína. Anestesia local prolongada." },

  // ═══════════════════════════════════════════════════════════════════════════
  // OUTROS / ESPECIAIS
  // ═══════════════════════════════════════════════════════════════════════════
  { patterns: ["gonadorelin", "gonadorelina", "cystorelina"], reapplyDays: 10, dosage: "100-200 mcg", route: "IM", category: "OUTROS", notes: "GnRH. Sincronização de estro, cistos ovarianos. Repetir em 10 dias se necessário." },
  { patterns: ["d-cloprostenol", "cloprostenol", "d-clost", "estrumate"], reapplyDays: 11, dosage: "2 ml (500 mcg)", route: "IM", category: "OUTROS", notes: "PGF2α. Sincronização de estro, luteólise. Repetir em 11 dias para sincronia." },
  { patterns: ["progesterona", "progesterone", "CIDR"], reapplyDays: 7, dosage: "Implante intravaginal (1,9 g)", route: "INTRAVAGINAL", category: "OUTROS", notes: "Implante de progesterona. Sincronização de estro. Manter 7-8 dias." },
  { patterns: ["eCG", "gonadotrofina", "sergon"], reapplyDays: 1, dosage: "400-1000 UI", route: "IM", category: "OUTROS", notes: "Gonadotrofina equina. Indução de estro em fêmeas anestro." },
  { patterns: ["misoprostol", "misoprostol"], reapplyDays: 1, dosage: "400-800 mcg", route: "PO", category: "OUTROS", notes: "Análogo de PGE1. Proteção gástrica com AINEs." },
  { patterns: ["ranitidina", "ranitidine"], reapplyDays: 1, dosage: "300-600 mg/animal", route: "PO", category: "OUTROS", notes: "Antiulceroso. Gastrite por estresse." },
  { patterns: ["diuron", "diurona"], reapplyDays: 14, dosage: "4 ml/100 kg", route: "TÓPICA (banho)", category: "ECTOPARASITICIDA", notes: "Inseticida para mosca dos chifres (Haematobia irritans)." },
  { patterns: ["dexametasona longa", "dexamethasone long acting", "dexasone"], reapplyDays: 7, dosage: "20-40 mg/animal", route: "IM", category: "ANTI_INFLAMATORIO", notes: "Corticosteroide de depósito. Anti-inflamatório prolongado. CUIDADO: causaraborto em gestantes." },
];

/**
 * Finds a medication in the catalog by name (fuzzy matching).
 * @param {string} name - Medication name to search
 * @returns {object|null} - Matching catalog entry or null
 */
export const findMedication = (name) => {
  const search = String(name || "").toLowerCase().trim();
  if (!search) return null;
  
  // Exact match first
  for (const med of BOVINE_MEDICATIONS) {
    if (med.patterns.some((p) => search === p.toLowerCase())) return med;
  }
  
  // Partial match
  for (const med of BOVINE_MEDICATIONS) {
    if (med.patterns.some((p) => search.includes(p.toLowerCase()) || p.toLowerCase().includes(search))) return med;
  }
  
  return null;
};

/**
 * Gets the reapplication interval for a medication, considering catalog + custom override.
 * @param {string} medicationName
 * @param {number|null} customIntervalDays - User-defined override
 * @returns {{ days: number, label: string, category: string, notes: string, dosage: string, route: string }}
 */
export const getMedicationInfo = (medicationName, customIntervalDays = null) => {
  if (customIntervalDays !== null && customIntervalDays !== undefined && Number(customIntervalDays) > 0) {
    return {
      days: Number(customIntervalDays),
      label: "intervalo customizado",
      category: "OUTROS",
      notes: "Intervalo definido pelo usuário.",
      dosage: "Consultar bula ou veterinário",
      route: "Consultar bula",
    };
  }

  const match = findMedication(medicationName);
  if (match) {
    const cat = MEDICATION_CATEGORIES[match.category] || MEDICATION_CATEGORIES.OUTROS;
    return {
      days: match.reapplyDays,
      label: cat.label,
      category: match.category,
      notes: match.notes,
      dosage: match.dosage,
      route: match.route,
    };
  }

  return {
    days: 30,
    label: "retorno padrão",
    category: "OUTROS",
    notes: "Medicamento não identificado no catálogo. Intervalo padrão de 30 dias.",
    dosage: "Consultar bula ou veterinário",
    route: "Consultar bula",
  };
};

/**
 * Calcula a dose recomendada de um medicamento baseado no peso do animal.
 * @param {string} medicationName - Nome do medicamento
 * @param {number|null} animalWeight - Peso do animal em kg
 * @param {number|null} customInterval - Intervalo customizado de reaplicação
 * @returns {{ dosage: string, calculatedDose: string|null, weightUsed: number|null, warning: string|null }}
 */
export const calculateDosage = (medicationName, animalWeight = null, customInterval = null) => {
  const info = getMedicationInfo(medicationName, customInterval);
  
  if (!animalWeight || animalWeight <= 0) {
    return {
      dosage: info.dosage,
      calculatedDose: null,
      weightUsed: null,
      warning: "Peso não informado — informe o peso do animal para calcular a dose",
    };
  }

  // Padrões de dosagem por kg (extraídos do catálogo)
  const dosagePatterns = [
    { pattern: /(\d+(?:,\d+)?)\s*ml\/(\d+)\s*kg/i, unit: "ml", factor: true },
    { pattern: /(\d+(?:,\d+)?)\s*mg\/kg/i, unit: "mg", factor: true },
    { pattern: /(\d+(?:,\d+)?)\s*ml\/animal/i, unit: "ml", factor: false },
    { pattern: /(\d+(?:,\d+)?)\s*ml\/100\s*kg/i, unit: "ml", per100: true },
    { pattern: /(\d+(?:,\d+)?)\s*ml\/50\s*kg/i, unit: "ml", per50: true },
    { pattern: /(\d+(?:,\d+)?)\s*UI\/kg/i, unit: "UI", factor: true },
    { pattern: /(\d+(?:,\d+)?)\s*mcg\/kg/i, unit: "mcg", factor: true },
    { pattern: /(\d+(?:,\d+)?)\s*g\/kg/i, unit: "g", factor: true },
  ];

  const dosageStr = info.dosage;
  
  for (const { pattern, unit, factor, per100, per50 } of dosagePatterns) {
    const match = dosageStr.match(pattern);
    if (!match) continue;
    
    const baseValue = parseFloat(match[1].replace(",", "."));
    let calculatedDose = null;
    
    if (factor) {
      // Ex: "1 ml/50 kg" → 1 ml para cada 50 kg
      calculatedDose = (baseValue * animalWeight) / (per50 ? 50 : per100 ? 100 : 1);
    } else if (per100) {
      calculatedDose = (baseValue * animalWeight) / 100;
    } else if (per50) {
      calculatedDose = (baseValue * animalWeight) / 50;
    }
    
    if (calculatedDose !== null) {
      const rounded = Math.round(calculatedDose * 10) / 10;
      const calculatedStr = `${rounded} ${unit} (${animalWeight} kg)`;
      
      return {
        dosage: dosageStr,
        calculatedDose: calculatedStr,
        weightUsed: animalWeight,
        warning: rounded <= 0 ? "Dose calculada ZERO — verificar peso e dosagem" : null,
      };
    }
  }

  // Não conseguiu calcular automaticamente
  return {
    dosage: dosageStr,
    calculatedDose: null,
    weightUsed: animalWeight,
    warning: "Fórmula de dosagem não reconhecida — consulte a bula",
  };
};

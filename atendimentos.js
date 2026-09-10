// =============================================================
// CTP 360 - GERENCIAMENTO DE ATENDIMENTOS + HISTÓRICO
// =============================================================
//
// Requer no config.js:
// POWER_AUTOMATE_ATENDIMENTOS_URL
// POWER_AUTOMATE_ATUALIZAR_URL
// POWER_AUTOMATE_HISTORICO_URL
// POWER_AUTOMATE_REGISTRAR_ACOMPANHAMENTO_URL
// POWER_AUTOMATE_INICIAR_ATENDIMENTO_URL
// POWER_AUTOMATE_ENCERRAR_ATENDIMENTO_URL
//
// =============================================================

let registrosAtendimentosOriginais = [];
let registrosAtendimentosNormalizados = [];
let atendimentoSelecionado = null;

// =============================================================
// UTILITÁRIOS
// =============================================================

function normalizarTextoAtendimento(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/_x0020_/gi, " ")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function encontrarChaveAtendimento(registro, nomesPossiveis) {
    if (!registro || typeof registro !== "object") return null;

    for (const nome of nomesPossiveis) {
        if (Object.prototype.hasOwnProperty.call(registro, nome)) {
            return nome;
        }
    }

    for (const chave of Object.keys(registro)) {
        const chaveNormalizada = normalizarTextoAtendimento(chave);

        for (const nome of nomesPossiveis) {
            if (
                chaveNormalizada ===
                normalizarTextoAtendimento(nome)
            ) {
                return chave;
            }
        }
    }

    return null;
}

function extrairValorAtendimento(valor) {
    if (valor === null || valor === undefined) {
        return "";
    }

    if (Array.isArray(valor)) {
        return valor
            .map(extrairValorAtendimento)
            .filter(item => item !== "")
            .join(", ");
    }

    if (typeof valor === "object") {
        const candidatos = [
            "Value",
            "value",
            "LookupValue",
            "Title",
            "DisplayName",
            "Name",
            "Email",
            "Id",
            "ID"
        ];

        for (const chave of candidatos) {
            if (
                Object.prototype.hasOwnProperty.call(valor, chave) &&
                valor[chave] !== null &&
                valor[chave] !== undefined &&
                valor[chave] !== ""
            ) {
                return extrairValorAtendimento(valor[chave]);
            }
        }

        return "";
    }

    return valor;
}

function obterValorAtendimento(
    registro,
    nomesPossiveis,
    padrao = ""
) {
    const chave = encontrarChaveAtendimento(
        registro,
        nomesPossiveis
    );

    if (!chave) {
        return padrao;
    }

    const valor = extrairValorAtendimento(
        registro[chave]
    );

    return (
        valor === null ||
        valor === undefined ||
        valor === ""
    )
        ? padrao
        : valor;
}

function obterPrimeiroValorAtendimento(
    registro,
    nomesPossiveis,
    padrao = ""
) {
    for (const nome of nomesPossiveis) {
        const valor = obterValorAtendimento(
            registro,
            [nome],
            ""
        );

        if (
            valor !== "" &&
            valor !== null &&
            valor !== undefined
        ) {
            return valor;
        }
    }

    return padrao;
}

function obterIdAtendimento(registro) {
    const numero = Number(
        obterPrimeiroValorAtendimento(
            registro,
            ["ID", "Id", "id"]
        )
    );

    return Number.isFinite(numero)
        ? numero
        : null;
}

function converterBooleanoAtendimento(valor) {
    if (typeof valor === "boolean") {
        return valor;
    }

    if (typeof valor === "number") {
        return valor === 1;
    }

    return [
        "true",
        "sim",
        "yes",
        "1",
        "verdadeiro"
    ].includes(
        normalizarTextoAtendimento(valor)
    );
}

function formatarBooleanoAtendimento(valor) {
    return converterBooleanoAtendimento(valor)
        ? "Sim"
        : "Não";
}

function formatarDataAtendimento(valor) {
    if (
        valor === null ||
        valor === undefined ||
        valor === ""
    ) {
        return "";
    }

    if (
        (
            typeof valor === "number" ||
            /^\d+(\.\d+)?$/.test(String(valor))
        ) &&
        Number(valor) > 20000
    ) {
        const numero = Number(valor);

        const dataBase = new Date(
            Date.UTC(1899, 11, 30)
        );

        const data = new Date(
            dataBase.getTime() +
            numero * 86400000
        );

        const dia = String(
            data.getUTCDate()
        ).padStart(2, "0");

        const mes = String(
            data.getUTCMonth() + 1
        ).padStart(2, "0");

        const ano = data.getUTCFullYear();

        return `${dia}/${mes}/${ano}`;
    }

    const texto = String(valor).trim();

    if (
        /^\d{4}-\d{2}-\d{2}/.test(texto)
    ) {
        const [ano, mes, dia] =
            texto
                .substring(0, 10)
                .split("-");

        return `${dia}/${mes}/${ano}`;
    }

    return texto;
}

function formatarDataHoraAtendimento(valor) {
    if (!valor) {
        return "";
    }

    const texto = String(valor).trim();

    if (
        /^\d{4}-\d{2}-\d{2}T/.test(texto)
    ) {
        const data = new Date(texto);

        if (
            !Number.isNaN(
                data.getTime()
            )
        ) {
            return new Intl.DateTimeFormat(
                "pt-BR",
                {
                    dateStyle: "short",
                    timeStyle: "short"
                }
            ).format(data);
        }
    }

    return formatarDataAtendimento(valor);
}

function converterParaInputData(valor) {
    if (!valor) {
        return "";
    }

    const texto = String(valor).trim();

    if (
        /^\d{4}-\d{2}-\d{2}/.test(texto)
    ) {
        return texto.substring(0, 10);
    }

    if (
        /^\d{2}\/\d{2}\/\d{4}$/.test(texto)
    ) {
        const [dia, mes, ano] =
            texto.split("/");

        return `${ano}-${mes}-${dia}`;
    }

    return "";
}

function obterIdDaUrl() {
    const parametros =
        new URLSearchParams(
            window.location.search
        );

    const id = parametros.get("id");

    if (!id) {
        return null;
    }

    const numero = Number(id);

    return Number.isFinite(numero)
        ? numero
        : null;
}

function definirValorElemento(id, valor) {
    const elemento =
        document.getElementById(id);

    if (!elemento) {
        return;
    }

    elemento.value = valor ?? "";
}

// =============================================================
// STATUS
// =============================================================

function valorRepresentaEncerrado(valor) {
    const texto =
        normalizarTextoAtendimento(valor);

    return [
        "encerrado",
        "encerrada",
        "concluido",
        "concluida",
        "finalizado",
        "finalizada",
        "fechado",
        "fechada"
    ].includes(texto);
}

function valorRepresentaAgendado(valor) {
    return (
        normalizarTextoAtendimento(valor) ===
        "agendado"
    );
}

function valorRepresentaAberto(valor) {
    return [
        "aberto",
        "aberta",
        "em andamento"
    ].includes(
        normalizarTextoAtendimento(valor)
    );
}

function valorRepresentaCancelado(valor) {
    return [
        "cancelado",
        "cancelada"
    ].includes(
        normalizarTextoAtendimento(valor)
    );
}

// =============================================================
// NORMALIZAÇÃO DA LISTA PRINCIPAL
// =============================================================

function normalizarRegistroAtendimento(registro) {
    const id =
        obterIdAtendimento(registro);

    const inicioAgendado =
        obterPrimeiroValorAtendimento(
            registro,
            [
                "InicioAgendado",
                "Início Agendado",
                "Inicio Agendado"
            ]
        );

    const fimAgendado =
        obterPrimeiroValorAtendimento(
            registro,
            [
                "FimAgendado",
                "Fim Agendado"
            ]
        );

    const inicioAtendimento =
        obterPrimeiroValorAtendimento(
            registro,
            [
                "InicioAtendimento",
                "Início Atendimento",
                "Inicio Atendimento"
            ]
        );

    const fimAtendimento =
        obterPrimeiroValorAtendimento(
            registro,
            [
                "FimAtendimento",
                "Fim Atendimento"
            ]
        );

    const duracaoMinutos =
        obterPrimeiroValorAtendimento(
            registro,
            [
                "DuracaoMinutos",
                "Duração Minutos",
                "Duracao Minutos"
            ]
        );

    const inicioExibicao =
        inicioAtendimento ||
        inicioAgendado ||
        obterPrimeiroValorAtendimento(
            registro,
            [
                "Data",
                "Created"
            ]
        );

    return {
        id,

        numero:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "NumeroAtendimento",
                        "Número Atendimento",
                        "Numero Atendimento",
                        "Número do Atendimento"
                    ],
                    id ?? ""
                )
            ),

        assunto:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Title",
                        "Título",
                        "Assunto"
                    ]
                )
            ),

        inicio:
            inicioExibicao,

        inicioAgendado,
        fimAgendado,
        inicioAtendimento,
        fimAtendimento,
        duracaoMinutos,

        instituicao:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Instituicao",
                        "Instituição",
                        "Instituicao Value",
                        "Instituição Value",
                        "Instituicao LookupValue"
                    ]
                )
            ),

        contato:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Contato",
                        "Contato Value",
                        "Nome",
                        "Nome do atendido",
                        "Atendido"
                    ]
                )
            ),

        programa:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Programa",
                        "Programa Value",
                        "Programa LookupValue"
                    ]
                )
            ),

        tecnologias:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Tecnologias",
                        "Tecnologia"
                    ]
                )
            ),

        descricaoProblema:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "DescricaoProblema",
                        "Descrição do Problema",
                        "Descricao Problema"
                    ]
                )
            ),

        descricaoSolucao:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "DescricaoSolucao",
                        "Descrição da Solução",
                        "Descricao Solucao"
                    ]
                )
            ),

        status:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Status",
                        "Status Value"
                    ]
                )
            ),

        prioridade:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Prioridade",
                        "Prioridade Value"
                    ]
                )
            ),

        responsavel:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Responsavel",
                        "Responsável",
                        "Responsavel DisplayName",
                        "Responsavel Claims",
                        "Responsável Claims"
                    ]
                )
            ),

        necessitaAcompanhamento:
            converterBooleanoAtendimento(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "NecessitaAcompanhamento",
                        "Necessita Acompanhamento"
                    ],
                    false
                )
            ),

        resolvidoPrimeiroContato:
            converterBooleanoAtendimento(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "ResolvidoPrimeiroContato",
                        "Resolvido Primeiro Contato"
                    ],
                    false
                )
            ),

        encaminhadoPara:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "EncaminhadoPara",
                        "EncaminhadoPara Value",
                        "Encaminhado Para"
                    ]
                )
            ),

        dataConclusao:
            obterPrimeiroValorAtendimento(
                registro,
                [
                    "DataConclusao",
                    "Data Conclusão",
                    "Data de Conclusão"
                ]
            ),

        observacoesInternas:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "ObservacoesInternas",
                        "Observações Internas",
                        "Observacoes Internas"
                    ]
                )
            ),

        dataProximoAcompanhamento:
            obterPrimeiroValorAtendimento(
                registro,
                [
                    "DataProximoAcompanhamento",
                    "Data Próximo Acompanhamento",
                    "Data Proximo Acompanhamento"
                ]
            ),

        bookingsAppointmentId:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "BookingsAppointmentId"
                    ]
                )
            ),

        emailContatoAgendamento:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "EmailContatoAgendamento"
                    ]
                )
            ),

        telefoneContatoAgendamento:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "TelefoneContatoAgendamento"
                    ]
                )
            ),

        original:
            registro
    };
}

function extrairColecaoAtendimentos(dados) {
    if (Array.isArray(dados)) {
        return dados;
    }

    if (
        !dados ||
        typeof dados !== "object"
    ) {
        return [];
    }

    const candidatos = [
        dados.value,
        dados.registros,
        dados.items,
        dados.dados,
        dados.body?.value,
        dados.body?.registros
    ];

    for (const candidato of candidatos) {
        if (Array.isArray(candidato)) {
            return candidato;
        }
    }

    return [];
}

// =============================================================
// APIS - CONSULTA E EDIÇÃO
// =============================================================

async function buscarAtendimentosDaFonte() {
    if (
        typeof POWER_AUTOMATE_ATENDIMENTOS_URL ===
            "undefined" ||
        !POWER_AUTOMATE_ATENDIMENTOS_URL
    ) {
        throw new Error(
            "POWER_AUTOMATE_ATENDIMENTOS_URL não está configurada no config.js."
        );
    }

    const resposta =
        await fetch(
            POWER_AUTOMATE_ATENDIMENTOS_URL,
            {
                method: "GET"
            }
        );

    const texto =
        await resposta.text();

    if (!resposta.ok) {
        throw new Error(
            `Falha ao consultar atendimentos. HTTP ${resposta.status}. ${texto}`
        );
    }

    try {
        return extrairColecaoAtendimentos(
            texto
                ? JSON.parse(texto)
                : []
        );
    } catch {
        throw new Error(
            "O fluxo de consulta não retornou um JSON válido."
        );
    }
}

async function atualizarAtendimentoNoPowerAutomate(
    payload
) {
    if (
        typeof POWER_AUTOMATE_ATUALIZAR_URL ===
            "undefined" ||
        !POWER_AUTOMATE_ATUALIZAR_URL
    ) {
        throw new Error(
            "POWER_AUTOMATE_ATUALIZAR_URL não está configurada no config.js."
        );
    }

    const resposta =
        await fetch(
            POWER_AUTOMATE_ATUALIZAR_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(payload)
            }
        );

    const texto =
        await resposta.text();

    let retorno = null;

    if (texto) {
        try {
            retorno =
                JSON.parse(texto);
        } catch {
            retorno = {
                mensagem: texto
            };
        }
    }

    if (!resposta.ok) {
        throw new Error(
            retorno?.message ||
            retorno?.mensagem ||
            `Falha ao atualizar. HTTP ${resposta.status}.`
        );
    }

    return retorno || {
        sucesso: true,
        mensagem:
            "Atendimento atualizado com sucesso."
    };
}

// =============================================================
// API - HISTÓRICO
// =============================================================

async function buscarHistoricoAtendimento(
    atendimentoId
) {
    if (
        typeof POWER_AUTOMATE_HISTORICO_URL ===
            "undefined" ||
        !POWER_AUTOMATE_HISTORICO_URL ||
        POWER_AUTOMATE_HISTORICO_URL.includes(
            "COLE_AQUI"
        )
    ) {
        throw new Error(
            "POWER_AUTOMATE_HISTORICO_URL não está configurada no config.js."
        );
    }

    const url =
        new URL(
            POWER_AUTOMATE_HISTORICO_URL
        );

    url.searchParams.set(
        "AtendimentoID",
        String(atendimentoId)
    );

    const resposta =
        await fetch(
            url.toString(),
            {
                method: "GET"
            }
        );

    const texto =
        await resposta.text();

    if (!resposta.ok) {
        throw new Error(
            `Falha ao consultar histórico. HTTP ${resposta.status}. ${texto}`
        );
    }

    try {
        return extrairColecaoAtendimentos(
            texto
                ? JSON.parse(texto)
                : []
        );
    } catch {
        throw new Error(
            "O fluxo CTP 360 - Consultar Histórico não retornou JSON válido."
        );
    }
}

// =============================================================
// API - REGISTRAR ACOMPANHAMENTO
// =============================================================

async function registrarAcompanhamentoNoPowerAutomate(
    payload
) {
    if (
        typeof POWER_AUTOMATE_REGISTRAR_ACOMPANHAMENTO_URL ===
            "undefined" ||
        !POWER_AUTOMATE_REGISTRAR_ACOMPANHAMENTO_URL ||
        POWER_AUTOMATE_REGISTRAR_ACOMPANHAMENTO_URL.includes(
            "COLE_AQUI"
        )
    ) {
        throw new Error(
            "POWER_AUTOMATE_REGISTRAR_ACOMPANHAMENTO_URL não está configurada no config.js."
        );
    }

    const resposta =
        await fetch(
            POWER_AUTOMATE_REGISTRAR_ACOMPANHAMENTO_URL,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(payload)
            }
        );

    const texto =
        await resposta.text();

    let retorno = null;

    if (texto) {
        try {
            retorno =
                JSON.parse(texto);
        } catch {
            retorno = {
                mensagem: texto
            };
        }
    }

    if (!resposta.ok) {
        const detalhe =
            retorno?.message ||
            retorno?.mensagem ||
            retorno?.error?.message ||
            texto ||
            "Sem detalhes.";

        throw new Error(
            `Falha ao registrar acompanhamento. HTTP ${resposta.status}. ${detalhe}`
        );
    }

    return retorno || {
        sucesso: true,
        mensagem:
            "Acompanhamento registrado com sucesso."
    };
}

// =============================================================
// APIS - INICIAR / ENCERRAR ATENDIMENTO
// =============================================================

async function executarFluxoOperacional(
    url,
    payload,
    nomeFluxo
) {
    if (
        !url ||
        String(url).includes(
            "COLE_AQUI"
        )
    ) {
        throw new Error(
            `A URL do fluxo ${nomeFluxo} não está configurada.`
        );
    }

    const resposta =
        await fetch(
            url,
            {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/json"
                },
                body:
                    JSON.stringify(payload)
            }
        );

    const texto =
        await resposta.text();

    let retorno = null;

    if (texto) {
        try {
            retorno =
                JSON.parse(texto);
        } catch {
            retorno = {
                mensagem: texto
            };
        }
    }

    if (!resposta.ok) {
        throw new Error(
            retorno?.message ||
            retorno?.mensagem ||
            retorno?.error?.message ||
            `Falha no fluxo ${nomeFluxo}. HTTP ${resposta.status}.`
        );
    }

    return retorno || {
        success: true
    };
}

async function iniciarAtendimentoNoPowerAutomate(
    id
) {
    const url =
        typeof POWER_AUTOMATE_INICIAR_ATENDIMENTO_URL !==
        "undefined"
            ? POWER_AUTOMATE_INICIAR_ATENDIMENTO_URL
            : "";

    return executarFluxoOperacional(
        url,
        {
            ID: Number(id)
        },
        "Iniciar Atendimento"
    );
}

async function encerrarAtendimentoNoPowerAutomate(
    payload
) {
    const url =
        typeof POWER_AUTOMATE_ENCERRAR_ATENDIMENTO_URL !==
        "undefined"
            ? POWER_AUTOMATE_ENCERRAR_ATENDIMENTO_URL
            : "";

    return executarFluxoOperacional(
        url,
        payload,
        "Encerrar Atendimento"
    );
}

// =============================================================
// INTERFACE GERAL
// =============================================================

function definirStatusPagina(
    texto,
    tipo = ""
) {
    const elemento =
        document.getElementById(
            "statusAtendimentos"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent =
        texto;

    elemento.className =
        `status-inline ${tipo}`.trim();
}

function mostrarMensagemEdicao(
    texto,
    tipo
) {
    const elemento =
        document.getElementById(
            "mensagemEdicao"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent =
        texto;

    elemento.className =
        `status-message ${tipo}`;
}

function limparMensagemEdicao() {
    const elemento =
        document.getElementById(
            "mensagemEdicao"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent = "";

    elemento.className =
        "status-message";
}

// =============================================================
// SELECTS E FILTROS
// =============================================================

function obterValoresUnicos(campo) {
    return Array.from(
        new Set(
            registrosAtendimentosNormalizados
                .map(
                    item =>
                        String(
                            item[campo] || ""
                        ).trim()
                )
                .filter(Boolean)
        )
    ).sort(
        (a, b) =>
            a.localeCompare(
                b,
                "pt-BR"
            )
    );
}

function preencherSelectComValores(
    idSelect,
    valores,
    textoTodos
) {
    const select =
        document.getElementById(
            idSelect
        );

    if (!select) {
        return;
    }

    const atual =
        select.value;

    select.innerHTML = "";

    const inicial =
        document.createElement(
            "option"
        );

    inicial.value = "";

    inicial.textContent =
        textoTodos;

    select.appendChild(
        inicial
    );

    valores.forEach(valor => {
        const option =
            document.createElement(
                "option"
            );

        option.value =
            valor;

        option.textContent =
            valor;

        select.appendChild(
            option
        );
    });

    if (
        valores.includes(atual)
    ) {
        select.value =
            atual;
    }
}

function preencherSelectEdicao(
    idSelect,
    valores,
    sugestoes = []
) {
    const select =
        document.getElementById(
            idSelect
        );

    if (!select) {
        return;
    }

    const atual =
        select.value;

    const opcoes =
        Array.from(
            new Set(
                [
                    ...valores,
                    ...sugestoes
                ]
                    .map(
                        valor =>
                            String(
                                valor || ""
                            ).trim()
                    )
                    .filter(Boolean)
            )
        ).sort(
            (a, b) =>
                a.localeCompare(
                    b,
                    "pt-BR"
                )
        );

    select.innerHTML =
        '<option value="">Selecione</option>';

    opcoes.forEach(valor => {
        const option =
            document.createElement(
                "option"
            );

        option.value =
            valor;

        option.textContent =
            valor;

        select.appendChild(
            option
        );
    });

    if (
        opcoes.includes(atual)
    ) {
        select.value =
            atual;
    }
}

function garantirOpcaoSelect(
    idSelect,
    valor
) {
    const select =
        document.getElementById(
            idSelect
        );

    if (
        !select ||
        !valor
    ) {
        return;
    }

    const existe =
        Array.from(
            select.options
        ).some(
            option =>
                option.value ===
                valor
        );

    if (!existe) {
        const option =
            document.createElement(
                "option"
            );

        option.value =
            valor;

        option.textContent =
            valor;

        select.appendChild(
            option
        );
    }

    select.value =
        valor;
}

function preencherFiltrosESugestoes() {
    const status =
        obterValoresUnicos(
            "status"
        );

    const prioridades =
        obterValoresUnicos(
            "prioridade"
        );

    const encaminhamentos =
        obterValoresUnicos(
            "encaminhadoPara"
        );

    preencherSelectComValores(
        "filtroStatus",
        status,
        "Todos"
    );

    preencherSelectComValores(
        "filtroPrioridade",
        prioridades,
        "Todas"
    );

    preencherSelectEdicao(
        "editStatus",
        status,
        [
            "Agendado",
            "Aberto",
            "Encerrado",
            "Cancelado"
        ]
    );

    preencherSelectEdicao(
        "editPrioridade",
        prioridades,
        [
            "Baixa",
            "Normal",
            "Média",
            "Alta",
            "Urgente"
        ]
    );

    preencherSelectEdicao(
        "editEncaminhadoPara",
        encaminhamentos
    );

    const editStatus =
        document.getElementById(
            "editStatus"
        );

    if (editStatus) {
        editStatus.disabled =
            true;
    }
}

function aplicarFiltrosAtendimentos() {
    const busca =
        normalizarTextoAtendimento(
            document.getElementById(
                "filtroBusca"
            )?.value
        );

    const status =
        normalizarTextoAtendimento(
            document.getElementById(
                "filtroStatus"
            )?.value
        );

    const prioridade =
        normalizarTextoAtendimento(
            document.getElementById(
                "filtroPrioridade"
            )?.value
        );

    return registrosAtendimentosNormalizados
        .filter(item => {
            const texto =
                normalizarTextoAtendimento(
                    [
                        item.id,
                        item.numero,
                        item.assunto,
                        item.instituicao,
                        item.contato,
                        item.programa,
                        item.tecnologias,
                        item.descricaoProblema,
                        item.descricaoSolucao,
                        item.status,
                        item.prioridade,
                        item.responsavel,
                        item.encaminhadoPara
                    ].join(" ")
                );

            return (
                (
                    !busca ||
                    texto.includes(
                        busca
                    )
                ) &&
                (
                    !status ||
                    normalizarTextoAtendimento(
                        item.status
                    ) === status
                ) &&
                (
                    !prioridade ||
                    normalizarTextoAtendimento(
                        item.prioridade
                    ) === prioridade
                )
            );
        });
}

// =============================================================
// INDICADORES
// =============================================================

function atualizarIndicadoresAtendimentos() {
    const total =
        registrosAtendimentosNormalizados.length;

    const encerrados =
        registrosAtendimentosNormalizados
            .filter(
                item =>
                    valorRepresentaEncerrado(
                        item.status
                    )
            )
            .length;

    const andamento =
        registrosAtendimentosNormalizados
            .filter(
                item =>
                    valorRepresentaAgendado(
                        item.status
                    ) ||
                    valorRepresentaAberto(
                        item.status
                    )
            )
            .length;

    const acompanhamento =
        registrosAtendimentosNormalizados
            .filter(
                item =>
                    item.necessitaAcompanhamento
            )
            .length;

    const statTotal =
        document.getElementById(
            "statTotal"
        );

    const statAndamento =
        document.getElementById(
            "statAndamento"
        );

    const statEncerrados =
        document.getElementById(
            "statEncerrados"
        );

    const statAcompanhamento =
        document.getElementById(
            "statAcompanhamento"
        );

    if (statTotal) {
        statTotal.textContent =
            total;
    }

    if (statAndamento) {
        statAndamento.textContent =
            andamento;
    }

    if (statEncerrados) {
        statEncerrados.textContent =
            encerrados;
    }

    if (statAcompanhamento) {
        statAcompanhamento.textContent =
            acompanhamento;
    }
}

// =============================================================
// TABELA
// =============================================================

function criarBadgeStatus(valor) {
    const span =
        document.createElement(
            "span"
        );

    span.className =
        "status-badge";

    span.textContent =
        valor ||
        "Não informado";

    if (
        valorRepresentaEncerrado(valor)
    ) {
        span.classList.add(
            "status-badge-sucesso"
        );
    } else if (
        valorRepresentaCancelado(valor)
    ) {
        span.classList.add(
            "status-badge-cancelado"
        );
    } else if (
        valorRepresentaAgendado(valor)
    ) {
        span.classList.add(
            "status-badge-agendado"
        );
    } else {
        span.classList.add(
            "status-badge-info"
        );
    }

    return span;
}

function adicionarCelulaTexto(
    linha,
    texto
) {
    const td =
        document.createElement(
            "td"
        );

    td.textContent =
        texto ?? "";

    linha.appendChild(
        td
    );

    return td;
}

function renderizarTabelaAtendimentos() {
    const tbody =
        document.getElementById(
            "tabelaAtendimentos"
        );

    const contador =
        document.getElementById(
            "contadorFiltrado"
        );

    if (!tbody) {
        return;
    }

    const filtrados =
        aplicarFiltrosAtendimentos()
            .slice()
            .sort(
                (a, b) =>
                    (b.id || 0) -
                    (a.id || 0)
            );

    tbody.innerHTML = "";

    if (contador) {
        contador.textContent =
            `${filtrados.length} de ${registrosAtendimentosNormalizados.length} atendimento(s) exibido(s).`;
    }

    if (
        filtrados.length === 0
    ) {
        const tr =
            document.createElement(
                "tr"
            );

        const td =
            document.createElement(
                "td"
            );

        td.colSpan =
            10;

        td.textContent =
            "Nenhum atendimento encontrado.";

        tr.appendChild(
            td
        );

        tbody.appendChild(
            tr
        );

        return;
    }

    filtrados.forEach(item => {
        const tr =
            document.createElement(
                "tr"
            );

        adicionarCelulaTexto(
            tr,
            item.id ?? ""
        );

        adicionarCelulaTexto(
            tr,
            item.numero
        );

        adicionarCelulaTexto(
            tr,
            formatarDataHoraAtendimento(
                item.inicio
            )
        );

        adicionarCelulaTexto(
            tr,
            item.instituicao
        );

        adicionarCelulaTexto(
            tr,
            item.contato
        );

        const tdStatus =
            document.createElement(
                "td"
            );

        tdStatus.appendChild(
            criarBadgeStatus(
                item.status
            )
        );

        tr.appendChild(
            tdStatus
        );

        adicionarCelulaTexto(
            tr,
            item.prioridade || "-"
        );

        adicionarCelulaTexto(
            tr,
            item.responsavel || "-"
        );

        adicionarCelulaTexto(
            tr,
            formatarBooleanoAtendimento(
                item.necessitaAcompanhamento
            )
        );

        const tdAcao =
            document.createElement(
                "td"
            );

        tdAcao.className =
            "celula-acoes";

        const botao =
            document.createElement(
                "button"
            );

        botao.type =
            "button";

        botao.className =
            "button secondary button-pequeno";

        botao.textContent =
            "Editar";

        botao.addEventListener(
            "click",
            () =>
                abrirModalAtendimento(
                    item.id
                )
        );

        tdAcao.appendChild(
            botao
        );

        tr.appendChild(
            tdAcao
        );

        tbody.appendChild(
            tr
        );
    });
}

// =============================================================
// HISTÓRICO
// =============================================================

function normalizarRegistroHistorico(
    registro
) {
    return {
        id:
            Number(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "ID",
                        "Id"
                    ]
                )
            ) || null,

        data:
            obterPrimeiroValorAtendimento(
                registro,
                [
                    "DataAcompanhamento",
                    "Data Acompanhamento",
                    "Created"
                ]
            ),

        tipo:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "TipoAcompanhamento",
                        "TipoAcompanhamento Value",
                        "Tipo Acompanhamento"
                    ]
                )
            ),

        resultado:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Resultado"
                    ]
                )
            ),

        proximaAcao:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "ProximaAcao",
                        "Próxima Ação",
                        "Proxima Acao"
                    ]
                )
            ),

        proximaData:
            obterPrimeiroValorAtendimento(
                registro,
                [
                    "DataProximoAcompanhamento",
                    "Data Próximo Acompanhamento",
                    "Data Proximo Acompanhamento"
                ]
            ),

        status:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "StatusAcompanhamento",
                        "StatusAcompanhamento Value",
                        "Status Acompanhamento"
                    ]
                )
            ),

        responsavel:
            String(
                obterPrimeiroValorAtendimento(
                    registro,
                    [
                        "Responsavel",
                        "Responsável"
                    ]
                )
            )
    };
}

function definirStatusHistorico(
    texto,
    tipo = ""
) {
    const elemento =
        document.getElementById(
            "statusHistorico"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent =
        texto;

    elemento.className =
        `status-historico ${tipo}`.trim();
}

function renderizarHistorico(
    registros
) {
    const container =
        document.getElementById(
            "listaHistorico"
        );

    if (!container) {
        return;
    }

    container.innerHTML = "";

    if (!registros.length) {
        const vazio =
            document.createElement(
                "div"
            );

        vazio.className =
            "historico-vazio";

        vazio.textContent =
            "Ainda não há acompanhamentos registrados para este atendimento.";

        container.appendChild(
            vazio
        );

        return;
    }

    registros
        .map(
            normalizarRegistroHistorico
        )
        .sort(
            (a, b) => {
                const da =
                    new Date(
                        a.data || 0
                    ).getTime() || 0;

                const db =
                    new Date(
                        b.data || 0
                    ).getTime() || 0;

                return db - da;
            }
        )
        .forEach(item => {
            const card =
                document.createElement(
                    "article"
                );

            card.className =
                "historico-item";

            const topo =
                document.createElement(
                    "div"
                );

            topo.className =
                "historico-item-topo";

            const data =
                document.createElement(
                    "strong"
                );

            data.textContent =
                formatarDataHoraAtendimento(
                    item.data
                ) ||
                "Data não informada";

            const status =
                document.createElement(
                    "span"
                );

            status.className =
                "historico-status";

            status.textContent =
                item.status ||
                "Sem status";

            topo.appendChild(
                data
            );

            topo.appendChild(
                status
            );

            card.appendChild(
                topo
            );

            const tipo =
                document.createElement(
                    "h4"
                );

            tipo.textContent =
                item.tipo ||
                "Acompanhamento";

            card.appendChild(
                tipo
            );

            if (item.resultado) {
                const p =
                    document.createElement(
                        "p"
                    );

                p.innerHTML =
                    "<strong>Resultado:</strong> ";

                p.appendChild(
                    document.createTextNode(
                        item.resultado
                    )
                );

                card.appendChild(
                    p
                );
            }

            if (item.proximaAcao) {
                const p =
                    document.createElement(
                        "p"
                    );

                p.innerHTML =
                    "<strong>Próxima ação:</strong> ";

                p.appendChild(
                    document.createTextNode(
                        item.proximaAcao
                    )
                );

                card.appendChild(
                    p
                );
            }

            if (item.proximaData) {
                const p =
                    document.createElement(
                        "p"
                    );

                p.innerHTML =
                    "<strong>Próximo acompanhamento:</strong> ";

                p.appendChild(
                    document.createTextNode(
                        formatarDataAtendimento(
                            item.proximaData
                        )
                    )
                );

                card.appendChild(
                    p
                );
            }

            if (item.responsavel) {
                const p =
                    document.createElement(
                        "p"
                    );

                p.innerHTML =
                    "<strong>Responsável:</strong> ";

                p.appendChild(
                    document.createTextNode(
                        item.responsavel
                    )
                );

                card.appendChild(
                    p
                );
            }

            container.appendChild(
                card
            );
        });
}

async function carregarHistoricoAtendimento(
    atendimentoId
) {
    if (!atendimentoId) {
        return;
    }

    definirStatusHistorico(
        "Consultando histórico...",
        "carregando"
    );

    const lista =
        document.getElementById(
            "listaHistorico"
        );

    if (lista) {
        lista.innerHTML = "";
    }

    try {
        const registros =
            await buscarHistoricoAtendimento(
                atendimentoId
            );

        renderizarHistorico(
            registros
        );

        definirStatusHistorico(
            `${registros.length} acompanhamento(s) encontrado(s).`,
            "sucesso"
        );

    } catch (erro) {
        console.error(
            erro
        );

        definirStatusHistorico(
            erro.message ||
            "Não foi possível consultar o histórico.",
            "erro"
        );
    }
}

// =============================================================
// MODAL - REGISTRAR ACOMPANHAMENTO
// =============================================================

function limparMensagemAcompanhamento() {
    const elemento =
        document.getElementById(
            "mensagemAcompanhamento"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent =
        "";

    elemento.className =
        "status-message";
}

function mostrarMensagemAcompanhamento(
    texto,
    tipo
) {
    const elemento =
        document.getElementById(
            "mensagemAcompanhamento"
        );

    if (!elemento) {
        return;
    }

    elemento.textContent =
        texto;

    elemento.className =
        `status-message ${tipo}`;
}

function atualizarRegrasFormularioAcompanhamento() {
    const status =
        document.getElementById(
            "acompStatusAcompanhamento"
        )?.value;

    const campoData =
        document.getElementById(
            "acompDataProximoAcompanhamento"
        );

    const avisoConclusao =
        document.getElementById(
            "avisoConclusaoAcompanhamento"
        );

    const ajudaData =
        document.getElementById(
            "ajudaDataAcompanhamento"
        );

    if (!campoData) {
        return;
    }

    campoData.disabled =
        false;

    campoData.required =
        false;

    if (avisoConclusao) {
        avisoConclusao.hidden =
            true;
    }

    if (
        status ===
        "Reagendado"
    ) {
        campoData.required =
            true;

        if (ajudaData) {
            ajudaData.textContent =
                "Informe obrigatoriamente a nova data de acompanhamento.";
        }

        return;
    }

    if (
        status ===
        "Concluído"
    ) {
        campoData.value =
            "";

        campoData.disabled =
            true;

        if (avisoConclusao) {
            avisoConclusao.hidden =
                false;
        }

        if (ajudaData) {
            ajudaData.textContent =
                "Não é necessário informar nova data para um acompanhamento concluído.";
        }

        return;
    }

    if (ajudaData) {
        ajudaData.textContent =
            "Informe uma data se houver novo acompanhamento previsto.";
    }
}

function abrirModalRegistrarAcompanhamento() {
    if (
        !atendimentoSelecionado?.id
    ) {
        mostrarMensagemEdicao(
            "Abra um atendimento antes de registrar um acompanhamento.",
            "error"
        );

        return;
    }

    const modal =
        document.getElementById(
            "modalRegistrarAcompanhamento"
        );

    const form =
        document.getElementById(
            "formRegistrarAcompanhamento"
        );

    if (
        !modal ||
        !form
    ) {
        return;
    }

    form.reset();

    limparMensagemAcompanhamento();

    definirValorElemento(
        "acompAtendimentoID",
        atendimentoSelecionado.id
    );

    const subtitulo =
        document.getElementById(
            "subtituloModalRegistrarAcompanhamento"
        );

    if (subtitulo) {
        subtitulo.textContent =
            `${atendimentoSelecionado.numero || "Atendimento"} • ` +
            `${atendimentoSelecionado.instituicao || "Instituição não informada"}`;
    }

    definirValorElemento(
        "acompStatusAcompanhamento",
        "Pendente"
    );

    atualizarRegrasFormularioAcompanhamento();

    modal.hidden =
        false;

    setTimeout(
        () => {
            document
                .getElementById(
                    "acompTipoAcompanhamento"
                )
                ?.focus();
        },
        0
    );
}

function fecharModalRegistrarAcompanhamento() {
    const modal =
        document.getElementById(
            "modalRegistrarAcompanhamento"
        );

    if (!modal) {
        return;
    }

    modal.hidden =
        true;

    limparMensagemAcompanhamento();
}

async function salvarNovoAcompanhamento(
    event
) {
    event.preventDefault();

    const atendimentoId =
        Number(
            document.getElementById(
                "acompAtendimentoID"
            )?.value
        );

    const tipoAcompanhamento =
        document.getElementById(
            "acompTipoAcompanhamento"
        )?.value || "";

    const resultado =
        document.getElementById(
            "acompResultado"
        )?.value.trim() || "";

    const proximaAcao =
        document.getElementById(
            "acompProximaAcao"
        )?.value.trim() || "";

    const statusAcompanhamento =
        document.getElementById(
            "acompStatusAcompanhamento"
        )?.value || "";

    let dataProximoAcompanhamento =
        document.getElementById(
            "acompDataProximoAcompanhamento"
        )?.value || null;

    if (
        !Number.isFinite(
            atendimentoId
        )
    ) {
        mostrarMensagemAcompanhamento(
            "O ID do atendimento é inválido.",
            "error"
        );

        return;
    }

    if (
        !tipoAcompanhamento ||
        !resultado ||
        !statusAcompanhamento
    ) {
        mostrarMensagemAcompanhamento(
            "Preencha Tipo, Resultado e Status do acompanhamento.",
            "error"
        );

        return;
    }

    if (
        statusAcompanhamento ===
            "Reagendado" &&
        !dataProximoAcompanhamento
    ) {
        mostrarMensagemAcompanhamento(
            "Informe a nova data para um acompanhamento Reagendado.",
            "error"
        );

        return;
    }

    if (
        statusAcompanhamento ===
        "Concluído"
    ) {
        dataProximoAcompanhamento =
            null;
    }

    const payload = {
        AtendimentoID:
            atendimentoId,

        TipoAcompanhamento:
            tipoAcompanhamento,

        Resultado:
            resultado,

        ProximaAcao:
            proximaAcao,

        DataProximoAcompanhamento:
            dataProximoAcompanhamento,

        StatusAcompanhamento:
            statusAcompanhamento
    };

    const botao =
        document.getElementById(
            "btnSalvarAcompanhamento"
        );

    if (!botao) {
        return;
    }

    const textoOriginal =
        botao.textContent;

    try {
        botao.disabled =
            true;

        botao.textContent =
            "Salvando...";

        mostrarMensagemAcompanhamento(
            "Registrando acompanhamento...",
            "success"
        );

        const retorno =
            await registrarAcompanhamentoNoPowerAutomate(
                payload
            );

        mostrarMensagemAcompanhamento(
            retorno?.message ||
            retorno?.mensagem ||
            "Acompanhamento registrado com sucesso.",
            "success"
        );

        await carregarAtendimentos({
            preservarModal: true,
            mensagemFinal:
                "Acompanhamento registrado."
        });

        const atualizado =
            registrosAtendimentosNormalizados
                .find(
                    item =>
                        Number(item.id) ===
                        Number(atendimentoId)
                );

        if (atualizado) {
            atendimentoSelecionado =
                atualizado;

            definirValorElemento(
                "editNecessitaAcompanhamento",
                String(
                    Boolean(
                        atualizado
                            .necessitaAcompanhamento
                    )
                )
            );

            definirValorElemento(
                "editDataProximoAcompanhamento",
                converterParaInputData(
                    atualizado
                        .dataProximoAcompanhamento
                )
            );
        }

        await carregarHistoricoAtendimento(
            atendimentoId
        );

        setTimeout(
            () => {
                fecharModalRegistrarAcompanhamento();
            },
            600
        );

    } catch (erro) {
        console.error(
            erro
        );

        mostrarMensagemAcompanhamento(
            erro.message ||
            "Não foi possível registrar o acompanhamento.",
            "error"
        );

    } finally {
        botao.disabled =
            false;

        botao.textContent =
            textoOriginal;
    }
}

// =============================================================
// AÇÕES OPERACIONAIS DO MODAL
// =============================================================

function garantirBotoesOperacionaisModal() {
    const container =
        document.querySelector(
            ".acoes-modal"
        );

    if (!container) {
        return;
    }

    let btnIniciar =
        document.getElementById(
            "btnIniciarAtendimento"
        );

    if (!btnIniciar) {
        btnIniciar =
            document.createElement(
                "button"
            );

        btnIniciar.id =
            "btnIniciarAtendimento";

        btnIniciar.type =
            "button";

        btnIniciar.className =
            "button success button-sem-margem";

        btnIniciar.textContent =
            "▶ Iniciar atendimento";

        btnIniciar.hidden =
            true;

        const salvar =
            document.getElementById(
                "btnSalvarAtendimento"
            );

        if (
            salvar &&
            salvar.parentElement ===
                container
        ) {
            container.insertBefore(
                btnIniciar,
                salvar
            );
        } else {
            container.appendChild(
                btnIniciar
            );
        }
    }

    let btnEncerrar =
        document.getElementById(
            "btnEncerrarAtendimento"
        );

    if (!btnEncerrar) {
        btnEncerrar =
            document.createElement(
                "button"
            );

        btnEncerrar.id =
            "btnEncerrarAtendimento";

        btnEncerrar.type =
            "button";

        btnEncerrar.className =
            "button danger button-sem-margem";

        btnEncerrar.textContent =
            "■ Encerrar atendimento";

        btnEncerrar.hidden =
            true;

        const salvar =
            document.getElementById(
                "btnSalvarAtendimento"
            );

        if (
            salvar &&
            salvar.parentElement ===
                container
        ) {
            container.insertBefore(
                btnEncerrar,
                salvar
            );
        } else {
            container.appendChild(
                btnEncerrar
            );
        }
    }
}

function atualizarAcoesOperacionaisModal(
    item
) {
    const btnIniciar =
        document.getElementById(
            "btnIniciarAtendimento"
        );

    const btnEncerrar =
        document.getElementById(
            "btnEncerrarAtendimento"
        );

    if (
        !btnIniciar ||
        !btnEncerrar
    ) {
        return;
    }

    const status =
        normalizarTextoAtendimento(
            item?.status
        );

    btnIniciar.hidden =
        status !== "agendado";

    btnEncerrar.hidden =
        status !== "aberto";
}

async function iniciarAtendimentoSelecionado() {
    const item =
        atendimentoSelecionado;

    if (!item?.id) {
        mostrarMensagemEdicao(
            "Nenhum atendimento foi selecionado.",
            "error"
        );

        return;
    }

    if (
        !valorRepresentaAgendado(
            item.status
        )
    ) {
        mostrarMensagemEdicao(
            "Somente atendimentos Agendados podem ser iniciados.",
            "error"
        );

        return;
    }

    const confirmar =
        window.confirm(
            `Deseja iniciar agora o atendimento ${item.numero || item.id}?`
        );

    if (!confirmar) {
        return;
    }

    const botao =
        document.getElementById(
            "btnIniciarAtendimento"
        );

    if (!botao) {
        return;
    }

    const textoOriginal =
        botao.textContent;

    try {
        botao.disabled =
            true;

        botao.textContent =
            "Iniciando...";

        mostrarMensagemEdicao(
            "Iniciando atendimento...",
            "success"
        );

        await iniciarAtendimentoNoPowerAutomate(
            item.id
        );

        await carregarAtendimentos({
            preservarModal: true,
            mensagemFinal:
                "Atendimento iniciado."
        });

        const atualizado =
            registrosAtendimentosNormalizados
                .find(
                    registro =>
                        Number(registro.id) ===
                        Number(item.id)
                );

        if (atualizado) {
            abrirModalAtendimento(
                atualizado.id
            );
        }

        mostrarMensagemEdicao(
            "Atendimento iniciado com sucesso.",
            "success"
        );

    } catch (erro) {
        console.error(
            erro
        );

        mostrarMensagemEdicao(
            erro.message ||
            "Não foi possível iniciar o atendimento.",
            "error"
        );

    } finally {
        botao.disabled =
            false;

        botao.textContent =
            textoOriginal;
    }
}

async function encerrarAtendimentoSelecionado() {
    const item =
        atendimentoSelecionado;

    if (!item?.id) {
        mostrarMensagemEdicao(
            "Nenhum atendimento foi selecionado.",
            "error"
        );

        return;
    }

    if (
        !valorRepresentaAberto(
            item.status
        )
    ) {
        mostrarMensagemEdicao(
            "Somente atendimentos Abertos podem ser encerrados.",
            "error"
        );

        return;
    }

    const campoSolucao =
        document.getElementById(
            "editDescricaoSolucao"
        );

    const campoResolvido =
        document.getElementById(
            "editResolvidoPrimeiroContato"
        );

    const campoAcompanhamento =
        document.getElementById(
            "editNecessitaAcompanhamento"
        );

    const campoData =
        document.getElementById(
            "editDataProximoAcompanhamento"
        );

    const campoObservacoes =
        document.getElementById(
            "editObservacoesInternas"
        );

    const descricaoSolucao =
        campoSolucao
            ?.value
            .trim() || "";

    const resolvidoPrimeiroContato =
        campoResolvido
            ?.value ===
        "true";

    const necessitaAcompanhamento =
        campoAcompanhamento
            ?.value ===
        "true";

    const dataProximoAcompanhamento =
        campoData
            ?.value || null;

    const observacoesInternas =
        campoObservacoes
            ?.value
            .trim() || null;

    if (!descricaoSolucao) {
        mostrarMensagemEdicao(
            "Informe a descrição da solução antes de encerrar.",
            "error"
        );

        campoSolucao?.focus();

        return;
    }

    if (
        necessitaAcompanhamento &&
        !dataProximoAcompanhamento
    ) {
        mostrarMensagemEdicao(
            "Informe a data do próximo acompanhamento.",
            "error"
        );

        campoData?.focus();

        return;
    }

    const confirmar =
        window.confirm(
            `Deseja encerrar o atendimento ${item.numero || item.id}?`
        );

    if (!confirmar) {
        return;
    }

    const botao =
        document.getElementById(
            "btnEncerrarAtendimento"
        );

    if (!botao) {
        return;
    }

    const textoOriginal =
        botao.textContent;

    const payload = {
        ID:
            Number(item.id),

        DescricaoSolucao:
            descricaoSolucao,

        ResolvidoPrimeiroContato:
            resolvidoPrimeiroContato,

        NecessitaAcompanhamento:
            necessitaAcompanhamento,

        DataProximoAcompanhamento:
            necessitaAcompanhamento
                ? dataProximoAcompanhamento
                : null,

        ObservacoesInternas:
            observacoesInternas
    };

    try {
        botao.disabled =
            true;

        botao.textContent =
            "Encerrando...";

        mostrarMensagemEdicao(
            "Encerrando atendimento...",
            "success"
        );

        await encerrarAtendimentoNoPowerAutomate(
            payload
        );

        await carregarAtendimentos({
            preservarModal: true,
            mensagemFinal:
                "Atendimento encerrado."
        });

        const atualizado =
            registrosAtendimentosNormalizados
                .find(
                    registro =>
                        Number(registro.id) ===
                        Number(item.id)
                );

        if (atualizado) {
            abrirModalAtendimento(
                atualizado.id
            );
        }

        mostrarMensagemEdicao(
            "Atendimento encerrado com sucesso.",
            "success"
        );

    } catch (erro) {
        console.error(
            erro
        );

        mostrarMensagemEdicao(
            erro.message ||
            "Não foi possível encerrar o atendimento.",
            "error"
        );

    } finally {
        botao.disabled =
            false;

        botao.textContent =
            textoOriginal;
    }
}

// =============================================================
// MODAL PRINCIPAL
// =============================================================

function abrirModalAtendimento(id) {
    const item =
        registrosAtendimentosNormalizados
            .find(
                registro =>
                    Number(registro.id) ===
                    Number(id)
            );

    if (!item) {
        definirStatusPagina(
            "Não foi possível localizar o atendimento selecionado.",
            "erro"
        );

        return;
    }

    atendimentoSelecionado =
        item;

    limparMensagemEdicao();

    garantirBotoesOperacionaisModal();

    atualizarAcoesOperacionaisModal(
        item
    );

    // ---------------------------------------------------------
    // ID
    // ---------------------------------------------------------

    definirValorElemento(
        "editId",
        item.id ?? ""
    );

    // ---------------------------------------------------------
    // NÚMERO
    // ---------------------------------------------------------

    definirValorElemento(
        "editNumero",
        item.numero || ""
    );

    // ---------------------------------------------------------
    // STATUS VISUAL
    // ESTE É O CAMPO NOVO DO HTML
    // ---------------------------------------------------------

    definirValorElemento(
        "editStatusVisual",
        item.status || ""
    );

    // ---------------------------------------------------------
    // INÍCIO REAL
    // ---------------------------------------------------------

    definirValorElemento(
        "editInicio",
        formatarDataHoraAtendimento(
            item.inicioAtendimento ||
            item.inicio
        )
    );

    // ---------------------------------------------------------
    // HORÁRIOS AGENDADOS
    // ---------------------------------------------------------

    definirValorElemento(
        "editInicioAgendado",
        formatarDataHoraAtendimento(
            item.inicioAgendado
        )
    );

    definirValorElemento(
        "editFimAgendado",
        formatarDataHoraAtendimento(
            item.fimAgendado
        )
    );

    // ---------------------------------------------------------
    // FIM REAL
    // ---------------------------------------------------------

    definirValorElemento(
        "editFim",
        formatarDataHoraAtendimento(
            item.fimAtendimento
        )
    );

    // ---------------------------------------------------------
    // DURAÇÃO
    // ---------------------------------------------------------

    definirValorElemento(
        "editDuracao",
        (
            item.duracaoMinutos !== "" &&
            item.duracaoMinutos !== null &&
            item.duracaoMinutos !== undefined
        )
            ? `${item.duracaoMinutos} minuto(s)`
            : ""
    );

    // ---------------------------------------------------------
    // INSTITUIÇÃO
    // ---------------------------------------------------------

    definirValorElemento(
        "editInstituicao",
        item.instituicao || ""
    );

    // ---------------------------------------------------------
    // CONTATO
    // ---------------------------------------------------------

    definirValorElemento(
        "editContato",
        item.contato || ""
    );

    // ---------------------------------------------------------
    // PROGRAMA
    // ---------------------------------------------------------

    definirValorElemento(
        "editPrograma",
        item.programa || ""
    );

    // ---------------------------------------------------------
    // TECNOLOGIA
    // ---------------------------------------------------------

    definirValorElemento(
        "editTecnologias",
        item.tecnologias || ""
    );

    // ---------------------------------------------------------
    // PROBLEMA
    // ---------------------------------------------------------

    definirValorElemento(
        "editProblema",
        item.descricaoProblema || ""
    );

    // ---------------------------------------------------------
    // STATUS INTERNO DO FORMULÁRIO
    // ---------------------------------------------------------

    garantirOpcaoSelect(
        "editStatus",
        item.status
    );

    // ---------------------------------------------------------
    // PRIORIDADE
    // ---------------------------------------------------------

    garantirOpcaoSelect(
        "editPrioridade",
        item.prioridade
    );

    // ---------------------------------------------------------
    // ENCAMINHAMENTO
    // ---------------------------------------------------------

    garantirOpcaoSelect(
        "editEncaminhadoPara",
        item.encaminhadoPara
    );

    // ---------------------------------------------------------
    // RESPONSÁVEL
    // ---------------------------------------------------------

    definirValorElemento(
        "editResponsavel",
        item.responsavel || ""
    );

    // ---------------------------------------------------------
    // ACOMPANHAMENTO
    // ---------------------------------------------------------

    definirValorElemento(
        "editNecessitaAcompanhamento",
        String(
            Boolean(
                item.necessitaAcompanhamento
            )
        )
    );

    // ---------------------------------------------------------
    // RESOLVIDO PRIMEIRO CONTATO
    // ---------------------------------------------------------

    definirValorElemento(
        "editResolvidoPrimeiroContato",
        String(
            Boolean(
                item.resolvidoPrimeiroContato
            )
        )
    );

    // ---------------------------------------------------------
    // DATA PRÓXIMO ACOMPANHAMENTO
    // ---------------------------------------------------------

    definirValorElemento(
        "editDataProximoAcompanhamento",
        converterParaInputData(
            item.dataProximoAcompanhamento
        )
    );

    // ---------------------------------------------------------
    // DATA CONCLUSÃO
    // ---------------------------------------------------------

    definirValorElemento(
        "editDataConclusao",
        formatarDataHoraAtendimento(
            item.dataConclusao
        )
    );

    // ---------------------------------------------------------
    // SOLUÇÃO
    // ---------------------------------------------------------

    definirValorElemento(
        "editDescricaoSolucao",
        item.descricaoSolucao || ""
    );

    // ---------------------------------------------------------
    // OBSERVAÇÕES
    // ---------------------------------------------------------

    definirValorElemento(
        "editObservacoesInternas",
        item.observacoesInternas || ""
    );

    // ---------------------------------------------------------
    // E-MAIL DO BOOKING
    // ---------------------------------------------------------

    definirValorElemento(
        "editEmailContatoAgendamento",
        item.emailContatoAgendamento || ""
    );

    // ---------------------------------------------------------
    // TELEFONE DO BOOKING
    // ---------------------------------------------------------

    definirValorElemento(
        "editTelefoneContatoAgendamento",
        item.telefoneContatoAgendamento || ""
    );

    // ---------------------------------------------------------
    // SUBTÍTULO
    // ---------------------------------------------------------

    const subtitulo =
        document.getElementById(
            "subtituloModalAtendimento"
        );

    if (subtitulo) {
        subtitulo.textContent =
            `ID ${item.id ?? "-"} • ` +
            `${item.instituicao || "Instituição não informada"}`;
    }

    // ---------------------------------------------------------
    // ABRIR MODAL
    // ---------------------------------------------------------

    const modal =
        document.getElementById(
            "modalAtendimento"
        );

    if (modal) {
        modal.hidden =
            false;
    }

    document.body.classList.add(
        "modal-aberto"
    );

    carregarHistoricoAtendimento(
        item.id
    );
}

function fecharModalAtendimento() {
    const modal =
        document.getElementById(
            "modalAtendimento"
        );

    if (!modal) {
        return;
    }

    fecharModalRegistrarAcompanhamento();

    modal.hidden =
        true;

    document.body.classList.remove(
        "modal-aberto"
    );

    atendimentoSelecionado =
        null;

    limparMensagemEdicao();

    if (
        window.location.search
    ) {
        window.history.replaceState(
            {},
            document.title,
            window.location.pathname
        );
    }
}

// =============================================================
// SALVAR EDIÇÃO NORMAL
// =============================================================

async function salvarEdicaoAtendimento(
    event
) {
    event.preventDefault();

    const id =
        Number(
            document.getElementById(
                "editId"
            )?.value
        );

    const prioridade =
        document.getElementById(
            "editPrioridade"
        )?.value || "";

    // O status é preservado.
    // Iniciar e Encerrar possuem fluxos separados.
    const status =
        atendimentoSelecionado?.status ||
        document.getElementById(
            "editStatus"
        )?.value ||
        "";

    if (
        !Number.isFinite(id)
    ) {
        mostrarMensagemEdicao(
            "O ID do atendimento é inválido.",
            "error"
        );

        return;
    }

    if (
        !status ||
        !prioridade
    ) {
        mostrarMensagemEdicao(
            "Informe Status e Prioridade.",
            "error"
        );

        return;
    }

    const payload = {
        ID:
            id,

        Status:
            status,

        Prioridade:
            prioridade,

        NecessitaAcompanhamento:
            document.getElementById(
                "editNecessitaAcompanhamento"
            )?.value ===
            "true",

        ResolvidoPrimeiroContato:
            document.getElementById(
                "editResolvidoPrimeiroContato"
            )?.value ===
            "true",

        EncaminhadoPara:
            document.getElementById(
                "editEncaminhadoPara"
            )?.value || "",

        DescricaoSolucao:
            document.getElementById(
                "editDescricaoSolucao"
            )?.value.trim() || "",

        ObservacoesInternas:
            document.getElementById(
                "editObservacoesInternas"
            )?.value.trim() || "",

        DataProximoAcompanhamento:
            document.getElementById(
                "editDataProximoAcompanhamento"
            )?.value || null
    };

    const botao =
        document.getElementById(
            "btnSalvarAtendimento"
        );

    if (!botao) {
        return;
    }

    const textoOriginal =
        botao.textContent;

    try {
        botao.disabled =
            true;

        botao.textContent =
            "Salvando...";

        const retorno =
            await atualizarAtendimentoNoPowerAutomate(
                payload
            );

        mostrarMensagemEdicao(
            retorno?.message ||
            retorno?.mensagem ||
            "Atendimento atualizado com sucesso.",
            "success"
        );

        await carregarAtendimentos({
            preservarModal: true,
            mensagemFinal:
                "Atendimento atualizado."
        });

        const atualizado =
            registrosAtendimentosNormalizados
                .find(
                    item =>
                        Number(item.id) ===
                        Number(id)
                );

        if (atualizado) {
            atendimentoSelecionado =
                atualizado;

            abrirModalAtendimento(
                atualizado.id
            );
        }

    } catch (erro) {
        console.error(
            erro
        );

        mostrarMensagemEdicao(
            erro.message ||
            "Não foi possível atualizar o atendimento.",
            "error"
        );

    } finally {
        botao.disabled =
            false;

        botao.textContent =
            textoOriginal;
    }
}

// =============================================================
// CARREGAR PÁGINA
// =============================================================

async function carregarAtendimentos(
    opcoes = {}
) {
    const {
        preservarModal = false,
        mensagemFinal = ""
    } = opcoes;

    try {
        definirStatusPagina(
            "Buscando atendimentos...",
            "carregando"
        );

        const dados =
            await buscarAtendimentosDaFonte();

        registrosAtendimentosOriginais =
            dados;

        registrosAtendimentosNormalizados =
            dados
                .map(
                    normalizarRegistroAtendimento
                )
                .filter(
                    item =>
                        item.id !== null
                );

        preencherFiltrosESugestoes();

        atualizarIndicadoresAtendimentos();

        renderizarTabelaAtendimentos();

        definirStatusPagina(
            mensagemFinal ||
            `Lista atualizada com ${registrosAtendimentosNormalizados.length} atendimento(s).`,
            "sucesso"
        );

        const idSolicitado =
            obterIdDaUrl();

        if (
            idSolicitado &&
            !preservarModal
        ) {
            const existe =
                registrosAtendimentosNormalizados
                    .some(
                        item =>
                            Number(item.id) ===
                            Number(idSolicitado)
                    );

            if (existe) {
                abrirModalAtendimento(
                    idSolicitado
                );
            }
        }

    } catch (erro) {
        console.error(
            erro
        );

        registrosAtendimentosOriginais =
            [];

        registrosAtendimentosNormalizados =
            [];

        atualizarIndicadoresAtendimentos();

        renderizarTabelaAtendimentos();

        definirStatusPagina(
            erro.message ||
            "Não foi possível carregar os atendimentos.",
            "erro"
        );
    }
}

function limparFiltrosAtendimentos() {
    const busca =
        document.getElementById(
            "filtroBusca"
        );

    const status =
        document.getElementById(
            "filtroStatus"
        );

    const prioridade =
        document.getElementById(
            "filtroPrioridade"
        );

    if (busca) {
        busca.value =
            "";
    }

    if (status) {
        status.value =
            "";
    }

    if (prioridade) {
        prioridade.value =
            "";
    }

    renderizarTabelaAtendimentos();
}

// =============================================================
// EVENTOS
// =============================================================

document.addEventListener(
    "DOMContentLoaded",
    function () {

        garantirBotoesOperacionaisModal();

        // -----------------------------------------------------
        // ATUALIZAR LISTA
        // -----------------------------------------------------

        document
            .getElementById(
                "btnRecarregar"
            )
            ?.addEventListener(
                "click",
                () =>
                    carregarAtendimentos()
            );

        // -----------------------------------------------------
        // LIMPAR FILTROS
        // -----------------------------------------------------

        document
            .getElementById(
                "btnLimparFiltros"
            )
            ?.addEventListener(
                "click",
                limparFiltrosAtendimentos
            );

        // -----------------------------------------------------
        // FILTRO TEXTO
        // -----------------------------------------------------

        document
            .getElementById(
                "filtroBusca"
            )
            ?.addEventListener(
                "input",
                renderizarTabelaAtendimentos
            );

        // -----------------------------------------------------
        // FILTRO STATUS
        // -----------------------------------------------------

        document
            .getElementById(
                "filtroStatus"
            )
            ?.addEventListener(
                "change",
                renderizarTabelaAtendimentos
            );

        // -----------------------------------------------------
        // FILTRO PRIORIDADE
        // -----------------------------------------------------

        document
            .getElementById(
                "filtroPrioridade"
            )
            ?.addEventListener(
                "change",
                renderizarTabelaAtendimentos
            );

        // -----------------------------------------------------
        // SALVAR EDIÇÃO
        // -----------------------------------------------------

        document
            .getElementById(
                "formEditarAtendimento"
            )
            ?.addEventListener(
                "submit",
                salvarEdicaoAtendimento
            );

        // -----------------------------------------------------
        // FECHAR MODAL PRINCIPAL
        // -----------------------------------------------------

        document
            .getElementById(
                "btnFecharModal"
            )
            ?.addEventListener(
                "click",
                fecharModalAtendimento
            );

        document
            .getElementById(
                "btnCancelarEdicao"
            )
            ?.addEventListener(
                "click",
                fecharModalAtendimento
            );

        document
            .querySelectorAll(
                "[data-fechar-modal]"
            )
            .forEach(
                elemento => {
                    elemento.addEventListener(
                        "click",
                        fecharModalAtendimento
                    );
                }
            );

        // -----------------------------------------------------
        // HISTÓRICO
        // -----------------------------------------------------

        document
            .getElementById(
                "btnAtualizarHistorico"
            )
            ?.addEventListener(
                "click",
                () => {
                    if (
                        atendimentoSelecionado?.id
                    ) {
                        carregarHistoricoAtendimento(
                            atendimentoSelecionado.id
                        );
                    }
                }
            );

        // -----------------------------------------------------
        // ABRIR MODAL ACOMPANHAMENTO
        // -----------------------------------------------------

        document
            .getElementById(
                "btnRegistrarAcompanhamento"
            )
            ?.addEventListener(
                "click",
                abrirModalRegistrarAcompanhamento
            );

        // -----------------------------------------------------
        // SALVAR ACOMPANHAMENTO
        // -----------------------------------------------------

        document
            .getElementById(
                "formRegistrarAcompanhamento"
            )
            ?.addEventListener(
                "submit",
                salvarNovoAcompanhamento
            );

        // -----------------------------------------------------
        // FECHAR MODAL ACOMPANHAMENTO
        // -----------------------------------------------------

        document
            .getElementById(
                "btnFecharModalAcompanhamento"
            )
            ?.addEventListener(
                "click",
                fecharModalRegistrarAcompanhamento
            );

        document
            .getElementById(
                "btnCancelarAcompanhamento"
            )
            ?.addEventListener(
                "click",
                fecharModalRegistrarAcompanhamento
            );

        document
            .querySelectorAll(
                "[data-fechar-modal-acompanhamento]"
            )
            .forEach(
                elemento => {
                    elemento.addEventListener(
                        "click",
                        fecharModalRegistrarAcompanhamento
                    );
                }
            );

        // -----------------------------------------------------
        // STATUS ACOMPANHAMENTO
        // -----------------------------------------------------

        document
            .getElementById(
                "acompStatusAcompanhamento"
            )
            ?.addEventListener(
                "change",
                atualizarRegrasFormularioAcompanhamento
            );

        // -----------------------------------------------------
        // INICIAR ATENDIMENTO
        // -----------------------------------------------------

        document
            .getElementById(
                "btnIniciarAtendimento"
            )
            ?.addEventListener(
                "click",
                iniciarAtendimentoSelecionado
            );

        // -----------------------------------------------------
        // ENCERRAR ATENDIMENTO
        // -----------------------------------------------------

        document
            .getElementById(
                "btnEncerrarAtendimento"
            )
            ?.addEventListener(
                "click",
                encerrarAtendimentoSelecionado
            );

        // -----------------------------------------------------
        // TECLA ESC
        // -----------------------------------------------------

        document.addEventListener(
            "keydown",
            event => {

                if (
                    event.key !==
                    "Escape"
                ) {
                    return;
                }

                const modalAcompanhamento =
                    document.getElementById(
                        "modalRegistrarAcompanhamento"
                    );

                if (
                    modalAcompanhamento &&
                    !modalAcompanhamento.hidden
                ) {
                    fecharModalRegistrarAcompanhamento();

                    return;
                }

                const modalAtendimento =
                    document.getElementById(
                        "modalAtendimento"
                    );

                if (
                    modalAtendimento &&
                    !modalAtendimento.hidden
                ) {
                    fecharModalAtendimento();
                }
            }
        );

        // -----------------------------------------------------
        // CARREGAMENTO INICIAL
        // -----------------------------------------------------

        carregarAtendimentos();
    }
);
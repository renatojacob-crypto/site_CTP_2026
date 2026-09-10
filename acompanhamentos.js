let acompanhamentosOriginais = [];
let acompanhamentosNormalizados = [];

function normalizarTexto(valor) {
    return String(valor ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/_x0020_/gi, " ")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function encontrarChave(registro, nomesPossiveis) {
    if (!registro || typeof registro !== "object") return null;

    for (const nome of nomesPossiveis) {
        if (Object.prototype.hasOwnProperty.call(registro, nome)) return nome;
    }

    for (const chave of Object.keys(registro)) {
        const chaveNormalizada = normalizarTexto(chave);

        for (const nome of nomesPossiveis) {
            if (chaveNormalizada === normalizarTexto(nome)) return chave;
        }
    }

    return null;
}

function extrairValor(valor) {
    if (valor === null || valor === undefined) return "";

    if (Array.isArray(valor)) {
        return valor.map(extrairValor).filter(Boolean).join(", ");
    }

    if (typeof valor === "object") {
        const candidatos = [
            "Value", "value", "LookupValue", "Title",
            "DisplayName", "Name", "Email", "Id", "ID"
        ];

        for (const chave of candidatos) {
            if (
                Object.prototype.hasOwnProperty.call(valor, chave) &&
                valor[chave] !== null &&
                valor[chave] !== undefined &&
                valor[chave] !== ""
            ) {
                return extrairValor(valor[chave]);
            }
        }

        return "";
    }

    return valor;
}

function obterValor(registro, nomesPossiveis, padrao = "") {
    const chave = encontrarChave(registro, nomesPossiveis);
    if (!chave) return padrao;

    const valor = extrairValor(registro[chave]);

    return valor === "" || valor === null || valor === undefined
        ? padrao
        : valor;
}

function converterBooleano(valor) {
    if (typeof valor === "boolean") return valor;
    if (typeof valor === "number") return valor === 1;

    return ["true", "sim", "yes", "1", "verdadeiro"].includes(
        normalizarTexto(valor)
    );
}

function converterDataParaObjeto(valor) {
    if (!valor) return null;

    const texto = String(valor).trim();

    if (/^\d{4}-\d{2}-\d{2}/.test(texto)) {
        const [ano, mes, dia] = texto.substring(0, 10).split("-").map(Number);
        return new Date(ano, mes - 1, dia);
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
        const [dia, mes, ano] = texto.split("/").map(Number);
        return new Date(ano, mes - 1, dia);
    }

    if (!Number.isNaN(Number(valor)) && Number(valor) > 20000) {
        const numero = Number(valor);
        const baseExcel = new Date(Date.UTC(1899, 11, 30));
        const dataUTC = new Date(baseExcel.getTime() + numero * 86400000);

        return new Date(
            dataUTC.getUTCFullYear(),
            dataUTC.getUTCMonth(),
            dataUTC.getUTCDate()
        );
    }

    const tentativa = new Date(texto);
    return Number.isNaN(tentativa.getTime()) ? null : tentativa;
}

function formatarData(valor) {
    const data = converterDataParaObjeto(valor);
    if (!data) return "";
    return new Intl.DateTimeFormat("pt-BR").format(data);
}

function dataDeHoje() {
    const agora = new Date();
    return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

function mesmoDia(dataA, dataB) {
    return (
        dataA.getFullYear() === dataB.getFullYear() &&
        dataA.getMonth() === dataB.getMonth() &&
        dataA.getDate() === dataB.getDate()
    );
}

function normalizarRegistro(registro) {
    const id = Number(obterValor(registro, ["ID", "Id", "id"]));

    return {
        id: Number.isFinite(id) ? id : null,
        numero: String(obterValor(registro, [
            "NumeroAtendimento", "Número Atendimento",
            "Numero Atendimento", "Número do Atendimento",
            "Title", "Título"
        ], id || "")),
        instituicao: String(obterValor(registro, [
            "Instituicao", "Instituição", "Instituicao Value", "Instituição Value"
        ])),
        contato: String(obterValor(registro, [
            "Contato", "Contato Value", "Nome", "Atendido"
        ])),
        status: String(obterValor(registro, [
            "Status", "Status Value"
        ])),
        prioridade: String(obterValor(registro, [
            "Prioridade", "Prioridade Value"
        ])),
        necessitaAcompanhamento: converterBooleano(
            obterValor(registro, [
                "NecessitaAcompanhamento", "Necessita Acompanhamento"
            ], false)
        ),
        dataProximoAcompanhamento: obterValor(registro, [
            "DataProximoAcompanhamento",
            "Data Próximo Acompanhamento",
            "Data Proximo Acompanhamento"
        ]),
        observacoesInternas: String(obterValor(registro, [
            "ObservacoesInternas", "Observações Internas", "Observacoes Internas"
        ])),
        descricaoSolucao: String(obterValor(registro, [
            "DescricaoSolucao", "Descrição da Solução", "Descricao Solucao"
        ])),
        original: registro
    };
}

function extrairColecao(dados) {
    if (Array.isArray(dados)) return dados;
    if (!dados || typeof dados !== "object") return [];

    const candidatos = [
        dados.value,
        dados.registros,
        dados.items,
        dados.dados,
        dados.body?.value,
        dados.body?.registros
    ];

    for (const candidato of candidatos) {
        if (Array.isArray(candidato)) return candidato;
    }

    return [];
}

function obterSituacao(item) {
    const data = converterDataParaObjeto(item.dataProximoAcompanhamento);

    if (!data) return { chave: "sem-data", texto: "Sem data" };

    const hoje = dataDeHoje();

    if (mesmoDia(data, hoje)) return { chave: "hoje", texto: "Para hoje" };
    if (data < hoje) return { chave: "atrasado", texto: "Atrasado" };

    return { chave: "proximo", texto: "Próximo" };
}

async function buscarAcompanhamentos() {
    if (
        typeof POWER_AUTOMATE_ATENDIMENTOS_URL === "undefined" ||
        !POWER_AUTOMATE_ATENDIMENTOS_URL
    ) {
        throw new Error(
            "POWER_AUTOMATE_ATENDIMENTOS_URL não está configurada no config.js."
        );
    }

    const resposta = await fetch(POWER_AUTOMATE_ATENDIMENTOS_URL, {
        method: "GET"
    });

    const texto = await resposta.text();

    if (!resposta.ok) {
        throw new Error(
            `Falha ao consultar os atendimentos. HTTP ${resposta.status}. ${texto}`
        );
    }

    let dados;

    try {
        dados = texto ? JSON.parse(texto) : [];
    } catch {
        throw new Error("O fluxo de consulta não retornou um JSON válido.");
    }

    return extrairColecao(dados);
}

function definirStatus(texto, tipo = "") {
    const elemento = document.getElementById("statusAcompanhamentos");
    if (!elemento) return;

    elemento.textContent = texto;
    elemento.className = `status-inline ${tipo}`.trim();
}

function preencherFiltroPrioridade() {
    const select = document.getElementById("filtroPrioridadeAcompanhamento");
    if (!select) return;

    const valores = Array.from(
        new Set(
            acompanhamentosNormalizados
                .map(item => item.prioridade)
                .filter(Boolean)
        )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));

    select.innerHTML = '<option value="">Todas</option>';

    valores.forEach(valor => {
        const option = document.createElement("option");
        option.value = valor;
        option.textContent = valor;
        select.appendChild(option);
    });
}

function atualizarIndicadores() {
    document.getElementById("statPendentes").textContent =
        acompanhamentosNormalizados.length;

    document.getElementById("statAtrasados").textContent =
        acompanhamentosNormalizados.filter(
            item => obterSituacao(item).chave === "atrasado"
        ).length;

    document.getElementById("statHoje").textContent =
        acompanhamentosNormalizados.filter(
            item => obterSituacao(item).chave === "hoje"
        ).length;

    document.getElementById("statSemData").textContent =
        acompanhamentosNormalizados.filter(
            item => obterSituacao(item).chave === "sem-data"
        ).length;
}

function obterIdDaUrl() {
    const parametros = new URLSearchParams(window.location.search);
    const id = parametros.get("id");

    if (!id) {
        return null;
    }

    const numero = Number(id);

    return Number.isFinite(numero) ? numero : null;
}

function filtrarAcompanhamentos() {
    const busca = normalizarTexto(
        document.getElementById("filtroBuscaAcompanhamento")?.value
    );

    const situacao =
        document.getElementById("filtroSituacaoAcompanhamento")?.value || "";

    const prioridade = normalizarTexto(
        document.getElementById("filtroPrioridadeAcompanhamento")?.value
    );

    return acompanhamentosNormalizados.filter(item => {
        const textoBusca = normalizarTexto([
            item.id,
            item.numero,
            item.instituicao,
            item.contato,
            item.status,
            item.prioridade,
            item.observacoesInternas,
            item.descricaoSolucao
        ].join(" "));

        const passaBusca = !busca || textoBusca.includes(busca);
        const passaSituacao = !situacao || obterSituacao(item).chave === situacao;
        const passaPrioridade =
            !prioridade || normalizarTexto(item.prioridade) === prioridade;

        return passaBusca && passaSituacao && passaPrioridade;
    });
}

function criarBadgeSituacao(item) {
    const situacao = obterSituacao(item);
    const span = document.createElement("span");

    span.className = `badge-acompanhamento badge-${situacao.chave}`;
    span.textContent = situacao.texto;

    return span;
}

function adicionarCelula(linha, texto) {
    const td = document.createElement("td");
    td.textContent = texto ?? "";
    linha.appendChild(td);
    return td;
}

function renderizarTabela() {
    const tbody = document.getElementById("tabelaAcompanhamentos");
    const contador = document.getElementById("contadorAcompanhamentos");
    if (!tbody) return;

    const itens = filtrarAcompanhamentos()
        .slice()
        .sort((a, b) => {
            const ordem = { atrasado: 1, hoje: 2, proximo: 3, "sem-data": 4 };

            const diferenca =
                ordem[obterSituacao(a).chave] -
                ordem[obterSituacao(b).chave];

            if (diferenca !== 0) return diferenca;

            const dataA = converterDataParaObjeto(a.dataProximoAcompanhamento);
            const dataB = converterDataParaObjeto(b.dataProximoAcompanhamento);

            if (dataA && dataB) return dataA - dataB;

            return (b.id || 0) - (a.id || 0);
        });

    tbody.innerHTML = "";

    if (contador) {
        contador.textContent =
            `${itens.length} de ${acompanhamentosNormalizados.length} acompanhamento(s) exibido(s).`;
    }

    if (itens.length === 0) {
        const tr = document.createElement("tr");
        const td = document.createElement("td");

        td.colSpan = 9;
        td.textContent = "Nenhum acompanhamento encontrado.";

        tr.appendChild(td);
        tbody.appendChild(tr);
        return;
    }

    itens.forEach(item => {
        const tr = document.createElement("tr");
        const situacao = obterSituacao(item);

        if (situacao.chave === "atrasado") {
            tr.classList.add("linha-atrasada");
        }

        adicionarCelula(tr, item.numero);
        adicionarCelula(tr, item.instituicao);
        adicionarCelula(tr, item.contato);
        adicionarCelula(tr, item.status || "-");
        adicionarCelula(tr, item.prioridade || "-");
        adicionarCelula(
            tr,
            formatarData(item.dataProximoAcompanhamento) || "Não definida"
        );

        const tdSituacao = document.createElement("td");
        tdSituacao.appendChild(criarBadgeSituacao(item));
        tr.appendChild(tdSituacao);

        adicionarCelula(tr, item.observacoesInternas || "-");

        const tdAcoes = document.createElement("td");
        tdAcoes.className = "celula-acoes";

        const link = document.createElement("a");
        link.className = "button secondary button-pequeno";
        link.textContent = "Abrir";
        link.href = `atendimentos.html?id=${encodeURIComponent(item.id)}`;

        tdAcoes.appendChild(link);
        tr.appendChild(tdAcoes);

        tbody.appendChild(tr);
    });
}

async function carregarPainel() {
    try {
        definirStatus("Buscando acompanhamentos...", "carregando");

        const dados = await buscarAcompanhamentos();

        acompanhamentosOriginais = dados;

        acompanhamentosNormalizados = dados
            .map(normalizarRegistro)
            .filter(item =>
                item.id !== null &&
                item.necessitaAcompanhamento === true
            );

        preencherFiltroPrioridade();
        atualizarIndicadores();
        renderizarTabela();

        definirStatus(
            `Painel atualizado com ${acompanhamentosNormalizados.length} acompanhamento(s) pendente(s).`,
            "sucesso"
        );

    } catch (erro) {
        console.error(erro);

        acompanhamentosOriginais = [];
        acompanhamentosNormalizados = [];

        atualizarIndicadores();
        renderizarTabela();

        definirStatus(
            erro.message || "Não foi possível carregar os acompanhamentos.",
            "erro"
        );
    }
}

function limparFiltros() {
    document.getElementById("filtroBuscaAcompanhamento").value = "";
    document.getElementById("filtroSituacaoAcompanhamento").value = "";
    document.getElementById("filtroPrioridadeAcompanhamento").value = "";
    renderizarTabela();
}

document.addEventListener("DOMContentLoaded", function () {
    document.getElementById("btnAtualizarAcompanhamentos")
        ?.addEventListener("click", carregarPainel);

    document.getElementById("btnLimparFiltrosAcompanhamento")
        ?.addEventListener("click", limparFiltros);

    document.getElementById("filtroBuscaAcompanhamento")
        ?.addEventListener("input", renderizarTabela);

    document.getElementById("filtroSituacaoAcompanhamento")
        ?.addEventListener("change", renderizarTabela);

    document.getElementById("filtroPrioridadeAcompanhamento")
        ?.addEventListener("change", renderizarTabela);

    carregarPainel();
});

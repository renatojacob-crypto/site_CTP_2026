let registrosIndicadoresOriginais = [];

const nomesMesesIndicadores = {
    "01": "Janeiro",
    "02": "Fevereiro",
    "03": "Março",
    "04": "Abril",
    "05": "Maio",
    "06": "Junho",
    "07": "Julho",
    "08": "Agosto",
    "09": "Setembro",
    "10": "Outubro",
    "11": "Novembro",
    "12": "Dezembro"
};

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/_x0020_/g, " ")
        .replace(/_/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
}

function obterValor(registro, nomesPossiveis) {
    for (const nome of nomesPossiveis) {
        if (registro[nome] !== undefined && registro[nome] !== null && registro[nome] !== "") {
            return registro[nome];
        }
    }

    const chaves = Object.keys(registro);

    for (const chave of chaves) {
        const chaveNormalizada = normalizarTexto(chave);

        for (const nome of nomesPossiveis) {
            if (chaveNormalizada === normalizarTexto(nome)) {
                return registro[chave];
            }
        }
    }

    return "";
}

function obterTecnologia(registro) {
    const nomesPossiveis = [
        "Tecnologia Envolvida",
        "Tecnologia envolvida",
        "Tencologia Envolvida",
        "Tencologia envolvida",
        "Tecnologia",
        "Tencologia",
        "Tecnologias",
        "TecnologiaEnvolvida",
        "TencologiaEnvolvida",
        "Tecnologia_x0020_Envolvida",
        "Tencologia_x0020_Envolvida"
    ];

    const valor = obterValor(registro, nomesPossiveis);

    if (valor) {
        return valor;
    }

    const chaves = Object.keys(registro);

    for (const chave of chaves) {
        const chaveNormalizada = normalizarTexto(chave);

        if (chaveNormalizada.includes("tecnologia") || chaveNormalizada.includes("tencologia")) {
            return registro[chave];
        }
    }

    return "";
}

function converterDataExcel(valor) {
    if (!valor) {
        return "";
    }

    if (typeof valor === "string" && valor.includes("-")) {
        const partes = valor.split("T")[0].split("-");
        if (partes.length === 3) {
            return `${partes[2]}/${partes[1]}/${partes[0]}`;
        }
    }

    if (!isNaN(valor)) {
        const numero = Number(valor);
        const dataBase = new Date(Date.UTC(1899, 11, 30));
        const dataConvertida = new Date(dataBase.getTime() + numero * 86400000);

        const dia = String(dataConvertida.getUTCDate()).padStart(2, "0");
        const mes = String(dataConvertida.getUTCMonth() + 1).padStart(2, "0");
        const ano = dataConvertida.getUTCFullYear();

        return `${dia}/${mes}/${ano}`;
    }

    return valor;
}

function obterMesAno(registro) {
    let mes = obterValor(registro, ["Mês", "Mes"]);
    let ano = obterValor(registro, ["Ano"]);

    mes = String(mes || "").padStart(2, "0");
    ano = String(ano || "");

    if (mes && ano && mes !== "00") {
        return { mes, ano };
    }

    const data = obterValor(registro, ["Data"]);

    if (!data) {
        return { mes: "", ano: "" };
    }

    if (!isNaN(data)) {
        const dataFormatada = converterDataExcel(data);
        const partes = dataFormatada.split("/");

        return {
            mes: partes[1] || "",
            ano: partes[2] || ""
        };
    }

    if (String(data).includes("-")) {
        const partes = String(data).split("T")[0].split("-");

        return {
            mes: partes[1] || "",
            ano: partes[0] || ""
        };
    }

    if (String(data).includes("/")) {
        const partes = String(data).split("/");

        return {
            mes: partes[1] || "",
            ano: partes[2] || ""
        };
    }

    return { mes: "", ano: "" };
}

function formatarDuracao(minutos) {
    const total = Number(minutos || 0);
    const horas = Math.floor(total / 60);
    const mins = total % 60;

    if (horas === 0) {
        return `${mins}min`;
    }

    return `${horas}h ${mins}min`;
}

function contarPorCampo(registros, nomesCampo) {
    const contagem = {};

    registros.forEach(registro => {
        const valor = obterValor(registro, nomesCampo) || "Não informado";
        contagem[valor] = (contagem[valor] || 0) + 1;
    });

    return contagem;
}

function contarTecnologias(registros) {
    const contagem = {};

    registros.forEach(registro => {
        const tecnologias = obterTecnologia(registro);

        if (!tecnologias) {
            contagem["Não informado"] = (contagem["Não informado"] || 0) + 1;
            return;
        }

        String(tecnologias)
            .split(",")
            .map(item => item.trim())
            .filter(item => item !== "")
            .forEach(tecnologia => {
                contagem[tecnologia] = (contagem[tecnologia] || 0) + 1;
            });
    });

    return contagem;
}

function obterMaiorCategoria(contagem) {
    const entradas = Object.entries(contagem);

    if (entradas.length === 0) {
        return "-";
    }

    entradas.sort((a, b) => b[1] - a[1]);
    return entradas[0][0];
}

function obterTopCategorias(contagem, limite = 5) {
    return Object.entries(contagem)
        .sort((a, b) => b[1] - a[1])
        .slice(0, limite);
}

function preencherTabelaTop(idTabela, dados) {
    const tabela = document.getElementById(idTabela);

    if (!tabela) {
        return;
    }

    tabela.innerHTML = "";

    if (dados.length === 0) {
        tabela.innerHTML = `
            <tr>
                <td colspan="2">Nenhum dado encontrado.</td>
            </tr>
        `;
        return;
    }

    dados.forEach(([nome, quantidade]) => {
        const linha = document.createElement("tr");

        linha.innerHTML = `
            <td>${nome}</td>
            <td>${quantidade}</td>
        `;

        tabela.appendChild(linha);
    });
}

async function buscarRegistrosDaPlanilha() {
    if (!POWER_AUTOMATE_DASHBOARD_URL) {
        throw new Error("A URL de consulta do dashboard não está configurada no config.js.");
    }

    const resposta = await fetch(POWER_AUTOMATE_DASHBOARD_URL, {
        method: "GET"
    });

    const texto = await resposta.text();

    if (!resposta.ok) {
        throw new Error(`Erro ao buscar dados. Status: ${resposta.status}. Resposta: ${texto}`);
    }

    return JSON.parse(texto);
}

function preencherFiltroAnoIndicadores(registros) {
    const selectAno = document.getElementById("filtroAnoIndicadores");

    if (!selectAno) {
        return;
    }

    const anoAtualSelecionado = selectAno.value;

    const anos = new Set();

    registros.forEach(registro => {
        const periodo = obterMesAno(registro);

        if (periodo.ano) {
            anos.add(periodo.ano);
        }
    });

    selectAno.innerHTML = `<option value="">Todos os anos</option>`;

    Array.from(anos)
        .sort()
        .forEach(ano => {
            const option = document.createElement("option");
            option.value = ano;
            option.textContent = ano;
            selectAno.appendChild(option);
        });

    if (anoAtualSelecionado) {
        selectAno.value = anoAtualSelecionado;
    }
}

function aplicarFiltrosIndicadores() {
    const filtroMes = document.getElementById("filtroMesIndicadores")?.value || "";
    const filtroAno = document.getElementById("filtroAnoIndicadores")?.value || "";

    return registrosIndicadoresOriginais.filter(registro => {
        const periodo = obterMesAno(registro);

        const passaMes = !filtroMes || periodo.mes === filtroMes;
        const passaAno = !filtroAno || periodo.ano === filtroAno;

        return passaMes && passaAno;
    });
}

function contarPendentes(registros) {
    let encontrouCampoStatus = false;

    const pendentes = registros.filter(registro => {
        const status = obterValor(registro, [
            "Status",
            "Status do Atendimento",
            "Status Atendimento",
            "Situação",
            "Situacao"
        ]);

        if (status) {
            encontrouCampoStatus = true;
        }

        const statusNormalizado = normalizarTexto(status);

        return (
            statusNormalizado.includes("pendente") ||
            statusNormalizado.includes("em acompanhamento") ||
            statusNormalizado.includes("encaminhado") ||
            statusNormalizado.includes("aberto")
        );
    });

    if (!encontrouCampoStatus) {
        return null;
    }

    return pendentes.length;
}

function atualizarIndicadores() {
    const status = document.getElementById("statusIndicadores");

    const registros = aplicarFiltrosIndicadores();

    const totalAtendimentos = registros.length;

    const totalMinutos = registros.reduce((soma, item) => {
        return soma + Number(obterValor(item, ["Duração em Minutos", "Duracao em Minutos"]) || 0);
    }, 0);

    const mediaMinutos = totalAtendimentos > 0
        ? Math.round(totalMinutos / totalAtendimentos)
        : 0;

    const contagemCanal = contarPorCampo(registros, ["Canal"]);
    const contagemTecnologia = contarTecnologias(registros);
    const contagemInstituicao = contarPorCampo(registros, ["Instituição", "Instituicao"]);

    const contagemProblema = contarPorCampo(registros, [
        "Categoria do Problema",
        "Categoria Problema",
        "Problema",
        "Tipo de Atendimento"
    ]);

    const pendentes = contarPendentes(registros);

    const canalMaisUsado = obterMaiorCategoria(contagemCanal);
    const tecnologiaMaisAtendida = obterMaiorCategoria(contagemTecnologia);
    const instituicaoMaisAtendida = obterMaiorCategoria(contagemInstituicao);
    const problemaMaisRecorrente = obterMaiorCategoria(contagemProblema);

    document.getElementById("indTotalAtendimentos").textContent = totalAtendimentos;
    document.getElementById("indTotalHoras").textContent = formatarDuracao(totalMinutos);
    document.getElementById("indMediaDuracao").textContent = formatarDuracao(mediaMinutos);
    document.getElementById("indCanalMaisUsado").textContent = canalMaisUsado;
    document.getElementById("indTecnologiaMaisAtendida").textContent = tecnologiaMaisAtendida;
    document.getElementById("indInstituicaoMaisAtendida").textContent = instituicaoMaisAtendida;
    document.getElementById("indProblemaMaisRecorrente").textContent = problemaMaisRecorrente;
    document.getElementById("indAtendimentosPendentes").textContent = pendentes === null ? "Não configurado" : pendentes;

    preencherTabelaTop(
        "tabelaTopTecnologias",
        obterTopCategorias(contagemTecnologia, 5)
    );

    preencherTabelaTop(
        "tabelaTopInstituicoes",
        obterTopCategorias(contagemInstituicao, 5)
    );

    gerarResumoExecutivo(
        totalAtendimentos,
        totalMinutos,
        mediaMinutos,
        canalMaisUsado,
        tecnologiaMaisAtendida,
        instituicaoMaisAtendida,
        problemaMaisRecorrente,
        pendentes
    );

    const filtroMes = document.getElementById("filtroMesIndicadores")?.value || "";
    const filtroAno = document.getElementById("filtroAnoIndicadores")?.value || "";

    let periodoTexto = "todos os períodos";

    if (filtroMes && filtroAno) {
        periodoTexto = `${nomesMesesIndicadores[filtroMes]} de ${filtroAno}`;
    } else if (filtroMes) {
        periodoTexto = `mês de ${nomesMesesIndicadores[filtroMes]}`;
    } else if (filtroAno) {
        periodoTexto = `ano de ${filtroAno}`;
    }

    status.textContent = `Indicadores atualizados para ${periodoTexto}.`;
}

function gerarResumoExecutivo(
    totalAtendimentos,
    totalMinutos,
    mediaMinutos,
    canalMaisUsado,
    tecnologiaMaisAtendida,
    instituicaoMaisAtendida,
    problemaMaisRecorrente,
    pendentes
) {
    const resumo = document.getElementById("resumoExecutivo");

    let textoPendentes = "";

    if (pendentes === null) {
        textoPendentes = "O indicador de pendências ainda não está configurado, pois não foi localizado um campo de status na base.";
    } else {
        textoPendentes = `Foram identificados ${pendentes} atendimento(s) pendente(s), em acompanhamento, encaminhado(s) ou aberto(s).`;
    }

    resumo.textContent =
        `No período selecionado, a Central Técnico-Pedagógica registrou ${totalAtendimentos} atendimento(s), ` +
        `totalizando ${formatarDuracao(totalMinutos)}. A média de duração por atendimento foi de ${formatarDuracao(mediaMinutos)}. ` +
        `O canal mais utilizado foi ${canalMaisUsado}, a tecnologia mais atendida foi ${tecnologiaMaisAtendida}, ` +
        `e a instituição com maior volume de registros foi ${instituicaoMaisAtendida}. ` +
        `O problema ou tipo de atendimento mais recorrente foi ${problemaMaisRecorrente}. ${textoPendentes}`;
}

async function iniciarIndicadores() {
    const status = document.getElementById("statusIndicadores");

    try {
        status.textContent = "Buscando dados da planilha...";

        registrosIndicadoresOriginais = await buscarRegistrosDaPlanilha();

        preencherFiltroAnoIndicadores(registrosIndicadoresOriginais);

        atualizarIndicadores();

    } catch (erro) {
        console.error(erro);
        status.textContent = "Erro ao carregar os indicadores. Verifique o console do navegador e o fluxo de consulta.";
    }
}

document.addEventListener("DOMContentLoaded", function() {
    iniciarIndicadores();

    const botaoAtualizar = document.getElementById("atualizarIndicadores");
    const filtroMes = document.getElementById("filtroMesIndicadores");
    const filtroAno = document.getElementById("filtroAnoIndicadores");

    if (botaoAtualizar) {
        botaoAtualizar.addEventListener("click", atualizarIndicadores);
    }

    if (filtroMes) {
        filtroMes.addEventListener("change", atualizarIndicadores);
    }

    if (filtroAno) {
        filtroAno.addEventListener("change", atualizarIndicadores);
    }
});
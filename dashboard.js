let graficosCriados = [];
let registrosOriginais = [];

function limparGraficos() {
    graficosCriados.forEach(grafico => grafico.destroy());
    graficosCriados = [];
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
            const nomeNormalizado = normalizarTexto(nome);

            if (chaveNormalizada === nomeNormalizado) {
                return registro[chave];
            }
        }
    }

    return "";
}

function normalizarTexto(texto) {
    return String(texto || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
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
        return {
            mes,
            ano
        };
    }

    const data = obterValor(registro, ["Data"]);

    if (!data) {
        return {
            mes: "",
            ano: ""
        };
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

    return {
        mes: "",
        ano: ""
    };
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
        const tecnologias = obterValor(registro, [
            "Tecnologia Envolvida",
            "Tecnologia envolvida",
            "Tecnologia",
            "Tecnologias",
            "TecnologiaEnvolvida"
        ]);

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

function contarPorMes(registros) {
    const contagem = {};

    registros.forEach(registro => {
        const periodo = obterMesAno(registro);

        let chave = "Não informado";

        if (periodo.mes && periodo.ano) {
            chave = `${periodo.mes}/${periodo.ano}`;
        }

        contagem[chave] = (contagem[chave] || 0) + 1;
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

function criarGrafico(idCanvas, tipo, titulo, dados) {
    const canvas = document.getElementById(idCanvas);

    if (!canvas) {
        return;
    }

    const labels = Object.keys(dados);
    const valores = Object.values(dados);

    const grafico = new Chart(canvas, {
        type: tipo,
        data: {
            labels: labels,
            datasets: [{
                label: titulo,
                data: valores
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    display: tipo === "pie" || tipo === "doughnut"
                }
            },
            scales: tipo === "pie" || tipo === "doughnut" ? {} : {
                y: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });

    graficosCriados.push(grafico);
}

function preencherTabela(registros) {
    const tabela = document.getElementById("tabelaRegistros");

    if (!tabela) {
        return;
    }

    tabela.innerHTML = "";

    registros
        .slice()
        .reverse()
        .slice(0, 50)
        .forEach(registro => {
            const data = converterDataExcel(obterValor(registro, ["Data"]));
            const canal = obterValor(registro, ["Canal"]);
            const instituicao = obterValor(registro, ["Instituição", "Instituicao"]);
            const nome = obterValor(registro, ["Nome"]);
            const cargo = obterValor(registro, ["Cargo"]);
            const tipo = obterValor(registro, ["Tipo de Atendimento"]);
            const tecnologia = obterValor(registro, [
                "Tecnologia Envolvida",
                "Tecnologia envolvida",
                "Tecnologia",
                "Tecnologias",
                "TecnologiaEnvolvida"
            ]);
            const duracao = obterValor(registro, ["Duração Formatada", "Duracao Formatada"]) ||
                formatarDuracao(obterValor(registro, ["Duração em Minutos", "Duracao em Minutos"]));

            const linha = document.createElement("tr");

            linha.innerHTML = `
                <td>${data}</td>
                <td>${canal}</td>
                <td>${instituicao}</td>
                <td>${nome}</td>
                <td>${cargo}</td>
                <td>${tipo}</td>
                <td>${tecnologia || "Não informado"}</td>
                <td>${duracao}</td>
            `;

            tabela.appendChild(linha);
        });
}

async function buscarRegistrosDaPlanilha() {
    if (!POWER_AUTOMATE_DASHBOARD_URL) {
        throw new Error("A URL do fluxo de consulta ainda não foi configurada no config.js.");
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

function preencherFiltroAno(registros) {
    const selectAno = document.getElementById("filtroAno");

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

function aplicarFiltros(registros) {
    const filtroMes = document.getElementById("filtroMes")?.value || "";
    const filtroAno = document.getElementById("filtroAno")?.value || "";

    return registros.filter(registro => {
        const periodo = obterMesAno(registro);

        const passaMes = !filtroMes || periodo.mes === filtroMes;
        const passaAno = !filtroAno || periodo.ano === filtroAno;

        return passaMes && passaAno;
    });
}

function atualizarComponentes(registros) {
    limparGraficos();

    const totalAtendimentos = registros.length;

    const totalMinutos = registros.reduce((soma, item) => {
        return soma + Number(obterValor(item, ["Duração em Minutos", "Duracao em Minutos"]) || 0);
    }, 0);

    const contagemCanal = contarPorCampo(registros, ["Canal"]);
    const canalMaisUsado = obterMaiorCategoria(contagemCanal);

    document.getElementById("totalAtendimentos").textContent = totalAtendimentos;
    document.getElementById("totalHoras").textContent = formatarDuracao(totalMinutos);
    document.getElementById("principalCanal").textContent = canalMaisUsado;

    criarGrafico("graficoCanal", "bar", "Atendimentos por canal", contagemCanal);

    criarGrafico(
        "graficoCargo",
        "bar",
        "Atendimentos por cargo",
        contarPorCampo(registros, ["Cargo"])
    );

    criarGrafico(
        "graficoSegmento",
        "doughnut",
        "Atendimentos por segmento",
        contarPorCampo(registros, ["Segmento"])
    );

    criarGrafico(
        "graficoTipo",
        "bar",
        "Atendimentos por tipo",
        contarPorCampo(registros, ["Tipo de Atendimento"])
    );

    criarGrafico(
        "graficoTecnologia",
        "bar",
        "Atendimentos por tecnologia",
        contarTecnologias(registros)
    );

    criarGrafico(
        "graficoMes",
        "line",
        "Atendimentos por mês",
        contarPorMes(registros)
    );

    preencherTabela(registros);
}

async function carregarDashboard() {
    const status = document.getElementById("statusDashboard");

    try {
        status.textContent = "Buscando dados da planilha...";

        registrosOriginais = await buscarRegistrosDaPlanilha();

        console.log("Registros recebidos da planilha:", registrosOriginais);

        preencherFiltroAno(registrosOriginais);

        const registrosFiltrados = aplicarFiltros(registrosOriginais);

        atualizarComponentes(registrosFiltrados);

        status.textContent = `Dashboard atualizado com ${registrosFiltrados.length} atendimento(s).`;

    } catch (erro) {
        console.error(erro);
        status.textContent = "Erro ao carregar o dashboard. Veja o Console do navegador e o histórico do Power Automate.";
    }
}

function atualizarPorFiltro() {
    const status = document.getElementById("statusDashboard");

    const registrosFiltrados = aplicarFiltros(registrosOriginais);

    atualizarComponentes(registrosFiltrados);

    status.textContent = `Dashboard filtrado com ${registrosFiltrados.length} atendimento(s).`;
}

document.addEventListener("DOMContentLoaded", function() {
    carregarDashboard();

    const botaoAtualizar = document.getElementById("atualizarDashboard");
    const filtroMes = document.getElementById("filtroMes");
    const filtroAno = document.getElementById("filtroAno");

    if (botaoAtualizar) {
        botaoAtualizar.addEventListener("click", carregarDashboard);
    }

    if (filtroMes) {
        filtroMes.addEventListener("change", atualizarPorFiltro);
    }

    if (filtroAno) {
        filtroAno.addEventListener("change", atualizarPorFiltro);
    }
});
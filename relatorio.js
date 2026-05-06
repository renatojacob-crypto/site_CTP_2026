let registrosRelatorioOriginais = [];
let graficosRelatorio = [];

const nomesMeses = {
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

function contarValoresMultiplos(registros, nomesCampo) {
    const contagem = {};

    registros.forEach(registro => {
        const valores = obterValor(registro, nomesCampo);

        if (!valores) {
            contagem["Não informado"] = (contagem["Não informado"] || 0) + 1;
            return;
        }

        String(valores)
            .split(",")
            .map(item => item.trim())
            .filter(item => item !== "")
            .forEach(valor => {
                contagem[valor] = (contagem[valor] || 0) + 1;
            });
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

function limitarCategorias(dados, limite = 8) {
    const entradas = Object.entries(dados);

    entradas.sort((a, b) => b[1] - a[1]);

    const principais = entradas.slice(0, limite);
    const restantes = entradas.slice(limite);

    if (restantes.length > 0) {
        const somaOutros = restantes.reduce((soma, item) => soma + item[1], 0);
        principais.push(["Outros", somaOutros]);
    }

    return Object.fromEntries(principais);
}

function limparGraficosRelatorio() {
    graficosRelatorio.forEach(grafico => grafico.destroy());
    graficosRelatorio = [];
}

function criarGraficoRelatorio(idCanvas, tipo, titulo, dados) {
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
            animation: false,
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

    graficosRelatorio.push(grafico);
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

function preencherFiltroAno(registros) {
    const selectAno = document.getElementById("filtroAnoRelatorio");

    if (!selectAno) {
        return;
    }

    const anos = new Set();

    registros.forEach(registro => {
        const periodo = obterMesAno(registro);

        if (periodo.ano) {
            anos.add(periodo.ano);
        }
    });

    selectAno.innerHTML = `<option value="">Selecione o ano</option>`;

    Array.from(anos)
        .sort()
        .forEach(ano => {
            const option = document.createElement("option");
            option.value = ano;
            option.textContent = ano;
            selectAno.appendChild(option);
        });
}

function filtrarRegistrosPorPeriodo() {
    const mesSelecionado = document.getElementById("filtroMesRelatorio").value;
    const anoSelecionado = document.getElementById("filtroAnoRelatorio").value;

    if (!mesSelecionado || !anoSelecionado) {
        return [];
    }

    return registrosRelatorioOriginais.filter(registro => {
        const periodo = obterMesAno(registro);

        return periodo.mes === mesSelecionado && periodo.ano === anoSelecionado;
    });
}

function preencherTabelaRelatorio(registros) {
    const tabela = document.getElementById("relTabelaAtendimentos");

    if (!tabela) {
        return;
    }

    tabela.innerHTML = "";

    registros
        .slice()
        .reverse()
        .slice(0, 20)
        .forEach(registro => {
            const data = converterDataExcel(obterValor(registro, ["Data"]));
            const canal = obterValor(registro, ["Canal"]);
            const instituicao = obterValor(registro, ["Instituição", "Instituicao"]);
            const nome = obterValor(registro, ["Nome"]);
            const cargo = obterValor(registro, ["Cargo"]);
            const tipo = obterValor(registro, ["Tipo de Atendimento"]);
            const tecnologia = obterTecnologia(registro);
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

function gerarRelatorio() {
    const status = document.getElementById("statusRelatorio");
    const mesSelecionado = document.getElementById("filtroMesRelatorio").value;
    const anoSelecionado = document.getElementById("filtroAnoRelatorio").value;

    if (!mesSelecionado || !anoSelecionado) {
        status.textContent = "Selecione o mês e o ano para gerar o relatório.";
        return;
    }

    const registros = filtrarRegistrosPorPeriodo();

    limparGraficosRelatorio();

    const totalAtendimentos = registros.length;

    const totalMinutos = registros.reduce((soma, item) => {
        return soma + Number(obterValor(item, ["Duração em Minutos", "Duracao em Minutos"]) || 0);
    }, 0);

    const contagemCanal = contarPorCampo(registros, ["Canal"]);
    const canalPrincipal = obterMaiorCategoria(contagemCanal);

    document.getElementById("periodoRelatorio").textContent =
        `Período: ${nomesMeses[mesSelecionado]} de ${anoSelecionado}`;

    document.getElementById("relTotalAtendimentos").textContent = totalAtendimentos;
    document.getElementById("relTotalHoras").textContent = formatarDuracao(totalMinutos);
    document.getElementById("relCanalPrincipal").textContent = canalPrincipal;

    criarGraficoRelatorio(
        "relGraficoCanal",
        "bar",
        "Atendimentos por canal",
        limitarCategorias(contagemCanal)
    );

    criarGraficoRelatorio(
        "relGraficoCargo",
        "bar",
        "Atendimentos por cargo",
        limitarCategorias(contarPorCampo(registros, ["Cargo"]))
    );

    criarGraficoRelatorio(
        "relGraficoSegmento",
        "doughnut",
        "Atendimentos por segmento",
        limitarCategorias(contarValoresMultiplos(registros, ["Segmento"]))
    );

    criarGraficoRelatorio(
        "relGraficoTecnologia",
        "bar",
        "Atendimentos por tecnologia",
        limitarCategorias(contarTecnologias(registros))
    );

    criarGraficoRelatorio(
        "relGraficoTipo",
        "bar",
        "Atendimentos por tipo",
        limitarCategorias(contarPorCampo(registros, ["Tipo de Atendimento"]))
    );

    criarGraficoRelatorio(
        "relGraficoInstituicao",
        "bar",
        "Atendimentos por instituição",
        limitarCategorias(contarPorCampo(registros, ["Instituição", "Instituicao"]))
    );

    preencherTabelaRelatorio(registros);

    status.textContent = `Relatório gerado com ${totalAtendimentos} atendimento(s).`;
}

async function capturarRelatorioComoImagemBase64() {
    const area = document.getElementById("relatorioConteudo");

    const canvas = await html2canvas(area, {
        scale: 2,
        backgroundColor: "#ffffff"
    });

    const imagemCompleta = canvas.toDataURL("image/png");

    return imagemCompleta.replace("data:image/png;base64,", "");
}

function montarResumoHtmlEmail() {
    const periodo = document.getElementById("periodoRelatorio").textContent;
    const total = document.getElementById("relTotalAtendimentos").textContent;
    const horas = document.getElementById("relTotalHoras").textContent;
    const canal = document.getElementById("relCanalPrincipal").textContent;

    return `
        <h2>Relatório Mensal de Atendimentos - CTP</h2>
        <p><strong>${periodo}</strong></p>
        <p>
            Segue em anexo a imagem do relatório mensal de atendimentos da Central Técnico-Pedagógica.
        </p>
        <ul>
            <li><strong>Total de atendimentos:</strong> ${total}</li>
            <li><strong>Total de horas:</strong> ${horas}</li>
            <li><strong>Canal mais utilizado:</strong> ${canal}</li>
        </ul>
        <p>Este relatório foi gerado automaticamente a partir da base de dados da planilha oficial.</p>
    `;
}

async function enviarRelatorioPorEmail() {
    const statusEmail = document.getElementById("statusEmail");
    const destinatarios = document.getElementById("emailsRelatorio").value.trim();
    const mesSelecionado = document.getElementById("filtroMesRelatorio").value;
    const anoSelecionado = document.getElementById("filtroAnoRelatorio").value;

    if (!POWER_AUTOMATE_EMAIL_URL) {
        statusEmail.textContent = "A URL do fluxo de envio de e-mail ainda não foi configurada no config.js.";
        return;
    }

    if (!destinatarios) {
        statusEmail.textContent = "Digite pelo menos um e-mail destinatário.";
        return;
    }

    if (!mesSelecionado || !anoSelecionado) {
        statusEmail.textContent = "Gere o relatório antes de enviar por e-mail.";
        return;
    }

    try {
        statusEmail.textContent = "Gerando imagem do relatório...";

        const imagemBase64 = await capturarRelatorioComoImagemBase64();

        const assunto = `Relatório Mensal de Atendimentos CTP - ${nomesMeses[mesSelecionado]} de ${anoSelecionado}`;

        const corpoHtml = montarResumoHtmlEmail();

        const resposta = await fetch(POWER_AUTOMATE_EMAIL_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                destinatarios: destinatarios,
                assunto: assunto,
                corpoHtml: corpoHtml,
                nomeArquivo: `relatorio-ctp-${mesSelecionado}-${anoSelecionado}.png`,
                imagemBase64: imagemBase64
            })
        });

        const texto = await resposta.text();

        if (!resposta.ok) {
            throw new Error(`Erro ao enviar e-mail. Status: ${resposta.status}. Resposta: ${texto}`);
        }

        statusEmail.textContent = "Relatório enviado por e-mail com sucesso.";

    } catch (erro) {
        console.error(erro);
        statusEmail.textContent = "Erro ao enviar o relatório. Verifique o console e o histórico do Power Automate.";
    }
}

async function iniciarPaginaRelatorio() {
    const status = document.getElementById("statusRelatorio");

    try {
        status.textContent = "Buscando dados da planilha...";

        registrosRelatorioOriginais = await buscarRegistrosDaPlanilha();

        preencherFiltroAno(registrosRelatorioOriginais);

        status.textContent = "Dados carregados. Selecione o mês e o ano para gerar o relatório.";

    } catch (erro) {
        console.error(erro);
        status.textContent = "Erro ao carregar dados da planilha.";
    }
}

document.addEventListener("DOMContentLoaded", function() {
    iniciarPaginaRelatorio();

    document.getElementById("gerarRelatorio").addEventListener("click", gerarRelatorio);

    document.getElementById("imprimirRelatorio").addEventListener("click", function() {
        window.print();
    });

    document.getElementById("enviarRelatorioEmail").addEventListener("click", enviarRelatorioPorEmail);
});
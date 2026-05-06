let graficosCriados = [];

function limparGraficos() {
    graficosCriados.forEach(grafico => grafico.destroy());
    graficosCriados = [];
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

function contarPorCampo(registros, campo) {
    const contagem = {};

    registros.forEach(registro => {
        const valor = registro[campo] || "Não informado";
        contagem[valor] = (contagem[valor] || 0) + 1;
    });

    return contagem;
}

function contarTecnologias(registros) {
    const contagem = {};

    registros.forEach(registro => {
        const tecnologias = registro["Tecnologia Envolvida"] || "Não informado";

        tecnologias.split(",").forEach(item => {
            const tecnologia = item.trim();

            if (tecnologia) {
                contagem[tecnologia] = (contagem[tecnologia] || 0) + 1;
            }
        });
    });

    return contagem;
}

function contarPorMes(registros) {
    const contagem = {};

    registros.forEach(registro => {
        const ano = registro["Ano"] || "";
        const mes = registro["Mês"] || "";

        let chave = "Não informado";

        if (ano && mes) {
            chave = `${mes}/${ano}`;
        } else if (registro["Data"]) {
            const partes = registro["Data"].split("-");
            if (partes.length >= 2) {
                chave = `${partes[1]}/${partes[0]}`;
            }
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
        .slice(0, 30)
        .forEach(registro => {
            const linha = document.createElement("tr");

            linha.innerHTML = `
                <td>${registro["Data"] || ""}</td>
                <td>${registro["Canal"] || ""}</td>
                <td>${registro["Instituição"] || ""}</td>
                <td>${registro["Nome"] || ""}</td>
                <td>${registro["Cargo"] || ""}</td>
                <td>${registro["Tipo de Atendimento"] || ""}</td>
                <td>${registro["Tecnologia Envolvida"] || ""}</td>
                <td>${registro["Duração Formatada"] || ""}</td>
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

async function carregarDashboard() {
    const status = document.getElementById("statusDashboard");

    try {
        status.textContent = "Buscando dados da planilha...";

        limparGraficos();

        const registros = await buscarRegistrosDaPlanilha();

        const totalAtendimentos = registros.length;

        const totalMinutos = registros.reduce((soma, item) => {
            return soma + Number(item["Duração em Minutos"] || 0);
        }, 0);

        const contagemCanal = contarPorCampo(registros, "Canal");
        const canalMaisUsado = obterMaiorCategoria(contagemCanal);

        document.getElementById("totalAtendimentos").textContent = totalAtendimentos;
        document.getElementById("totalHoras").textContent = formatarDuracao(totalMinutos);
        document.getElementById("principalCanal").textContent = canalMaisUsado;

        criarGrafico("graficoCanal", "bar", "Atendimentos por canal", contagemCanal);
        criarGrafico("graficoCargo", "bar", "Atendimentos por cargo", contarPorCampo(registros, "Cargo"));
        criarGrafico("graficoSegmento", "doughnut", "Atendimentos por segmento", contarPorCampo(registros, "Segmento"));
        criarGrafico("graficoTipo", "bar", "Atendimentos por tipo", contarPorCampo(registros, "Tipo de Atendimento"));
        criarGrafico("graficoTecnologia", "bar", "Atendimentos por tecnologia", contarTecnologias(registros));
        criarGrafico("graficoMes", "line", "Atendimentos por mês", contarPorMes(registros));

        preencherTabela(registros);

        status.textContent = `Dashboard atualizado com ${totalAtendimentos} atendimento(s).`;

    } catch (erro) {
        console.error(erro);
        status.textContent = "Erro ao carregar o dashboard. Veja o Console do navegador e o histórico do Power Automate.";
    }
}

document.addEventListener("DOMContentLoaded", function() {
    carregarDashboard();

    const botaoAtualizar = document.getElementById("atualizarDashboard");

    if (botaoAtualizar) {
        botaoAtualizar.addEventListener("click", carregarDashboard);
    }
});
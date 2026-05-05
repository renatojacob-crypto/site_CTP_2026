// FUNÇÕES GERAIS DO SITE CTP

function gerarId() {
    return "CTP-" + Date.now();
}

function calcularDuracaoMinutos(inicio, fim) {
    if (!inicio || !fim) return 0;

    const [horaInicio, minutoInicio] = inicio.split(":").map(Number);
    const [horaFim, minutoFim] = fim.split(":").map(Number);

    const totalInicio = horaInicio * 60 + minutoInicio;
    const totalFim = horaFim * 60 + minutoFim;

    if (totalFim < totalInicio) {
        return 0;
    }

    return totalFim - totalInicio;
}

function formatarDuracao(minutos) {
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;

    if (horas === 0) {
        return `${mins}min`;
    }

    return `${horas}h ${mins}min`;
}

function mostrarMensagem(texto, tipo) {
    const mensagem = document.getElementById("mensagem");
    if (!mensagem) return;

    mensagem.textContent = texto;
    mensagem.className = `status-message ${tipo}`;
}

function obterRegistrosLocais() {
    return JSON.parse(localStorage.getItem("atendimentosCTP")) || [];
}

function salvarRegistroLocal(registro) {
    const registros = obterRegistrosLocais();
    registros.push(registro);
    localStorage.setItem("atendimentosCTP", JSON.stringify(registros));
}

async function enviarParaPowerAutomate(registro) {
    if (!POWER_AUTOMATE_URL) {
        salvarRegistroLocal(registro);
        return {
            modo: "local",
            sucesso: true
        };
    }

    const resposta = await fetch(POWER_AUTOMATE_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify(registro)
    });

    if (!resposta.ok) {
        throw new Error("Erro ao enviar para o Power Automate.");
    }

    return {
        modo: "powerAutomate",
        sucesso: true
    };
}

function iniciarFormulario() {
    const form = document.getElementById("formAtendimento");
    if (!form) return;

    const campoData = document.getElementById("data");
    if (campoData && !campoData.value) {
        campoData.valueAsDate = new Date();
    }

    form.addEventListener("submit", async function(event) {
        event.preventDefault();

        const dados = new FormData(form);

        const horarioInicial = dados.get("horarioInicial");
        const horarioFinal = dados.get("horarioFinal");
        const duracaoMinutos = calcularDuracaoMinutos(horarioInicial, horarioFinal);

        if (duracaoMinutos <= 0) {
            mostrarMensagem("Verifique os horários. O horário final precisa ser maior que o horário inicial.", "error");
            return;
        }

        const registro = {
            id: gerarId(),
            data: dados.get("data"),
            horarioInicial: horarioInicial,
            horarioFinal: horarioFinal,
            canal: dados.get("canal"),
            instituicao: dados.get("instituicao"),
            nome: dados.get("nome"),
            cargo: dados.get("cargo"),
            tipoAtendimento: dados.get("tipoAtendimento"),
            segmento: dados.get("segmento"),
            programa: dados.get("programa"),
            tecnologia: dados.get("tecnologia"),
            aulaAtividade: dados.get("aulaAtividade"),
            descricao: dados.get("descricao"),
            duracaoMinutos: duracaoMinutos,
            duracaoFormatada: formatarDuracao(duracaoMinutos),
            mes: dados.get("data") ? dados.get("data").substring(5, 7) : "",
            ano: dados.get("data") ? dados.get("data").substring(0, 4) : "",
            criadoEm: new Date().toISOString()
        };

        try {
            const resultado = await enviarParaPowerAutomate(registro);

            if (resultado.modo === "local") {
                mostrarMensagem("Atendimento salvo em modo de teste neste navegador.", "success");
            } else {
                mostrarMensagem("Atendimento enviado com sucesso para a planilha.", "success");
            }

            form.reset();
            const campoData = document.getElementById("data");
            if (campoData) campoData.valueAsDate = new Date();

        } catch (erro) {
            console.error(erro);
            mostrarMensagem("Não foi possível salvar o atendimento. Verifique a integração e tente novamente.", "error");
        }
    });
}

function contarPorCampo(registros, campo) {
    const contagem = {};

    registros.forEach(registro => {
        const valor = registro[campo] || "Não informado";
        contagem[valor] = (contagem[valor] || 0) + 1;
    });

    return contagem;
}

function obterMaiorCategoria(contagem) {
    const entradas = Object.entries(contagem);

    if (entradas.length === 0) return "-";

    entradas.sort((a, b) => b[1] - a[1]);
    return entradas[0][0];
}

function iniciarDashboard() {
    const totalAtendimentos = document.getElementById("totalAtendimentos");
    if (!totalAtendimentos) return;

    const registros = obterRegistrosLocais();

    const totalMinutos = registros.reduce((soma, item) => soma + Number(item.duracaoMinutos || 0), 0);
    const canalMaisUsado = obterMaiorCategoria(contarPorCampo(registros, "canal"));

    document.getElementById("totalAtendimentos").textContent = registros.length;
    document.getElementById("totalHoras").textContent = formatarDuracao(totalMinutos);
    document.getElementById("principalCanal").textContent = canalMaisUsado;

    const tabela = document.getElementById("tabelaRegistros");
    tabela.innerHTML = "";

    registros.slice().reverse().forEach(registro => {
        const linha = document.createElement("tr");

        linha.innerHTML = `
            <td>${registro.data || ""}</td>
            <td>${registro.canal || ""}</td>
            <td>${registro.instituicao || ""}</td>
            <td>${registro.nome || ""}</td>
            <td>${registro.cargo || ""}</td>
            <td>${registro.tecnologia || ""}</td>
            <td>${registro.duracaoFormatada || ""}</td>
        `;

        tabela.appendChild(linha);
    });

    const botaoLimpar = document.getElementById("limparDados");
    if (botaoLimpar) {
        botaoLimpar.addEventListener("click", function() {
            const confirmar = confirm("Deseja apagar os dados de teste salvos neste navegador?");
            if (confirmar) {
                localStorage.removeItem("atendimentosCTP");
                location.reload();
            }
        });
    }
}

document.addEventListener("DOMContentLoaded", function() {
    iniciarFormulario();
    iniciarDashboard();
});

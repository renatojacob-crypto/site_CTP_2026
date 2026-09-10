// ============================================================
// CTP 360 - NOVO ATENDIMENTO
// Integração com Power Automate + SharePoint (CTP_Atendimentos)
// Versão: permite iniciar atendimento sem horário final/solução
// ============================================================

function calcularDuracaoMinutos(inicio, fim) {
    // Se ainda não houver horário final, o atendimento está em andamento.
    if (!inicio || !fim) {
        return null;
    }

    const [horaInicio, minutoInicio] = inicio
        .split(":")
        .map(Number);

    const [horaFim, minutoFim] = fim
        .split(":")
        .map(Number);

    const totalInicio =
        horaInicio * 60 + minutoInicio;

    const totalFim =
        horaFim * 60 + minutoFim;

    // Retorna -1 para indicar horário inválido.
    if (totalFim <= totalInicio) {
        return -1;
    }

    return totalFim - totalInicio;
}


// ============================================================
// MENSAGENS NA TELA
// ============================================================

function mostrarMensagem(texto, tipo = "") {
    const mensagem =
        document.getElementById("mensagem");

    if (!mensagem) {
        return;
    }

    mensagem.textContent = texto;

    mensagem.className =
        `status-message ${tipo}`.trim();
}


// ============================================================
// DATA ATUAL
// ============================================================

function definirDataAtual() {
    const campoData =
        document.getElementById("data");

    if (!campoData || campoData.value) {
        return;
    }

    const agora = new Date();

    const ano =
        agora.getFullYear();

    const mes =
        String(
            agora.getMonth() + 1
        ).padStart(2, "0");

    const dia =
        String(
            agora.getDate()
        ).padStart(2, "0");

    campoData.value =
        `${ano}-${mes}-${dia}`;
}


// ============================================================
// FUNÇÕES AUXILIARES
// ============================================================

function limparTexto(valor) {
    return String(
        valor ?? ""
    ).trim();
}


function textoOuNull(valor) {
    const texto =
        limparTexto(valor);

    return texto || null;
}


// ============================================================
// MONTA O JSON ENVIADO AO POWER AUTOMATE
// ============================================================

function montarPayload(form) {
    const dados =
        new FormData(form);

    return {

        // ----------------------------------------------------
        // ASSUNTO / TÍTULO
        // ----------------------------------------------------

        Assunto:
            limparTexto(
                dados.get("assunto")
            ) ||
            "Atendimento técnico-pedagógico",


        // ----------------------------------------------------
        // DATA E HORÁRIOS
        // ----------------------------------------------------

        Data:
            limparTexto(
                dados.get("data")
            ),

        HorarioInicial:
            limparTexto(
                dados.get("horarioInicial")
            ),

        // Pode ser null enquanto o atendimento
        // ainda estiver em andamento.
        HorarioFinal:
            textoOuNull(
                dados.get("horarioFinal")
            ),


        // ----------------------------------------------------
        // DADOS DO ATENDIMENTO
        // ----------------------------------------------------

        Canal:
            limparTexto(
                dados.get("canal")
            ),

        Instituicao:
            limparTexto(
                dados.get("instituicao")
            ),

        NomeContato:
            limparTexto(
                dados.get("nome")
            ),

        CargoAtendido:
            limparTexto(
                dados.get("cargo")
            ),

        TipoAtendimento:
            limparTexto(
                dados.get("tipoAtendimento")
            ),

        Programa:
            limparTexto(
                dados.get("programa")
            ),


        // ----------------------------------------------------
        // CAMPOS COM MÚLTIPLAS OPÇÕES
        // ----------------------------------------------------

        Segmentos:
            dados
                .getAll("segmento")
                .map(limparTexto)
                .filter(Boolean)
                .join(", "),

        Tecnologias:
            dados
                .getAll("tecnologia")
                .map(limparTexto)
                .filter(Boolean)
                .join(", "),


        // ----------------------------------------------------
        // AULA / ATIVIDADE
        // ----------------------------------------------------

        AulaAtividade:
            textoOuNull(
                dados.get("aulaAtividade")
            ),


        // ----------------------------------------------------
        // PROBLEMA E SOLUÇÃO
        // ----------------------------------------------------

        DescricaoProblema:
            limparTexto(
                dados.get("descricaoProblema")
            ),

        // Pode ser null durante a abertura.
        DescricaoSolucao:
            textoOuNull(
                dados.get("descricaoSolucao")
            )
    };
}


// ============================================================
// ENVIA O ATENDIMENTO PARA O POWER AUTOMATE
// ============================================================

async function enviarNovoAtendimento(
    payload
) {

    // --------------------------------------------------------
    // Verifica se a URL está configurada
    // --------------------------------------------------------

    if (
        typeof POWER_AUTOMATE_URL ===
            "undefined" ||
        !POWER_AUTOMATE_URL ||
        POWER_AUTOMATE_URL.includes(
            "COLE_AQUI"
        )
    ) {

        throw new Error(
            "POWER_AUTOMATE_URL não está configurada no config.js."
        );
    }


    // --------------------------------------------------------
    // Envia para o Power Automate
    // --------------------------------------------------------

    const resposta =
        await fetch(
            POWER_AUTOMATE_URL,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body:
                    JSON.stringify(
                        payload
                    )
            }
        );


    // --------------------------------------------------------
    // Lê a resposta
    // --------------------------------------------------------

    const texto =
        await resposta.text();

    let retorno = null;


    if (texto) {

        try {

            retorno =
                JSON.parse(
                    texto
                );

        } catch {

            retorno = {
                mensagem: texto
            };
        }
    }


    // --------------------------------------------------------
    // Tratamento de erro HTTP
    // --------------------------------------------------------

    if (!resposta.ok) {

        const detalhe =
            retorno?.mensagem ||
            retorno?.error?.message ||
            texto ||
            "O fluxo não retornou detalhes.";

        throw new Error(
            `Falha ao registrar atendimento. HTTP ${resposta.status}. ${detalhe}`
        );
    }


    // --------------------------------------------------------
    // Retorno padrão
    // --------------------------------------------------------

    return (
        retorno || {
            sucesso: true,

            mensagem:
                "Atendimento registrado com sucesso."
        }
    );
}


// ============================================================
// INICIALIZAÇÃO DO FORMULÁRIO
// ============================================================

function iniciarFormulario() {

    const form =
        document.getElementById(
            "formAtendimento"
        );

    if (!form) {
        return;
    }


    // --------------------------------------------------------
    // Preenche a data atual
    // --------------------------------------------------------

    definirDataAtual();


    // --------------------------------------------------------
    // Botão salvar
    // --------------------------------------------------------

    const botaoSalvar =
        form.querySelector(
            'button[type="submit"]'
        );

    const textoOriginalBotao =
        botaoSalvar?.textContent ||
        "Iniciar atendimento";


    // ========================================================
    // ENVIO DO FORMULÁRIO
    // ========================================================

    form.addEventListener(
        "submit",

        async function(event) {

            event.preventDefault();


            // ------------------------------------------------
            // Limpa mensagens antigas
            // ------------------------------------------------

            mostrarMensagem(
                "",
                ""
            );


            // ------------------------------------------------
            // Validação HTML
            // ------------------------------------------------

            if (
                !form.checkValidity()
            ) {

                form.reportValidity();

                return;
            }


            // ------------------------------------------------
            // Monta JSON
            // ------------------------------------------------

            const payload =
                montarPayload(
                    form
                );


            // ------------------------------------------------
            // Valida horário final somente se ele foi informado
            // ------------------------------------------------

            if (
                payload.HorarioFinal
            ) {

                const duracaoMinutos =
                    calcularDuracaoMinutos(
                        payload.HorarioInicial,
                        payload.HorarioFinal
                    );


                if (
                    duracaoMinutos === -1
                ) {

                    mostrarMensagem(
                        "Verifique os horários. Quando informado, o horário final precisa ser maior que o horário inicial.",
                        "error"
                    );

                    return;
                }
            }


            // ------------------------------------------------
            // Desabilita botão durante o envio
            // ------------------------------------------------

            if (botaoSalvar) {

                botaoSalvar.disabled =
                    true;

                botaoSalvar.textContent =
                    "Salvando...";
            }


            try {

                // --------------------------------------------
                // Chama Power Automate
                // --------------------------------------------

                const retorno =
                    await enviarNovoAtendimento(
                        payload
                    );


                // --------------------------------------------
                // Número retornado pelo fluxo
                // --------------------------------------------

                const numeroAtendimento =
                    retorno?.NumeroAtendimento ||
                    retorno?.numeroAtendimento ||
                    "";


                // --------------------------------------------
                // Mensagem final
                // --------------------------------------------

                const mensagemSucesso =
                    numeroAtendimento
                        ? `Atendimento ${numeroAtendimento} iniciado com sucesso.`
                        : (
                            retorno?.mensagem ||
                            "Atendimento iniciado com sucesso."
                        );


                mostrarMensagem(
                    mensagemSucesso,
                    "success"
                );


                // --------------------------------------------
                // Limpa formulário
                // --------------------------------------------

                form.reset();


                // --------------------------------------------
                // Recoloca a data atual
                // --------------------------------------------

                definirDataAtual();


                // --------------------------------------------
                // Volta para o topo
                // --------------------------------------------

                window.scrollTo({
                    top: 0,

                    behavior:
                        "smooth"
                });


            } catch (erro) {

                console.error(
                    "Erro ao registrar atendimento:",
                    erro
                );


                mostrarMensagem(
                    erro?.message ||
                    "Não foi possível iniciar o atendimento. Verifique a integração e tente novamente.",
                    "error"
                );


            } finally {

                // --------------------------------------------
                // Reativa botão
                // --------------------------------------------

                if (botaoSalvar) {

                    botaoSalvar.disabled =
                        false;

                    botaoSalvar.textContent =
                        textoOriginalBotao;
                }
            }
        }
    );
}


// ============================================================
// CARREGA O FORMULÁRIO
// ============================================================

document.addEventListener(
    "DOMContentLoaded",
    iniciarFormulario
);
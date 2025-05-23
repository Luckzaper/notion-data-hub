const Twilio = require('twilio');
const { Client } = require('@notionhq/client');

// Configuração do cliente Notion
const notion = new Client({ auth: process.env.NOTION_API_KEY });
const databaseId = process.env.NOTION_DATABASE_ID;

// Armazena as sessões dos usuários
const sessions = {};

// Handler principal
exports.handler = async function (context, event, callback) {
    console.log("Função Twilio iniciada...");

    // Configuração do Twilio MessagingResponse
    const { MessagingResponse } = Twilio.twiml;
    const twiml = new MessagingResponse();
    const incomingMsg = event.Body.trim().toLowerCase();
    const userNumber = event.From;

    // Recupera a sessão do usuário ou cria uma nova
    let userSession = sessions[userNumber] || { step: 0, data: {}, transferred: false };
    console.log("Mensagem recebida:", incomingMsg);
    console.log("Sessão do usuário:", userSession);

    let reply;

    try {
        // Gerencia o fluxo de mensagens com base no passo atual da sessão
        switch (userSession.step) {
            case 0:
                reply = "Olá! Vou realizar seu atendimento :). Para qual setor você deseja atendimento?\n1 - Vapt Vupt\n2 - M Decals";
                userSession.step = 1;
                break;

            case 1:
                if (incomingMsg === '1') {
                    reply = "Você escolheu Vapt Vupt. Por favor, escolha uma das opções:\n1 - Atendimento com o Contador\n2 - Fazer Passaporte BR\n3 - Fazer Passaporte USA\n4 - Enviar dinheiro para o Brasil";
                    userSession.data.sector = "Vapt Vupt";
                    userSession.step = 2;
                } else if (incomingMsg === '2') {
                    reply = "Você escolheu M Decals. Por favor, escolha o serviço:\n1 - Quero fazer um orçamento\n2 - Consultar meus pagamentos\n3 - Preciso de ajuda";
                    userSession.data.sector = "M Decals";
                    userSession.step = 3;
                } else {
                    reply = "Opção inválida. Digite 1 para Vapt Vupt ou 2 para M Decals.";
                }
                break;

            case 2:
            case 3:
                userSession.data.service = incomingMsg;
                reply = "Por favor, informe seu nome para continuar:";
                userSession.step = 4;
                break;

            case 4:
                if (incomingMsg) {
                    userSession.data.name = incomingMsg;
                    userSession.data.contact = userNumber; // Automatically set the contact number
                    reply = `Obrigado, ${incomingMsg}! Registramos seu atendimento no setor ${userSession.data.sector}.`;
                    await saveToNotion(userSession.data); // Salva os dados no Notion
                } else {
                    reply = "Por favor, informe um nome válido.";
                    userSession.step = 4; // Volta para pedir o nome novamente
                }
                break;

            default:
                reply = "Algo deu errado. Digite 'Oi' para reiniciar o atendimento.";
                userSession.step = 0;
        }

        // Atualiza a sessão do usuário e envia a resposta
        sessions[userNumber] = userSession;
        twiml.message(reply);
        console.log("Resposta enviada:", reply);

        // Chama o callback
        callback(null, twiml);

    } catch (error) {
        console.error("Erro no fluxo do bot:", error);
        // Em caso de erro, reinicia o atendimento
        const errorReply = "Ocorreu um erro. Por favor, digite 'Oi' para reiniciar o atendimento.";
        sessions[userNumber] = { step: 0, data: {}, transferred: false }; // Reseta a sessão
        twiml.message(errorReply);
        callback(null, twiml);
    }
};

// Função para salvar os dados no Notion
async function saveToNotion(data) {
    try {
        await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                Name: {
                    title: [{ text: { content: data.name || "Sem Nome" } }],
                },
                Sector: {
                    select: { name: data.sector || "Não especificado" },
                },
                Service: {
                    select: { name: data.service || "Não especificado" },
                },
                Contact: {
                    phone_number: data.contact || "Null",
                },
            },
        });
        console.log("Dados registrados no Notion com sucesso!");
    } catch (error) {
        console.error("Erro ao salvar no Notion:", error.message);
        throw error; // Lança o erro para ser tratado no fluxo principal
    }
}

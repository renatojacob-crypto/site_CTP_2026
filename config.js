// CONFIGURAÇÃO DO SITE CTP
// Cole aqui a URL do Power Automate quando o fluxo estiver pronto.
// URL usada pelo formulário para enviar novos atendimentos
const POWER_AUTOMATE_URL = "https://defaultf916220e9d9a444a9c2bddd8cd5534.b2.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/eba2173d84b64a9aa6d8c99be2157d33/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=8T9OnLAlCl1Sv998JSrKikiII8Wey6obW0F-geKjCyE";
// URL usada pelo dashboard e relatório para buscar dados da planilha
const POWER_AUTOMATE_DASHBOARD_URL = "https://defaultf916220e9d9a444a9c2bddd8cd5534.b2.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/a1e2f28155d14aa5a16a30bfaba884c7/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=fjRxaCMcAXVsaVwb7HGWkwgXdmD78A2UOQHzpBQostk";
// URL usada pelo relatório para enviar e-mail
const POWER_AUTOMATE_EMAIL_URL = "https://defaultf916220e9d9a444a9c2bddd8cd5534.b2.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/e958c620fbca48fd939171f886e28d2a/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=u7OWPP3hJZ1OWobL8M-G8j_Vf3-ugS6ji_boaD52G8c";
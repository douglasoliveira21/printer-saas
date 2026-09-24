// Chaves espelham exatamente o que apps/api/src/reports/reports.service.ts
// (serviceOrdersDetailedPdf) reconhece. `wired: false` = a coluna aparece no
// PDF, mas como "Não disponível" — o dado não é coletado/registrado hoje
// (ex.: patrimônio da impressora, tempo por serviço individual, comentários
// de OS — esse recurso nem existe ainda).

export interface ReportColumnGroup {
  group: string;
  columns: { key: string; label: string; wired: boolean }[];
}

export const SERVICE_ORDER_REPORT_COLUMNS: ReportColumnGroup[] = [
  {
    group: "Chamados",
    columns: [
      { key: "number", label: "Nº do chamado", wired: true },
      { key: "status", label: "Situação", wired: true },
      { key: "createdBy", label: "Criado por", wired: true },
      { key: "technician", label: "Responsável", wired: true },
      { key: "customer", label: "Cliente", wired: true },
      { key: "title", label: "Título", wired: true },
      { key: "serviceType", label: "Tipo de chamado", wired: true },
      { key: "attendanceStart", label: "Início do atendimento", wired: true },
      { key: "attendanceEnd", label: "Fim do atendimento", wired: true },
      { key: "attendanceDuration", label: "Tempo de Atendimento", wired: true },
      { key: "createdAt", label: "Data de abertura", wired: true },
      { key: "completedAt", label: "Data de encerramento", wired: true },
      { key: "openDuration", label: "Tempo aberto", wired: true },
      { key: "priority", label: "Prioridade", wired: true },
      { key: "description", label: "Descrição do chamado", wired: true },
      { key: "discount", label: "Desconto do chamado", wired: false },
      { key: "value", label: "Valor do chamado", wired: true },
    ],
  },
  {
    group: "SLA",
    columns: [
      { key: "slaHours", label: "SLA do chamado", wired: true },
      { key: "slaDueAt", label: "Prazo final de atendimento", wired: true },
      { key: "slaExceeded", label: "SLA excedido?", wired: true },
      { key: "slaExceededTime", label: "Tempo excedido do SLA", wired: true },
    ],
  },
  {
    group: "Localização",
    columns: [
      { key: "locationName", label: "Identificação da localização", wired: true },
      { key: "zipCode", label: "CEP", wired: true },
      { key: "street", label: "Rua", wired: true },
      { key: "addressNumber", label: "Número", wired: true },
      { key: "neighborhood", label: "Bairro", wired: true },
      { key: "complement", label: "Complemento", wired: true },
      { key: "state", label: "Estado", wired: true },
      { key: "city", label: "Cidade", wired: true },
    ],
  },
  {
    group: "Impressoras",
    columns: [
      { key: "printer", label: "Impressoras", wired: true },
      { key: "manufacturer", label: "Fabricantes", wired: true },
      { key: "model", label: "Modelos", wired: true },
      { key: "serial", label: "Números de série", wired: true },
      { key: "asset", label: "Nº de patrimônio", wired: false },
      { key: "ip", label: "Endereços IP", wired: true },
      { key: "mac", label: "Endereços MAC", wired: true },
      { key: "printerLocation", label: "Localizações das impressoras", wired: true },
      { key: "department", label: "Departamento da impressora", wired: true },
      { key: "owner", label: "Proprietários das impressoras", wired: true },
    ],
  },
  {
    group: "Alertas",
    columns: [
      { key: "alertType", label: "Tipos de alerta", wired: true },
      { key: "alertLevel", label: "Níveis de criticidade dos alertas", wired: true },
      { key: "alertMessage", label: "Descrições dos alertas", wired: true },
      { key: "alertPrinter", label: "Impressoras dos Alertas", wired: true },
      { key: "alertOpenDuration", label: "Tempo que os alertas ficaram abertos", wired: true },
      { key: "alertCreatedAt", label: "Datas de abertura dos alertas", wired: true },
      { key: "alertResolvedAt", label: "Datas de encerramento dos alertas", wired: true },
    ],
  },
  {
    group: "Serviços",
    columns: [
      { key: "serviceName", label: "Serviços", wired: true },
      { key: "servicePrinter", label: "Impressoras dos serviços", wired: true },
      { key: "serviceResponsible", label: "Responsáveis dos serviços", wired: true },
      { key: "serviceExecutionTime", label: "Tempos de execução dos serviços", wired: false },
      { key: "serviceStart", label: "Início dos serviços", wired: false },
      { key: "serviceEnd", label: "Fim dos serviços", wired: false },
      { key: "serviceNotes", label: "Observações dos serviços", wired: false },
      { key: "serviceValue", label: "Valores dos serviços", wired: true },
    ],
  },
  {
    group: "Itens do estoque",
    columns: [
      { key: "stockItem", label: "Itens do estoque", wired: true },
      { key: "stockQuantity", label: "Quantidade de itens", wired: true },
      { key: "stockOriginType", label: "Tipos de origens", wired: false },
      { key: "stockOriginDesc", label: "Descrições das origens", wired: false },
      { key: "stockDestType", label: "Tipos de destinos", wired: false },
      { key: "stockDestDesc", label: "Descrições dos destinos", wired: false },
      { key: "stockNotes", label: "Observações dos itens do estoque", wired: false },
      { key: "stockTotalValue", label: "Valores totais dos itens do estoque", wired: true },
    ],
  },
  {
    group: "Custos adicionais",
    columns: [
      { key: "costDescription", label: "Descrições dos custos adicionais", wired: true },
      { key: "costValue", label: "Valores dos custos adicionais", wired: true },
      { key: "costNotes", label: "Observações dos custos adicionais", wired: false },
    ],
  },
  {
    group: "Comentários",
    columns: [
      { key: "commentText", label: "Comentários", wired: false },
      { key: "commentAuthor", label: "Quem escreveu os comentários", wired: false },
      { key: "commentDate", label: "Data dos comentários", wired: false },
    ],
  },
];

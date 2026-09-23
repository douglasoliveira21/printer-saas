// Catálogo completo das colunas pedidas pra "Configurações de relatório" —
// chaves marcadas `wired: true` realmente mudam o PDF/e-mail gerado
// (ClosingsService.generatePdf / report-delivery.processor.ts); as demais
// ficam guardadas em TenantClosingSettings.*ReportColumns sem efeito ainda,
// porque o dado que elas representam (patrimônio, departamento nos
// contadores A3, nível de cobertura de cor, etc.) não é coletado hoje.

export interface ReportColumnGroup {
  group: string;
  columns: { key: string; label: string; wired: boolean }[];
}

export const CLOSING_REPORT_COLUMNS: ReportColumnGroup[] = [
  {
    group: "Identificação da impressora",
    columns: [
      { key: "id_serial", label: "Número de série", wired: true },
      { key: "id_ip", label: "Endereço IP", wired: true },
      { key: "id_asset", label: "Número de patrimônio", wired: false },
      { key: "id_mac", label: "Endereço MAC", wired: true },
      { key: "id_location", label: "Localização", wired: true },
      { key: "id_department", label: "Departamento", wired: true },
      { key: "id_notes", label: "Observação", wired: false },
    ],
  },
  {
    group: "Contadores",
    columns: [
      { key: "counter_bw", label: "P&B", wired: true },
      { key: "counter_color", label: "Coloridos", wired: true },
      { key: "counter_general", label: "Gerais", wired: false },
      { key: "counter_scan", label: "Digitalização", wired: true },
    ],
  },
  {
    group: "Identificação do dispositivo",
    columns: [
      { key: "device_type", label: "Tipo", wired: false },
      { key: "device_serial", label: "Número de série", wired: false },
      { key: "device_ip", label: "Endereço IP", wired: false },
      { key: "device_asset", label: "Número de patrimônio", wired: false },
      { key: "device_mac", label: "Endereço MAC", wired: false },
      { key: "device_location", label: "Localização", wired: false },
      { key: "device_department", label: "Departamento", wired: false },
      { key: "device_notes", label: "Observação", wired: false },
    ],
  },
  {
    group: "Outros valores",
    columns: [{ key: "other_fixedCost", label: "Custo fixo por impressora", wired: true }],
  },
];

export const PRINT_USAGE_REPORT_COLUMNS: ReportColumnGroup[] = [
  {
    group: "Identificação da impressora",
    columns: [
      { key: "printer_id_serial", label: "Número de série", wired: true },
      { key: "printer_id_ip", label: "Endereço IP", wired: true },
      { key: "printer_id_asset", label: "Número de patrimônio", wired: false },
      { key: "printer_id_mac", label: "Endereço MAC", wired: true },
      { key: "printer_id_location", label: "Localização", wired: true },
      { key: "printer_id_department", label: "Departamento", wired: true },
      { key: "printer_id_costCenter", label: "Centro de custo", wired: false },
    ],
  },
  {
    group: "Contadores P&B",
    columns: [
      { key: "bw_start", label: "Contador inicial", wired: false },
      { key: "bw_end", label: "Contador final", wired: false },
      { key: "bw_total", label: "Total", wired: true },
      { key: "bw_startDate", label: "Data inicial", wired: false },
      { key: "bw_endDate", label: "Data final", wired: false },
    ],
  },
  {
    group: "Contadores coloridos",
    columns: [
      { key: "color_start", label: "Contador inicial", wired: false },
      { key: "color_end", label: "Contador final", wired: false },
      { key: "color_total", label: "Total", wired: true },
      { key: "color_startDate", label: "Data inicial", wired: false },
      { key: "color_endDate", label: "Data final", wired: false },
    ],
  },
  {
    group: "Contadores coloridos por nível de cobertura",
    columns: [
      { key: "colorCoverage_start", label: "Contador inicial", wired: false },
      { key: "colorCoverage_end", label: "Contador final", wired: false },
      { key: "colorCoverage_total", label: "Total", wired: false },
    ],
  },
  {
    group: "Contadores gerais",
    columns: [
      { key: "general_start", label: "Contador inicial", wired: false },
      { key: "general_end", label: "Contador final", wired: false },
      { key: "general_total", label: "Total", wired: false },
      { key: "general_startDate", label: "Data inicial", wired: false },
      { key: "general_endDate", label: "Data final", wired: false },
    ],
  },
  {
    group: "Contadores A3 P&B",
    columns: [
      { key: "a3bw_start", label: "Contador inicial", wired: false },
      { key: "a3bw_end", label: "Contador final", wired: false },
      { key: "a3bw_total", label: "Total", wired: false },
      { key: "a3bw_startDate", label: "Data inicial", wired: false },
      { key: "a3bw_endDate", label: "Data final", wired: false },
    ],
  },
  {
    group: "Contadores A3 coloridos",
    columns: [
      { key: "a3color_start", label: "Contador inicial", wired: false },
      { key: "a3color_end", label: "Contador final", wired: false },
      { key: "a3color_total", label: "Total", wired: false },
      { key: "a3color_startDate", label: "Data inicial", wired: false },
      { key: "a3color_endDate", label: "Data final", wired: false },
    ],
  },
  {
    group: "Contadores A3 gerais",
    columns: [
      { key: "a3general_start", label: "Contador inicial", wired: false },
      { key: "a3general_end", label: "Contador final", wired: false },
      { key: "a3general_total", label: "Total", wired: false },
      { key: "a3general_startDate", label: "Data inicial", wired: false },
      { key: "a3general_endDate", label: "Data final", wired: false },
    ],
  },
];

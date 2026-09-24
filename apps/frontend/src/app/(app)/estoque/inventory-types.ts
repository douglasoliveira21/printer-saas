export const TYPE_OPTIONS = [
  { value: "TONER", label: "Toner" },
  { value: "CARTUCHO_TINTA", label: "Cartucho de tinta" },
  { value: "CILINDRO", label: "Cilindro (drum)" },
  { value: "REVELADOR", label: "Revelador" },
  { value: "FUSOR", label: "Unidade fusora" },
  { value: "CINTA_TRANSFERENCIA", label: "Correia/cinta de transferência" },
  { value: "COLETOR_TONER_RESIDUAL", label: "Coletor de toner residual" },
  { value: "CABECA_IMPRESSAO", label: "Cabeça de impressão" },
  { value: "ROLETE_TRACAO", label: "Rolete de tração" },
  { value: "PECA", label: "Peça" },
  { value: "OUTRO", label: "Outro" },
];

export function inventoryTypeLabel(value: string): string {
  return TYPE_OPTIONS.find((t) => t.value === value)?.label ?? value;
}

# Catálogo técnico de impressoras — pesquisa incremental

Base de dados técnica pra alimentar `apps/agent-windows/src/PrinterAgent.Core/Discovery/printer-model-database.json`
e a documentação de OIDs por fabricante (`Vendors/`). Construída em lotes — cada
sessão de trabalho adiciona modelos novos ao `catalogo.csv`, sempre seguindo a
regra: **nunca inventar**. Um campo sem confirmação vira `A CONFIRMAR`, nunca
`SIM`/`NÃO` por suposição.

## Como continuar

Cada linha do CSV representa um modelo específico (nunca uma família inteira).
Pra adicionar mais modelos numa sessão futura, peça: "continue o catálogo de
impressoras, próximo lote: <marcas/modelos>" — ou simplesmente "continue o
catálogo" pra eu seguir a ordem de prioridade original (HP → Epson → Brother →
Canon → Lexmark → Xerox → Ricoh → Kyocera → Konica Minolta → ...).

## Nível de confiança por campo, não só por linha

Diferente do pedido original (`confianca` como um campo único por modelo),
aqui a maioria dos campos técnicos (duplex, scanner, ADF, SNMP, contadores)
já vem direto como `SIM` / `NÃO` / `A CONFIRMAR` — o campo `confianca` da
linha reflete a fonte mais fraca usada entre os campos preenchidos como
SIM/NÃO (nunca conta os `A CONFIRMAR`, já que esses não afirmam nada).

## Limitação sendo honesta

Detalhes de baixo nível (OIDs SNMP privados exatos, se um contador específico
é exposto via SNMP) raramente estão em datasheets públicos — a maioria dos
fabricantes só documenta isso em manuais de administração de rede/MIB que
nem sempre são públicos. Esses campos ficam `A CONFIRMAR` na grande maioria
dos modelos até serem verificados contra o equipamento real ou um MIB
oficial encontrado.

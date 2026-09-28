import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SubmitDevicesDto } from './agent-payloads.dto';

/**
 * Regressão: main.ts liga o ValidationPipe global com
 * `whitelist: true, forbidNonWhitelisted: true` — qualquer campo que o
 * Agent (.NET) envie e o DTO aqui não declare faz a API rejeitar o LOTE
 * INTEIRO com 400, não só o campo desconhecido. Foi exatamente isso que
 * aconteceu quando a Fase 13 (IPP avançado) adicionou `printerState`/
 * `mediaReady` no Agent sem atualizar este DTO: o Agent achava impressoras
 * na varredura, mas nenhuma chegava a ser salva — sem nenhum erro visível
 * pro usuário do ConfigTool. Este teste valida um payload com TODOS os
 * campos que DiscoveredDevice (apps/agent-windows/.../Models/DeviceModels.cs)
 * realmente serializa hoje, em camelCase (mesma PropertyNamingPolicy do
 * PrinterSaasApiClient), pra pegar esse tipo de dessincronia antes de virar
 * um 400 silencioso em produção.
 */
describe('SubmitDevicesDto — todo campo que o Agent envia precisa estar whitelisted', () => {
  it('um device com todos os campos atuais do DiscoveredDevice não gera nenhum erro de validação', async () => {
    const payload = {
      collectionId: '550e8400-e29b-41d4-a716-446655440000',
      devices: [
        {
          ip: '10.0.0.5',
          mac: 'AA:BB:CC:DD:EE:FF',
          hostname: 'SAMSUNGM4070',
          serial: 'ZER4BQAF200292F',
          manufacturer: 'Samsung',
          model: 'SL-M4070FR',
          firmware: 'V4.00.01.15',
          sysDescr: 'Samsung SL-M4070FR',
          counters: { total: 272, blackWhite: 262, color: 0, copies: 22, printPages: 242, duplexPages: 10, raw: { samsung_report_total: 8 } },
          consumables: [{ type: 'toner', color: 'black', levelPercent: 83, capacity: '15000', name: 'Black Toner Cartridge' }],
          collectionMethod: 'SNMP',
          supportsA3: false,
          alerts: [{ code: 'COVER_OPEN', description: 'Tampa aberta', severity: 'warning' }],
          deviceType: 'PRINTER',
          classificationConfidence: 0.95,
          classificationEvidence: ['printer_mib:Nome/série via Printer-MIB'],
          capabilities: { color: false, duplex: true, a3: false, copy: true, scan: true, fax: false },
          capabilitySources: { duplex: 'printer_mib', copies: 'samsung_syncthru' },
          diagnostics: { snmp: 'success', ipp: 'success', ws_discovery: 'not_available' },
          // Fase 13 — os dois campos que causaram o 400 silencioso.
          printerState: 'idle',
          mediaReady: ['na_letter_8.5x11in'],
        },
      ],
    };

    const dto = plainToInstance(SubmitDevicesDto, payload);
    const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });

    expect(errors).toEqual([]);
  });
});

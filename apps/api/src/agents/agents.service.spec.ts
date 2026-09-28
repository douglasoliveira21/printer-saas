import { describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';
import { AgentsService } from './agents.service';
import type { SubmitDevicesDto } from './dto/agent-payloads.dto';

/**
 * Fase 2 (idempotência) — cobre submitDevices sem tocar num banco real: o
 * Prisma inteiro é mockado, incluindo $transaction (que aqui só chama o
 * callback passando o próprio mock como `tx`, já que não precisamos testar
 * rollback real de transação — só que a lógica de dedup por collectionId
 * funciona e que o resto do processamento não muda de comportamento).
 */
function createMockPrisma() {
  const prisma: any = {
    printer: {
      upsert: vi.fn().mockResolvedValue({ id: 'printer-1', status: 'DISCOVERED', supportsA3: null, capabilities: {}, capabilitySources: {} }),
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
    counterReading: { create: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
    consumableReading: { create: vi.fn().mockResolvedValue({}), findFirst: vi.fn().mockResolvedValue(null) },
    consumableReplacement: {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      create: vi.fn().mockResolvedValue({}),
      findFirst: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    printerAlertReading: { createMany: vi.fn().mockResolvedValue({}) },
    printerCatalogModel: { findMany: vi.fn().mockResolvedValue([]) },
    agentSubmission: { create: vi.fn().mockResolvedValue({}) },
  };
  prisma.$transaction = vi.fn((callback: (tx: unknown) => unknown) => callback(prisma));
  return prisma;
}

const fakeAgent = { id: 'agent-1', tenantId: 'tenant-1' } as any;

function makeDto(overrides: Partial<SubmitDevicesDto> = {}): SubmitDevicesDto {
  return {
    devices: [{ ip: '10.0.0.5', mac: 'AA:BB:CC:DD:EE:FF', counters: { total: 100 } } as any],
    ...overrides,
  } as SubmitDevicesDto;
}

describe('AgentsService.submitDevices — idempotência (Fase 2)', () => {
  it('sem collectionId (Agent antigo): processa normalmente, sem usar o guard de idempotência', async () => {
    const prisma = createMockPrisma();
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    const result = await service.submitDevices(fakeAgent, makeDto());

    expect(prisma.agentSubmission.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(prisma.counterReading.create).toHaveBeenCalledTimes(1);
    expect(result.processed).toBe(1);
  });

  it('POST normal com collectionId: processa e grava o guard', async () => {
    const prisma = createMockPrisma();
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    const result = await service.submitDevices(fakeAgent, makeDto({ collectionId: '11111111-1111-1111-1111-111111111111' }));

    expect(prisma.agentSubmission.create).toHaveBeenCalledWith({
      data: { agentId: 'agent-1', collectionId: '11111111-1111-1111-1111-111111111111', deviceCount: 1 },
    });
    expect(prisma.counterReading.create).toHaveBeenCalledTimes(1);
    expect(result.processed).toBe(1);
  });

  it('mesmo POST duas vezes (retry após ack perdido): a segunda vez não duplica nenhuma leitura', async () => {
    const prisma = createMockPrisma();
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);
    const dto = makeDto({ collectionId: '22222222-2222-2222-2222-222222222222' });

    await service.submitDevices(fakeAgent, dto);

    // A segunda tentativa do MESMO lote: simula a unique constraint real do
    // Postgres rejeitando o segundo insert de agentSubmission.
    prisma.agentSubmission.create.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    );

    const secondResult = await service.submitDevices(fakeAgent, dto);

    expect(secondResult).toEqual({ processed: 0, results: [], deduplicated: true });
    // Só a primeira chamada gravou leitura — a segunda não tocou em nenhuma tabela de dados.
    expect(prisma.counterReading.create).toHaveBeenCalledTimes(1);
    expect(prisma.printer.upsert).toHaveBeenCalledTimes(1);
  });

  it('dois requests simultâneos com o mesmo collectionId: só um processa, o outro é reconhecido como duplicado', async () => {
    const prisma = createMockPrisma();
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);
    const dto = makeDto({ collectionId: '33333333-3333-3333-3333-333333333333' });

    // A "corrida": o segundo insert de agentSubmission falha com P2002
    // exatamente como aconteceria no Postgres real com dois requests
    // concorrentes tentando inserir a mesma chave única ao mesmo tempo.
    prisma.agentSubmission.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }));

    const [first, second] = await Promise.all([service.submitDevices(fakeAgent, dto), service.submitDevices(fakeAgent, dto)]);

    const results = [first, second];
    const deduplicated = results.filter((r: any) => r.deduplicated);
    const processed = results.filter((r: any) => !r.deduplicated);
    expect(deduplicated).toHaveLength(1);
    expect(processed).toHaveLength(1);
    expect(prisma.counterReading.create).toHaveBeenCalledTimes(1);
  });

  it('duas coletas diferentes da mesma impressora (collectionId diferente): ambas são gravadas normalmente', async () => {
    const prisma = createMockPrisma();
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDto({ collectionId: '44444444-4444-4444-4444-444444444444' }));
    await service.submitDevices(fakeAgent, makeDto({ collectionId: '55555555-5555-5555-5555-555555555555' }));

    expect(prisma.counterReading.create).toHaveBeenCalledTimes(2);
    expect(prisma.agentSubmission.create).toHaveBeenCalledTimes(2);
  });

  it('um erro real (não P2002) durante o processamento é propagado, não silenciado como duplicado', async () => {
    const prisma = createMockPrisma();
    prisma.counterReading.create.mockRejectedValueOnce(new Error('falha de conexão com o banco'));
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await expect(service.submitDevices(fakeAgent, makeDto({ collectionId: '66666666-6666-6666-6666-666666666666' }))).rejects.toThrow(
      'falha de conexão com o banco',
    );
  });

  it('Fase 14: múltiplos Agents diferentes, cada um com seu próprio collectionId, processam independentemente sem interferir um no outro', async () => {
    // collectionId é @unique globalmente (não composto com agentId) — o
    // guard de idempotência não pode acidentalmente barrar o Agent B só
    // porque o Agent A já submeteu ALGUMA coisa antes. O que garante que
    // isso nunca colide na prática é o Agent gerar um GUID novo por lote
    // (AgentWorker.SubmitDiscoveredDevicesAsync); este teste cobre o lado
    // da API: dois agentIds diferentes, dois collectionIds diferentes,
    // ambos devem gravar normalmente.
    const prisma = createMockPrisma();
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);
    const agentA = { id: 'agent-A', tenantId: 'tenant-1' } as any;
    const agentB = { id: 'agent-B', tenantId: 'tenant-1' } as any;

    const [resultA, resultB] = await Promise.all([
      service.submitDevices(agentA, makeDto({ collectionId: '77777777-7777-7777-7777-777777777777' })),
      service.submitDevices(agentB, makeDto({ collectionId: '88888888-8888-8888-8888-888888888888' })),
    ]);

    expect(resultA).toMatchObject({ processed: 1 });
    expect(resultB).toMatchObject({ processed: 1 });
    expect(prisma.agentSubmission.create).toHaveBeenCalledWith({
      data: { agentId: 'agent-A', collectionId: '77777777-7777-7777-7777-777777777777', deviceCount: 1 },
    });
    expect(prisma.agentSubmission.create).toHaveBeenCalledWith({
      data: { agentId: 'agent-B', collectionId: '88888888-8888-8888-8888-888888888888', deviceCount: 1 },
    });
    expect(prisma.counterReading.create).toHaveBeenCalledTimes(2);
  });
});

describe('AgentsService.submitDevices — proteção contra regressão de contadores (Fase 3)', () => {
  function makeDtoWithTotal(total: number): SubmitDevicesDto {
    return { devices: [{ ip: '10.0.0.5', counters: { total } } as any] } as SubmitDevicesDto;
  }

  it('primeira leitura (sem histórico anterior): NORMAL, sem previousTotal', async () => {
    const prisma = createMockPrisma();
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithTotal(100));

    expect(prisma.counterReading.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ total: 100, status: 'NORMAL', previousTotal: undefined }) }),
    );
  });

  it('contador maior que o anterior: NORMAL', async () => {
    const prisma = createMockPrisma();
    prisma.counterReading.findFirst.mockResolvedValue({ total: 100000 });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithTotal(100450));

    expect(prisma.counterReading.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ total: 100450, status: 'NORMAL', previousTotal: undefined }) }),
    );
  });

  it('contador igual ao anterior: NORMAL (não é regressão)', async () => {
    const prisma = createMockPrisma();
    prisma.counterReading.findFirst.mockResolvedValue({ total: 100000 });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithTotal(100000));

    expect(prisma.counterReading.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'NORMAL' }) }),
    );
  });

  it('contador menor que o anterior (reset/troca): REGRESSED, valor bruto preservado, previousTotal gravado', async () => {
    const prisma = createMockPrisma();
    prisma.counterReading.findFirst.mockResolvedValue({ total: 101000 });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithTotal(500));

    // O valor informado pela impressora (500) é gravado exatamente como
    // veio — nunca descartado, nunca zerado — só marcado.
    expect(prisma.counterReading.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ total: 500, status: 'REGRESSED', previousTotal: 101000 }) }),
    );
  });

  it('ausência de leitura anterior com total null na única linha existente: tratado como sem histórico, NORMAL', async () => {
    const prisma = createMockPrisma();
    prisma.counterReading.findFirst.mockResolvedValue(null); // where já filtra total != null
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithTotal(42));

    expect(prisma.counterReading.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'NORMAL' }) }));
  });

});

describe('AgentsService.detectReplacement — debounce de troca de suprimento (Fase 4)', () => {
  function makeDtoWithConsumable(levelPercent: number): SubmitDevicesDto {
    return {
      devices: [{ ip: '10.0.0.5', consumables: [{ type: 'toner', color: 'black', levelPercent }] } as any],
    } as SubmitDevicesDto;
  }

  it('sem salto: nenhum candidato é criado', async () => {
    const prisma = createMockPrisma();
    prisma.consumableReading.findFirst.mockResolvedValue({ levelPercent: 60 });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithConsumable(55)); // caiu, é o normal

    expect(prisma.consumableReplacement.create).not.toHaveBeenCalled();
    expect(prisma.consumableReplacement.update).not.toHaveBeenCalled();
  });

  it('salto grande pela primeira vez: cria CANDIDATE, NUNCA confirma na hora', async () => {
    const prisma = createMockPrisma();
    prisma.consumableReading.findFirst.mockResolvedValue({ levelPercent: 15 }); // baixo antes do salto
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithConsumable(100)); // salto de 85

    expect(prisma.consumableReplacement.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'CANDIDATE', levelPercentAtReplacement: 15 }) }),
    );
    // Nunca gera CONFIRMED/PREMATURE direto na primeira leitura.
    expect(prisma.consumableReplacement.update).not.toHaveBeenCalled();
  });

  it('candidato existente + próxima leitura confirma o salto: promove pra CONFIRMED (nível anterior baixo)', async () => {
    const prisma = createMockPrisma();
    prisma.consumableReading.findFirst.mockResolvedValue({ levelPercent: 95 }); // a própria leitura-candidata já gravada
    prisma.consumableReplacement.findFirst.mockResolvedValue({ id: 'candidate-1', levelPercentAtReplacement: 15, predictedAt: null });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithConsumable(98)); // continua alto — persistiu

    expect(prisma.consumableReplacement.update).toHaveBeenCalledWith({
      where: { id: 'candidate-1' },
      data: { status: 'CONFIRMED', replacedAt: expect.any(Date) },
    });
  });

  it('candidato existente + próxima leitura confirma, mas nível anterior era alto: promove pra PREMATURE', async () => {
    const prisma = createMockPrisma();
    prisma.consumableReading.findFirst.mockResolvedValue({ levelPercent: 90 });
    prisma.consumableReplacement.findFirst.mockResolvedValue({ id: 'candidate-2', levelPercentAtReplacement: 30, predictedAt: null });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithConsumable(95));

    expect(prisma.consumableReplacement.update).toHaveBeenCalledWith({
      where: { id: 'candidate-2' },
      data: { status: 'PREMATURE', replacedAt: expect.any(Date) },
    });
  });

  it('candidato existente mas o nível caiu de novo (era ruído): descarta, não confirma nada', async () => {
    const prisma = createMockPrisma();
    prisma.consumableReading.findFirst.mockResolvedValue({ levelPercent: 95 }); // a leitura-candidata gravada
    prisma.consumableReplacement.findFirst.mockResolvedValue({ id: 'candidate-3', levelPercentAtReplacement: 15, predictedAt: null });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithConsumable(20)); // voltou pro nível normal — era ruído

    expect(prisma.consumableReplacement.update).toHaveBeenCalledWith({
      where: { id: 'candidate-3' },
      data: { status: 'DISMISSED', levelPercentAtReplacement: null },
    });
  });

  it('candidato que veio de um PREDICTED (previsão): se não confirma, volta pra PREDICTED em vez de descartar a previsão', async () => {
    const prisma = createMockPrisma();
    prisma.consumableReading.findFirst.mockResolvedValue({ levelPercent: 95 });
    prisma.consumableReplacement.findFirst.mockResolvedValue({
      id: 'candidate-4',
      levelPercentAtReplacement: 15,
      predictedAt: new Date('2026-10-01'),
    });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithConsumable(20));

    expect(prisma.consumableReplacement.update).toHaveBeenCalledWith({
      where: { id: 'candidate-4' },
      data: { status: 'PREDICTED', levelPercentAtReplacement: null },
    });
  });

  it('salto detectado com uma previsão (PREDICTED) já aberta: promove a mesma linha pra CANDIDATE em vez de criar outra', async () => {
    const prisma = createMockPrisma();
    prisma.consumableReading.findFirst.mockResolvedValue({ levelPercent: 15 });
    // Duas chamadas a findFirst acontecem em sequência: a primeira procura um
    // CANDIDATE aberto (não existe, null), a segunda procura um PREDICTED
    // aberto (existe) — o mock precisa diferenciar pela query, não só
    // devolver o mesmo valor pra qualquer chamada.
    prisma.consumableReplacement.findFirst.mockImplementation(({ where }: { where: { status: string } }) =>
      where.status === 'CANDIDATE' ? Promise.resolve(null) : Promise.resolve({ id: 'predicted-1' }),
    );
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);

    await service.submitDevices(fakeAgent, makeDtoWithConsumable(100));

    expect(prisma.consumableReplacement.update).toHaveBeenCalledWith({
      where: { id: 'predicted-1' },
      data: { status: 'CANDIDATE', levelPercentAtReplacement: 15 },
    });
    expect(prisma.consumableReplacement.create).not.toHaveBeenCalled();
  });
});

describe('AgentsService.submitDevices — troca de impressora e fingerprint', () => {
  it('troca de impressora (fingerprint diferente = printer novo): a comparação nunca atravessa printers diferentes', async () => {
    // classifyCounterReading sempre filtra por printerId — este teste
    // confirma que o findFirst é chamado com o printerId do device sendo
    // processado agora, não com um id de outro device do mesmo lote.
    const prisma = createMockPrisma();
    prisma.printer.upsert.mockResolvedValueOnce({ id: 'printer-A', status: 'DISCOVERED', capabilities: {}, capabilitySources: {} });
    const service = new AgentsService(prisma, {} as any, {} as any, {} as any, {} as any);
    const dto = { devices: [{ ip: '10.0.0.5', counters: { total: 10 } } as any] } as SubmitDevicesDto;

    await service.submitDevices(fakeAgent, dto);

    expect(prisma.counterReading.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ printerId: 'printer-A' }) }),
    );
  });
});

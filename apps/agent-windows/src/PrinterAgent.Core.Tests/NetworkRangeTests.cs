using PrinterAgent.Core.Discovery;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>Fase 7 (validação de Network Range).</summary>
public class NetworkRangeTests
{
    [Theory]
    [InlineData("192.168.1.10", 1)]
    [InlineData("192.168.1.0/24", 254)] // exclui rede e broadcast
    [InlineData("192.168.1.0/30", 2)]
    [InlineData("192.168.1.0/31", 2)] // ponto-a-ponto — sem exclusão de rede/broadcast
    [InlineData("192.168.1.5/32", 1)]
    [InlineData("10.0.0.0/16", 65534)]
    [InlineData("192.168.1.10-192.168.1.20", 11)]
    [InlineData("192.168.1.10-192.168.1.10", 1)]
    public void EstimateHostCount_bate_com_a_conta_esperada(string target, long expected)
    {
        Assert.Equal(expected, NetworkRange.EstimateHostCount(target));
    }

    [Theory]
    [InlineData("192.168.1.10")]
    [InlineData("192.168.1.0/28")]
    [InlineData("192.168.1.10-192.168.1.20")]
    public void EstimateHostCount_bate_com_a_contagem_real_do_Expand_para_alvos_pequenos(string target)
    {
        var realCount = NetworkRange.Expand(target).Count();

        Assert.Equal(realCount, NetworkRange.EstimateHostCount(target));
    }

    [Fact]
    public void EstimateHostCount_de_uma_faixa_invertida_retorna_zero_em_vez_de_negativo()
    {
        Assert.Equal(0, NetworkRange.EstimateHostCount("192.168.1.20-192.168.1.10"));
    }
}

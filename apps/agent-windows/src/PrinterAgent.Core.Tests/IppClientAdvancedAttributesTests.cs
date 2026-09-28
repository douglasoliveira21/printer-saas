using System.Text;
using PrinterAgent.Core.Discovery.Ipp;
using Xunit;

namespace PrinterAgent.Core.Tests;

/// <summary>
/// Fase 13 (IPP avançado) — printer-state, printer-state-reasons,
/// printer-supply, printer-supply-description, media-ready. Enum/encoding
/// details sourced from RFC 8011 (§5.4.11/§5.4.12/§5.4.16, confirmed
/// against the IANA IPP registrations) and PWG5100.13 §5.6.39-40 (confirmed
/// against the PWG's own IPP mailing-list clarification of the
/// printer-supply octetString encoding — a "key=value;" ASCII payload, not
/// a fixed binary struct), not assumed from memory.
/// </summary>
public class IppClientAdvancedAttributesTests
{
    [Theory]
    [InlineData("type=toner;level=45;maxcapacity=100;colorantname=black;", "toner", 45, 100, "black")]
    [InlineData("type=fuser;level=96;maxcapacity=100;", "fuser", 96, 100, null)]
    [InlineData("type=toner;level=-2;maxcapacity=100;", "toner", null, 100, null)] // -2 = unknown level, never reported as a real value
    [InlineData("type=waste-toner;level=0;maxcapacity=-1;", "waste-toner", 0, null, null)] // -1 = unlimited capacity
    [InlineData("type=opc;colorantname=unknown;", "opc", null, null, null)] // "unknown"/"other" colorant is not a real color
    public void ParseSupply_le_os_campos_key_value_do_octetString(string raw, string expectedType, int? expectedLevel, int? expectedMaxCapacity, string? expectedColorant)
    {
        var supply = IppClient.ParseSupply(raw);

        Assert.Equal(expectedType, supply.Type);
        Assert.Equal(expectedLevel, supply.Level);
        Assert.Equal(expectedMaxCapacity, supply.MaxCapacity);
        Assert.Equal(expectedColorant, supply.ColorantName);
    }

    [Fact]
    public void ParseSupply_ignora_chaves_desconhecidas_sem_quebrar()
    {
        var supply = IppClient.ParseSupply("type=toner;index=1;markerindex=1;class=supplyThatIsConsumed;unit=percent;colorantindex=1;colorantrole=process;coloranttonality=100;level=50;maxcapacity=100;");

        Assert.Equal("toner", supply.Type);
        Assert.Equal(50, supply.Level);
        Assert.Equal(100, supply.MaxCapacity);
    }

    [Fact]
    public void ParseResponse_le_printer_state_e_mapeia_o_enum_correto()
    {
        var response = BuildResponse(new Dictionary<string, (byte Tag, string[] Values)>
        {
            ["printer-state"] = (0x23, ["4"]), // enum tag, 4 = processing
        });

        var result = IppClient.ParseResponse(response);

        Assert.Equal("processing", result.PrinterState);
    }

    [Fact]
    public void ParseResponse_filtra_o_valor_none_de_printer_state_reasons()
    {
        var response = BuildResponse(new Dictionary<string, (byte Tag, string[] Values)>
        {
            ["printer-state-reasons"] = (0x44, ["none"]),
        });

        var result = IppClient.ParseResponse(response);

        Assert.Null(result.PrinterStateReasons);
    }

    [Fact]
    public void ParseResponse_mantem_state_reasons_reais_com_o_keyword_exato()
    {
        var response = BuildResponse(new Dictionary<string, (byte Tag, string[] Values)>
        {
            ["printer-state-reasons"] = (0x44, ["media-jam-error", "door-open-warning"]),
        });

        var result = IppClient.ParseResponse(response);

        Assert.Equal(["media-jam-error", "door-open-warning"], result.PrinterStateReasons);
    }

    [Fact]
    public void ParseResponse_pareia_printer_supply_com_printer_supply_description_pela_posicao()
    {
        var response = BuildResponse(new Dictionary<string, (byte Tag, string[] Values)>
        {
            ["printer-supply"] = (0x30, ["type=toner;level=45;maxcapacity=100;colorantname=black;", "type=fuser;level=96;maxcapacity=100;"]),
            ["printer-supply-description"] = (0x41, ["Black Toner Cartridge", "Fuser Unit"]),
        });

        var result = IppClient.ParseResponse(response);

        Assert.NotNull(result.Supplies);
        Assert.Equal(2, result.Supplies!.Count);
        Assert.Equal("toner", result.Supplies[0].Type);
        Assert.Equal("Black Toner Cartridge", result.Supplies[0].Description);
        Assert.Equal("fuser", result.Supplies[1].Type);
        Assert.Equal("Fuser Unit", result.Supplies[1].Description);
    }

    [Fact]
    public void ParseResponse_media_ready_fica_bruto_sem_interpretacao()
    {
        var response = BuildResponse(new Dictionary<string, (byte Tag, string[] Values)>
        {
            ["media-ready"] = (0x44, ["na_letter_8.5x11in", "na_legal_8.5x14in"]),
        });

        var result = IppClient.ParseResponse(response);

        Assert.Equal(["na_letter_8.5x11in", "na_legal_8.5x14in"], result.MediaReady);
    }

    /// <summary>Builds a minimal well-formed IPP response (status-line + one printer-attributes group) carrying only the attributes under test — mirrors IppClient's own request-encoding style so the round-trip through ParseResponse is real, not mocked.</summary>
    private static byte[] BuildResponse(Dictionary<string, (byte Tag, string[] Values)> attributes)
    {
        using var stream = new MemoryStream();
        void WriteBE16(int value) => stream.Write([(byte)(value >> 8), (byte)value]);

        stream.Write([0x01, 0x01]); // version 1.1
        stream.Write([0x00, 0x00]); // status-code = successful-ok
        stream.Write([0x00, 0x00, 0x00, 0x01]); // request-id

        stream.WriteByte(0x02); // printer-attributes-tag

        foreach (var (name, (tag, values)) in attributes)
        {
            for (var i = 0; i < values.Length; i++)
            {
                stream.WriteByte(tag);
                var nameBytes = Encoding.ASCII.GetBytes(i == 0 ? name : "");
                WriteBE16(nameBytes.Length);
                stream.Write(nameBytes);
                // integer/enum (0x21/0x23) are 4-byte big-endian binary on
                // the wire, not ASCII text — everything else in this test
                // suite is text-like, matching IppClient's own DecodeValue.
                var valueBytes = tag is 0x21 or 0x23
                    ? BitConverter.GetBytes(int.Parse(values[i])).Reverse().ToArray()
                    : Encoding.UTF8.GetBytes(values[i]);
                WriteBE16(valueBytes.Length);
                stream.Write(valueBytes);
            }
        }

        stream.WriteByte(0x03); // end-of-attributes-tag
        return stream.ToArray();
    }
}

using CUE4Parse.FileProvider;
using CUE4Parse.Compression;
using CUE4Parse.MappingsProvider.Usmap;
using CUE4Parse.UE4.Versions;
using CUE4Parse.UE4.Assets.Exports.StaticMesh;
using CUE4Parse.UE4.Assets.Exports.Engine;
using CUE4Parse.UE4.Assets.Exports.Texture;
using CUE4Parse_Conversion;
using CUE4Parse_Conversion.Options;
using Newtonsoft.Json;
using Serilog;

if (args.Length < 2) {
    Console.Error.WriteLine("Usage: AssetExporter <pak-directory> <export-directory> [GAME_UE5_4] [filter: FPV|all|regex] [matching.usmap]");
    return 2;
}
Log.Logger = new LoggerConfiguration().MinimumLevel.Information().WriteTo.Console().CreateLogger();
var output = Path.GetFullPath(args[1]);
Directory.CreateDirectory(output);
var version = Enum.Parse<EGame>(args.ElementAtOrDefault(2) ?? "GAME_UE5_4");
var filter = args.ElementAtOrDefault(3) ?? "FPV";
var pattern = filter == "all" ? "FPV|Orlan|geran|Shahed|Lancet" : filter;
var regex = new System.Text.RegularExpressions.Regex(pattern, System.Text.RegularExpressions.RegexOptions.IgnoreCase);
var report = new List<object>();
try {
    using var provider = new DefaultFileProvider(args[0], SearchOption.TopDirectoryOnly, new VersionContainer(version), StringComparer.OrdinalIgnoreCase);
    if (args.Length > 4) provider.MappingsContainer = new FileUsmapTypeMappingsProvider(args[4]);
    provider.Initialize();
    provider.Mount();
    provider.PostMount();
    provider.LoadVirtualPaths();
    File.WriteAllText(Path.Combine(output, "mounted-files.txt"), string.Join('\n', provider.Files.Keys.Order()));
    Console.WriteLine($"Mounted files: {provider.Files.Count}; engine={version}; mappings={args.ElementAtOrDefault(4) ?? "none"}");
    // OodleSharp provides a managed decompressor. No proprietary DLL is downloaded.
    foreach (var file in provider.Files.Values.Where(f => f.Path.EndsWith(".uproject") || f.Path.EndsWith("DefaultEngine.ini"))) {
        try { File.WriteAllBytes(Path.Combine(output, file.Name), provider.SaveAsset(file.Path)); }
        catch (Exception ex) { Console.WriteLine($"Metadata {file.Path}: {ex.Message}"); }
    }
    var session = new ExportSession { MaxDegreeOfParallelism = 1 };
    var queued = 0;
    foreach (var file in provider.Files.Values.Where(f => f.IsUePackage && regex.IsMatch(f.Path)).OrderBy(f => f.Path)) {
        try {
            var objects = provider.LoadPackage(file.Path).GetExports().ToArray();
            File.WriteAllText(Path.Combine(output, file.Name + ".json"), JsonConvert.SerializeObject(objects, Formatting.Indented));
            foreach (var obj in objects) {
                report.Add(new { source = file.Path, component = obj.Name, type = obj.ExportType });
                if (obj is UStaticMesh or USkinnedAsset or UTexture) { session.Add(obj); queued++; }
            }
        } catch (Exception ex) {
            report.Add(new { source = file.Path, error = ex.ToString() });
            Console.Error.WriteLine($"LOAD FAILED {file.Path}: {ex}");
        }
    }
    if (queued > 0) {
        var results = await session.RunAsync(output, new ExportOptions(meshFormat: EMeshFormat.Gltf2, exportMaterials: true));
        report.Add(new { exports = results });
    }
    File.WriteAllText(Path.Combine(output, "export-report.json"), JsonConvert.SerializeObject(report, Formatting.Indented));
    return Directory.GetFiles(output, "*.glb", SearchOption.AllDirectories).Length > 0 ? 0 : 3;
} catch (Exception ex) {
    File.WriteAllText(Path.Combine(output, "fatal-error.txt"), ex.ToString());
    Console.Error.WriteLine(ex);
    return 4;
}

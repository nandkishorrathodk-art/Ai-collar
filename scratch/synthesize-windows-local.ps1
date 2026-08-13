param (
    [string]$text = "Hello! This is a test from your Acer laptop local speech engine.",
    [string]$outputPath = "c:\Users\nandk\Ai-collar\scratch\out.wav",
    [string]$voiceName = "Microsoft Zira Desktop"
)

Add-Type -AssemblyName System.Speech
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer

if ($voiceName) {
    try {
        $synth.SelectVoice($voiceName)
    } catch {
        # Fall back to first available voice
    }
}

# Set output format to 8kHz 16-bit Mono WAV (ideal for Twilio / phone audio)
$format = New-Object System.Speech.Synthesis.AudioFormatInfo(8000, [System.Speech.Synthesis.AudioBitsPerSample]::Sixteen, [System.Speech.Synthesis.AudioChannel]::Mono)
$synth.SetOutputToWaveFile($outputPath, $format)
$synth.Speak($text)
$synth.Dispose()

Write-Output "SUCCESS: Audio generated at $outputPath"

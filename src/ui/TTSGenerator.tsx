import React, { useEffect, useState } from "react";

export default function TTSGenerator() {
  const [referenceFiles, setReferenceFiles] = useState<string[]>([]);
  const [selectedReference, setSelectedReference] = useState("");
  const [text, setText] = useState("");
  const [emotion, setEmotion] = useState("neutral");
  const [language, setLanguage] = useState("pt");
  const [audioUrl, setAudioUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/reference-audio")
      .then(res => res.json())
      .then(setReferenceFiles)
      .catch(() => setError("Erro ao carregar arquivos de referência"));
  }, []);

  const handleGenerate = async () => {
    setLoading(true);
    setError("");
    setAudioUrl("");
    try {
      const formData = new FormData();
      formData.append("text", text);
      formData.append("language", language);
      formData.append("reference_audio_filename", selectedReference);

      const response = await fetch("http://localhost:5003/api/tts", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Erro ao gerar áudio");
      }

      const data = await response.json();
      
      // Faz o download do arquivo de áudio
      const audioResponse = await fetch(`http://localhost:5003${data.download_link}`);
      if (!audioResponse.ok) {
        throw new Error("Erro ao baixar áudio");
      }

      const blob = await audioResponse.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
    } catch (e) {
      setError("Erro ao gerar áudio");
    }
    setLoading(false);
  };

  return (
    <div style={{ maxWidth: 500, margin: "auto", padding: 24 }}>
      <h2>Gerador de Áudio TTS</h2>
      <div>
        <label>Arquivo de referência:</label>
        <select
          value={selectedReference}
          onChange={e => setSelectedReference(e.target.value)}
        >
          <option value="">Selecione...</option>
          {referenceFiles.map(f => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
      </div>
      <div>
        <label>Texto:</label>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={3}
          style={{ width: "100%" }}
        />
      </div>
      <div>
        <label>Emoção:</label>
        <select value={emotion} onChange={e => setEmotion(e.target.value)}>
          <option value="neutral">Neutro</option>
          <option value="happy">Feliz</option>
          <option value="sad">Triste</option>
          <option value="angry">Bravo</option>
        </select>
      </div>
      <div>
        <label>Idioma:</label>
        <select value={language} onChange={e => setLanguage(e.target.value)}>
          <option value="pt">Português</option>
          <option value="en">Inglês</option>
        </select>
      </div>
      <button onClick={handleGenerate} disabled={loading || !selectedReference || !text}>
        {loading ? "Gerando..." : "Gerar Áudio"}
      </button>
      {error && <div style={{ color: "red" }}>{error}</div>}
      {audioUrl && (
        <div>
          <h4>Áudio gerado:</h4>
          <audio controls src={audioUrl} />
        </div>
      )}
    </div>
  );
} 
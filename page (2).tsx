import { markerSvg, MARKER_CM, CARD_CM } from "@/lib/scan/marker";
import PrintButton from "./PrintButton";
import Logo from "@/components/Logo";

export const metadata = { title: "Marcador de medição — Visatto" };

// Folha A4 para imprimir em tamanho real. O quadrado preto tem exatamente 15 cm e serve de régua para o escâner.
export default function Marcador() {
  const svg = markerSvg(MARKER_CM * 10);
  return (
    <main className="bg-neutral-200 print:bg-white">
      <style>{`
        @page { size: A4 portrait; margin: 0; }
        @media print { .folha { box-shadow: none !important; margin: 0 !important; } }
      `}</style>
      <div className="no-print mx-auto max-w-[210mm] px-4 py-6">
        <div className="rounded-3xl bg-white p-6 ring-1 ring-black/10">
          <Logo size={28} />
          <h1 className="mt-4 text-[26px] font-extrabold leading-tight">Marcador de medição</h1>
          <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-[14.5px] text-black/70">
            <li>Imprima em papel A4, de preferência em <b>100% / Tamanho real</b>.</li>
            <li>Não precisa medir nada: na hora de escanear, o Visatto confere o tamanho da impressão pela própria folha.</li>
            <li>Deixe a folha bem lisa na mesa, ao lado do prato. Em mesa branca, ponha uma toalha ou bandeja mais escura por baixo, para a folha se destacar.</li>
          </ol>
          <PrintButton />
        </div>
      </div>

      <div
        className="folha mx-auto mb-10 bg-white shadow-xl print:mb-0"
        style={{ width: "210mm", height: "297mm", position: "relative", overflow: "hidden" }}
      >
        {/* quadrado preto centralizado, com o centro a 105 mm do topo */}
        <div style={{ position: "absolute", left: "30mm", top: "30mm", width: "150mm", height: "150mm" }} dangerouslySetInnerHTML={{ __html: svg }} />
        <p style={{ position: "absolute", top: "14mm", width: "100%", textAlign: "center", fontSize: "5mm", fontWeight: 800, fontFamily: "sans-serif" }}>
          VISATTO • marcador de medição • 15 cm
        </p>
        <p style={{ position: "absolute", top: "21mm", width: "100%", textAlign: "center", fontSize: "3.2mm", color: "#555", fontFamily: "sans-serif" }}>
          Deixe esta folha lisa e inteira à vista na mesa, ao lado do prato. Não mexa nela durante a volta.
        </p>
        {/* verificação de escala */}
        <div style={{ position: "absolute", left: `${105 - (CARD_CM.w * 10) / 2}mm`, top: "196mm", width: `${CARD_CM.w * 10}mm`, height: `${CARD_CM.h * 10}mm`, border: "0.5mm dashed #333", borderRadius: "3mm" }} />
        <p style={{ position: "absolute", top: "254mm", width: "100%", textAlign: "center", fontSize: "3.4mm", fontFamily: "sans-serif" }}>
          ↑ Um cartão de banco deve caber exatamente aqui. Se sobrar ou faltar, a impressão saiu fora de escala.
        </p>
        <div style={{ position: "absolute", left: "55mm", top: "266mm", width: "100mm", height: "6mm", borderBottom: "0.4mm solid #000" }}>
          {Array.from({ length: 11 }).map((_, i) => (
            <span key={i} style={{ position: "absolute", left: `${i * 10}mm`, bottom: 0, width: "0.4mm", height: i % 5 === 0 ? "6mm" : "3.5mm", background: "#000" }} />
          ))}
        </div>
        <p style={{ position: "absolute", top: "274mm", width: "100%", textAlign: "center", fontSize: "3.2mm", fontFamily: "sans-serif" }}>10 cm</p>
      </div>
    </main>
  );
}

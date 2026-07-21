import ChatInterface from "@/app/components/ChatInterface";

const COMMANDS = [
  "/tabela języki programowania 2026",
  "/porownanie ChatGPT vs Claude",
  "/lista 5 kroków do pierwszego agenta AI",
  "/faq sztuczna inteligencja dla początkujących",
  "/email podziękowanie za udaną rekrutację",
];

export default function FormatPage() {
  return (
    <ChatInterface
      title="📐 Formatowanie"
      subtitle="Agent odpowiada w tabeli, liście, porównaniu — na żądanie"
      placeholder="Wpisz komendę lub pytanie..."
      apiEndpoint="/api/format"
      termButtons={COMMANDS}
    />
  );
}

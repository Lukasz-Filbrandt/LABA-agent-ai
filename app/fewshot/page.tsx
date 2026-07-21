import ChatInterface from "@/app/components/ChatInterface";

const TERMS = [
  "Sztuczna inteligencja",
  "Agent AI",
  "Prompt",
  "Halucynacja AI",
  "RAG",
  "API",
];

export default function FewShotPage() {
  return (
    <ChatInterface
      title="📚 Słownik AI"
      subtitle="Wyjaśniam trudne pojęcia prostym językiem"
      placeholder="Wpisz pojęcie do wyjaśnienia..."
      apiEndpoint="/api/fewshot"
      termButtons={TERMS}
    />
  );
}

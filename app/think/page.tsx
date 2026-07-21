import ChatInterface from "@/app/components/ChatInterface";

export default function ThinkPage() {
  return (
    <ChatInterface
      title="🧠 Tryb głębokiego myślenia"
      subtitle="Agent pokazuje tok rozumowania krok po kroku"
      placeholder="Zadaj trudne pytanie..."
      apiEndpoint="/api/think"
    />
  );
}

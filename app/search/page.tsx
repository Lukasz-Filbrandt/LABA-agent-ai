import ChatInterface from "@/app/components/ChatInterface";

export default function SearchPage() {
  return (
    <ChatInterface
      title="🌐 Agent z wyszukiwarką"
      subtitle="Przeszukuję prawdziwy internet i czytam strony"
      placeholder="Zapytaj o cokolwiek aktualnego..."
      apiEndpoint="/api/search"
      exampleQuestions={[
        "Jakie są najnowsze wiadomości o sztucznej inteligencji?",
        "Ile kosztuje iPhone 16 Pro w Polsce?",
        "Kto wygrał ostatni mecz reprezentacji Polski?",
        "Jakie filmy są teraz w kinach?",
      ]}
    />
  );
}

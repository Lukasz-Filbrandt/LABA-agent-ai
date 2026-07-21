import ChatInterface from "@/app/components/ChatInterface";

// Przykładowe pytania startowe z dziedziny agenta
const EXAMPLE_QUESTIONS = [
  "Jaką formę opodatkowania wybrać dla jednoosobowej działalności?",
  "Do kiedy trzeba złożyć PIT-37 za zeszły rok?",
  "Czy na ryczałcie mogę odliczać koszty?",
  "Jak rozliczyć fakturę od kontrahenta z UE?",
];

export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ continueId?: string }>;
}) {
  const { continueId } = await searchParams;

  return (
    <ChatInterface
      title="📊 Marek Kowalski — Doradca podatkowy"
      subtitle="Ekspert od podatków. Zapytaj mnie o PIT, VAT, ryczałt i rozliczenia firm."
      placeholder="Napisz wiadomość..."
      apiEndpoint="/api/chat"
      exampleQuestions={EXAMPLE_QUESTIONS}
      persist
      personalize
      continueConversationId={continueId}
    />
  );
}

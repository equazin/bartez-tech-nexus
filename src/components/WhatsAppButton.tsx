import { MessageCircle } from "lucide-react";

const WhatsAppButton = () => {
  const phoneNumber = "5411123456789";
  const message = encodeURIComponent("Hola, me gustaría recibir información sobre sus productos y servicios.");

  return (
    <a
      href={`https://wa.me/${phoneNumber}?text=${message}`}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(142,70%,45%)] text-[hsl(0,0%,100%)] shadow-lg transition-transform hover:scale-110"
      aria-label="Contactar por WhatsApp"
    >
      <MessageCircle size={26} />
    </a>
  );
};

export default WhatsAppButton;

// app/pet/[id]/page.tsx

import { Metadata } from "next";
import { supabase } from "@/lib/supabaseClient";
import EmergencyPetClient from "./EmergencyPetClient";
import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export const instant = false;

type Props = {
  params: Promise<{ id: string }>;
};

const DEMO_IDS = ["1", "demo", "ejemplo", "simba"];
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;

  if (DEMO_IDS.includes(id.toLowerCase())) {
    return {
      title: "🚨 ALERTA MÉDICA (Demo): SIMBA (Perro) | HuellaDigital",
      description:
        "Perfil de ejemplo HuellaDigital NFC: Simba (Golden Retriever). Visualizá cómo funciona la ficha de emergencia e historial clínico.",
      openGraph: {
        title: "🐾 Perfil de Ejemplo: Simba | HuellaDigital Misiones",
        description:
          "Ejemplo de ficha de emergencia NFC con alerta médica, contacto por WhatsApp e historial clínico verificado.",
        images: [
          {
            url: "https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&q=80&w=800",
            width: 800,
            height: 800,
            alt: "Simba - Perfil de Ejemplo HuellaDigital",
          },
        ],
        type: "article",
      },
    };
  }

  try {
    let resolvedPetId: string | null = null;

    // 1. Buscar por UID de tarjeta en la tabla cards
    const { data: card } = await supabase
      .from("cards")
      .select("pet_id")
      .eq("uid", id)
      .maybeSingle();

    if (card?.pet_id) {
      resolvedPetId = card.pet_id;
    } else if (UUID_REGEX.test(id)) {
      resolvedPetId = id;
    }

    let pet: any = null;

    if (resolvedPetId) {
      const { data } = await supabase
        .from("pets")
        .select("name, species, breed, avatar_url, emergency_notes")
        .eq("id", resolvedPetId)
        .maybeSingle();
      pet = data;
    } else {
      const { data } = await supabase
        .from("pets")
        .select("name, species, breed, avatar_url, emergency_notes")
        .eq("nfc_uid", id)
        .maybeSingle();
      pet = data;
    }

    if (!pet) {
      return {
        title: "Mascota No Encontrada | HuellaDigital",
        description: "El perfil escaneado no está registrado en HuellaDigital.",
      };
    }

    const hasEmergency = Boolean(pet.emergency_notes);
    const title = hasEmergency
      ? `🚨 ALERTA MÉDICA: ${pet.name.toUpperCase()} (${pet.species})`
      : `🐾 Ficha de Emergencia: ${pet.name} (${pet.species})`;

    const description = hasEmergency
      ? `Atención: ${pet.emergency_notes}. Escaneá para contactar a su tutor responsable.`
      : `Perfil verificado NFC de ${pet.name} (${pet.breed || pet.species}). Contactá a su tutor al instante.`;

    const imageUrl = pet.avatar_url || "https://huelladigital.com/logo-huella.png";

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        images: [{ url: imageUrl, width: 800, height: 800, alt: pet.name }],
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [imageUrl],
      },
    };
  } catch (error) {
    return {
      title: "HuellaDigital • Emergencia Mascotas",
      description: "Servicio de Identificación NFC en Misiones.",
    };
  }
}

export default async function EmergencyPetPage({ params }: Props) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-petlight flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-petgreen" />
        </div>
      }
    >
      <EmergencyPetClient petId={id} />
    </Suspense>
  );
}
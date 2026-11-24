"use client";

import React, { useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import {
  Search,
  ScanLine,
  Loader2,
  AlertTriangle,
  Clock,
  User,
  Phone,
  PawPrint,
  Send,
} from "lucide-react";
import type { BranchVet } from "@/components/vet/ReceptionLiveQueue";

export interface PetSearchResult {
  id: string;
  name: string;
  species: string;
  breed: string;
  avatar_url: string | null;
  emergency_notes: string | null;
  uid: string;
  ownerName: string;
  ownerPhone: string;
  ownerDni: string;
}

interface ReceptionSearchAndAdmitProps {
  branchId: string;
  userId: string;
  branchVets: BranchVet[];
  waitingPetIds: string[];
  onAdmitted: (petName: string) => Promise<void> | void;
  onError: (message: string) => void;
  onClearFeedback: () => void;
}

const VISIT_TYPES = [
  "Consulta General",
  "Urgencia",
  "Vacunación",
  "Control",
  "Cirugía / Procedimiento",
  "Estudios",
];

function extractUid(cards: any): string {
  if (Array.isArray(cards) && cards.length > 0) return cards[0]?.uid || "Sin chip";
  if (cards?.uid) return cards.uid;
  return "Sin chip";
}

function extractProfile(profiles: any) {
  if (Array.isArray(profiles)) return profiles[0] || null;
  return profiles || null;
}

export default function ReceptionSearchAndAdmit({
  branchId,
  userId,
  branchVets,
  waitingPetIds,
  onAdmitted,
  onError,
  onClearFeedback,
}: ReceptionSearchAndAdmitProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<PetSearchResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedPet, setSelectedPet] = useState<PetSearchResult | null>(null);

  const [visitType, setVisitType] = useState<string>("Consulta General");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [assignedVetId, setAssignedVetId] = useState<string>("");
  const [receptionNotes, setReceptionNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const term = searchQuery.trim();
    if (!term) return;

    setSearching(true);
    setHasSearched(true);
    onClearFeedback();

    try {
      const pattern = `%${term}%`;

      const cardsPromise = supabase
        .from("cards")
        .select(
          `
          uid,
          pets (
            id,
            name,
            species,
            breed,
            avatar_url,
            emergency_notes,
            profiles (full_name, phone, dni)
          )
        `
        )
        .ilike("uid", pattern)
        .limit(10);

      const petsPromise = supabase
        .from("pets")
        .select(
          `
          id,
          name,
          species,
          breed,
          avatar_url,
          emergency_notes,
          profiles (full_name, phone, dni),
          cards (uid)
        `
        )
        .ilike("name", pattern)
        .limit(10);

      const ownersPromise = (async () => {
        const res = await supabase
          .from("profiles")
          .select(
            `
            full_name,
            phone,
            dni,
            pets (
              id,
              name,
              species,
              breed,
              avatar_url,
              emergency_notes,
              cards (uid)
            )
          `
          )
          .or(
            `full_name.ilike.${pattern},phone.ilike.${pattern},dni.ilike.${pattern}`
          )
          .limit(10);

        if (!res.error) return res;

        const fallbackOr = /^\d+$/.test(term)
          ? `full_name.ilike.${pattern},phone.ilike.${pattern},dni.eq.${term}`
          : `full_name.ilike.${pattern},phone.ilike.${pattern}`;

        return supabase
          .from("profiles")
          .select(
            `
            full_name,
            phone,
            dni,
            pets (
              id,
              name,
              species,
              breed,
              avatar_url,
              emergency_notes,
              cards (uid)
            )
          `
          )
          .or(fallbackOr)
          .limit(10);
      })();

      const [cardsRes, petsRes, ownersRes] = await Promise.all([
        cardsPromise,
        petsPromise,
        ownersPromise,
      ]);

      const mapById = new Map<string, PetSearchResult>();

      if (cardsRes.data) {
        for (const card of cardsRes.data as any[]) {
          const petList = Array.isArray(card.pets)
            ? card.pets
            : card.pets
            ? [card.pets]
            : [];
          for (const pet of petList) {
            if (!pet?.id) continue;
            const owner = extractProfile(pet.profiles);
            mapById.set(pet.id, {
              id: pet.id,
              name: pet.name,
              species: pet.species || "",
              breed: pet.breed || "",
              avatar_url: pet.avatar_url || null,
              emergency_notes: pet.emergency_notes || null,
              uid: card.uid,
              ownerName: owner?.full_name || "Sin tutor",
              ownerPhone: owner?.phone || "",
              ownerDni: owner?.dni ? String(owner.dni) : "",
            });
          }
        }
      }

      if (petsRes.data) {
        for (const pet of petsRes.data as any[]) {
          if (!pet?.id || mapById.has(pet.id)) continue;
          const owner = extractProfile(pet.profiles);
          mapById.set(pet.id, {
            id: pet.id,
            name: pet.name,
            species: pet.species || "",
            breed: pet.breed || "",
            avatar_url: pet.avatar_url || null,
            emergency_notes: pet.emergency_notes || null,
            uid: extractUid(pet.cards),
            ownerName: owner?.full_name || "Sin tutor",
            ownerPhone: owner?.phone || "",
            ownerDni: owner?.dni ? String(owner.dni) : "",
          });
        }
      }

      if (ownersRes.data) {
        for (const owner of ownersRes.data as any[]) {
          const petList = Array.isArray(owner.pets)
            ? owner.pets
            : owner.pets
            ? [owner.pets]
            : [];
          for (const pet of petList) {
            if (!pet?.id || mapById.has(pet.id)) continue;
            mapById.set(pet.id, {
              id: pet.id,
              name: pet.name,
              species: pet.species || "",
              breed: pet.breed || "",
              avatar_url: pet.avatar_url || null,
              emergency_notes: pet.emergency_notes || null,
              uid: extractUid(pet.cards),
              ownerName: owner.full_name || "Sin tutor",
              ownerPhone: owner.phone || "",
              ownerDni: owner.dni ? String(owner.dni) : "",
            });
          }
        }
      }

      const results = Array.from(mapById.values());
      setSearchResults(results);

      const exactUidMatch = results.find(
        (r) => r.uid.toLowerCase() === term.toLowerCase()
      );
      if (exactUidMatch) {
        setSelectedPet(exactUidMatch);
      } else if (results.length === 1) {
        setSelectedPet(results[0]);
      }
    } catch (err) {
      console.error("Error buscando paciente:", err);
      onError("Error al buscar pacientes registrados.");
    } finally {
      setSearching(false);
    }
  };

  const handleSelectVisitType = (type: string) => {
    setVisitType(type);
    if (type === "Urgencia") {
      setPriority("urgent");
    } else if (priority === "urgent" && visitType === "Urgencia") {
      setPriority("normal");
    }
  };

  const handleAddToWaitingRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet || !branchId || !userId) return;

    setSubmitting(true);
    onClearFeedback();

    try {
      const { error } = await supabase.from("waiting_room").insert([
        {
          branch_id: branchId,
          pet_id: selectedPet.id,
          registered_by: userId,
          assigned_vet_id: assignedVetId || null,
          visit_type: visitType,
          priority,
          reception_notes: receptionNotes.trim() || null,
          status: "waiting",
        },
      ]);

      if (error) throw error;

      const admittedName = selectedPet.name;

      setSelectedPet(null);
      setSearchQuery("");
      setSearchResults([]);
      setHasSearched(false);
      setVisitType("Consulta General");
      setPriority("normal");
      setAssignedVetId("");
      setReceptionNotes("");

      await onAdmitted(admittedName);
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } catch (err: any) {
      console.error("Error ingresando a sala de espera:", err);
      onError(
        err.message || "No se pudo registrar el ingreso en Sala de Espera."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="lg:col-span-7 space-y-6">
      {/* Paso 1: Escaneo / Búsqueda Rápida */}
      <div className="bg-petblue rounded-2xl p-6 shadow-md border border-slate-700">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-petgreen" />
            <span>1. Identificar Paciente HuellaDigital</span>
          </h1>
          <span className="text-[11px] font-mono text-slate-300 bg-white/10 px-2.5 py-1 rounded-lg">
            NFC / QR / Tutor
          </span>
        </div>

        <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Search className="w-5 h-5" />
            </span>
            <input
              ref={searchInputRef}
              type="text"
              autoFocus
              placeholder="Escaneá UID NFC/QR o buscá por mascota, tutor, DNI o teléfono..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 min-h-[48px] bg-slate-800 border border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-white text-sm sm:text-base font-medium placeholder-slate-400"
            />
          </div>
          <button
            type="submit"
            disabled={searching || !searchQuery.trim()}
            className="min-h-[48px] px-6 bg-petgreen hover:bg-emerald-600 text-white font-bold rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all disabled:opacity-60 cursor-pointer shrink-0"
          >
            {searching ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Search className="w-4 h-4" />
                <span>Buscar</span>
              </>
            )}
          </button>
        </form>

        {hasSearched && !selectedPet && (
          <div className="mt-4 space-y-2">
            {searchResults.length === 0 ? (
              <div className="bg-slate-800/80 border border-slate-700 rounded-xl p-4 text-center text-slate-300 text-sm">
                No se encontraron mascotas registradas en HuellaDigital para{" "}
                <span className="font-bold text-white">
                  "{searchQuery}"
                </span>
                .
              </div>
            ) : (
              <div className="bg-white rounded-xl overflow-hidden divide-y divide-slate-100 shadow-lg max-h-72 overflow-y-auto">
                {searchResults.map((pet) => (
                  <button
                    key={pet.id}
                    type="button"
                    onClick={() => setSelectedPet(pet)}
                    className="w-full p-3.5 hover:bg-emerald-50/60 transition-colors flex items-center justify-between gap-3 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={
                          pet.avatar_url ||
                          "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80"
                        }
                        alt={pet.name}
                        className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-petblue text-sm">
                            {pet.name}
                          </span>
                          <span className="text-[11px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                            {pet.uid}
                          </span>
                          {pet.emergency_notes && (
                            <span className="text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                              Alerta Médica
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          {pet.species} • {pet.breed} — Tutor:{" "}
                          <span className="font-semibold text-slate-700">
                            {pet.ownerName}
                          </span>
                          {pet.ownerDni ? ` (DNI ${pet.ownerDni})` : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-bold text-petgreen shrink-0">
                      Seleccionar →
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Paso 2: Confirmación y Selección en 2 Toques */}
      {selectedPet ? (
        <form
          onSubmit={handleAddToWaitingRoom}
          className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div className="flex items-center gap-4">
              <img
                src={
                  selectedPet.avatar_url ||
                  "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80"
                }
                alt={selectedPet.name}
                className="w-16 h-16 rounded-2xl object-cover border-2 border-petgreen/30 shadow-sm shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-petblue">
                    {selectedPet.name}
                  </h2>
                  <span className="text-[11px] font-mono bg-petlight text-slate-600 px-2 py-0.5 rounded-md border border-slate-200">
                    {selectedPet.uid}
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {selectedPet.species} • {selectedPet.breed}
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs text-slate-600 font-medium">
                  <span className="flex items-center gap-1">
                    <User className="w-3.5 h-3.5 text-petgreen" />
                    {selectedPet.ownerName}
                  </span>
                  {selectedPet.ownerPhone && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3.5 h-3.5 text-petgreen" />
                      {selectedPet.ownerPhone}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedPet(null);
                setTimeout(() => searchInputRef.current?.focus(), 50);
              }}
              className="text-xs font-bold text-slate-500 hover:text-red-600 bg-slate-100 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors self-start sm:self-center cursor-pointer"
            >
              Cambiar paciente
            </button>
          </div>

          {selectedPet.emergency_notes && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-red-700 block">
                  Alerta Médica Crítica
                </span>
                <p className="text-sm font-semibold text-red-900 mt-0.5">
                  {selectedPet.emergency_notes}
                </p>
              </div>
            </div>
          )}

          {waitingPetIds.includes(selectedPet.id) && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 shrink-0" />
              <span>
                Este paciente ya figura actualmente en la Sala de Espera.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              2. Tipo de Atención
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {VISIT_TYPES.map((type) => {
                const active = visitType === type;
                const isUrgencyBtn = type === "Urgencia";
                return (
                  <button
                    key={type}
                    type="button"
                    onClick={() => handleSelectVisitType(type)}
                    className={`min-h-[52px] px-3 py-2.5 rounded-xl font-bold text-xs sm:text-sm border-2 transition-all cursor-pointer text-center ${
                      active
                        ? isUrgencyBtn
                          ? "bg-red-600 text-white border-red-600 shadow-md shadow-red-600/20"
                          : "bg-petblue text-white border-petblue shadow-md"
                        : isUrgencyBtn
                        ? "bg-red-50/70 text-red-700 border-red-200 hover:bg-red-100"
                        : "bg-petlight text-petblue border-slate-200 hover:border-petgreen"
                    }`}
                  >
                    {type}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Prioridad
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPriority("normal")}
                  className={`min-h-[44px] rounded-xl font-bold text-xs border-2 transition-all cursor-pointer ${
                    priority === "normal"
                      ? "bg-emerald-600 text-white border-emerald-600"
                      : "bg-slate-50 text-slate-600 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  Normal
                </button>
                <button
                  type="button"
                  onClick={() => setPriority("urgent")}
                  className={`min-h-[44px] rounded-xl font-bold text-xs border-2 transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    priority === "urgent"
                      ? "bg-red-600 text-white border-red-600 animate-pulse"
                      : "bg-red-50 text-red-700 border-red-200 hover:bg-red-100"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Urgente</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Veterinario Asignado
              </label>
              <select
                value={assignedVetId}
                onChange={(e) => setAssignedVetId(e.target.value)}
                className="w-full px-3 py-2.5 min-h-[44px] text-sm bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-semibold"
              >
                <option value="">Cualquier disponible</option>
                {branchVets.map((vet) => (
                  <option key={vet.id} value={vet.id}>
                    {vet.full_name}{" "}
                    {vet.license_number ? `(${vet.license_number})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
              Nota Breve de Mostrador (Opcional)
            </label>
            <input
              type="text"
              placeholder="Ej. Viene con vómitos desde ayer / Retira libreta..."
              value={receptionNotes}
              onChange={(e) => setReceptionNotes(e.target.value)}
              className="w-full px-4 py-3 min-h-[44px] text-sm bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={`w-full min-h-[56px] rounded-2xl font-extrabold text-base text-white shadow-lg flex items-center justify-center gap-2.5 transition-all active:scale-[0.99] disabled:opacity-70 cursor-pointer ${
              priority === "urgent"
                ? "bg-red-600 hover:bg-red-700 shadow-red-600/25"
                : "bg-petgreen hover:bg-emerald-600 shadow-petgreen/25"
            }`}
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Ingresando a Sala de Espera...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span>Pasar a Sala de Espera</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="bg-white rounded-2xl p-8 border border-dashed border-slate-300 text-center text-slate-400">
          <PawPrint className="w-12 h-12 mx-auto text-slate-300 mb-2" />
          <p className="text-sm font-semibold text-slate-500">
            Escaneá una tarjeta NFC/QR o buscá una mascota registrada para
            pasarla a Sala de Espera.
          </p>
        </div>
      )}
    </div>
  );
}
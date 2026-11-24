"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import {
  ArrowLeft,
  User,
  Phone,
  MapPin,
  Calendar,
  Syringe,
  Thermometer,
  Weight,
  FilePlus,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Paperclip,
  FileText,
  Clock,
} from "lucide-react";

interface Consultation {
  id: string;
  created_at: string;
  visit_type: string;
  diagnosis: string;
  weight: string;
  temperature: string;
  vaccine_details: string | null;
  attachment_url: string | null;
  vetName: string;
  license: string;
}

interface ActiveWaitingEntry {
  id: string;
  visit_type: string;
  priority: "normal" | "urgent";
  reception_notes: string | null;
  status: string;
}

function extractFirst(val: any) {
  if (Array.isArray(val)) return val[0] || null;
  return val || null;
}

function extractUid(cards: any): string {
  if (Array.isArray(cards) && cards.length > 0) return cards[0]?.uid || "N/A";
  return cards?.uid || "N/A";
}

function calculateAge(birthDate: string | null) {
  if (!birthDate) return "Edad Desconocida";
  const birth = new Date(birthDate);
  const today = new Date();

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (months < 0 || (months === 0 && today.getDate() < birth.getDate())) {
    years--;
    months += 12;
  }
  if (today.getDate() < birth.getDate()) {
    months--;
    if (months < 0) months = 11;
  }

  if (years === 0 && months === 0) return "Menos de 1 mes";
  if (years === 0) return `${months} mes${months > 1 ? "es" : ""}`;
  if (months === 0) return `${years} año${years > 1 ? "s" : ""}`;
  return `${years} año${years > 1 ? "s" : ""} y ${months} mes${
    months > 1 ? "es" : ""
  }`;
}

function isBirthday(birthDate: string | null) {
  if (!birthDate) return false;
  const [, month, day] = birthDate.split("-");
  const today = new Date();
  return (
    today.getMonth() + 1 === parseInt(month) &&
    today.getDate() === parseInt(day)
  );
}

const VISIT_TYPE_OPTIONS = [
  "Consulta General",
  "Control",
  "Toma de Muestra",
  "Vacunación",
  "Urgencia",
  "Cirugía / Procedimiento",
  "Estudios",
  "Control Dermatológico",
];

function VetPatientDetailContent() {
  const params = useParams();
  const router = useRouter();
  const patientId = params?.id as string;

  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [isVet, setIsVet] = useState(false);
  const [vetProfile, setVetProfile] = useState<any>(null);
  const [patient, setPatient] = useState<any>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [activeTurn, setActiveTurn] = useState<ActiveWaitingEntry | null>(null);

  const [newConsultation, setNewConsultation] = useState({
    visit_type: "Consulta General",
    diagnosis: "",
    weight: "",
    temperature: "",
    vaccine_details: "",
  });

  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);

  useEffect(() => {
    async function loadPatientData() {
      try {
        // 1. Cargar datos públicos del paciente
        const { data: petData, error: petError } = await supabase
          .from("pets")
          .select(
            `
            *,
            profiles (full_name, location, phone),
            cards (uid)
          `
          )
          .eq("id", patientId)
          .single();

        if (petError || !petData) throw petError;
        setPatient(petData);

        // 2. Cargar historial médico
        const { data: recordsData, error: recordsError } = await supabase
          .from("medical_records")
          .select(
            `
            *,
            profiles (full_name),
            vet_profiles (license_number)
          `
          )
          .eq("pet_id", patientId)
          .order("created_at", { ascending: false });

        if (!recordsError && recordsData) {
          const mappedRecords: Consultation[] = recordsData.map((r: any) => {
            const p = extractFirst(r.profiles);
            const vp = extractFirst(r.vet_profiles);
            return {
              id: r.id,
              created_at: new Date(r.created_at).toLocaleDateString("es-AR"),
              visit_type: r.visit_type || r.consultation_type || "Consulta Médica",
              diagnosis: r.diagnosis || r.diagnosis_notes || "Sin observaciones",
              weight: r.weight || r.weight_kg || "-",
              temperature: r.temperature || r.temperature_c || "-",
              vaccine_details: r.vaccine_details || r.vaccine_batch || null,
              attachment_url: r.attachment_url || null,
              vetName: p?.full_name || r.vet_name || "Clínica / Profesional",
              license: vp?.license_number || "S/M",
            };
          });
          setConsultations(mappedRecords);
        }

        // 3. Verificar si el usuario es un veterinario aprobado (solo ellos pueden firmar historias clínicas)
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role, full_name, branch_id, vet_profiles(license_number, branch_id, status)")
            .eq("id", user.id)
            .single();

          const vp = extractFirst(profile?.vet_profiles);
          const isApprovedVet =
            profile?.role === "vet" && vp?.status === "approved";

          if (isApprovedVet) {
            setIsVet(true);
            const resolvedBranchId = vp?.branch_id || profile?.branch_id || null;
            setVetProfile({
              id: user.id,
              name: profile?.full_name || "Veterinario",
              license: vp?.license_number || "Matrícula Verificada",
              branchId: resolvedBranchId,
            });

            // Buscar si este paciente tiene un turno activo en sala de espera de esta sucursal
            if (resolvedBranchId) {
              const { data: turnData } = await supabase
                .from("waiting_room")
                .select("id, visit_type, priority, reception_notes, status")
                .eq("branch_id", resolvedBranchId)
                .eq("pet_id", patientId)
                .in("status", ["in_consultation", "waiting"])
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

              if (turnData) {
                setActiveTurn(turnData as ActiveWaitingEntry);
                if (VISIT_TYPE_OPTIONS.includes(turnData.visit_type)) {
                  setNewConsultation((prev) => ({
                    ...prev,
                    visit_type: turnData.visit_type,
                  }));
                }
              }
            }
          }
        }
      } catch (error) {
        console.error("Error cargando ficha extendida:", error);
      } finally {
        setIsLoading(false);
      }
    }

    loadPatientData();
  }, [patientId, router]);

  const handleFormChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    setNewConsultation({
      ...newConsultation,
      [e.target.name]: e.target.value,
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setAttachmentFile(e.target.files[0]);
    }
  };

  const handleSaveConsultation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isVet || !vetProfile?.id) return;

    setSaving(true);
    setErrorMessage("");

    try {
      let attachmentUrl = null;

      if (attachmentFile) {
        const fileExt = attachmentFile.name.split(".").pop();
        const fileName = `${patientId}_${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("medical-records")
          .upload(fileName, attachmentFile);

        if (uploadError)
          throw new Error("No se pudo subir el archivo adjunto.");

        const { data: urlData } = supabase.storage
          .from("medical-records")
          .getPublicUrl(fileName);

        attachmentUrl = urlData.publicUrl;
      }

      const { data, error } = await supabase
        .from("medical_records")
        .insert([
          {
            pet_id: patientId,
            vet_id: vetProfile.id,
            visit_type: newConsultation.visit_type,
            diagnosis: newConsultation.diagnosis,
            weight: newConsultation.weight
              ? parseFloat(newConsultation.weight)
              : null,
            temperature: newConsultation.temperature
              ? parseFloat(newConsultation.temperature)
              : null,
            vaccine_details: newConsultation.vaccine_details || null,
            attachment_url: attachmentUrl,
          },
        ])
        .select()
        .single();

      if (error) throw error;

      // Si había turno activo en sala de espera, marcarlo como completado
      if (activeTurn) {
        await supabase
          .from("waiting_room")
          .update({ status: "completed" })
          .eq("id", activeTurn.id);
        setActiveTurn(null);
      }

      const entry: Consultation = {
        id: data.id,
        created_at: new Date(data.created_at).toLocaleDateString("es-AR"),
        visit_type: data.visit_type,
        diagnosis: data.diagnosis,
        weight: data.weight?.toString() || "-",
        temperature: data.temperature?.toString() || "-",
        vaccine_details: data.vaccine_details,
        attachment_url: data.attachment_url,
        vetName: vetProfile.name,
        license: vetProfile.license,
      };

      setConsultations([entry, ...consultations]);
      if (data.weight) {
        setPatient({ ...patient, weight: data.weight });
      }

      setSuccessMessage(true);
      setNewConsultation({
        visit_type: "Consulta General",
        diagnosis: "",
        weight: "",
        temperature: "",
        vaccine_details: "",
      });
      setAttachmentFile(null);
      setTimeout(() => setSuccessMessage(false), 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "Error al registrar la consulta");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-petlight flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-petgreen" />
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="min-h-screen bg-petlight flex items-center justify-center flex-col p-4">
        <AlertCircle className="w-16 h-16 text-slate-300 mb-4" />
        <h2 className="text-xl font-bold text-petblue">Ficha no encontrada</h2>
        <Link
          href="/"
          className="mt-4 text-petgreen font-bold text-sm hover:underline"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const petUid = extractUid(patient.cards);
  const owner = extractFirst(patient.profiles);

  return (
    <main className="min-h-screen bg-petlight pb-12 overflow-x-hidden">
      <nav className="bg-petblue text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex flex-wrap justify-between items-center gap-3">
          <Link
            href={
              isVet
                ? "/vet/dashboard"
                : `/pet/${petUid !== "N/A" ? petUid : patientId}`
            }
            className="flex items-center min-h-[44px] gap-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl transition-all border border-white/10"
          >
            <ArrowLeft className="w-4 h-4 text-petgreen" />
            <span>
              {isVet ? "Volver al Panel Clínico" : "Volver a la Ficha Pública"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs min-h-[44px] flex items-center px-3 py-2 rounded-xl border font-semibold whitespace-nowrap ${
                isVet
                  ? "bg-emerald-500/20 text-petgreen border-emerald-500/30"
                  : "bg-white/10 text-slate-200 border-white/10"
              }`}
            >
              ● {isVet ? "Modo Clínico Activo" : "Modo Lectura (Emergencia)"}
            </span>
          </div>
        </div>
      </nav>

      <div className="w-[90%] sm:max-w-6xl mx-auto mt-8 space-y-6">
        {isVet && activeTurn && (
          <div
            className={`rounded-2xl p-4 border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
              activeTurn.priority === "urgent"
                ? "bg-red-50 border-red-200 text-red-900"
                : "bg-emerald-50 border-emerald-200 text-emerald-900"
            }`}
          >
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 shrink-0 mt-0.5 text-petgreen" />
              <div>
                <p className="text-sm font-bold">
                  Turno en Sala: {activeTurn.visit_type}{" "}
                  {activeTurn.priority === "urgent" ? "(URGENTE)" : ""}
                </p>
                {activeTurn.reception_notes && (
                  <p className="text-xs font-medium mt-0.5">
                    Nota de mostrador: {activeTurn.reception_notes}
                  </p>
                )}
              </div>
            </div>
            <span className="text-[11px] font-bold opacity-80">
              Se marcará completado al guardar la consulta
            </span>
          </div>
        )}

        {isBirthday(patient.birth_date) && (
          <div className="bg-gradient-to-r from-amber-100 to-orange-100 border border-amber-200 rounded-2xl p-4 w-full animate-in fade-in flex items-center gap-4 shadow-sm">
            <div className="text-3xl">🎉</div>
            <div>
              <p className="text-base font-bold text-amber-900">
                ¡Hoy es el cumpleaños de {patient.name}!
              </p>
              <p className="text-sm text-amber-800 font-medium">
                Aprovecha para felicitar a su tutor durante la atención.
              </p>
            </div>
          </div>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 w-full">
            <img
              src={
                patient.avatar_url ||
                "https://images.unsplash.com/photo-1543466835-00a7907e9de1?auto=format&fit=crop&q=80"
              }
              alt={patient.name}
              className="w-20 h-20 rounded-2xl object-cover border-2 border-slate-100 shadow-sm shrink-0"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-petblue">
                  {patient.name}
                </h1>
                <span className="bg-petlight px-2.5 py-1 rounded-md text-[11px] font-mono text-slate-600 border border-slate-200 mt-1 sm:mt-0">
                  UID: {petUid}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-1">
                {patient.species} • {patient.breed} • {patient.sex} •{" "}
                {patient.reproductive_status} •{" "}
                {calculateAge(patient.birth_date)}
              </p>
              <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
                <span className="flex items-center gap-1 font-medium">
                  <User className="w-3.5 h-3.5 text-petgreen" /> Tutor:{" "}
                  {owner?.full_name || "Sin tutor"}
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <Phone className="w-3.5 h-3.5 text-petgreen" />{" "}
                  {owner?.phone || "Sin teléfono"}
                  {owner?.phone && (
                    <a
                      href={`https://wa.me/${owner.phone.replace(
                        /[^0-9]/g,
                        ""
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-1 bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold hover:bg-green-200 transition-colors"
                    >
                      WhatsApp
                    </a>
                  )}
                </span>
                <span className="flex items-center gap-1 font-medium">
                  <MapPin className="w-3.5 h-3.5 text-petgreen" />{" "}
                  {owner?.location || "Ubicación desconocida"}
                </span>
              </div>
            </div>
          </div>

          {patient.emergency_notes && (
            <div className="bg-red-50 border border-red-200/80 rounded-xl p-4 w-full md:max-w-xs shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-red-700 flex items-center gap-1 mb-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> Alergias /
                Notas Críticas
              </span>
              <p className="text-xs text-red-900 leading-relaxed font-medium">
                {patient.emergency_notes}
              </p>
            </div>
          )}
        </div>

        <div
          className={`grid grid-cols-1 ${
            isVet ? "lg:grid-cols-3" : "lg:grid-cols-1 max-w-5xl mx-auto"
          } gap-6`}
        >
          {isVet && (
            <div className="lg:col-span-1 bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4 h-fit">
              <div className="border-b border-slate-100 pb-3">
                <h2 className="text-base font-bold text-petblue flex items-center gap-2">
                  <FilePlus className="w-5 h-5 text-petgreen" />
                  <span>Registrar Nueva Consulta</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Firma oficial vinculada a tu matrícula.
                </p>
              </div>

              {successMessage && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2 animate-pulse">
                  <CheckCircle2 className="w-5 h-5 text-petgreen shrink-0" />
                  <span>¡Consulta y archivos guardados!</span>
                </div>
              )}
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <form onSubmit={handleSaveConsultation} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Tipo de Atención <span className="text-red-500">*</span>
                  </label>
                  <select
                    name="visit_type"
                    value={newConsultation.visit_type}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-base min-h-[44px] bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium"
                  >
                    {VISIT_TYPE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Peso (kg)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      name="weight"
                      placeholder="Ej. 32.8"
                      value={newConsultation.weight}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 text-base min-h-[44px] bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                      Temp. (°C)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      name="temperature"
                      placeholder="Ej. 38.4"
                      value={newConsultation.temperature}
                      onChange={handleFormChange}
                      className="w-full px-3 py-2 text-base min-h-[44px] bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Vacuna (Opcional)
                  </label>
                  <input
                    type="text"
                    name="vaccine_details"
                    placeholder="Ej. Séxtuple (Lote #ST-441)"
                    value={newConsultation.vaccine_details}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-base min-h-[44px] bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium placeholder-slate-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Adjuntar Estudio / Archivo
                  </label>
                  <div className="relative">
                    <input
                      type="file"
                      id="file-upload"
                      accept=".pdf,.doc,.docx,image/*"
                      onChange={handleFileChange}
                      className="hidden"
                    />
                    <label
                      htmlFor="file-upload"
                      className={`w-full flex items-center justify-between px-3 py-2 min-h-[44px] bg-petlight border ${
                        attachmentFile
                          ? "border-petgreen text-petgreen"
                          : "border-slate-200 text-slate-400"
                      } rounded-xl cursor-pointer hover:bg-slate-100 transition-colors`}
                    >
                      <span className="text-sm font-medium truncate pr-4">
                        {attachmentFile
                          ? attachmentFile.name
                          : "Subir PDF, Word o Imagen..."}
                      </span>
                      <Paperclip className="w-4 h-4 shrink-0" />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Diagnóstico / Observaciones{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    name="diagnosis"
                    rows={4}
                    required
                    placeholder="Detalle hallazgos clínicos y tratamiento..."
                    value={newConsultation.diagnosis}
                    onChange={handleFormChange}
                    className="w-full px-3 py-2 text-base min-h-[44px] bg-petlight border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-petgreen text-petblue font-medium resize-none placeholder-slate-400"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 bg-petgreen hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl shadow transition-all active:scale-[0.98] disabled:opacity-70 cursor-pointer text-sm mt-4"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Guardando Datos...</span>
                    </>
                  ) : (
                    <span>Registrar y Firmar Historia</span>
                  )}
                </button>
              </form>
            </div>
          )}

          <div
            className={`${
              isVet ? "lg:col-span-2" : "lg:col-span-1"
            } bg-white rounded-2xl p-6 shadow-sm border border-slate-100 space-y-4`}
          >
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-petblue">
                  Historial Clínico Extendido
                </h2>
                <p className="text-xs text-slate-500 hidden sm:block">
                  {isVet
                    ? "Registro inmutable de atenciones veterinarias."
                    : "Lectura pública en caso de emergencia médica."}
                </p>
              </div>
              <span className="text-xs bg-petblue text-white px-3 py-1.5 rounded-lg font-bold whitespace-nowrap">
                {consultations.length} Entradas
              </span>
            </div>

            <div className="space-y-4 pt-2">
              {consultations.length === 0 ? (
                <div className="py-10 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                  No hay registros clínicos previos para este paciente.
                </div>
              ) : (
                consultations.map((item) => (
                  <div
                    key={item.id}
                    className="bg-petlight/60 rounded-2xl p-5 border border-slate-200/60 space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/50 pb-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="bg-petblue text-white px-2.5 py-1 rounded-lg text-xs font-bold">
                          {item.visit_type}
                        </span>
                        <span className="text-xs text-slate-500 flex items-center gap-1 font-medium">
                          <Calendar className="w-3.5 h-3.5 text-petgreen" />{" "}
                          {item.created_at}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-slate-200 w-full sm:w-auto">
                        <ShieldCheck className="w-4 h-4 text-petgreen shrink-0" />
                        <span className="truncate">
                          {item.vetName} ({item.license})
                        </span>
                      </div>
                    </div>

                    <p className="text-sm text-slate-700 leading-relaxed font-medium">
                      {item.diagnosis}
                    </p>

                    <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-600 font-medium">
                      {item.weight !== "-" && (
                        <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          <Weight className="w-3.5 h-3.5 text-petgreen" />{" "}
                          {item.weight} kg
                        </span>
                      )}
                      {item.temperature !== "-" && (
                        <span className="inline-flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
                          <Thermometer className="w-3.5 h-3.5 text-petgreen" />{" "}
                          {item.temperature} °C
                        </span>
                      )}
                      {item.vaccine_details && (
                        <span className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-lg border border-emerald-100 font-semibold">
                          <Syringe className="w-3.5 h-3.5 text-petgreen" />{" "}
                          {item.vaccine_details}
                        </span>
                      )}
                      {item.attachment_url && (
                        <a
                          href={item.attachment_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 hover:bg-blue-100 px-2.5 py-1 rounded-lg border border-blue-200 font-bold transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" /> Ver Adjunto
                          Clínico
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

export default function VetPatientDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-petlight flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-petgreen" />
        </div>
      }
    >
      <VetPatientDetailContent />
    </Suspense>
  );
}